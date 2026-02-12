package auth

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"os"
	"sync"
	"time"

	"golang.org/x/crypto/bcrypt"
)

// Simple in-memory session store (use Redis in production)
var (
	sessions = make(map[string]*Session)
	mu       sync.RWMutex
)

type Session struct {
	UserID    uint      `json:"user_id"`
	Email     string    `json:"email"`
	Name      string    `json:"name"`
	Picture   string    `json:"picture"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"created_at"`
	ExpiresAt time.Time `json:"expires_at"`
}

const SessionCookieName = "azify_session"

// GenerateState generates a random state string for OAuth
func GenerateState() string {
	b := make([]byte, 32)
	rand.Read(b)
	return base64.URLEncoding.EncodeToString(b)
}

// CreateSession creates a new session for the user
func CreateSession(userID uint, email, name, picture, role string) string {
	sessionID := GenerateState()

	mu.Lock()
	sessions[sessionID] = &Session{
		UserID:    userID,
		Email:     email,
		Name:      name,
		Picture:   picture,
		Role:      role,
		CreatedAt: time.Now(),
		ExpiresAt: time.Now().Add(7 * 24 * time.Hour), // 7 days
	}
	mu.Unlock()

	return sessionID
}

// GetSession gets session by ID
func GetSession(sessionID string) *Session {
	mu.RLock()
	defer mu.RUnlock()

	session, ok := sessions[sessionID]
	if !ok {
		return nil
	}

	if time.Now().After(session.ExpiresAt) {
		return nil
	}

	return session
}

// DeleteSession removes a session
func DeleteSession(sessionID string) {
	mu.Lock()
	delete(sessions, sessionID)
	mu.Unlock()
}

// SetSessionCookie sets the session cookie
func SetSessionCookie(w http.ResponseWriter, sessionID string) {
	secure := os.Getenv("ENV") == "production"
	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookieName,
		Value:    sessionID,
		Path:     "/",
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   7 * 24 * 60 * 60, // 7 days
	})
}

// ClearSessionCookie clears the session cookie
func ClearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		MaxAge:   -1,
	})
}

// GetSessionFromRequest gets session from request cookie
func GetSessionFromRequest(r *http.Request) *Session {
	cookie, err := r.Cookie(SessionCookieName)
	if err != nil {
		return nil
	}
	return GetSession(cookie.Value)
}

// RequireAuth middleware checks if user is authenticated
func RequireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		session := GetSessionFromRequest(r)
		if session == nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(map[string]string{"error": "unauthorized"})
			return
		}
		next(w, r)
	}
}

// RequireAdmin middleware checks if user is authenticated and has admin role
func RequireAdmin(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		session := GetSessionFromRequest(r)
		if session == nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(map[string]string{"error": "unauthorized"})
			return
		}
		if session.Role != "admin" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusForbidden)
			json.NewEncoder(w).Encode(map[string]string{"error": "forbidden: admin access required"})
			return
		}
		next(w, r)
	}
}

// HashPassword hashes a password using bcrypt
func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(bytes), err
}

// CheckPassword checks if password matches the hash
func CheckPassword(hash, password string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}
