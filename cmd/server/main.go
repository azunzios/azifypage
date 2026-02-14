package main

import (
	"bufio"
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"log"
	"math"
	"mime/multipart"
	"net/http"
	"net/smtp"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/youming-ai/pikpak-downloader/internal/auth"
	"github.com/youming-ai/pikpak-downloader/internal/database"
	"github.com/youming-ai/pikpak-downloader/internal/pikpak"
	"github.com/youming-ai/pikpak-downloader/internal/realdebrid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var globalClient *pikpak.Client
var rdClient *realdebrid.Client
var telegramBotToken string
var telegramAdminChatIDs map[int64]struct{}
var forgotPasswordCooldownMu sync.Mutex
var forgotPasswordCooldown = make(map[string]time.Time)
var premiumAPISemaphore = make(chan struct{}, 1)

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

// generateFolderName creates a folder name from email: username_XXXX (4 random hex chars)
func generateFolderName(email string) string {
	// Extract username from email
	parts := strings.Split(email, "@")
	username := parts[0]

	// Generate 4 random hex characters
	b := make([]byte, 2)
	rand.Read(b)
	suffix := hex.EncodeToString(b)

	return username + "_" + suffix
}

func loadEnv() {
	file, err := os.Open(".env")
	if err != nil {
		fmt.Println("No .env file found, relying on environment variables.")
		return
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := scanner.Text()
		parts := strings.SplitN(line, "=", 2)
		if len(parts) == 2 {
			os.Setenv(strings.TrimSpace(parts[0]), strings.TrimSpace(parts[1]))
		}
	}
}

func main() {
	loadEnv()
	telegramBotToken = strings.TrimSpace(os.Getenv("TELEGRAM_BOT_TOKEN"))
	telegramAdminChatIDs = parseTelegramAdminChatIDs()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// Initialize Google OAuth
	auth.InitGoogleOAuth()
	if auth.IsConfigured() {
		log.Println("✅ Google OAuth configured")
	} else {
		log.Println("⚠️  Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env")
	}

	// Initialize Database
	dbCfg := database.DefaultConfig()
	if err := database.CreateDatabaseIfNotExists(dbCfg); err != nil {
		log.Fatalf("Failed to create database: %v", err)
	}
	if err := database.Connect(dbCfg); err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	if err := database.AutoMigrate(); err != nil {
		log.Fatalf("Failed to migrate database: %v", err)
	}
	if err := database.SeedDefaultPricing(); err != nil {
		log.Printf("Warning: Failed to seed pricing: %v", err)
	}
	if err := database.SeedDefaultBanners(); err != nil {
		log.Printf("Warning: Failed to seed banners: %v", err)
	}
	if err := database.SeedDefaultPosts(); err != nil {
		log.Printf("Warning: Failed to seed posts: %v", err)
	}

	// Initialize Real-Debrid client
	rdAPIKey := strings.TrimSpace(os.Getenv("REALDEBRID_API_KEY"))
	rdClient = realdebrid.NewClient(rdAPIKey)
	if rdAPIKey == "" {
		log.Println("ℹ️ REALDEBRID_API_KEY belum diatur. Mode host premium masih manual.")
	} else {
		log.Println("✅ REALDEBRID_API_KEY terdeteksi. Mode host premium otomatis aktif.")
	}

	// PikPak Client
	username := os.Getenv("PIKPAK_USERNAME")
	password := os.Getenv("PIKPAK_PASSWORD")

	if username == "" || password == "" {
		log.Fatal("PIKPAK_USERNAME and PIKPAK_PASSWORD must be set in .env")
	}

	globalClient = pikpak.NewClient("", "")

	log.Printf("Attempting login as %s...", username)
	if err := globalClient.Login(username, password); err != nil {
		log.Fatalf("Fatal: Initial login failed: %v", err)
	}
	if err := globalClient.RefreshAccessToken(); err != nil {
		log.Printf("Warning: Initial refresh failed: %v", err)
	}
	log.Println("Login successful! Token acquired.")

	// Auth Endpoints
	http.HandleFunc("/api/auth/google", handleGoogleLogin)
	http.HandleFunc("/api/auth/google/callback", handleGoogleCallback)
	http.HandleFunc("/api/auth/login", handleManualLogin)
	http.HandleFunc("/api/auth/register", handleRegister)
	http.HandleFunc("/api/auth/verify-email", handleVerifyEmail)
	http.HandleFunc("/api/auth/forgot-password", handleForgotPassword)
	http.HandleFunc("/api/auth/reset-password", handleResetPassword)
	http.HandleFunc("/api/auth/logout", handleLogout)
	http.HandleFunc("/api/auth/me", handleAuthMe)

	// PikPak API Endpoints (protected)
	http.HandleFunc("/api/files", auth.RequireAuth(handleListFiles))
	http.HandleFunc("/api/file", auth.RequireAuth(handleFileOps))
	http.HandleFunc("/api/file/link", auth.RequireAuth(handleGetDownloadLink))
	http.HandleFunc("/api/file/download", auth.RequireAuth(handleDirectFileDownload))
	http.HandleFunc("/api/folder/manifest", auth.RequireAuth(handleFolderManifest))
	http.HandleFunc("/api/task", auth.RequireAuth(handleAddOfflineTask))

	// User & Database API Endpoints (protected)
	http.HandleFunc("/api/user", auth.RequireAuth(handleGetUser))
	http.HandleFunc("/api/user/photo", auth.RequireAuth(handleUserPhotoUpload))
	http.HandleFunc("/api/user/name", auth.RequireAuth(handleUserNameUpdate))
	http.HandleFunc("/api/user/password", auth.RequireAuth(handleUserPasswordUpdate))
	http.HandleFunc("/api/user/delete", auth.RequireAuth(handleUserDelete))
	http.HandleFunc("/api/user/email", auth.RequireAuth(handleSendVerificationEmail))
	http.HandleFunc("/api/notifications", auth.RequireAuth(handleNotifications))
	http.HandleFunc("/api/transactions", auth.RequireAuth(handleTransactions))
	http.HandleFunc("/api/topups", auth.RequireAuth(handleTopUps))
	http.HandleFunc("/api/hosts", handleGetHosts)     // Public
	http.HandleFunc("/api/pricing", handleGetPricing) // Public
	http.HandleFunc("/api/voucher/preview", auth.RequireAuth(handleVoucherPreview))
	http.HandleFunc("/api/premium/request", auth.RequireAuth(handlePremiumRequest))

	// Admin Endpoints (protected by admin role)
	http.HandleFunc("/api/admin/users", auth.RequireAdmin(handleAdminUsers))
	http.HandleFunc("/api/admin/pricing", auth.RequireAdmin(handleAdminPricing))
	http.HandleFunc("/api/admin/vouchers", auth.RequireAdmin(handleAdminVouchers))
	http.HandleFunc("/api/admin/stats", auth.RequireAdmin(handleAdminStats))
	http.HandleFunc("/api/admin/monitoring", auth.RequireAdmin(handleAdminMonitoring))
	http.HandleFunc("/api/admin/user/balance", auth.RequireAdmin(handleAdminUserBalance))
	http.HandleFunc("/api/admin/topups", auth.RequireAdmin(handleAdminTopUps))
	http.HandleFunc("/api/admin/hosts", auth.RequireAdmin(handleAdminHosts))
	http.HandleFunc("/api/admin/banners", auth.RequireAdmin(handleAdminBanners))
	http.HandleFunc("/api/admin/banners/upload-image", auth.RequireAdmin(handleAdminBannerImageUpload))
	http.HandleFunc("/api/admin/posts/official", auth.RequireAdmin(handleAdminOfficialPosts))

	// Feed Endpoints
	http.HandleFunc("/api/banners", handleBanners)
	http.HandleFunc("/api/posts/official", handleOfficialPosts)
	http.HandleFunc("/api/posts/user", auth.RequireAuth(handleUserPosts))
	http.HandleFunc("/api/posts/user/replies", auth.RequireAuth(handleUserPostReplies))

	// Static files (React SPA)
	fs := http.FileServer(http.Dir("./frontend/dist"))
	http.Handle("/uploads/", http.StripPrefix("/uploads/", http.FileServer(http.Dir("./uploads"))))

	// SPA Handler
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") {
			http.NotFound(w, r)
			return
		}

		path := "./frontend/dist" + r.URL.Path
		_, err := os.Stat(path)
		if os.IsNotExist(err) || r.URL.Path == "/" {
			http.ServeFile(w, r, "./frontend/dist/index.html")
			return
		}

		fs.ServeHTTP(w, r)
	})

	log.Printf("Server starting on http://localhost:%s", port)
	startTelegramAdminBotListener()
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatal(err)
	}
}

// ========== AUTH HANDLERS ==========

func handleGoogleLogin(w http.ResponseWriter, r *http.Request) {
	if !auth.IsConfigured() {
		http.Error(w, "Google OAuth not configured", http.StatusServiceUnavailable)
		return
	}

	state := auth.GenerateState()
	// Store state in cookie for validation
	http.SetCookie(w, &http.Cookie{
		Name:     "oauth_state",
		Value:    state,
		Path:     "/",
		HttpOnly: true,
		MaxAge:   300, // 5 minutes
	})

	url := auth.GetGoogleLoginURL(state)
	http.Redirect(w, r, url, http.StatusTemporaryRedirect)
}

func handleGoogleCallback(w http.ResponseWriter, r *http.Request) {
	// Validate state
	stateCookie, err := r.Cookie("oauth_state")
	if err != nil || stateCookie.Value != r.URL.Query().Get("state") {
		http.Error(w, "Invalid state", http.StatusBadRequest)
		return
	}

	code := r.URL.Query().Get("code")
	if code == "" {
		http.Error(w, "No code provided", http.StatusBadRequest)
		return
	}

	// Exchange code for user info
	googleUser, err := auth.ExchangeCode(context.Background(), code)
	if err != nil {
		log.Printf("Failed to exchange code: %v", err)
		http.Error(w, "Authentication failed", http.StatusInternalServerError)
		return
	}

	// Find or create user in database
	var user database.User
	result := database.DB.Where("email = ?", googleUser.Email).First(&user)
	if result.Error != nil {
		// Generate folder name: username_XXXX
		folderName := generateFolderName(googleUser.Email)

		// Create folder in PikPak
		folderID, err := globalClient.CreateFolder(folderName, "")
		if err != nil {
			log.Printf("Warning: Failed to create PikPak folder: %v", err)
		}

		// Create new user
		user = database.User{
			Name:             firstNonEmpty(strings.TrimSpace(googleUser.Name), googleUser.Email),
			Email:            googleUser.Email,
			EmailVerified:    true,
			Balance:          0,
			PikPakFolderID:   folderID,
			PikPakFolderName: folderName,
		}
		database.DB.Create(&user)
	} else if !user.EmailVerified {
		database.DB.Model(&user).Update("email_verified", true)
		user.EmailVerified = true

		// Welcome notification
		notification := database.Notification{
			UserID:  user.ID,
			Title:   "Selamat datang!",
			Message: fmt.Sprintf("Halo %s! Terima kasih telah bergabung di azify.page", googleUser.Name),
		}
		database.DB.Create(&notification)
	}

	// Create session
	if !user.IsActive {
		http.Error(w, "Akun dinonaktifkan", http.StatusForbidden)
		return
	}
	sessionID := auth.CreateSession(user.ID, user.Email, firstNonEmpty(user.Name, googleUser.Name, user.Email), googleUser.Picture, user.Role)
	auth.SetSessionCookie(w, sessionID)

	// Redirect to home
	http.Redirect(w, r, "/", http.StatusTemporaryRedirect)
}

func handleManualLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Invalid request"})
		return
	}

	if req.Email == "" || req.Password == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Email dan password wajib diisi"})
		return
	}

	// Find user by email
	var user database.User
	if err := database.DB.Where("email = ?", req.Email).First(&user).Error; err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{"error": "Email atau password salah"})
		return
	}

	// Check password
	if !auth.CheckPassword(user.Password, req.Password) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{"error": "Email atau password salah"})
		return
	}

	if !user.IsActive {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(map[string]string{"error": "Akun dinonaktifkan"})
		return
	}

	// Create session
	sessionID := auth.CreateSession(user.ID, user.Email, firstNonEmpty(user.Name, user.Email), "", user.Role)
	auth.SetSessionCookie(w, sessionID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"success": true,
		"message": "Login berhasil",
	})
}

func handleRegister(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Invalid request"})
		return
	}

	if req.Email == "" || req.Password == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Email dan password wajib diisi"})
		return
	}

	if len(req.Password) < 6 {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Password minimal 6 karakter"})
		return
	}

	// Check if email already exists
	var existingUser database.User
	if err := database.DB.Where("email = ?", req.Email).First(&existingUser).Error; err == nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Email sudah terdaftar"})
		return
	}

	// Hash password
	hashedPassword, err := auth.HashPassword(req.Password)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Gagal membuat akun"})
		return
	}

	// Generate folder name: username_XXXX
	folderName := generateFolderName(req.Email)

	// Create folder in PikPak
	folderID, err := globalClient.CreateFolder(folderName, "")
	if err != nil {
		log.Printf("Warning: Failed to create PikPak folder: %v", err)
		// Don't fail registration, folder can be created later
	}

	// Create user
	user := database.User{
		Name:             req.Email,
		Email:            req.Email,
		Password:         hashedPassword,
		IsActive:         true,
		Balance:          0,
		PikPakFolderID:   folderID,
		PikPakFolderName: folderName,
	}
	if err := database.DB.Create(&user).Error; err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Gagal membuat akun"})
		return
	}

	// Welcome notification
	notification := database.Notification{
		UserID:  user.ID,
		Title:   "Selamat datang!",
		Message: "Terima kasih telah bergabung di azify.page",
	}
	database.DB.Create(&notification)

	// Create session and log them in
	sessionID := auth.CreateSession(user.ID, user.Email, firstNonEmpty(user.Name, user.Email), "", user.Role)
	auth.SetSessionCookie(w, sessionID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"success": true,
		"message": "Pendaftaran berhasil",
	})
}

func handleLogout(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie(auth.SessionCookieName)
	if err == nil {
		auth.DeleteSession(cookie.Value)
	}
	auth.ClearSessionCookie(w)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Logged out"})
}

func handleAuthMe(w http.ResponseWriter, r *http.Request) {
	session := auth.GetSessionFromRequest(r)
	if session == nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"authenticated": false})
		return
	}

	var user database.User
	database.DB.First(&user, session.UserID)
	if !user.IsActive {
		cookie, err := r.Cookie(auth.SessionCookieName)
		if err == nil {
			auth.DeleteSession(cookie.Value)
		}
		auth.ClearSessionCookie(w)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"authenticated": false})
		return
	}

	var unreadCount int64
	database.DB.Model(&database.Notification{}).Where("user_id = ? AND is_read = ?", user.ID, false).Count(&unreadCount)
	var totalDownloads int64
	var torrentCount int64
	var premiumCount int64
	database.DB.Model(&database.UserUsage{}).Where("user_id = ?", user.ID).Count(&totalDownloads)
	database.DB.Model(&database.UserUsage{}).Where("user_id = ? AND service_type = ?", user.ID, "torrent").Count(&torrentCount)
	database.DB.Model(&database.UserUsage{}).Where("user_id = ? AND service_type = ?", user.ID, "premium").Count(&premiumCount)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"authenticated":        true,
		"id":                   user.ID,
		"email":                user.Email,
		"name":                 firstNonEmpty(user.Name, session.Name, user.Email),
		"picture":              firstNonEmpty(user.Picture, session.Picture),
		"role":                 user.Role,
		"email_verified":       user.EmailVerified,
		"balance":              user.Balance,
		"balance_formatted":    fmt.Sprintf("Rp %d", user.Balance),
		"total_downloads":      totalDownloads,
		"torrent_count":        torrentCount,
		"premium_count":        premiumCount,
		"unread_notifications": unreadCount,
	})
}

func generateSecureToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(strings.TrimSpace(token)))
	return hex.EncodeToString(sum[:])
}

func appBaseURL(r *http.Request) string {
	base := strings.TrimSpace(os.Getenv("APP_BASE_URL"))
	if base != "" {
		return strings.TrimRight(base, "/")
	}
	scheme := "http"
	if r != nil {
		if r.TLS != nil || strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https") {
			scheme = "https"
		}
		if r.Host != "" {
			return scheme + "://" + r.Host
		}
	}
	return "http://localhost:8080"
}

func sendSMTPMail(to, subject, body string) error {
	host := strings.TrimSpace(os.Getenv("SMTP_HOST"))
	port := strings.TrimSpace(os.Getenv("SMTP_PORT"))
	user := strings.TrimSpace(os.Getenv("SMTP_USER"))
	pass := strings.TrimSpace(os.Getenv("SMTP_PASS"))
	from := strings.TrimSpace(os.Getenv("SMTP_FROM"))
	if from == "" {
		from = user
	}

	if host == "" || port == "" || from == "" {
		return errors.New("SMTP belum dikonfigurasi")
	}

	addr := host + ":" + port
	msg := []byte("From: " + from + "\r\n" +
		"To: " + to + "\r\n" +
		"Subject: " + subject + "\r\n" +
		"MIME-Version: 1.0\r\n" +
		"Content-Type: text/plain; charset=UTF-8\r\n\r\n" +
		body + "\r\n")

	var authSMTP smtp.Auth
	if user != "" && pass != "" {
		authSMTP = smtp.PlainAuth("", user, pass, host)
	}

	return smtp.SendMail(addr, authSMTP, from, []string{to}, msg)
}

func handleSendVerificationEmail(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"message": "Request tidak valid"})
		return
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))
	if email == "" || !strings.Contains(email, "@") || !strings.Contains(email, ".") {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"message": "Email tidak valid"})
		return
	}

	session := auth.GetSessionFromRequest(r)
	var user database.User
	if err := database.DB.First(&user, session.UserID).Error; err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{"message": "User tidak ditemukan"})
		return
	}

	if strings.ToLower(user.Email) != email {
		var exists int64
		database.DB.Model(&database.User{}).
			Where("LOWER(email) = ? AND id <> ?", email, user.ID).
			Count(&exists)
		if exists > 0 {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{"message": "Email sudah digunakan akun lain"})
			return
		}
		user.Email = email
		user.EmailVerified = false
	}

	rawToken, err := generateSecureToken()
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"message": "Gagal membuat token verifikasi"})
		return
	}

	expires := time.Now().Add(24 * time.Hour)
	user.EmailVerifyToken = hashToken(rawToken)
	user.EmailVerifyExp = &expires
	if err := database.DB.Save(&user).Error; err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"message": "Gagal menyimpan verifikasi"})
		return
	}

	verifyURL := fmt.Sprintf("%s/api/auth/verify-email?token=%s", appBaseURL(r), url.QueryEscape(rawToken))
	body := fmt.Sprintf("Halo,\n\nKlik link berikut untuk verifikasi email akun azify.page kamu:\n%s\n\nLink berlaku 24 jam.\n\nJika kamu tidak meminta ini, abaikan email ini.", verifyURL)
	if err := sendSMTPMail(user.Email, "Verifikasi Email azify.page", body); err != nil {
		log.Printf("send verification email failed: %v", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"message": "Gagal mengirim email verifikasi. Periksa SMTP."})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Link verifikasi berhasil dikirim"})
}

func handleVerifyEmail(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	rawToken := strings.TrimSpace(r.URL.Query().Get("token"))
	if rawToken == "" {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte("<h3>Token verifikasi tidak valid.</h3>"))
		return
	}

	now := time.Now()
	tokenHash := hashToken(rawToken)
	var user database.User
	err := database.DB.Where("email_verify_token = ? AND email_verify_exp IS NOT NULL AND email_verify_exp > ?", tokenHash, now).First(&user).Error
	if err != nil {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte("<h3>Token verifikasi tidak ditemukan atau sudah kedaluwarsa.</h3><p><a href=\"/login\">Kembali ke login</a></p>"))
		return
	}

	if err := database.DB.Model(&user).Updates(map[string]any{
		"email_verified":     true,
		"email_verify_token": "",
		"email_verify_exp":   nil,
	}).Error; err != nil {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("<h3>Gagal memverifikasi email. Coba lagi nanti.</h3>"))
		return
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Write([]byte("<h3>Email berhasil diverifikasi.</h3><p><a href=\"/login\">Lanjut login</a></p>"))
}

func handleForgotPassword(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"message": "Request tidak valid"})
		return
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))
	if email == "" || !strings.Contains(email, "@") {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"message": "Jika email terdaftar, link reset akan dikirim."})
		return
	}

	now := time.Now()
	clientIP := strings.TrimSpace(r.Header.Get("X-Forwarded-For"))
	if clientIP == "" {
		clientIP = strings.TrimSpace(r.Header.Get("X-Real-IP"))
	}
	if clientIP == "" {
		clientIP = r.RemoteAddr
	}
	key := email + "|" + clientIP

	forgotPasswordCooldownMu.Lock()
	if until, exists := forgotPasswordCooldown[key]; exists && now.Before(until) {
		retryAfter := int(math.Ceil(until.Sub(now).Seconds()))
		if retryAfter < 1 {
			retryAfter = 1
		}
		forgotPasswordCooldownMu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusTooManyRequests)
		json.NewEncoder(w).Encode(map[string]any{
			"message":     "Tunggu sebentar sebelum minta link reset lagi.",
			"retry_after": retryAfter,
		})
		return
	}
	forgotPasswordCooldown[key] = now.Add(60 * time.Second)
	for k, v := range forgotPasswordCooldown {
		if now.After(v.Add(2 * time.Minute)) {
			delete(forgotPasswordCooldown, k)
		}
	}
	forgotPasswordCooldownMu.Unlock()

	var user database.User
	if err := database.DB.Where("LOWER(email) = ?", email).First(&user).Error; err == nil {
		rawToken, tokenErr := generateSecureToken()
		if tokenErr == nil {
			expires := time.Now().Add(30 * time.Minute)
			updateErr := database.DB.Model(&user).Updates(map[string]any{
				"password_reset_token": hashToken(rawToken),
				"password_reset_exp":   &expires,
			}).Error
			if updateErr == nil {
				resetURL := fmt.Sprintf("%s/reset-password?token=%s", appBaseURL(r), url.QueryEscape(rawToken))
				body := fmt.Sprintf("Halo,\n\nKlik link berikut untuk reset password akun azify.page kamu:\n%s\n\nLink berlaku 30 menit.\n\nJika kamu tidak meminta ini, abaikan email ini.", resetURL)
				if mailErr := sendSMTPMail(user.Email, "Reset Password azify.page", body); mailErr != nil {
					log.Printf("send reset password email failed: %v", mailErr)
				}
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Jika email terdaftar, link reset akan dikirim."})
}

func handleResetPassword(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Token       string `json:"token"`
		NewPassword string `json:"new_password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Request tidak valid"})
		return
	}

	rawToken := strings.TrimSpace(req.Token)
	if rawToken == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Token wajib diisi"})
		return
	}
	if len(req.NewPassword) < 6 {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Password minimal 6 karakter"})
		return
	}

	now := time.Now()
	tokenHash := hashToken(rawToken)
	var user database.User
	if err := database.DB.Where("password_reset_token = ? AND password_reset_exp IS NOT NULL AND password_reset_exp > ?", tokenHash, now).First(&user).Error; err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Token reset tidak valid atau kedaluwarsa"})
		return
	}

	hashedPassword, err := auth.HashPassword(req.NewPassword)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Gagal memproses password"})
		return
	}

	if err := database.DB.Model(&user).Updates(map[string]any{
		"password":             hashedPassword,
		"password_reset_token": "",
		"password_reset_exp":   nil,
	}).Error; err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Gagal reset password"})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"success": true, "message": "Password berhasil direset"})
}

// ========== USER & DATABASE HANDLERS ==========

func handleGetUser(w http.ResponseWriter, r *http.Request) {
	session := auth.GetSessionFromRequest(r)
	var user database.User
	if err := database.DB.First(&user, session.UserID).Error; err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	var unreadCount int64
	database.DB.Model(&database.Notification{}).Where("user_id = ? AND is_read = ?", user.ID, false).Count(&unreadCount)
	var totalDownloads int64
	var torrentCount int64
	var premiumCount int64
	database.DB.Model(&database.UserUsage{}).Where("user_id = ?", user.ID).Count(&totalDownloads)
	database.DB.Model(&database.UserUsage{}).Where("user_id = ? AND service_type = ?", user.ID, "torrent").Count(&torrentCount)
	database.DB.Model(&database.UserUsage{}).Where("user_id = ? AND service_type = ?", user.ID, "premium").Count(&premiumCount)

	response := map[string]any{
		"id":                   user.ID,
		"email":                user.Email,
		"picture":              firstNonEmpty(user.Picture, session.Picture),
		"email_verified":       user.EmailVerified,
		"balance":              user.Balance,
		"balance_formatted":    fmt.Sprintf("Rp %d", user.Balance),
		"total_downloads":      totalDownloads,
		"torrent_count":        torrentCount,
		"premium_count":        premiumCount,
		"unread_notifications": unreadCount,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func handleUserPhotoUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	session := auth.GetSessionFromRequest(r)
	if session == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	if err := r.ParseMultipartForm(2 * 1024 * 1024); err != nil {
		http.Error(w, "Invalid multipart form", http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("photo")
	if err != nil {
		http.Error(w, "photo file is required", http.StatusBadRequest)
		return
	}
	defer file.Close()

	if header.Size > 1*1024*1024 {
		http.Error(w, "ukuran file melebihi 1MB", http.StatusBadRequest)
		return
	}

	buffer := make([]byte, 512)
	n, readErr := file.Read(buffer)
	if readErr != nil && readErr != io.EOF {
		http.Error(w, "gagal membaca file", http.StatusBadRequest)
		return
	}

	contentType := http.DetectContentType(buffer[:n])
	ext := ""
	switch contentType {
	case "image/jpeg":
		ext = ".jpg"
	case "image/png":
		ext = ".png"
	case "image/gif":
		ext = ".gif"
	default:
		http.Error(w, "format gambar tidak didukung (gunakan jpg/png/gif)", http.StatusBadRequest)
		return
	}

	if _, err := file.Seek(0, io.SeekStart); err != nil {
		http.Error(w, "gagal reset file", http.StatusBadRequest)
		return
	}

	uploadDir := filepath.Join(".", "uploads", "profiles")
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		http.Error(w, "Failed to create upload directory", http.StatusInternalServerError)
		return
	}

	randomPart := make([]byte, 8)
	rand.Read(randomPart)
	filename := fmt.Sprintf("profile_%d_%s%s", session.UserID, hex.EncodeToString(randomPart), ext)
	fullPath := filepath.Join(uploadDir, filename)

	outFile, err := os.Create(fullPath)
	if err != nil {
		http.Error(w, "Failed to create image file", http.StatusInternalServerError)
		return
	}
	defer outFile.Close()

	written, err := io.Copy(outFile, io.LimitReader(file, 1*1024*1024+1))
	if err != nil {
		http.Error(w, "Failed to save image", http.StatusInternalServerError)
		return
	}

	if written > 1*1024*1024 {
		os.Remove(fullPath)
		http.Error(w, "ukuran file melebihi 1MB", http.StatusBadRequest)
		return
	}

	urlPath := "/uploads/profiles/" + filename
	if err := database.DB.Model(&database.User{}).Where("id = ?", session.UserID).Update("picture", urlPath).Error; err != nil {
		os.Remove(fullPath)
		http.Error(w, "Failed to update profile picture", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"success":    true,
		"message":    "Foto profil berhasil diperbarui",
		"picture":    urlPath,
		"size_bytes": written,
	})
}

func handleUserNameUpdate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	session := auth.GetSessionFromRequest(r)
	if session == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Invalid request"})
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Nama tidak boleh kosong"})
		return
	}
	if len([]rune(name)) > 80 {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Nama terlalu panjang"})
		return
	}

	if err := database.DB.Model(&database.User{}).Where("id = ?", session.UserID).Update("name", name).Error; err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Gagal mengubah nama"})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"success": true, "name": name})
}

func handleUserPasswordUpdate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	session := auth.GetSessionFromRequest(r)
	if session == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		CurrentPassword string `json:"current_password"`
		NewPassword     string `json:"new_password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Invalid request"})
		return
	}

	if strings.TrimSpace(req.CurrentPassword) == "" || strings.TrimSpace(req.NewPassword) == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Password lama dan baru wajib diisi"})
		return
	}
	if len(req.NewPassword) < 6 {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Password baru minimal 6 karakter"})
		return
	}

	var user database.User
	if err := database.DB.First(&user, session.UserID).Error; err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{"error": "User tidak ditemukan"})
		return
	}

	if !auth.CheckPassword(user.Password, req.CurrentPassword) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Password lama salah"})
		return
	}

	hashedPassword, err := auth.HashPassword(req.NewPassword)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Gagal memproses password"})
		return
	}

	if err := database.DB.Model(&database.User{}).Where("id = ?", session.UserID).Update("password", hashedPassword).Error; err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Gagal mengubah password"})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"success": true, "message": "Password berhasil diubah"})
}

func handleUserDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	session := auth.GetSessionFromRequest(r)
	if session == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	err := database.DB.Transaction(func(tx *gorm.DB) error {
		uid := session.UserID

		if err := tx.Where("user_id = ?", uid).Delete(&database.VoucherUsage{}).Error; err != nil {
			return err
		}
		if err := tx.Where("user_id = ?", uid).Delete(&database.UserPostReply{}).Error; err != nil {
			return err
		}

		var postIDs []uint
		if err := tx.Model(&database.UserPost{}).Where("user_id = ?", uid).Pluck("id", &postIDs).Error; err != nil {
			return err
		}
		if len(postIDs) > 0 {
			if err := tx.Where("post_id IN ?", postIDs).Delete(&database.UserPostReply{}).Error; err != nil {
				return err
			}
		}
		if err := tx.Where("user_id = ?", uid).Delete(&database.UserPost{}).Error; err != nil {
			return err
		}
		if err := tx.Where("user_id = ?", uid).Delete(&database.UserUsage{}).Error; err != nil {
			return err
		}
		if err := tx.Where("user_id = ?", uid).Delete(&database.PremiumRequest{}).Error; err != nil {
			return err
		}
		if err := tx.Where("user_id = ?", uid).Delete(&database.TopUpRequest{}).Error; err != nil {
			return err
		}
		if err := tx.Where("user_id = ?", uid).Delete(&database.Transaction{}).Error; err != nil {
			return err
		}
		if err := tx.Where("user_id = ?", uid).Delete(&database.Notification{}).Error; err != nil {
			return err
		}
		if err := tx.Delete(&database.User{}, uid).Error; err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"message": "Gagal menghapus akun"})
		return
	}

	if cookie, err := r.Cookie(auth.SessionCookieName); err == nil {
		auth.DeleteSession(cookie.Value)
	}
	auth.ClearSessionCookie(w)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"success": true, "message": "Akun berhasil dihapus"})
}

func handleNotifications(w http.ResponseWriter, r *http.Request) {
	session := auth.GetSessionFromRequest(r)

	if r.Method == http.MethodPost {
		var req struct {
			ID      uint `json:"id"`
			MarkAll bool `json:"mark_all"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}

		if req.MarkAll {
			database.DB.Model(&database.Notification{}).Where("user_id = ? AND is_read = ?", session.UserID, false).Update("is_read", true)
			w.WriteHeader(http.StatusOK)
			return
		}

		if req.ID == 0 {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}

		database.DB.Model(&database.Notification{}).Where("id = ? AND user_id = ?", req.ID, session.UserID).Update("is_read", true)
		w.WriteHeader(http.StatusOK)
		return
	}

	var notifications []database.Notification
	database.DB.Where("user_id = ?", session.UserID).Order("created_at desc").Limit(20).Find(&notifications)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(notifications)
}

func handleTransactions(w http.ResponseWriter, r *http.Request) {
	session := auth.GetSessionFromRequest(r)

	pageRaw := strings.TrimSpace(r.URL.Query().Get("page"))
	pageSizeRaw := strings.TrimSpace(r.URL.Query().Get("page_size"))
	usePagination := pageRaw != "" || pageSizeRaw != ""

	if usePagination {
		page := 1
		if v, err := strconv.Atoi(pageRaw); err == nil && v > 0 {
			page = v
		}

		pageSize := 10
		if v, err := strconv.Atoi(pageSizeRaw); err == nil {
			if v < 1 {
				v = 1
			}
			if v > 25 {
				v = 25
			}
			pageSize = v
		}

		var total int64
		database.DB.Model(&database.Transaction{}).Where("user_id = ?", session.UserID).Count(&total)

		totalPages := int((total + int64(pageSize) - 1) / int64(pageSize))
		if totalPages == 0 {
			totalPages = 1
		}
		if page > totalPages {
			page = totalPages
		}

		offset := (page - 1) * pageSize
		var items []database.Transaction
		database.DB.Where("user_id = ?", session.UserID).
			Order("created_at desc").
			Limit(pageSize).
			Offset(offset).
			Find(&items)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"items":       items,
			"page":        page,
			"page_size":   pageSize,
			"total":       total,
			"total_pages": totalPages,
		})
		return
	}

	var transactions []database.Transaction
	database.DB.Where("user_id = ?", session.UserID).Order("created_at desc").Limit(50).Find(&transactions)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(transactions)
}

type topupDestination struct {
	Method  string
	Label   string
	Account string
}

func topupSerialPrefix3(method string) string {
	switch strings.ToLower(strings.TrimSpace(method)) {
	case "gopay":
		return "GOP"
	case "bri":
		return "BRI"
	case "bank_jago":
		return "JGO"
	case "crypto_usdt":
		return "USD"
	default:
		m := strings.ToUpper(strings.TrimSpace(method))
		if len(m) >= 3 {
			return m[:3]
		}
		return (m + "XXX")[:3]
	}
}

func topupNamePrefix3(username string) string {
	// Take first 3 alphanumeric chars, uppercased. Pad with X.
	clean := make([]rune, 0, 3)
	for _, r := range strings.ToUpper(username) {
		if (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') {
			clean = append(clean, r)
		}
		if len(clean) >= 3 {
			break
		}
	}
	for len(clean) < 3 {
		clean = append(clean, 'X')
	}
	return string(clean[:3])
}

func randomBase36(n int) string {
	if n <= 0 {
		return ""
	}
	const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		for i := range b {
			b[i] = alphabet[i%len(alphabet)]
		}
		return string(b)
	}
	for i := range b {
		b[i] = alphabet[int(b[i])%len(alphabet)]
	}
	return string(b)
}

// Requested format:
// (3charmetode)(tanggal+jam)(3char nama)(3 char unik)
// Example: GOP12022614NAR9L1
// dateTime uses DDMMYYHH (local time)
func generateTopupSerial(method string, username string, t time.Time) string {
	prefix := topupSerialPrefix3(method)
	dateTime := t.Format("02010615")
	name3 := topupNamePrefix3(username)
	uniq3 := randomBase36(3)
	return fmt.Sprintf("%s%s%s%s", prefix, dateTime, name3, uniq3)
}

func getTopupDestinations() map[string]topupDestination {
	return map[string]topupDestination{
		"gopay":       {Method: "gopay", Label: "GoPay", Account: "085778135021"},
		"bri":         {Method: "bri", Label: "BRI", Account: "162901006178537"},
		"bank_jago":   {Method: "bank_jago", Label: "Bank Jago", Account: "103325280390"},
		"crypto_usdt": {Method: "crypto_usdt", Label: "Crypto (USDT)", Account: "SEGERA"},
	}
}

func handleTopUps(w http.ResponseWriter, r *http.Request) {
	session := auth.GetSessionFromRequest(r)

	expireUserTopups := func() {
		now := time.Now()
		// Best-effort expiry update for this user.
		database.DB.Model(&database.TopUpRequest{}).
			Where("user_id = ? AND status = ? AND expires_at < ?", session.UserID, "awaiting_payment", now).
			Updates(map[string]any{"status": "expired", "updated_at": now})
	}

	getFailureCountToday := func() int64 {
		now := time.Now()
		start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
		var count int64
		database.DB.Model(&database.TopUpRequest{}).
			Where("user_id = ? AND created_at >= ? AND status IN ?", session.UserID, start, []string{"cancelled", "expired"}).
			Count(&count)
		return count
	}

	findActive := func() (*database.TopUpRequest, bool) {
		var active database.TopUpRequest
		if err := database.DB.Where("user_id = ? AND status IN ?", session.UserID, []string{"awaiting_payment", "pending"}).
			Order("created_at desc").
			First(&active).Error; err != nil {
			return nil, false
		}
		return &active, true
	}

	// Keep statuses fresh.
	expireUserTopups()

	switch r.Method {
	case http.MethodGet:
		pageRaw := strings.TrimSpace(r.URL.Query().Get("page"))
		pageSizeRaw := strings.TrimSpace(r.URL.Query().Get("page_size"))
		usePagination := pageRaw != "" || pageSizeRaw != ""

		if usePagination {
			page := 1
			if v, err := strconv.Atoi(pageRaw); err == nil && v > 0 {
				page = v
			}

			pageSize := 10
			if v, err := strconv.Atoi(pageSizeRaw); err == nil {
				if v < 1 {
					v = 1
				}
				if v > 25 {
					v = 25
				}
				pageSize = v
			}

			var total int64
			database.DB.Model(&database.TopUpRequest{}).Where("user_id = ?", session.UserID).Count(&total)

			totalPages := int((total + int64(pageSize) - 1) / int64(pageSize))
			if totalPages == 0 {
				totalPages = 1
			}
			if page > totalPages {
				page = totalPages
			}

			offset := (page - 1) * pageSize
			var items []database.TopUpRequest
			database.DB.Where("user_id = ?", session.UserID).
				Order("created_at desc").
				Limit(pageSize).
				Offset(offset).
				Find(&items)

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]any{
				"items":       items,
				"page":        page,
				"page_size":   pageSize,
				"total":       total,
				"total_pages": totalPages,
			})
			return
		}

		var reqs []database.TopUpRequest
		database.DB.Where("user_id = ?", session.UserID).Order("created_at desc").Limit(50).Find(&reqs)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(reqs)
		return

	case http.MethodPost:
		// One active topup at a time.
		if active, ok := findActive(); ok {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusConflict)
			json.NewEncoder(w).Encode(map[string]any{
				"error":  "Anda masih punya top up yang sedang berjalan",
				"active": active,
			})
			return
		}

		// Max 3 failures (cancel/expired) per day.
		if getFailureCountToday() >= 3 {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusTooManyRequests)
			json.NewEncoder(w).Encode(map[string]any{
				"error": "Batas pembatalan/expired hari ini sudah tercapai (maks 3 kali). Silakan coba besok.",
			})
			return
		}

		var req struct {
			Amount        int64  `json:"amount"`
			PaymentMethod string `json:"payment_method"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}
		if req.Amount < 5000 {
			http.Error(w, "Minimum top up is 5000", http.StatusBadRequest)
			return
		}
		dests := getTopupDestinations()
		dest, ok := dests[strings.ToLower(strings.TrimSpace(req.PaymentMethod))]
		if !ok {
			http.Error(w, "Unsupported payment method", http.StatusBadRequest)
			return
		}

		var user database.User
		database.DB.First(&user, session.UserID)
		username := user.Email
		if user.PikPakFolderName != "" {
			username = user.PikPakFolderName
		}

		now := time.Now()
		topup := database.TopUpRequest{
			Serial:         generateTopupSerial(dest.Method, username, now),
			UserID:         session.UserID,
			Username:       username,
			Amount:         req.Amount,
			PaymentMethod:  dest.Method,
			PaymentAccount: dest.Account,
			Status:         "awaiting_payment",
			ExpiresAt:      now.Add(30 * time.Minute),
		}
		if err := database.DB.Create(&topup).Error; err != nil {
			http.Error(w, "Failed to create topup request", http.StatusInternalServerError)
			return
		}

		// Notify the user in-app.
		database.DB.Create(&database.Notification{
			UserID:  session.UserID,
			Title:   "Top up dibuat",
			Message: fmt.Sprintf("Top up Rp %d via %s dibuat. Silakan transfer dan konfirmasi sebelum %s.", req.Amount, dest.Label, topup.ExpiresAt.Format("15:04")),
		})

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(topup)
		return

	case http.MethodPatch:
		var req struct {
			ID     uint   `json:"id"`
			Action string `json:"action"` // paid|cancel
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}
		action := strings.ToLower(strings.TrimSpace(req.Action))
		if req.ID == 0 || (action != "paid" && action != "cancel") {
			http.Error(w, "Invalid id/action", http.StatusBadRequest)
			return
		}

		var topup database.TopUpRequest
		if err := database.DB.First(&topup, req.ID).Error; err != nil {
			http.Error(w, "Topup request not found", http.StatusNotFound)
			return
		}
		if topup.UserID != session.UserID {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}

		now := time.Now()
		// Expire if needed.
		if topup.Status == "awaiting_payment" && !topup.ExpiresAt.IsZero() && topup.ExpiresAt.Before(now) {
			topup.Status = "expired"
			_ = database.DB.Save(&topup).Error
		}

		if action == "cancel" {
			if topup.Status != "awaiting_payment" {
				http.Error(w, "Only awaiting_payment topups can be cancelled", http.StatusBadRequest)
				return
			}
			// Max 3 failures/day (cancel/expired) check at cancellation time.
			if getFailureCountToday() >= 3 {
				http.Error(w, "Daily cancellation/expiry limit reached", http.StatusTooManyRequests)
				return
			}
			topup.Status = "cancelled"
			topup.CancelledAt = &now
			if err := database.DB.Save(&topup).Error; err != nil {
				http.Error(w, "Failed to cancel", http.StatusInternalServerError)
				return
			}
			database.DB.Create(&database.Notification{
				UserID:  session.UserID,
				Title:   "Top up dibatalkan",
				Message: fmt.Sprintf("Top up Rp %d dibatalkan.", topup.Amount),
			})
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(topup)
			return
		}

		// action == paid
		if topup.Status != "awaiting_payment" {
			http.Error(w, "Topup is not in awaiting_payment", http.StatusBadRequest)
			return
		}
		if !topup.ExpiresAt.IsZero() && topup.ExpiresAt.Before(now) {
			http.Error(w, "Topup expired", http.StatusBadRequest)
			return
		}
		topup.Status = "pending"
		topup.PaidAt = &now
		if err := database.DB.Save(&topup).Error; err != nil {
			http.Error(w, "Failed to mark paid", http.StatusInternalServerError)
			return
		}

		// Notify the user in-app.
		database.DB.Create(&database.Notification{
			UserID:  session.UserID,
			Title:   "Konfirmasi terkirim",
			Message: fmt.Sprintf("Konfirmasi top up Rp %d terkirim. Status: pending (menunggu admin).", topup.Amount),
		})

		// Notify admin via Telegram bot with inline actions (optional, env-driven).
		_ = sendTelegramPendingTopupWithActions(topup, now)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(topup)
		return

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
}

func handleAdminTopUps(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		page := 1
		if v := strings.TrimSpace(r.URL.Query().Get("page")); v != "" {
			if n, err := strconv.Atoi(v); err == nil && n > 0 {
				page = n
			}
		}
		pageSize := 25
		if v := strings.TrimSpace(r.URL.Query().Get("page_size")); v != "" {
			if n, err := strconv.Atoi(v); err == nil {
				if n < 1 {
					n = 1
				}
				if n > 100 {
					n = 100
				}
				pageSize = n
			}
		}

		var total int64
		database.DB.Model(&database.TopUpRequest{}).Count(&total)

		var pendingCount int64
		database.DB.Model(&database.TopUpRequest{}).Where("status = ?", "pending").Count(&pendingCount)

		totalPages := 0
		if total > 0 {
			totalPages = int(math.Ceil(float64(total) / float64(pageSize)))
		}
		if totalPages > 0 && page > totalPages {
			page = totalPages
		}

		offset := (page - 1) * pageSize
		if offset < 0 {
			offset = 0
		}

		var reqs []database.TopUpRequest
		database.DB.
			Order("CASE WHEN status = 'pending' THEN 0 ELSE 1 END").
			Order("created_at desc").
			Offset(offset).
			Limit(pageSize).
			Find(&reqs)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"items":         reqs,
			"total":         total,
			"pending_count": pendingCount,
			"page":          page,
			"page_size":     pageSize,
			"total_pages":   totalPages,
		})
		return

	case http.MethodPatch:
		var req struct {
			ID     uint   `json:"id"`
			Status string `json:"status"` // approved|rejected
			Reason string `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}
		status := strings.ToLower(strings.TrimSpace(req.Status))
		if req.ID == 0 || (status != "approved" && status != "rejected") {
			http.Error(w, "Invalid id/status", http.StatusBadRequest)
			return
		}

		topup, err := applyTopupDecision(req.ID, status, req.Reason)
		if err != nil {
			switch {
			case errors.Is(err, errTopupNotFound):
				http.Error(w, "Topup request not found", http.StatusNotFound)
				return
			case errors.Is(err, errTopupAlreadyDecided):
				http.Error(w, "Topup request already decided", http.StatusBadRequest)
				return
			default:
				http.Error(w, "Failed to process topup", http.StatusInternalServerError)
				return
			}
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(topup)
		return

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
}

var errTopupNotFound = errors.New("topup not found")
var errTopupAlreadyDecided = errors.New("topup already decided")

func applyTopupDecision(id uint, status string, reason string) (database.TopUpRequest, error) {
	status = strings.ToLower(strings.TrimSpace(status))
	if id == 0 || (status != "approved" && status != "rejected") {
		return database.TopUpRequest{}, fmt.Errorf("invalid decision")
	}

	var topup database.TopUpRequest
	if err := database.DB.First(&topup, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return database.TopUpRequest{}, errTopupNotFound
		}
		return database.TopUpRequest{}, err
	}
	if topup.Status != "pending" {
		return database.TopUpRequest{}, errTopupAlreadyDecided
	}

	now := time.Now()
	cleanReason := strings.TrimSpace(reason)

	if status == "approved" {
		err := database.DB.Transaction(func(tx *gorm.DB) error {
			var user database.User
			if err := tx.First(&user, topup.UserID).Error; err != nil {
				return err
			}

			user.Balance += topup.Amount
			if err := tx.Save(&user).Error; err != nil {
				return err
			}

			trx := database.Transaction{
				UserID:      topup.UserID,
				Amount:      topup.Amount,
				Type:        "topup",
				Description: fmt.Sprintf("Top Up (%s)", topup.PaymentMethod),
			}
			if err := tx.Create(&trx).Error; err != nil {
				return err
			}

			topup.Status = "approved"
			topup.AdminReason = cleanReason
			topup.DecidedAt = &now
			return tx.Save(&topup).Error
		})
		if err != nil {
			return database.TopUpRequest{}, err
		}

		database.DB.Create(&database.Notification{
			UserID:  topup.UserID,
			Title:   "Top up disetujui",
			Message: fmt.Sprintf("Top up Rp %d telah disetujui. %s", topup.Amount, topup.AdminReason),
		})
		return topup, nil
	}

	topup.Status = "rejected"
	topup.AdminReason = cleanReason
	topup.DecidedAt = &now
	if err := database.DB.Save(&topup).Error; err != nil {
		return database.TopUpRequest{}, err
	}
	database.DB.Create(&database.Notification{
		UserID:  topup.UserID,
		Title:   "Top up ditolak",
		Message: fmt.Sprintf("Top up Rp %d ditolak. %s", topup.Amount, topup.AdminReason),
	})

	return topup, nil
}

func parseTelegramAdminChatIDs() map[int64]struct{} {
	ids := make(map[int64]struct{})
	rawSingle := strings.TrimSpace(os.Getenv("TELEGRAM_ADMIN_CHAT_ID"))
	rawMany := strings.TrimSpace(os.Getenv("TELEGRAM_ADMIN_CHAT_IDS"))
	raw := rawSingle
	if rawMany != "" {
		if raw != "" {
			raw += ","
		}
		raw += rawMany
	}
	if raw == "" {
		return ids
	}
	for _, part := range strings.Split(raw, ",") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		v, err := strconv.ParseInt(part, 10, 64)
		if err != nil || v == 0 {
			continue
		}
		ids[v] = struct{}{}
	}
	return ids
}

func isTelegramAdminChat(chatID int64) bool {
	if len(telegramAdminChatIDs) == 0 {
		return false
	}
	_, ok := telegramAdminChatIDs[chatID]
	return ok
}

func telegramPostJSON(method string, payload map[string]any) error {
	if telegramBotToken == "" {
		return nil
	}
	endpoint := fmt.Sprintf("https://api.telegram.org/bot%s/%s", telegramBotToken, method)
	body, _ := json.Marshal(payload)
	req, err := http.NewRequest(http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("telegram %s failed: %s", method, strings.TrimSpace(string(b)))
	}
	return nil
}

func sendTelegramAdminMessage(message string) error {
	if telegramBotToken == "" || len(telegramAdminChatIDs) == 0 {
		return nil // silently skip
	}
	for chatID := range telegramAdminChatIDs {
		if err := telegramPostJSON("sendMessage", map[string]any{
			"chat_id":                  chatID,
			"text":                     message,
			"disable_web_page_preview": true,
		}); err != nil {
			log.Printf("telegram sendMessage failed for chat %d: %v", chatID, err)
		}
	}
	return nil
}

func sendTelegramPendingTopupWithActions(topup database.TopUpRequest, paidAt time.Time) error {
	if telegramBotToken == "" || len(telegramAdminChatIDs) == 0 {
		return nil
	}
	text := fmt.Sprintf(
		"✅ Konfirmasi TopUp (PENDING)\n\nID: %d\nSerial: %s\nUser: %s (user_id=%d)\nNominal: Rp %d\nMetode: %s\nTujuan: %s\nPaidAt: %s\n\nPilih aksi:",
		topup.ID,
		topup.Serial,
		topup.Username,
		topup.UserID,
		topup.Amount,
		topup.PaymentMethod,
		topup.PaymentAccount,
		paidAt.Format(time.RFC3339),
	)
	replyMarkup := map[string]any{
		"inline_keyboard": [][]map[string]string{
			{
				{"text": "✅ ACC", "callback_data": fmt.Sprintf("topup:approve:%d", topup.ID)},
				{"text": "❌ Reject", "callback_data": fmt.Sprintf("topup:reject:%d", topup.ID)},
			},
		},
	}
	for chatID := range telegramAdminChatIDs {
		if err := telegramPostJSON("sendMessage", map[string]any{
			"chat_id":                  chatID,
			"text":                     text,
			"disable_web_page_preview": true,
			"reply_markup":             replyMarkup,
		}); err != nil {
			log.Printf("telegram pending topup message failed for chat %d: %v", chatID, err)
		}
	}
	return nil
}

type telegramGetUpdatesResponse struct {
	OK     bool             `json:"ok"`
	Result []telegramUpdate `json:"result"`
}

type telegramUpdate struct {
	UpdateID      int                    `json:"update_id"`
	Message       *telegramMessage       `json:"message"`
	CallbackQuery *telegramCallbackQuery `json:"callback_query"`
}

type telegramMessage struct {
	MessageID int          `json:"message_id"`
	Chat      telegramChat `json:"chat"`
	Text      string       `json:"text"`
}

type telegramChat struct {
	ID int64 `json:"id"`
}

type telegramCallbackQuery struct {
	ID      string           `json:"id"`
	Data    string           `json:"data"`
	Message *telegramMessage `json:"message"`
}

func startTelegramAdminBotListener() {
	if telegramBotToken == "" {
		return
	}
	if len(telegramAdminChatIDs) == 0 {
		log.Println("ℹ️ Telegram bot token set, but TELEGRAM_ADMIN_CHAT_ID/IDS is empty or invalid. Action bot disabled.")
		return
	}
	go runTelegramLongPolling()
	log.Printf("✅ Telegram admin action bot active (%d admin chat ID)", len(telegramAdminChatIDs))
}

func runTelegramLongPolling() {
	offset := 0
	client := &http.Client{Timeout: 70 * time.Second}

	for {
		endpoint := fmt.Sprintf("https://api.telegram.org/bot%s/getUpdates?timeout=60&offset=%d", telegramBotToken, offset)
		resp, err := client.Get(endpoint)
		if err != nil {
			time.Sleep(2 * time.Second)
			continue
		}

		var data telegramGetUpdatesResponse
		err = json.NewDecoder(resp.Body).Decode(&data)
		resp.Body.Close()
		if err != nil || !data.OK {
			time.Sleep(2 * time.Second)
			continue
		}

		for _, upd := range data.Result {
			if upd.UpdateID >= offset {
				offset = upd.UpdateID + 1
			}
			handleTelegramUpdate(upd)
		}
	}
}

func handleTelegramUpdate(upd telegramUpdate) {
	if upd.CallbackQuery != nil {
		handleTelegramCallback(*upd.CallbackQuery)
		return
	}
	if upd.Message == nil {
		return
	}
	chatID := upd.Message.Chat.ID
	if !isTelegramAdminChat(chatID) {
		return
	}
	text := strings.TrimSpace(upd.Message.Text)
	if text == "/start" || text == "/help" {
		_ = telegramPostJSON("sendMessage", map[string]any{
			"chat_id": chatID,
			"text":    "Bot admin aktif. Saat ada top up pending, gunakan tombol ✅ ACC atau ❌ Reject dari notifikasi.",
		})
	}
}

func handleTelegramCallback(cb telegramCallbackQuery) {
	if cb.Message == nil {
		return
	}
	chatID := cb.Message.Chat.ID
	if !isTelegramAdminChat(chatID) {
		_ = telegramPostJSON("answerCallbackQuery", map[string]any{
			"callback_query_id": cb.ID,
			"text":              "Unauthorized",
			"show_alert":        false,
		})
		return
	}

	parts := strings.Split(strings.TrimSpace(cb.Data), ":")
	if len(parts) != 3 || parts[0] != "topup" {
		_ = telegramPostJSON("answerCallbackQuery", map[string]any{
			"callback_query_id": cb.ID,
			"text":              "Aksi tidak dikenali",
			"show_alert":        false,
		})
		return
	}

	action := strings.ToLower(strings.TrimSpace(parts[1]))
	id64, err := strconv.ParseUint(strings.TrimSpace(parts[2]), 10, 64)
	if err != nil || id64 == 0 {
		_ = telegramPostJSON("answerCallbackQuery", map[string]any{
			"callback_query_id": cb.ID,
			"text":              "ID topup tidak valid",
			"show_alert":        false,
		})
		return
	}

	status := ""
	reason := "Diproses via Telegram"
	if action == "approve" {
		status = "approved"
		reason = "Disetujui via Telegram"
	} else if action == "reject" {
		status = "rejected"
		reason = "Ditolak via Telegram"
	} else {
		_ = telegramPostJSON("answerCallbackQuery", map[string]any{
			"callback_query_id": cb.ID,
			"text":              "Aksi tidak valid",
			"show_alert":        false,
		})
		return
	}

	topup, err := applyTopupDecision(uint(id64), status, reason)
	if err != nil {
		msg := "Gagal memproses"
		if errors.Is(err, errTopupNotFound) {
			msg = "Top up tidak ditemukan"
		} else if errors.Is(err, errTopupAlreadyDecided) {
			msg = "Top up sudah diputus"
		}
		_ = telegramPostJSON("answerCallbackQuery", map[string]any{
			"callback_query_id": cb.ID,
			"text":              msg,
			"show_alert":        false,
		})
		return
	}

	_ = telegramPostJSON("answerCallbackQuery", map[string]any{
		"callback_query_id": cb.ID,
		"text":              "Berhasil",
		"show_alert":        false,
	})

	_ = telegramPostJSON("sendMessage", map[string]any{
		"chat_id": chatID,
		"text":    fmt.Sprintf("Top up #%d (%s) berhasil %s via Telegram.", topup.ID, topup.Serial, topup.Status),
	})

	// Remove buttons so it cannot be clicked repeatedly from the same message.
	_ = telegramPostJSON("editMessageReplyMarkup", map[string]any{
		"chat_id":    chatID,
		"message_id": cb.Message.MessageID,
		"reply_markup": map[string]any{
			"inline_keyboard": [][]map[string]string{},
		},
	})
}

func handleGetHosts(w http.ResponseWriter, r *http.Request) {
	var hostSettings []database.HostAvailability
	database.DB.Order("name asc").Find(&hostSettings)

	hosts := make([]realdebrid.SimplifiedHost, 0, len(hostSettings))
	for _, hs := range hostSettings {
		status := "down"
		if hs.IsAvailable {
			status = "online"
		}
		hosts = append(hosts, realdebrid.SimplifiedHost{
			Name:   hs.Name,
			Status: status,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(hosts)
}

func acquirePremiumAPISlot(ctx context.Context) error {
	for {
		select {
		case premiumAPISemaphore <- struct{}{}:
			return nil
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(150 * time.Millisecond):
		}
	}
}

func releasePremiumAPISlot() {
	select {
	case <-premiumAPISemaphore:
	default:
	}
}

func mapRealDebridError(err error) (status int, message string) {
	if err == nil {
		return http.StatusBadRequest, "Gagal memproses request Real-Debrid"
	}
	msg := err.Error()
	lower := strings.ToLower(msg)

	if strings.Contains(lower, "bad_token") || strings.Contains(lower, "error_code\": 8") {
		return http.StatusUnauthorized, "REALDEBRID_API_KEY tidak valid. Silakan ganti token dari halaman apitoken."
	}
	if strings.Contains(lower, "error_code\": 34") || strings.Contains(lower, "too many requests") {
		return http.StatusTooManyRequests, "Terlalu banyak request ke Real-Debrid. Coba lagi sebentar."
	}
	if strings.Contains(lower, "error_code\": 22") {
		return http.StatusForbidden, "IP address tidak diizinkan oleh Real-Debrid untuk token ini."
	}
	if strings.Contains(lower, "error_code\": 16") {
		return http.StatusBadRequest, "Host/link belum didukung oleh Real-Debrid."
	}
	if strings.Contains(lower, "error_code\": 17") || strings.Contains(lower, "error_code\": 19") {
		return http.StatusServiceUnavailable, "Host sedang maintenance / sementara tidak tersedia."
	}

	return http.StatusBadRequest, "Gagal memproses link host premium"
}

type voucherApplyResult struct {
	Code     string
	Discount int64
	Final    int64
}

func computeVoucherDiscount(v database.Voucher, basePrice int64) int64 {
	if basePrice <= 0 {
		return 0
	}

	var discount int64
	switch strings.ToLower(strings.TrimSpace(v.DiscountType)) {
	case "fixed":
		discount = v.DiscountValue
	default:
		discount = (basePrice * v.DiscountValue) / 100
	}

	if discount < 0 {
		discount = 0
	}
	if v.MinDiscountAmount > 0 && discount < v.MinDiscountAmount {
		discount = v.MinDiscountAmount
	}
	if v.MaxDiscountAmount > 0 && discount > v.MaxDiscountAmount {
		discount = v.MaxDiscountAmount
	}
	if discount > basePrice {
		discount = basePrice
	}

	return discount
}

func applyVoucherInTx(tx *gorm.DB, rawCode string, serviceType string, basePrice int64, userID uint) (*voucherApplyResult, error) {
	code := strings.ToUpper(strings.TrimSpace(rawCode))
	if code == "" {
		return &voucherApplyResult{Code: "", Discount: 0, Final: basePrice}, nil
	}

	var v database.Voucher
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("UPPER(code) = ?", code).First(&v).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("voucher_not_found")
		}
		return nil, err
	}

	if !v.IsActive {
		return nil, fmt.Errorf("voucher_inactive")
	}
	appliesTo := strings.ToLower(strings.TrimSpace(v.AppliesTo))
	if appliesTo != "" && appliesTo != "all" && appliesTo != strings.ToLower(serviceType) {
		return nil, fmt.Errorf("voucher_not_applicable")
	}
	now := time.Now()
	if v.StartsAt != nil && now.Before(*v.StartsAt) {
		return nil, fmt.Errorf("voucher_not_started")
	}
	if v.EndsAt != nil && now.After(*v.EndsAt) {
		return nil, fmt.Errorf("voucher_expired")
	}

	usageScope := strings.ToLower(strings.TrimSpace(v.UsageScope))
	if usageScope == "" {
		usageScope = "global"
	}

	if v.UsageLimit > 0 {
		if usageScope == "per_user" {
			var userUsageCount int64
			if err := tx.Model(&database.VoucherUsage{}).
				Where("voucher_id = ? AND user_id = ?", v.ID, userID).
				Count(&userUsageCount).Error; err != nil {
				return nil, err
			}
			if int(userUsageCount) >= v.UsageLimit {
				return nil, fmt.Errorf("voucher_limit_reached")
			}
		} else {
			if v.UsedCount >= v.UsageLimit {
				return nil, fmt.Errorf("voucher_limit_reached")
			}
		}
	}
	if v.MinOrderAmount > 0 && basePrice < v.MinOrderAmount {
		return nil, fmt.Errorf("voucher_min_order")
	}

	discount := computeVoucherDiscount(v, basePrice)
	finalPrice := basePrice - discount
	if finalPrice < 0 {
		finalPrice = 0
	}

	if err := tx.Model(&database.Voucher{}).
		Where("id = ?", v.ID).
		Update("used_count", gorm.Expr("used_count + 1")).Error; err != nil {
		return nil, err
	}

	if err := tx.Create(&database.VoucherUsage{
		VoucherID: v.ID,
		UserID:    userID,
	}).Error; err != nil {
		return nil, err
	}

	return &voucherApplyResult{Code: v.Code, Discount: discount, Final: finalPrice}, nil
}

func handlePremiumRequest(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		session := auth.GetSessionFromRequest(r)
		page := 1
		if raw := strings.TrimSpace(r.URL.Query().Get("page")); raw != "" {
			if v, err := strconv.Atoi(raw); err == nil && v > 0 {
				page = v
			}
		}

		pageSize := 25
		if raw := strings.TrimSpace(r.URL.Query().Get("page_size")); raw != "" {
			if v, err := strconv.Atoi(raw); err == nil {
				if v < 1 {
					v = 1
				}
				if v > 25 {
					v = 25
				}
				pageSize = v
			}
		}

		var total int64
		database.DB.Model(&database.PremiumRequest{}).Where("user_id = ?", session.UserID).Count(&total)

		totalPages := int((total + int64(pageSize) - 1) / int64(pageSize))
		if totalPages == 0 {
			totalPages = 1
		}
		if page > totalPages {
			page = totalPages
		}

		offset := (page - 1) * pageSize

		var reqs []database.PremiumRequest
		database.DB.Where("user_id = ?", session.UserID).
			Order("created_at desc").
			Limit(pageSize).
			Offset(offset).
			Find(&reqs)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"items":       reqs,
			"page":        page,
			"page_size":   pageSize,
			"total":       total,
			"total_pages": totalPages,
		})
		return
	}

	if r.Method == http.MethodDelete {
		session := auth.GetSessionFromRequest(r)
		idRaw := strings.TrimSpace(r.URL.Query().Get("id"))
		allRaw := strings.TrimSpace(r.URL.Query().Get("all"))

		if allRaw == "1" || strings.EqualFold(allRaw, "true") {
			if err := database.DB.Where("user_id = ?", session.UserID).Delete(&database.PremiumRequest{}).Error; err != nil {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				json.NewEncoder(w).Encode(map[string]any{
					"message": "Gagal menghapus riwayat host premium",
					"error":   err.Error(),
				})
				return
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]any{
				"message": "Riwayat host premium berhasil dihapus",
			})
			return
		}

		id, err := strconv.Atoi(idRaw)
		if err != nil || id <= 0 {
			http.Error(w, "id atau all wajib diisi", http.StatusBadRequest)
			return
		}

		res := database.DB.Where("id = ? AND user_id = ?", id, session.UserID).Delete(&database.PremiumRequest{})
		if res.Error != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]any{
				"message": "Gagal menghapus item riwayat",
				"error":   res.Error.Error(),
			})
			return
		}
		if res.RowsAffected == 0 {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusNotFound)
			json.NewEncoder(w).Encode(map[string]any{
				"message": "Data riwayat tidak ditemukan",
			})
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"message": "Item riwayat berhasil dihapus",
		})
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	session := auth.GetSessionFromRequest(r)

	var req struct {
		URL             string  `json:"url"`
		Voucher         string  `json:"voucher"`
		EstimatedSizeGB float64 `json:"estimated_size_gb"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}
	req.URL = strings.TrimSpace(req.URL)
	req.Voucher = strings.TrimSpace(req.Voucher)
	if req.EstimatedSizeGB < 0 {
		req.EstimatedSizeGB = 0
	}
	if req.URL == "" {
		http.Error(w, "URL wajib diisi", http.StatusBadRequest)
		return
	}

	if strings.TrimSpace(rdClient.APIKey) != "" {
		if err := acquirePremiumAPISlot(r.Context()); err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusRequestTimeout)
			json.NewEncoder(w).Encode(map[string]any{
				"message": "Request dibatalkan sebelum diproses",
			})
			return
		}
		defer releasePremiumAPISlot()

		checkInfo, err := rdClient.CheckLink(req.URL)
		if err != nil {
			status, friendly := mapRealDebridError(err)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(status)
			json.NewEncoder(w).Encode(map[string]any{
				"message": friendly,
				"error":   err.Error(),
			})
			return
		}
		if !checkInfo.Supported {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]any{
				"message": "Host/link belum didukung oleh Real-Debrid",
			})
			return
		}

		priceCfg, err := database.GetPricing("premium")
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusServiceUnavailable)
			json.NewEncoder(w).Encode(map[string]any{
				"message": "Pricing premium belum tersedia",
				"error":   err.Error(),
			})
			return
		}

		fileSize := checkInfo.Filesize
		if fileSize < 0 {
			fileSize = 0
		}
		if fileSize <= 0 && req.EstimatedSizeGB > 0 {
			fileSize = int64(req.EstimatedSizeGB * 1024 * 1024 * 1024)
		}
		price, chargedUnits, chargedGB := priceCfg.CalculatePrice(fileSize)
		if price <= 0 {
			price = priceCfg.PricePerUnit
			chargedUnits = 1
			chargedGB = priceCfg.UnitSizeGB
		}

		var unrestricted realdebrid.UnrestrictedLinkResult
		streamURL := ""
		sizeGB := "0 GB"

		var savedReq database.PremiumRequest
		voucherApplied := ""
		voucherDiscount := int64(0)
		finalPrice := price
		var currentBalance int64
		txErr := database.DB.Transaction(func(tx *gorm.DB) error {
			if strings.TrimSpace(req.Voucher) != "" {
				voucherResult, vErr := applyVoucherInTx(tx, req.Voucher, "premium", price, session.UserID)
				if vErr != nil {
					return vErr
				}
				voucherApplied = voucherResult.Code
				voucherDiscount = voucherResult.Discount
				finalPrice = voucherResult.Final
			}

			var user database.User
			if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&user, session.UserID).Error; err != nil {
				return err
			}
			if user.Balance < finalPrice {
				currentBalance = user.Balance
				return fmt.Errorf("insufficient_balance")
			}

			user.Balance -= finalPrice
			currentBalance = user.Balance
			if err := tx.Model(&database.User{}).Where("id = ?", user.ID).Update("balance", user.Balance).Error; err != nil {
				return err
			}

			unrestricted, err = rdClient.UnrestrictLink(req.URL)
			if err != nil {
				return fmt.Errorf("unrestrict_failed: %w", err)
			}

			fileSize = unrestricted.Filesize
			if fileSize <= 0 {
				fileSize = checkInfo.Filesize
			}
			if fileSize <= 0 && req.EstimatedSizeGB > 0 {
				fileSize = int64(req.EstimatedSizeGB * 1024 * 1024 * 1024)
			}
			if fileSize > 0 {
				sizeGB = fmt.Sprintf("%.2f GB", float64(fileSize)/float64(1024*1024*1024))
			}

			if unrestricted.ID != "" {
				if s, streamErr := rdClient.GetStreamingLink(unrestricted.ID); streamErr == nil {
					streamURL = strings.TrimSpace(s)
				} else {
					log.Printf("realdebrid streaming link skipped: %v", streamErr)
				}
			}

			savedReq = database.PremiumRequest{
				UserID:    session.UserID,
				URL:       req.URL,
				Filename:  unrestricted.Filename,
				Host:      unrestricted.Host,
				SizeBytes: fileSize,
				Price:     finalPrice,
				Status:    "done",
				ResultURL: unrestricted.Download,
				StreamURL: streamURL,
			}
			if err := tx.Create(&savedReq).Error; err != nil {
				return err
			}

			if err := tx.Create(&database.Transaction{
				UserID:      session.UserID,
				Amount:      -finalPrice,
				Type:        "download",
				Description: func() string {
					if voucherApplied != "" && voucherDiscount > 0 {
						return fmt.Sprintf("Premium Host: %s (%d GB) - Rp %d (Voucher %s -Rp %d)", unrestricted.Filename, chargedGB, finalPrice, voucherApplied, voucherDiscount)
					}
					return fmt.Sprintf("Premium Host: %s (%d GB) - Rp %d", unrestricted.Filename, chargedGB, finalPrice)
				}(),
			}).Error; err != nil {
				return err
			}

			if err := tx.Create(&database.UserUsage{
				UserID:      session.UserID,
				ServiceType: "premium",
				Source:      req.URL,
			}).Error; err != nil {
				return err
			}

			notifMsg := fmt.Sprintf("Link premium siap diunduh. %s (%s). Biaya: Rp %d.", unrestricted.Filename, sizeGB, finalPrice)
			if voucherApplied != "" && voucherDiscount > 0 {
				notifMsg += fmt.Sprintf(" Voucher %s dipakai (-Rp %d).", voucherApplied, voucherDiscount)
			}
			if streamURL != "" {
				notifMsg += " Tersedia juga link streaming."
			}
			if err := tx.Create(&database.Notification{
				UserID:  session.UserID,
				Title:   "Link premium siap",
				Message: notifMsg,
			}).Error; err != nil {
				return err
			}

			return nil
		})
		if txErr != nil {
			errLower := strings.ToLower(txErr.Error())
			if strings.Contains(errLower, "unrestrict_failed:") {
				errMsg := txErr.Error()
				if idx := strings.Index(errMsg, ":"); idx >= 0 && idx+1 < len(errMsg) {
					errMsg = strings.TrimSpace(errMsg[idx+1:])
				}
				status, friendly := mapRealDebridError(errors.New(errMsg))
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(status)
				json.NewEncoder(w).Encode(map[string]any{
					"message": friendly,
					"error":   errMsg,
				})
				return
			}
			if strings.Contains(errLower, "voucher_") {
				friendly := "Voucher tidak valid"
				switch {
				case strings.Contains(errLower, "voucher_not_found"):
					friendly = "Kode voucher tidak ditemukan"
				case strings.Contains(errLower, "voucher_inactive"):
					friendly = "Voucher sedang tidak aktif"
				case strings.Contains(errLower, "voucher_not_applicable"):
					friendly = "Voucher tidak berlaku untuk layanan ini"
				case strings.Contains(errLower, "voucher_not_started"):
					friendly = "Voucher belum mulai berlaku"
				case strings.Contains(errLower, "voucher_expired"):
					friendly = "Voucher sudah kedaluwarsa"
				case strings.Contains(errLower, "voucher_limit_reached"):
					friendly = "Kuota voucher sudah habis"
				case strings.Contains(errLower, "voucher_min_order"):
					friendly = "Nominal belum memenuhi syarat minimal voucher"
				}
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusBadRequest)
				json.NewEncoder(w).Encode(map[string]any{
					"message": friendly,
					"error":   txErr.Error(),
				})
				return
			}

			if strings.Contains(strings.ToLower(txErr.Error()), "insufficient_balance") {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusPaymentRequired)
				json.NewEncoder(w).Encode(map[string]any{
					"message":         "Saldo tidak mencukupi untuk URL premium ini",
					"required_price":  finalPrice,
					"original_price":  price,
					"discount_amount": voucherDiscount,
					"voucher_code":    voucherApplied,
					"required_units":  chargedUnits,
					"required_gb":     chargedGB,
					"current_balance": currentBalance,
					"size_gb":         fmt.Sprintf("%d GB", chargedGB),
				})
				return
			}
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]any{
				"message": "Gagal menyimpan transaksi premium",
				"error":   txErr.Error(),
			})
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"message":       "Link premium valid dan siap diunduh",
			"id":            savedReq.ID,
			"mode":          "automatic",
			"filename":      unrestricted.Filename,
			"host":          unrestricted.Host,
			"size_bytes":    fileSize,
			"size_gb":       sizeGB,
			"price":         finalPrice,
			"original_price": price,
			"discount_amount": voucherDiscount,
			"voucher_code":   voucherApplied,
			"charged_units": chargedUnits,
			"charged_gb":    chargedGB,
			"current_balance_after": currentBalance,
			"download_url":  unrestricted.Download,
			"stream_url":    streamURL,
			"status":        "done",
		})
		return
	}

	premiumReq := database.PremiumRequest{
		UserID: session.UserID,
		URL:    req.URL,
		Status: "pending",
	}
	if err := database.DB.Create(&premiumReq).Error; err != nil {
		http.Error(w, "Failed to create request", http.StatusInternalServerError)
		return
	}
	_ = database.DB.Create(&database.UserUsage{
		UserID:      session.UserID,
		ServiceType: "premium",
		Source:      req.URL,
	}).Error

	notification := database.Notification{
		UserID:  session.UserID,
		Title:   "Request diterima",
		Message: fmt.Sprintf("Request untuk %s sedang diproses. Estimasi: 15-60 menit.", req.URL),
	}
	database.DB.Create(&notification)

	response := map[string]any{
		"message": "Request berhasil dikirim! Anda akan menerima notifikasi saat selesai.",
		"id":      premiumReq.ID,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// ========== PIKPAK HANDLERS ==========

func handleListFiles(w http.ResponseWriter, r *http.Request) {
	session := auth.GetSessionFromRequest(r)
	var user database.User
	database.DB.First(&user, session.UserID)

	parentID := r.URL.Query().Get("parent_id")

	// If no parent_id specified and user has a folder, use user's folder as root
	if parentID == "" && user.PikPakFolderID != "" {
		parentID = user.PikPakFolderID
	}

	files, err := globalClient.ListFiles(parentID)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to list files: %v", err), http.StatusInternalServerError)
		return
	}

	type FileResponse struct {
		pikpak.File
		SizeStr     string `json:"size_str"`
		ModifiedStr string `json:"modified_str"`
	}

	var resp []FileResponse
	for _, f := range files {
		var sizeBytes int64
		fmt.Sscanf(f.Size, "%d", &sizeBytes)

		resp = append(resp, FileResponse{
			File:        f,
			SizeStr:     pikpak.FormatBytes(sizeBytes),
			ModifiedStr: pikpak.FormatTime(f.Modified),
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func handleGetDownloadLink(w http.ResponseWriter, r *http.Request) {
	fileID := r.URL.Query().Get("file_id")
	if fileID == "" {
		http.Error(w, "file_id is required", http.StatusBadRequest)
		return
	}

	link, err := globalClient.GetDownloadUrl(fileID)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to get link: %v", err), http.StatusInternalServerError)
		return
	}

	response := map[string]string{"link": link}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func handleDirectFileDownload(w http.ResponseWriter, r *http.Request) {
	fileID := strings.TrimSpace(r.URL.Query().Get("file_id"))
	if fileID == "" {
		http.Error(w, "file_id is required", http.StatusBadRequest)
		return
	}

	fileName := strings.TrimSpace(r.URL.Query().Get("file_name"))
	if fileName == "" {
		fileName = "download"
	}

	link, err := globalClient.GetDownloadUrl(fileID)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to get link: %v", err), http.StatusInternalServerError)
		return
	}

	upReq, err := http.NewRequest(http.MethodGet, link, nil)
	if err != nil {
		http.Error(w, "Failed to create upstream request", http.StatusInternalServerError)
		return
	}

	upResp, err := http.DefaultClient.Do(upReq)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to fetch file: %v", err), http.StatusBadGateway)
		return
	}
	defer upResp.Body.Close()

	if upResp.StatusCode < 200 || upResp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(upResp.Body, 4096))
		http.Error(w, fmt.Sprintf("Upstream download failed: status %d, body: %s", upResp.StatusCode, string(body)), http.StatusBadGateway)
		return
	}

	contentType := upResp.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	w.Header().Set("Content-Type", contentType)
	if cl := upResp.Header.Get("Content-Length"); cl != "" {
		w.Header().Set("Content-Length", cl)
	}
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename*=UTF-8''%s", url.QueryEscape(fileName)))

	if _, err := io.Copy(w, upResp.Body); err != nil {
		return
	}
}

func handleFileOps(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	fileID := strings.TrimSpace(r.URL.Query().Get("file_id"))
	if fileID == "" {
		http.Error(w, "file_id is required", http.StatusBadRequest)
		return
	}

	if err := globalClient.DeleteFile(fileID); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]any{
			"message": "Gagal menghapus file",
			"error":   err.Error(),
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "File berhasil dihapus"})
}

func handleAddOfflineTask(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodDelete {
		handleDeleteTask(w, r)
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		URL     string `json:"url"`
		Voucher string `json:"voucher"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	req.URL = strings.TrimSpace(req.URL)
	req.Voucher = strings.TrimSpace(req.Voucher)
	if req.URL == "" {
		http.Error(w, "url is required", http.StatusBadRequest)
		return
	}

	// Get user's folder to scope the download
	session := auth.GetSessionFromRequest(r)
	var user database.User
	database.DB.First(&user, session.UserID)

	// Add task to user's folder
	res, err := globalClient.AddOfflineTaskToFolder(req.URL, user.PikPakFolderID)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to add task: %v", err), http.StatusInternalServerError)
		return
	}

	var name, sizeStr, id, phase, progress string
	var sizeBytes int64
	var isCached bool

	if task, ok := res["task"].(map[string]any); ok {
		id, _ = task["id"].(string)
		name, _ = task["name"].(string)
		sizeStr, _ = task["file_size"].(string)
		phase, _ = task["phase"].(string)
		progress, _ = task["progress"].(string)
	} else if file, ok := res["file"].(map[string]any); ok {
		id, _ = file["id"].(string)
		name, _ = file["name"].(string)
		sizeStr, _ = file["size"].(string)
		phase = "PHASE_TYPE_COMPLETE"
		progress = "100"
	} else {
		if n, ok := res["name"].(string); ok {
			name = n
		}
		if i, ok := res["id"].(string); ok {
			id = i
		}
		phase, _ = res["phase"].(string)
	}

	estimation := "Calculating..."
	if phase == "PHASE_TYPE_COMPLETE" || progress == "100" {
		isCached = true
		estimation = "Instant (Cached)"
	} else {
		isCached = false
		estimation = "Not Cached (Downloading by Server)"
	}

	fmt.Sscanf(sizeStr, "%d", &sizeBytes)

	// Get pricing from database
	pricing, err := database.GetPricing("torrent")
	var price int64
	var chargedUnits, chargedGB int

	if err == nil {
		price, chargedUnits, chargedGB = pricing.CalculatePrice(sizeBytes)
	} else {
		// Fallback to default pricing
		sizeGB := float64(sizeBytes) / (1024 * 1024 * 1024)
		chargedGB = int(math.Ceil(sizeGB))
		if chargedGB < 1 && sizeBytes > 0 {
			chargedGB = 1
		}
		if chargedGB < 1 {
			chargedGB = 1
		}
		price = int64(chargedGB * 650)
	}
	if price <= 0 {
		if err == nil && pricing.PricePerUnit > 0 {
			price = pricing.PricePerUnit
			chargedUnits = 1
			chargedGB = pricing.UnitSizeGB
			if chargedGB <= 0 {
				chargedGB = 1
			}
		} else {
			price = 650
			chargedUnits = 1
			chargedGB = 1
		}
	}

	sizeGB := float64(sizeBytes) / (1024 * 1024 * 1024)
	voucherApplied := ""
	voucherDiscount := int64(0)
	finalPrice := price
	var currentBalance int64
	txErr := database.DB.Transaction(func(tx *gorm.DB) error {
		if strings.TrimSpace(req.Voucher) != "" {
			voucherResult, vErr := applyVoucherInTx(tx, req.Voucher, "torrent", price, session.UserID)
			if vErr != nil {
				return vErr
			}
			voucherApplied = voucherResult.Code
			voucherDiscount = voucherResult.Discount
			finalPrice = voucherResult.Final
		}

		var user database.User
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&user, session.UserID).Error; err != nil {
			return err
		}
		if user.Balance < finalPrice {
			currentBalance = user.Balance
			return fmt.Errorf("insufficient_balance")
		}

		user.Balance -= finalPrice
		currentBalance = user.Balance
		if err := tx.Model(&database.User{}).Where("id = ?", user.ID).Update("balance", user.Balance).Error; err != nil {
			return err
		}

		if err := tx.Create(&database.Transaction{
			UserID:      session.UserID,
			Amount:      -finalPrice,
			Type:        "download",
			Description: func() string {
				if voucherApplied != "" && voucherDiscount > 0 {
					return fmt.Sprintf("Torrent/Magnet: %s (%d GB) - Rp %d (Voucher %s -Rp %d)", name, chargedGB, finalPrice, voucherApplied, voucherDiscount)
				}
				return fmt.Sprintf("Torrent/Magnet: %s (%d GB) - Rp %d", name, chargedGB, finalPrice)
			}(),
		}).Error; err != nil {
			return err
		}

		if err := tx.Create(&database.UserUsage{
			UserID:      session.UserID,
			ServiceType: "torrent",
			Source:      req.URL,
		}).Error; err != nil {
			return err
		}

		if err := tx.Create(&database.Notification{
			UserID:  session.UserID,
			Title:   "Unduhan torrent diproses",
			Message: func() string {
				msg := fmt.Sprintf("Unduhan %s diterima. Biaya: Rp %d.", name, finalPrice)
				if voucherApplied != "" && voucherDiscount > 0 {
					msg += fmt.Sprintf(" Voucher %s dipakai (-Rp %d).", voucherApplied, voucherDiscount)
				}
				return msg
			}(),
		}).Error; err != nil {
			return err
		}

		return nil
	})
	if txErr != nil {
		if strings.TrimSpace(id) != "" {
			if delErr := globalClient.DeleteTasks([]string{id}); delErr != nil {
				log.Printf("cleanup task gagal (id=%s): %v", id, delErr)
			}
		}

		errLower := strings.ToLower(txErr.Error())
		if strings.Contains(errLower, "voucher_") {
			friendly := "Voucher tidak valid"
			switch {
			case strings.Contains(errLower, "voucher_not_found"):
				friendly = "Kode voucher tidak ditemukan"
			case strings.Contains(errLower, "voucher_inactive"):
				friendly = "Voucher sedang tidak aktif"
			case strings.Contains(errLower, "voucher_not_applicable"):
				friendly = "Voucher tidak berlaku untuk layanan ini"
			case strings.Contains(errLower, "voucher_not_started"):
				friendly = "Voucher belum mulai berlaku"
			case strings.Contains(errLower, "voucher_expired"):
				friendly = "Voucher sudah kedaluwarsa"
			case strings.Contains(errLower, "voucher_limit_reached"):
				friendly = "Kuota voucher sudah habis"
			case strings.Contains(errLower, "voucher_min_order"):
				friendly = "Nominal belum memenuhi syarat minimal voucher"
			}
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]any{
				"message": friendly,
				"error":   txErr.Error(),
			})
			return
		}

		if strings.Contains(strings.ToLower(txErr.Error()), "insufficient_balance") {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusPaymentRequired)
			json.NewEncoder(w).Encode(map[string]any{
				"message":         "Saldo tidak mencukupi untuk torrent ini",
				"required_price":  finalPrice,
				"original_price":  price,
				"discount_amount": voucherDiscount,
				"voucher_code":    voucherApplied,
				"required_units":  chargedUnits,
				"required_gb":     chargedGB,
				"current_balance": currentBalance,
				"name":            name,
				"size":            pikpak.FormatBytes(sizeBytes),
				"size_gb":         fmt.Sprintf("%.2f GB", sizeGB),
			})
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]any{
			"message": "Gagal menyimpan transaksi torrent",
			"error":   txErr.Error(),
		})
		return
	}

	response := map[string]any{
		"id":            id,
		"name":          name,
		"size":          pikpak.FormatBytes(sizeBytes),
		"size_gb":       fmt.Sprintf("%.2f GB", sizeGB),
		"charged_gb":    chargedGB,
		"charged_units": chargedUnits,
		"price":         finalPrice,
		"original_price": price,
		"discount_amount": voucherDiscount,
		"voucher_code":   voucherApplied,
		"price_display": fmt.Sprintf("Rp %d", finalPrice),
		"current_balance_after": currentBalance,
		"cached":        isCached,
		"estimation":    estimation,
		"raw":           res,
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func handleGetPricing(w http.ResponseWriter, r *http.Request) {
	pricings, err := database.GetAllPricing()
	if err != nil {
		// Return default pricing if DB error
		pricings = []database.Pricing{
			{ServiceType: "torrent", DisplayName: "Torrent/Magnet", PricePerUnit: 650, UnitSizeGB: 1, Description: "Rp 650/GB"},
			{ServiceType: "premium", DisplayName: "Premium Host", PricePerUnit: 2000, UnitSizeGB: 2, Description: "Rp 2.000/2GB"},
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(pricings)
}

func handleVoucherPreview(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	code := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("code")))
	serviceType := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("service_type")))
	basePrice, _ := strconv.ParseInt(strings.TrimSpace(r.URL.Query().Get("base_price")), 10, 64)
	if basePrice < 0 {
		basePrice = 0
	}

	resp := map[string]any{
		"valid":            false,
		"code":             code,
		"service_type":     serviceType,
		"estimated_base":   basePrice,
		"estimated_discount": int64(0),
		"estimated_final":  basePrice,
	}

	session := auth.GetSessionFromRequest(r)

	if code == "" {
		resp["message"] = "Masukkan kode voucher"
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
		return
	}

	if serviceType != "torrent" && serviceType != "premium" {
		resp["message"] = "Layanan tidak valid"
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
		return
	}

	var v database.Voucher
	if err := database.DB.Where("UPPER(code) = ?", code).First(&v).Error; err != nil {
		resp["message"] = "Voucher tidak ditemukan"
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
		return
	}

	resp["name"] = v.Name
	resp["description"] = v.Description
	resp["discount_type"] = v.DiscountType
	resp["discount_value"] = v.DiscountValue
	resp["applies_to"] = v.AppliesTo
	resp["usage_scope"] = v.UsageScope
	resp["min_order_amount"] = v.MinOrderAmount
	resp["min_discount_amount"] = v.MinDiscountAmount
	resp["max_discount_amount"] = v.MaxDiscountAmount
	resp["usage_limit"] = v.UsageLimit
	resp["used_count"] = v.UsedCount

	if !v.IsActive {
		resp["message"] = "Voucher tidak aktif"
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
		return
	}

	now := time.Now()
	if v.StartsAt != nil && now.Before(*v.StartsAt) {
		resp["message"] = "Voucher belum mulai berlaku"
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
		return
	}
	if v.EndsAt != nil && now.After(*v.EndsAt) {
		resp["message"] = "Voucher sudah kedaluwarsa"
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
		return
	}

	appliesTo := strings.ToLower(strings.TrimSpace(v.AppliesTo))
	if appliesTo != "" && appliesTo != "all" && appliesTo != serviceType {
		resp["message"] = "Voucher tidak berlaku untuk layanan ini"
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
		return
	}

	usageScope := strings.ToLower(strings.TrimSpace(v.UsageScope))
	if usageScope == "" {
		usageScope = "global"
	}

	if v.UsageLimit > 0 {
		if usageScope == "per_user" {
			var userUsageCount int64
			if err := database.DB.Model(&database.VoucherUsage{}).
				Where("voucher_id = ? AND user_id = ?", v.ID, session.UserID).
				Count(&userUsageCount).Error; err != nil {
				resp["message"] = "Gagal cek kuota voucher"
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(resp)
				return
			}
			resp["user_used_count"] = userUsageCount
			if int(userUsageCount) >= v.UsageLimit {
				resp["message"] = "Kuota voucher per user habis"
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(resp)
				return
			}
		} else {
			if v.UsedCount >= v.UsageLimit {
				resp["message"] = "Kuota voucher habis"
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(resp)
				return
			}
		}
	}

	if basePrice < v.MinOrderAmount {
		resp["message"] = "Belum memenuhi minimal transaksi"
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
		return
	}

	discount := computeVoucherDiscount(v, basePrice)
	finalPrice := basePrice - discount
	if finalPrice < 0 {
		finalPrice = 0
	}

	resp["valid"] = true
	resp["message"] = "Voucher bisa dipakai"
	resp["estimated_discount"] = discount
	resp["estimated_final"] = finalPrice

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func handleDeleteTask(w http.ResponseWriter, r *http.Request) {
	taskID := r.URL.Query().Get("task_id")
	if taskID == "" {
		http.Error(w, "task_id is required", http.StatusBadRequest)
		return
	}

	err := globalClient.DeleteTasks([]string{taskID})
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to delete task: %v", err), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"message": "Task cancelled/deleted"}`))
}

func sanitizeDownloadName(name string) string {
	if strings.TrimSpace(name) == "" {
		return "folder"
	}
	cleaned := strings.ReplaceAll(name, " ", "_")
	cleaned = strings.ReplaceAll(cleaned, "/", "_")
	cleaned = strings.ReplaceAll(cleaned, "\\", "_")
	return cleaned
}

func handleFolderManifest(w http.ResponseWriter, r *http.Request) {
	folderID := r.URL.Query().Get("folder_id")
	if folderID == "" {
		http.Error(w, "folder_id is required", http.StatusBadRequest)
		return
	}

	folderName := r.URL.Query().Get("folder_name")
	if folderName == "" {
		folderName = folderID
	}

	format := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("format")))
	if format == "" {
		format = "json"
	}

	files, err := globalClient.WalkFolderManifest(folderID)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to walk folder: %v", err), http.StatusInternalServerError)
		return
	}

	type ManifestEntry struct {
		FileID         string    `json:"file_id"`
		ParentID       string    `json:"parent_id"`
		Name           string    `json:"name"`
		RelativePath   string    `json:"relative_path"`
		FolderPath     string    `json:"folder_path"`
		Size           string    `json:"size"`
		SizeStr        string    `json:"size_str"`
		MimeType       string    `json:"mime_type"`
		Modified       time.Time `json:"modified_time"`
		ModifiedStr    string    `json:"modified_str"`
		WebContentLink string    `json:"web_content_link"`
	}

	entries := make([]ManifestEntry, 0, len(files))
	for _, f := range files {
		var sizeBytes int64
		fmt.Sscanf(f.Size, "%d", &sizeBytes)
		entries = append(entries, ManifestEntry{
			FileID:         f.ID,
			ParentID:       f.ParentID,
			Name:           f.Name,
			RelativePath:   f.RelativePath,
			FolderPath:     f.FolderPath,
			Size:           f.Size,
			SizeStr:        pikpak.FormatBytes(sizeBytes),
			MimeType:       f.MimeType,
			Modified:       f.Modified,
			ModifiedStr:    pikpak.FormatTime(f.Modified),
			WebContentLink: f.WebContentLink,
		})
	}

	safeFolderName := sanitizeDownloadName(folderName)

	switch format {
	case "jsonl", "ndjson":
		w.Header().Set("Content-Type", "application/x-ndjson; charset=utf-8")
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s_manifest.jsonl\"", safeFolderName))
		enc := json.NewEncoder(w)
		for _, entry := range entries {
			if err := enc.Encode(entry); err != nil {
				http.Error(w, fmt.Sprintf("Failed to encode manifest: %v", err), http.StatusInternalServerError)
				return
			}
		}
		return

	case "aria2", "aria2c":
		var sb strings.Builder
		sb.WriteString("# Aria2 input generated by /api/folder/manifest\n")
		sb.WriteString(fmt.Sprintf("# Folder: %s\n", folderName))
		sb.WriteString(fmt.Sprintf("# Total files: %d\n", len(entries)))
		sb.WriteString("# ---------------------------------------------\n\n")

		for _, entry := range entries {
			if entry.WebContentLink == "" {
				continue
			}

			dirPart := path.Dir(entry.RelativePath)
			if dirPart == "." {
				dirPart = ""
			}
			downloadDir := filepath.Clean(filepath.Join(safeFolderName, filepath.FromSlash(dirPart)))
			outName := path.Base(entry.RelativePath)

			sb.WriteString(entry.WebContentLink + "\n")
			sb.WriteString("  dir=" + downloadDir + "\n")
			sb.WriteString("  out=" + outName + "\n\n")
		}

		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s_aria2.txt\"", safeFolderName))
		w.Write([]byte(sb.String()))
		return

	case "json":
		resp := map[string]any{
			"folder_id":    folderID,
			"folder_name":  folderName,
			"generated_at": time.Now().UTC(),
			"total_files":  len(entries),
			"items":        entries,
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
		return

	default:
		http.Error(w, "invalid format. use json|jsonl|aria2", http.StatusBadRequest)
		return
	}
}

func handleDownloadFolder(w http.ResponseWriter, r *http.Request) {
	folderID := r.URL.Query().Get("folder_id")
	if folderID == "" {
		http.Error(w, "folder_id is required", http.StatusBadRequest)
		return
	}

	// Get folder name for the filename
	folderName := r.URL.Query().Get("folder_name")
	if folderName == "" {
		folderName = folderID
	}

	files, err := globalClient.WalkFolderManifest(folderID)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to walk folder: %v", err), http.StatusInternalServerError)
		return
	}

	// Generate plain text file with URLs - compatible with JDownloader, IDM, ADM
	var sb strings.Builder

	// Add header comment for users
	sb.WriteString("# Download Links - Import to JDownloader/IDM/ADM\n")
	sb.WriteString(fmt.Sprintf("# Folder: %s\n", folderName))
	sb.WriteString(fmt.Sprintf("# Total files: %d\n", len(files)))
	sb.WriteString("# ---------------------------------------------\n\n")

	for _, f := range files {
		if f.WebContentLink == "" {
			continue
		}
		link := f.WebContentLink
		// Add filename parameter for download managers
		if !strings.Contains(link, "?") {
			link += "?fn=" + url.QueryEscape(f.Name)
		} else {
			link += "&fn=" + url.QueryEscape(f.Name)
		}

		// Format: URL (filename for reference)
		sb.WriteString(link + "\n")
	}

	// Sanitize folder name for filename
	safeFolderName := sanitizeDownloadName(folderName)

	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s_links.txt\"", safeFolderName))
	w.Write([]byte(sb.String()))
}

// ========== ADMIN HANDLERS ==========

func handleAdminUsers(w http.ResponseWriter, r *http.Request) {
	session := auth.GetSessionFromRequest(r)

	switch r.Method {
	case http.MethodGet:
		var users []database.User
		database.DB.Order("created_at desc").Find(&users)

		type usageAgg struct {
			UserID         uint  `json:"user_id"`
			TotalDownloads int64 `json:"total_downloads"`
			TorrentCount   int64 `json:"torrent_count"`
			PremiumCount   int64 `json:"premium_count"`
		}
		var aggs []usageAgg
		database.DB.Table("user_usages").
			Select(`user_id,
				COUNT(*) AS total_downloads,
				SUM(CASE WHEN service_type = 'torrent' THEN 1 ELSE 0 END) AS torrent_count,
				SUM(CASE WHEN service_type = 'premium' THEN 1 ELSE 0 END) AS premium_count`).
			Group("user_id").
			Scan(&aggs)

		usageMap := map[uint]usageAgg{}
		for _, a := range aggs {
			usageMap[a.UserID] = a
		}

		resp := make([]map[string]any, 0, len(users))
		for _, u := range users {
			a := usageMap[u.ID]
			resp = append(resp, map[string]any{
				"id":                 u.ID,
				"email":              u.Email,
				"role":               u.Role,
				"is_active":          u.IsActive,
				"balance":            u.Balance,
				"pikpak_folder_id":   u.PikPakFolderID,
				"pikpak_folder_name": u.PikPakFolderName,
				"created_at":         u.CreatedAt,
				"updated_at":         u.UpdatedAt,
				"total_downloads":    a.TotalDownloads,
				"torrent_count":      a.TorrentCount,
				"premium_count":      a.PremiumCount,
			})
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
		return

	case http.MethodPost:
		var req struct {
			Identifier string `json:"identifier"` // email OR username(before @)
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}
		identifier := strings.TrimSpace(req.Identifier)
		if identifier == "" {
			http.Error(w, "identifier is required", http.StatusBadRequest)
			return
		}

		var user database.User
		err := database.DB.Where("LOWER(email) = ?", strings.ToLower(identifier)).First(&user).Error
		if err != nil {
			err = database.DB.Where("LOWER(email) LIKE ?", strings.ToLower(identifier)+"@%").First(&user).Error
		}
		if err != nil {
			http.Error(w, "User tidak ditemukan", http.StatusNotFound)
			return
		}

		if user.Role != "admin" {
			if err := database.DB.Model(&database.User{}).Where("id = ?", user.ID).Update("role", "admin").Error; err != nil {
				http.Error(w, "Failed to promote user", http.StatusInternalServerError)
				return
			}
			user.Role = "admin"
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(user)
		return

	case http.MethodPatch:
		var req struct {
			UserID   uint   `json:"user_id"`
			IsActive *bool  `json:"is_active"`
			Role     string `json:"role"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}
		if req.UserID == 0 {
			http.Error(w, "user_id is required", http.StatusBadRequest)
			return
		}

		updates := map[string]any{}
		if req.IsActive != nil {
			if session != nil && session.UserID == req.UserID && !*req.IsActive {
				http.Error(w, "Tidak bisa menonaktifkan akun admin sendiri", http.StatusBadRequest)
				return
			}
			updates["is_active"] = *req.IsActive
		}
		if strings.TrimSpace(req.Role) != "" {
			role := strings.ToLower(strings.TrimSpace(req.Role))
			if role != "admin" && role != "client" {
				http.Error(w, "role must be admin/client", http.StatusBadRequest)
				return
			}
			if session != nil && session.UserID == req.UserID && role != "admin" {
				http.Error(w, "Tidak bisa menurunkan role akun sendiri", http.StatusBadRequest)
				return
			}
			updates["role"] = role
		}

		if len(updates) == 0 {
			http.Error(w, "No changes provided", http.StatusBadRequest)
			return
		}

		if err := database.DB.Model(&database.User{}).Where("id = ?", req.UserID).Updates(updates).Error; err != nil {
			http.Error(w, "Failed to update user", http.StatusInternalServerError)
			return
		}

		var updated database.User
		if err := database.DB.First(&updated, req.UserID).Error; err != nil {
			http.Error(w, "User not found", http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(updated)
		return

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
}

func handleAdminPricing(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		pricings, _ := database.GetAllPricing()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(pricings)
		return
	}

	if r.Method == http.MethodPost {
		var req database.Pricing
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}

		// Update existing pricing
		result := database.DB.Model(&database.Pricing{}).
			Where("service_type = ?", req.ServiceType).
			Updates(map[string]any{
				"price_per_unit": req.PricePerUnit,
				"unit_size_gb":   req.UnitSizeGB,
				"description":    req.Description,
				"display_name":   req.DisplayName,
			})

		if result.Error != nil {
			http.Error(w, "Failed to update pricing", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"message": "Pricing updated"})
		return
	}

	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}

func handleAdminVouchers(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		var vouchers []database.Voucher
		if err := database.DB.Order("created_at desc").Find(&vouchers).Error; err != nil {
			http.Error(w, "Failed to fetch vouchers", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(vouchers)
		return

	case http.MethodPost:
		var req database.Voucher
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}

		req.Code = strings.ToUpper(strings.TrimSpace(req.Code))
		req.Name = strings.TrimSpace(req.Name)
		req.AppliesTo = strings.ToLower(strings.TrimSpace(req.AppliesTo))
		req.DiscountType = strings.ToLower(strings.TrimSpace(req.DiscountType))
		req.UsageScope = strings.ToLower(strings.TrimSpace(req.UsageScope))

		if req.Code == "" {
			http.Error(w, "code is required", http.StatusBadRequest)
			return
		}
		if req.DiscountType != "percentage" && req.DiscountType != "fixed" {
			http.Error(w, "discount_type must be percentage/fixed", http.StatusBadRequest)
			return
		}
		if req.AppliesTo == "" {
			req.AppliesTo = "all"
		}
		if req.AppliesTo != "all" && req.AppliesTo != "torrent" && req.AppliesTo != "premium" {
			http.Error(w, "applies_to must be all/torrent/premium", http.StatusBadRequest)
			return
		}
		if req.UsageScope == "" {
			req.UsageScope = "global"
		}
		if req.UsageScope != "global" && req.UsageScope != "per_user" {
			http.Error(w, "usage_scope must be global/per_user", http.StatusBadRequest)
			return
		}
		if req.DiscountValue <= 0 {
			http.Error(w, "discount_value must be > 0", http.StatusBadRequest)
			return
		}
		if req.DiscountType == "percentage" && req.DiscountValue > 100 {
			http.Error(w, "percentage max is 100", http.StatusBadRequest)
			return
		}

		if err := database.DB.Create(&req).Error; err != nil {
			http.Error(w, "Failed to create voucher", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(req)
		return

	case http.MethodPatch:
		var req database.Voucher
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}
		if req.ID == 0 {
			http.Error(w, "id is required", http.StatusBadRequest)
			return
		}

		updates := map[string]any{}
		if strings.TrimSpace(req.Code) != "" {
			updates["code"] = strings.ToUpper(strings.TrimSpace(req.Code))
		}
		if strings.TrimSpace(req.Name) != "" {
			updates["name"] = strings.TrimSpace(req.Name)
		}
		if req.Description != "" {
			updates["description"] = req.Description
		}
		if strings.TrimSpace(req.DiscountType) != "" {
			dt := strings.ToLower(strings.TrimSpace(req.DiscountType))
			if dt != "percentage" && dt != "fixed" {
				http.Error(w, "discount_type must be percentage/fixed", http.StatusBadRequest)
				return
			}
			updates["discount_type"] = dt
		}
		if req.DiscountValue > 0 {
			updates["discount_value"] = req.DiscountValue
		}
		if req.MinOrderAmount >= 0 {
			updates["min_order_amount"] = req.MinOrderAmount
		}
		if req.MinDiscountAmount >= 0 {
			updates["min_discount_amount"] = req.MinDiscountAmount
		}
		if req.MaxDiscountAmount >= 0 {
			updates["max_discount_amount"] = req.MaxDiscountAmount
		}
		if strings.TrimSpace(req.AppliesTo) != "" {
			ap := strings.ToLower(strings.TrimSpace(req.AppliesTo))
			if ap != "all" && ap != "torrent" && ap != "premium" {
				http.Error(w, "applies_to must be all/torrent/premium", http.StatusBadRequest)
				return
			}
			updates["applies_to"] = ap
		}
		if strings.TrimSpace(req.UsageScope) != "" {
			scope := strings.ToLower(strings.TrimSpace(req.UsageScope))
			if scope != "global" && scope != "per_user" {
				http.Error(w, "usage_scope must be global/per_user", http.StatusBadRequest)
				return
			}
			updates["usage_scope"] = scope
		}
		if req.UsageLimit >= 0 {
			updates["usage_limit"] = req.UsageLimit
		}
		updates["is_active"] = req.IsActive
		updates["starts_at"] = req.StartsAt
		updates["ends_at"] = req.EndsAt

		if err := database.DB.Model(&database.Voucher{}).Where("id = ?", req.ID).Updates(updates).Error; err != nil {
			http.Error(w, "Failed to update voucher", http.StatusInternalServerError)
			return
		}

		var updated database.Voucher
		if err := database.DB.First(&updated, req.ID).Error; err != nil {
			http.Error(w, "Voucher not found", http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(updated)
		return

	case http.MethodDelete:
		id, _ := strconv.Atoi(strings.TrimSpace(r.URL.Query().Get("id")))
		if id <= 0 {
			http.Error(w, "id is required", http.StatusBadRequest)
			return
		}
		if err := database.DB.Delete(&database.Voucher{}, id).Error; err != nil {
			http.Error(w, "Failed to delete voucher", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"message": "Voucher deleted"})
		return

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
}

func handleAdminStats(w http.ResponseWriter, r *http.Request) {
	var userCount int64
	database.DB.Model(&database.User{}).Count(&userCount)

	var transactionCount int64
	database.DB.Model(&database.Transaction{}).Count(&transactionCount)

	var revenue int64
	database.DB.Model(&database.Transaction{}).Where("type = ?", "topup").Select("COALESCE(SUM(amount), 0)").Scan(&revenue)

	stats := map[string]any{
		"users":        userCount,
		"transactions": transactionCount,
		"revenue":      revenue,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

func handleAdminMonitoring(w http.ResponseWriter, r *http.Request) {
	type topUsageUser struct {
		UserID       uint   `json:"user_id"`
		Email        string `json:"email"`
		Balance      int64  `json:"balance"`
		TotalUsage   int64  `json:"total_usage"`
		TorrentCount int64  `json:"torrent_count"`
		PremiumCount int64  `json:"premium_count"`
	}
	type topSaldoUser struct {
		ID        uint      `json:"id"`
		Email     string    `json:"email"`
		Role      string    `json:"role"`
		Balance   int64     `json:"balance"`
		IsActive  bool      `json:"is_active"`
		CreatedAt time.Time `json:"created_at"`
	}
	type dailyUsage struct {
		Date         string `json:"date"`
		TorrentCount int64  `json:"torrent_count"`
		PremiumCount int64  `json:"premium_count"`
		TotalUsage   int64  `json:"total_usage"`
	}

	var totalUsage int64
	var torrentCount int64
	var premiumCount int64
	var activeUsers int64
	var totalUsers int64
	var usersWithUsage int64

	database.DB.Model(&database.UserUsage{}).Count(&totalUsage)
	database.DB.Model(&database.UserUsage{}).Where("service_type = ?", "torrent").Count(&torrentCount)
	database.DB.Model(&database.UserUsage{}).Where("service_type = ?", "premium").Count(&premiumCount)
	database.DB.Model(&database.User{}).Where("is_active = ?", true).Count(&activeUsers)
	database.DB.Model(&database.User{}).Count(&totalUsers)
	database.DB.Model(&database.UserUsage{}).Distinct("user_id").Count(&usersWithUsage)

	var topByUsage []topUsageUser
	database.DB.Table("user_usages AS uu").
		Select(`uu.user_id AS user_id,
			u.email AS email,
			u.balance AS balance,
			COUNT(*) AS total_usage,
			SUM(CASE WHEN uu.service_type = 'torrent' THEN 1 ELSE 0 END) AS torrent_count,
			SUM(CASE WHEN uu.service_type = 'premium' THEN 1 ELSE 0 END) AS premium_count`).
		Joins("JOIN users u ON u.id = uu.user_id").
		Group("uu.user_id, u.email, u.balance").
		Order("total_usage DESC").
		Limit(10).
		Scan(&topByUsage)

	var topBySaldo []topSaldoUser
	database.DB.Model(&database.User{}).
		Select("id, email, role, balance, is_active, created_at").
		Order("balance DESC").
		Limit(10).
		Find(&topBySaldo)

	var usageLast7Days []dailyUsage
	database.DB.Table("user_usages").
		Select(`DATE(created_at) AS date,
			SUM(CASE WHEN service_type = 'torrent' THEN 1 ELSE 0 END) AS torrent_count,
			SUM(CASE WHEN service_type = 'premium' THEN 1 ELSE 0 END) AS premium_count,
			COUNT(*) AS total_usage`).
		Where("created_at >= ?", time.Now().AddDate(0, 0, -7)).
		Group("DATE(created_at)").
		Order("DATE(created_at) DESC").
		Scan(&usageLast7Days)

	response := map[string]any{
		"aggregate": map[string]any{
			"total_users":       totalUsers,
			"active_users":      activeUsers,
			"users_with_usage":  usersWithUsage,
			"total_downloads":   totalUsage,
			"torrent_count":     torrentCount,
			"premium_url_count": premiumCount,
		},
		"top_users_by_usage":   topByUsage,
		"top_users_by_balance": topBySaldo,
		"usage_last_7_days":    usageLast7Days,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func handleAdminUserBalance(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		UserID  uint   `json:"user_id"`
		Amount  *int64 `json:"amount"`  // legacy: delta
		Balance *int64 `json:"balance"` // preferred: absolute
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	var user database.User
	if err := database.DB.First(&user, req.UserID).Error; err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	oldBalance := user.Balance
	newBalance := oldBalance
	if req.Balance != nil {
		newBalance = *req.Balance
	} else if req.Amount != nil {
		newBalance = oldBalance + *req.Amount
	} else {
		http.Error(w, "balance is required", http.StatusBadRequest)
		return
	}

	if err := database.DB.Model(&database.User{}).Where("id = ?", req.UserID).Update("balance", newBalance).Error; err != nil {
		http.Error(w, "Failed to update balance", http.StatusInternalServerError)
		return
	}

	delta := newBalance - oldBalance
	if delta != 0 {
		transType := "adjustment"
		description := fmt.Sprintf("Admin set balance: %d -> %d", oldBalance, newBalance)
		if delta > 0 {
			transType = "topup"
		}

		transaction := database.Transaction{
			UserID:      req.UserID,
			Amount:      delta,
			Type:        transType,
			Description: description,
		}
		database.DB.Create(&transaction)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Balance updated"})
}

func handleAdminHosts(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodDelete {
		idStr := r.URL.Query().Get("id")
		if idStr == "" {
			http.Error(w, "id is required", http.StatusBadRequest)
			return
		}

		if err := database.DB.Delete(&database.HostAvailability{}, idStr).Error; err != nil {
			http.Error(w, "Failed to delete host", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"message": "Deleted"})
		return
	}

	if r.Method == http.MethodPatch {
		var req struct {
			ID          uint    `json:"id"`
			Name        *string `json:"name"`
			IsAvailable *bool   `json:"is_available"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}
		if req.ID == 0 {
			http.Error(w, "id is required", http.StatusBadRequest)
			return
		}

		updates := map[string]any{}
		if req.Name != nil {
			name := strings.TrimSpace(*req.Name)
			if name == "" {
				http.Error(w, "name cannot be empty", http.StatusBadRequest)
				return
			}
			updates["name"] = name
		}
		if req.IsAvailable != nil {
			updates["is_available"] = *req.IsAvailable
		}
		if len(updates) == 0 {
			http.Error(w, "no updates provided", http.StatusBadRequest)
			return
		}

		if err := database.DB.Model(&database.HostAvailability{}).Where("id = ?", req.ID).Updates(updates).Error; err != nil {
			http.Error(w, "Failed to update host", http.StatusInternalServerError)
			return
		}

		var updated database.HostAvailability
		database.DB.First(&updated, req.ID)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(updated)
		return
	}

	if r.Method == http.MethodPost {
		var req struct {
			Name        string `json:"name"`
			IsAvailable bool   `json:"is_available"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}

		req.Name = strings.TrimSpace(req.Name)
		if req.Name == "" {
			http.Error(w, "name is required", http.StatusBadRequest)
			return
		}

		setting := database.HostAvailability{Name: req.Name, IsAvailable: req.IsAvailable}
		if err := database.DB.Create(&setting).Error; err != nil {
			http.Error(w, "Failed to create host", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(setting)
		return
	}

	// GET - return all admin-input hosts
	var result []database.HostAvailability
	database.DB.Order("name asc").Find(&result)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func handleAdminOfficialPosts(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodDelete {
		idStr := r.URL.Query().Get("id")
		if idStr == "" {
			http.Error(w, "id is required", http.StatusBadRequest)
			return
		}

		var post database.OfficialPost
		if err := database.DB.First(&post, idStr).Error; err != nil {
			http.Error(w, "Post not found", http.StatusNotFound)
			return
		}
		if strings.EqualFold(strings.TrimSpace(post.Type), "guide_help") {
			http.Error(w, "Panduan & bantuan tidak bisa dihapus", http.StatusForbidden)
			return
		}

		result := database.DB.Delete(&database.OfficialPost{}, idStr)
		if result.Error != nil {
			http.Error(w, "Failed to delete post", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"message": "Deleted"})
		return
	}

	if r.Method == http.MethodPatch {
		var req struct {
			ID       uint    `json:"id"`
			Title    *string `json:"title"`
			Content  *string `json:"content"`
			Type     *string `json:"type"`
			IsActive *bool   `json:"is_active"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}

		if req.ID == 0 {
			http.Error(w, "id is required", http.StatusBadRequest)
			return
		}

		updates := map[string]any{}
		if req.Title != nil {
			title := strings.TrimSpace(*req.Title)
			if title == "" {
				http.Error(w, "title cannot be empty", http.StatusBadRequest)
				return
			}
			updates["title"] = title
		}
		if req.Content != nil {
			content := strings.TrimSpace(*req.Content)
			if content == "" {
				http.Error(w, "content cannot be empty", http.StatusBadRequest)
				return
			}
			updates["content"] = content
		}
		if req.Type != nil {
			updates["type"] = strings.TrimSpace(*req.Type)
		}
		if req.IsActive != nil {
			updates["is_active"] = *req.IsActive
		}

		if len(updates) == 0 {
			http.Error(w, "no updates provided", http.StatusBadRequest)
			return
		}

		if err := database.DB.Model(&database.OfficialPost{}).Where("id = ?", req.ID).Updates(updates).Error; err != nil {
			http.Error(w, "Failed to update post", http.StatusInternalServerError)
			return
		}

		var post database.OfficialPost
		database.DB.First(&post, req.ID)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(post)
		return
	}

	if r.Method == http.MethodPost {
		var req struct {
			Title   string `json:"title"`
			Content string `json:"content"`
			Type    string `json:"type"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}

		req.Title = strings.TrimSpace(req.Title)
		req.Content = strings.TrimSpace(req.Content)
		req.Type = strings.TrimSpace(req.Type)

		if req.Title == "" || req.Content == "" {
			http.Error(w, "title and content are required", http.StatusBadRequest)
			return
		}
		if req.Type == "" {
			req.Type = "info"
		}

		post := database.OfficialPost{
			Title:   req.Title,
			Content: req.Content,
			Type:    req.Type,
			Author:  "Admin",
		}
		if err := database.DB.Create(&post).Error; err != nil {
			http.Error(w, "Failed to create post", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(post)
		return
	}

	// GET - list all official posts (active and inactive) for admin
	var posts []database.OfficialPost
	database.DB.Order("created_at desc").Limit(200).Find(&posts)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(posts)
}

// ========== FEED HANDLERS ==========

func handleBanners(w http.ResponseWriter, r *http.Request) {
	var banners []database.Banner
	database.DB.Where("is_active = ?", true).Order("sort_order asc").Find(&banners)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(banners)
}

func handleOfficialPosts(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodPost {
		// Admin only - create official post
		session := auth.GetSessionFromRequest(r)
		if session == nil {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
		var user database.User
		database.DB.First(&user, session.UserID)
		if user.Role != "admin" {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}

		var req struct {
			Title   string `json:"title"`
			Content string `json:"content"`
			Type    string `json:"type"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}

		post := database.OfficialPost{
			Title:   req.Title,
			Content: req.Content,
			Type:    req.Type,
			Author:  "Admin",
		}
		if post.Type == "" {
			post.Type = "info"
		}
		database.DB.Create(&post)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(post)
		return
	}

	// GET - single or list official posts
	idStr := strings.TrimSpace(r.URL.Query().Get("id"))
	typeFilter := strings.TrimSpace(r.URL.Query().Get("type"))
	if idStr != "" {
		var post database.OfficialPost
		if err := database.DB.Where("id = ? AND is_active = ?", idStr, true).First(&post).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				http.Error(w, "Post not found", http.StatusNotFound)
				return
			}
			http.Error(w, "Failed to fetch post", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(post)
		return
	}

	var posts []database.OfficialPost
	query := database.DB.Where("is_active = ?", true)
	if typeFilter != "" {
		query = query.Where("type = ?", typeFilter)
	} else {
		query = query.Where("type <> ?", "guide_help")
	}
	query.Order("created_at desc").Limit(20).Find(&posts)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(posts)
}

func resolveLocalBannerImagePath(imageURL string) (string, bool) {
	raw := strings.TrimSpace(imageURL)
	if raw == "" {
		return "", false
	}

	pathPart := raw
	if strings.HasPrefix(raw, "http://") || strings.HasPrefix(raw, "https://") {
		u, err := url.Parse(raw)
		if err != nil {
			return "", false
		}
		pathPart = u.Path
	}

	pathPart = strings.ReplaceAll(pathPart, "\\", "/")
	idx := strings.Index(pathPart, "/uploads/banners/")
	if idx < 0 {
		return "", false
	}
	pathPart = pathPart[idx:]

	rel := strings.TrimPrefix(pathPart, "/uploads/") // banners/<file>
	cleanRel := filepath.Clean(rel)
	cleanRel = strings.ReplaceAll(cleanRel, "\\", "/")
	if cleanRel == "." || strings.HasPrefix(cleanRel, "../") || cleanRel == ".." {
		return "", false
	}
	if !strings.HasPrefix(cleanRel, "banners/") {
		return "", false
	}

	return filepath.Join(".", "uploads", filepath.FromSlash(cleanRel)), true
}

func removeLocalBannerImageIfAny(imageURL string) {
	if fullPath, ok := resolveLocalBannerImagePath(imageURL); ok {
		if err := os.Remove(fullPath); err != nil && !os.IsNotExist(err) {
			log.Printf("failed removing banner image %s: %v", fullPath, err)
		}
	}
}

func handleAdminBanners(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodDelete {
		idStr := r.URL.Query().Get("id")
		if idStr == "" {
			http.Error(w, "id is required", http.StatusBadRequest)
			return
		}

		var banner database.Banner
		if err := database.DB.First(&banner, idStr).Error; err != nil {
			http.Error(w, "Banner not found", http.StatusNotFound)
			return
		}
		oldImage := banner.Image

		if err := database.DB.Delete(&database.Banner{}, idStr).Error; err != nil {
			http.Error(w, "Failed to delete banner", http.StatusInternalServerError)
			return
		}
		removeLocalBannerImageIfAny(oldImage)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"message": "Deleted"})
		return
	}

	if r.Method == http.MethodPatch {
		var req struct {
			ID          uint    `json:"id"`
			Title       *string `json:"title"`
			Description *string `json:"description"`
			Image       *string `json:"image"`
			Color       *string `json:"color"`
			IsActive    *bool   `json:"is_active"`
			SortOrder   *int    `json:"sort_order"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}
		if req.ID == 0 {
			http.Error(w, "id is required", http.StatusBadRequest)
			return
		}

		var currentBanner database.Banner
		if err := database.DB.First(&currentBanner, req.ID).Error; err != nil {
			http.Error(w, "Banner not found", http.StatusNotFound)
			return
		}
		oldImage := strings.TrimSpace(currentBanner.Image)

		updates := map[string]any{}
		if req.Title != nil {
			title := strings.TrimSpace(*req.Title)
			if title == "" {
				http.Error(w, "title cannot be empty", http.StatusBadRequest)
				return
			}
			updates["title"] = title
		}
		if req.Description != nil {
			updates["description"] = strings.TrimSpace(*req.Description)
		}
		if req.Image != nil {
			updates["image"] = strings.TrimSpace(*req.Image)
		}
		if req.Color != nil {
			updates["color"] = strings.TrimSpace(*req.Color)
		}
		if req.IsActive != nil {
			updates["is_active"] = *req.IsActive
		}
		if req.SortOrder != nil {
			updates["sort_order"] = *req.SortOrder
		}

		if len(updates) == 0 {
			http.Error(w, "no updates provided", http.StatusBadRequest)
			return
		}

		if err := database.DB.Model(&database.Banner{}).Where("id = ?", req.ID).Updates(updates).Error; err != nil {
			http.Error(w, "Failed to update banner", http.StatusInternalServerError)
			return
		}

		if req.Image != nil {
			newImage := strings.TrimSpace(*req.Image)
			if oldImage != "" && !strings.EqualFold(oldImage, newImage) {
				removeLocalBannerImageIfAny(oldImage)
			}
		}

		var banner database.Banner
		database.DB.First(&banner, req.ID)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(banner)
		return
	}

	if r.Method == http.MethodPost {
		var req struct {
			Title       string `json:"title"`
			Description string `json:"description"`
			Image       string `json:"image"`
			Color       string `json:"color"`
			SortOrder   int    `json:"sort_order"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}

		req.Title = strings.TrimSpace(req.Title)
		req.Description = strings.TrimSpace(req.Description)
		req.Image = strings.TrimSpace(req.Image)
		req.Color = strings.TrimSpace(req.Color)

		if req.Title == "" {
			http.Error(w, "title is required", http.StatusBadRequest)
			return
		}

		banner := database.Banner{
			Title:       req.Title,
			Description: req.Description,
			Image:       req.Image,
			Color:       req.Color,
			IsActive:    true,
			SortOrder:   req.SortOrder,
		}

		if banner.Color == "" {
			banner.Color = "linear-gradient(135deg, #009be5 0%, #0d47a1 100%)"
		}

		if err := database.DB.Create(&banner).Error; err != nil {
			http.Error(w, "Failed to create banner", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(banner)
		return
	}

	// GET - list all banners for admin
	var banners []database.Banner
	database.DB.Order("sort_order asc, created_at desc").Find(&banners)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(banners)
}

func validateBannerImage(file multipart.File, header *multipart.FileHeader) (width int, height int, ext string, err error) {
	const maxSize = 1 * 1024 * 1024 // 1MB

	if header.Size > maxSize {
		return 0, 0, "", fmt.Errorf("ukuran file melebihi 1MB")
	}

	buffer := make([]byte, 512)
	n, readErr := file.Read(buffer)
	if readErr != nil && readErr != io.EOF {
		return 0, 0, "", fmt.Errorf("gagal membaca file")
	}

	contentType := http.DetectContentType(buffer[:n])
	switch contentType {
	case "image/jpeg":
		ext = ".jpg"
	case "image/png":
		ext = ".png"
	case "image/gif":
		ext = ".gif"
	default:
		return 0, 0, "", fmt.Errorf("format gambar tidak didukung (gunakan jpg/png/gif)")
	}

	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return 0, 0, "", fmt.Errorf("gagal reset file")
	}

	cfg, _, err := image.DecodeConfig(file)
	if err != nil {
		return 0, 0, "", fmt.Errorf("file gambar tidak valid")
	}

	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return 0, 0, "", fmt.Errorf("gagal reset file")
	}

	return cfg.Width, cfg.Height, ext, nil
}

func handleAdminBannerImageUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if err := r.ParseMultipartForm(2 * 1024 * 1024); err != nil {
		http.Error(w, "Invalid multipart form", http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("image")
	if err != nil {
		http.Error(w, "image file is required", http.StatusBadRequest)
		return
	}
	defer file.Close()

	width, height, ext, err := validateBannerImage(file, header)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	uploadDir := filepath.Join(".", "uploads", "banners")
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		http.Error(w, "Failed to create upload directory", http.StatusInternalServerError)
		return
	}

	randomPart := make([]byte, 8)
	rand.Read(randomPart)
	filename := fmt.Sprintf("banner_%s%s", hex.EncodeToString(randomPart), ext)
	fullPath := filepath.Join(uploadDir, filename)

	outFile, err := os.Create(fullPath)
	if err != nil {
		http.Error(w, "Failed to create image file", http.StatusInternalServerError)
		return
	}
	defer outFile.Close()

	written, err := io.Copy(outFile, io.LimitReader(file, 1*1024*1024+1))
	if err != nil {
		http.Error(w, "Failed to save image", http.StatusInternalServerError)
		return
	}

	if written > 1*1024*1024 {
		os.Remove(fullPath)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "ukuran file melebihi 1MB"})
		return
	}

	urlPath := "/uploads/banners/" + filename

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"url":         urlPath,
		"size_bytes":  written,
		"width":       width,
		"height":      height,
		"max_size":    "1MB",
		"recommended": "Rasio sekitar 4.7:1 (contoh 1600x340)",
	})
}

func handleUserPosts(w http.ResponseWriter, r *http.Request) {
	session := auth.GetSessionFromRequest(r)

	if r.Method == http.MethodDelete {
		idStr := r.URL.Query().Get("id")
		if idStr == "" {
			http.Error(w, "id is required", http.StatusBadRequest)
			return
		}

		isAdmin := session.Role == "admin"
		var result *gorm.DB
		if isAdmin {
			// Admin can delete any user post
			database.DB.Where("post_id = ?", idStr).Delete(&database.UserPostReply{})
			result = database.DB.Where("id = ?", idStr).Delete(&database.UserPost{})
		} else {
			// Regular users can only delete their own posts
			database.DB.Where("post_id = ? AND user_id = ?", idStr, session.UserID).Delete(&database.UserPostReply{})
			result = database.DB.Where("id = ? AND user_id = ?", idStr, session.UserID).Delete(&database.UserPost{})
		}

		if result.RowsAffected == 0 {
			http.Error(w, "Post not found or not yours", http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"message": "Deleted"})
		return
	}

	if r.Method == http.MethodPost {
		var req struct {
			Content string `json:"content"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}

		if len(req.Content) == 0 || len(req.Content) > 500 {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{"error": "Konten harus 1-500 karakter"})
			return
		}

		var user database.User
		database.DB.First(&user, session.UserID)

		post := database.UserPost{
			UserID:      session.UserID,
			Content:     req.Content,
			AuthorName:  session.Name,
			AuthorEmail: user.Email,
		}
		if post.AuthorName == "" {
			post.AuthorName = strings.Split(user.Email, "@")[0]
		}
		database.DB.Create(&post)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(post)
		return
	}

	// GET - single or list user posts
	idStr := strings.TrimSpace(r.URL.Query().Get("id"))
	if idStr != "" {
		var post database.UserPost
		if err := database.DB.First(&post, idStr).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				http.Error(w, "Post not found", http.StatusNotFound)
				return
			}
			http.Error(w, "Failed to fetch post", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(post)
		return
	}

	q := r.URL.Query()

	// Pagination: ?limit=20&before=RFC3339&before_id=123
	limit := 50
	if limStr := strings.TrimSpace(q.Get("limit")); limStr != "" {
		if n, err := strconv.Atoi(limStr); err == nil {
			if n < 1 {
				n = 1
			}
			if n > 50 {
				n = 50
			}
			limit = n
		}
	}

	// Optional filter: only current user's posts.
	mine := strings.TrimSpace(q.Get("mine"))
	onlyMine := mine == "1" || strings.EqualFold(mine, "true") || strings.EqualFold(mine, "yes")

	dbq := database.DB.Model(&database.UserPost{})
	if onlyMine {
		dbq = dbq.Where("user_id = ?", session.UserID)
	}

	beforeStr := strings.TrimSpace(q.Get("before"))
	beforeIDStr := strings.TrimSpace(q.Get("before_id"))
	if beforeStr != "" {
		beforeTime, err := time.Parse(time.RFC3339Nano, beforeStr)
		if err != nil {
			beforeTime, err = time.Parse(time.RFC3339, beforeStr)
		}
		if err == nil {
			if beforeIDStr != "" {
				if beforeID, err2 := strconv.ParseUint(beforeIDStr, 10, 64); err2 == nil && beforeID > 0 {
					// Stable cursor with (created_at, id)
					dbq = dbq.Where("(created_at < ?) OR (created_at = ? AND id < ?)", beforeTime, beforeTime, uint(beforeID))
				} else {
					dbq = dbq.Where("created_at < ?", beforeTime)
				}
			} else {
				dbq = dbq.Where("created_at < ?", beforeTime)
			}
		}
	}

	var posts []database.UserPost
	dbq.Order("created_at desc").Order("id desc").Limit(limit).Find(&posts)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(posts)
}

func handleUserPostReplies(w http.ResponseWriter, r *http.Request) {
	session := auth.GetSessionFromRequest(r)

	if r.Method == http.MethodDelete {
		idStr := r.URL.Query().Get("id")
		if idStr == "" {
			http.Error(w, "id is required", http.StatusBadRequest)
			return
		}

		replyID64, err := strconv.ParseUint(idStr, 10, 64)
		if err != nil || replyID64 == 0 {
			http.Error(w, "invalid id", http.StatusBadRequest)
			return
		}

		result := database.DB.Where("id = ? AND user_id = ?", uint(replyID64), session.UserID).Delete(&database.UserPostReply{})
		if result.RowsAffected == 0 {
			http.Error(w, "Reply not found or not yours", http.StatusNotFound)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"message": "Deleted"})
		return
	}

	if r.Method == http.MethodPost {
		var req struct {
			PostID  uint   `json:"post_id"`
			Content string `json:"content"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}

		req.Content = strings.TrimSpace(req.Content)
		if req.PostID == 0 {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{"error": "post_id wajib"})
			return
		}

		if len(req.Content) == 0 || len(req.Content) > 500 {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{"error": "Konten balasan harus 1-500 karakter"})
			return
		}

		var post database.UserPost
		if err := database.DB.First(&post, req.PostID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				http.Error(w, "Post not found", http.StatusNotFound)
				return
			}
			http.Error(w, "Failed to check post", http.StatusInternalServerError)
			return
		}

		var user database.User
		database.DB.First(&user, session.UserID)

		reply := database.UserPostReply{
			PostID:      req.PostID,
			UserID:      session.UserID,
			Content:     req.Content,
			AuthorName:  session.Name,
			AuthorEmail: user.Email,
		}
		if reply.AuthorName == "" {
			reply.AuthorName = strings.Split(user.Email, "@")[0]
		}

		if err := database.DB.Create(&reply).Error; err != nil {
			http.Error(w, "Failed to create reply", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(reply)
		return
	}

	postIDStr := r.URL.Query().Get("post_id")
	if postIDStr == "" {
		http.Error(w, "post_id is required", http.StatusBadRequest)
		return
	}

	postID64, err := strconv.ParseUint(postIDStr, 10, 64)
	if err != nil || postID64 == 0 {
		http.Error(w, "invalid post_id", http.StatusBadRequest)
		return
	}

	var replies []database.UserPostReply
	database.DB.Where("post_id = ?", uint(postID64)).Order("created_at asc").Limit(200).Find(&replies)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(replies)
}
