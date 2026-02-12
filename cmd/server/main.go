package main

import (
	"bufio"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
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
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/youming-ai/pikpak-downloader/internal/auth"
	"github.com/youming-ai/pikpak-downloader/internal/database"
	"github.com/youming-ai/pikpak-downloader/internal/pikpak"
	"github.com/youming-ai/pikpak-downloader/internal/realdebrid"
	"gorm.io/gorm"
)

var globalClient *pikpak.Client
var rdClient *realdebrid.Client

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
	rdClient = realdebrid.NewClient("")

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
	http.HandleFunc("/api/auth/logout", handleLogout)
	http.HandleFunc("/api/auth/me", handleAuthMe)

	// PikPak API Endpoints (protected)
	http.HandleFunc("/api/files", auth.RequireAuth(handleListFiles))
	http.HandleFunc("/api/file/link", auth.RequireAuth(handleGetDownloadLink))
	http.HandleFunc("/api/folder/download", auth.RequireAuth(handleDownloadFolder))
	http.HandleFunc("/api/task", auth.RequireAuth(handleAddOfflineTask))

	// User & Database API Endpoints (protected)
	http.HandleFunc("/api/user", auth.RequireAuth(handleGetUser))
	http.HandleFunc("/api/notifications", auth.RequireAuth(handleNotifications))
	http.HandleFunc("/api/transactions", auth.RequireAuth(handleTransactions))
	http.HandleFunc("/api/hosts", handleGetHosts)     // Public
	http.HandleFunc("/api/pricing", handleGetPricing) // Public
	http.HandleFunc("/api/premium/request", auth.RequireAuth(handlePremiumRequest))

	// Admin Endpoints (protected by admin role)
	http.HandleFunc("/api/admin/users", auth.RequireAdmin(handleAdminUsers))
	http.HandleFunc("/api/admin/pricing", auth.RequireAdmin(handleAdminPricing))
	http.HandleFunc("/api/admin/stats", auth.RequireAdmin(handleAdminStats))
	http.HandleFunc("/api/admin/user/balance", auth.RequireAdmin(handleAdminUserBalance))
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
			Email:            googleUser.Email,
			Balance:          0,
			PikPakFolderID:   folderID,
			PikPakFolderName: folderName,
		}
		database.DB.Create(&user)

		// Welcome notification
		notification := database.Notification{
			UserID:  user.ID,
			Title:   "Selamat datang!",
			Message: fmt.Sprintf("Halo %s! Terima kasih telah bergabung di azify.page", googleUser.Name),
		}
		database.DB.Create(&notification)
	}

	// Create session
	sessionID := auth.CreateSession(user.ID, user.Email, googleUser.Name, googleUser.Picture, user.Role)
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

	// Create session
	sessionID := auth.CreateSession(user.ID, user.Email, user.Email, "", user.Role)
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
		Email:            req.Email,
		Password:         hashedPassword,
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
	sessionID := auth.CreateSession(user.ID, user.Email, user.Email, "", user.Role)
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

	var unreadCount int64
	database.DB.Model(&database.Notification{}).Where("user_id = ? AND is_read = ?", user.ID, false).Count(&unreadCount)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"authenticated":        true,
		"id":                   user.ID,
		"email":                user.Email,
		"name":                 session.Name,
		"picture":              session.Picture,
		"role":                 user.Role,
		"balance":              user.Balance,
		"balance_formatted":    fmt.Sprintf("Rp %d", user.Balance),
		"unread_notifications": unreadCount,
	})
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

	response := map[string]any{
		"id":                   user.ID,
		"email":                user.Email,
		"balance":              user.Balance,
		"balance_formatted":    fmt.Sprintf("Rp %d", user.Balance),
		"unread_notifications": unreadCount,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func handleNotifications(w http.ResponseWriter, r *http.Request) {
	session := auth.GetSessionFromRequest(r)

	if r.Method == http.MethodPost {
		var req struct {
			ID uint `json:"id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
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

	var transactions []database.Transaction
	database.DB.Where("user_id = ?", session.UserID).Order("created_at desc").Limit(50).Find(&transactions)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(transactions)
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

func handlePremiumRequest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	session := auth.GetSessionFromRequest(r)

	var req struct {
		URL string `json:"url"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
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
		URL string `json:"url"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

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
	var priceDisplay string

	if err == nil {
		price, chargedUnits, chargedGB = pricing.CalculatePrice(sizeBytes)
		priceDisplay = fmt.Sprintf("Rp %d", price)
	} else {
		// Fallback to default pricing
		sizeGB := float64(sizeBytes) / (1024 * 1024 * 1024)
		chargedGB = int(math.Ceil(sizeGB))
		if chargedGB < 1 && sizeBytes > 0 {
			chargedGB = 1
		}
		price = int64(chargedGB * 650)
		priceDisplay = fmt.Sprintf("Rp %d", price)
	}

	sizeGB := float64(sizeBytes) / (1024 * 1024 * 1024)

	response := map[string]any{
		"id":            id,
		"name":          name,
		"size":          pikpak.FormatBytes(sizeBytes),
		"size_gb":       fmt.Sprintf("%.2f GB", sizeGB),
		"charged_gb":    chargedGB,
		"charged_units": chargedUnits,
		"price":         price,
		"price_display": priceDisplay,
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

	files, err := globalClient.WalkFolderFiles(folderID)
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
	safeFolderName := strings.ReplaceAll(folderName, " ", "_")
	safeFolderName = strings.ReplaceAll(safeFolderName, "/", "_")
	safeFolderName = strings.ReplaceAll(safeFolderName, "\\", "_")

	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s_links.txt\"", safeFolderName))
	w.Write([]byte(sb.String()))
}

// ========== ADMIN HANDLERS ==========

func handleAdminUsers(w http.ResponseWriter, r *http.Request) {
	var users []database.User
	database.DB.Find(&users)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
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

func handleAdminUserBalance(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		UserID uint  `json:"user_id"`
		Amount int64 `json:"amount"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Update user balance
	result := database.DB.Model(&database.User{}).Where("id = ?", req.UserID).
		Update("balance", gorm.Expr("balance + ?", req.Amount))

	if result.Error != nil {
		http.Error(w, "Failed to update balance", http.StatusInternalServerError)
		return
	}

	// Create transaction record
	transType := "adjustment"
	description := fmt.Sprintf("Admin adjustment: %+d", req.Amount)
	if req.Amount > 0 {
		transType = "topup"
		description = fmt.Sprintf("Top Up (Admin): +Rp %d", req.Amount)
	}

	transaction := database.Transaction{
		UserID:      req.UserID,
		Amount:      req.Amount,
		Type:        transType,
		Description: description,
	}
	database.DB.Create(&transaction)

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
			updates["title"] = strings.TrimSpace(*req.Title)
		}
		if req.Content != nil {
			updates["content"] = strings.TrimSpace(*req.Content)
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

	// GET - list official posts
	var posts []database.OfficialPost
	database.DB.Where("is_active = ?", true).Order("created_at desc").Limit(20).Find(&posts)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(posts)
}

func handleAdminBanners(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodDelete {
		idStr := r.URL.Query().Get("id")
		if idStr == "" {
			http.Error(w, "id is required", http.StatusBadRequest)
			return
		}

		if err := database.DB.Delete(&database.Banner{}, idStr).Error; err != nil {
			http.Error(w, "Failed to delete banner", http.StatusInternalServerError)
			return
		}

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
		"url":       urlPath,
		"size_bytes": written,
		"width":      width,
		"height":     height,
		"max_size":   "1MB",
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

	// GET - list user posts
	var posts []database.UserPost
	database.DB.Order("created_at desc").Limit(50).Find(&posts)

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
