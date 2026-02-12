package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

var googleOAuthConfig *oauth2.Config

// GoogleUser represents user info from Google
type GoogleUser struct {
	ID            string `json:"id"`
	Email         string `json:"email"`
	VerifiedEmail bool   `json:"verified_email"`
	Name          string `json:"name"`
	GivenName     string `json:"given_name"`
	FamilyName    string `json:"family_name"`
	Picture       string `json:"picture"`
}

// InitGoogleOAuth initializes Google OAuth config
func InitGoogleOAuth() {
	googleOAuthConfig = &oauth2.Config{
		ClientID:     os.Getenv("GOOGLE_CLIENT_ID"),
		ClientSecret: os.Getenv("GOOGLE_CLIENT_SECRET"),
		RedirectURL:  getRedirectURL(),
		Scopes: []string{
			"https://www.googleapis.com/auth/userinfo.email",
			"https://www.googleapis.com/auth/userinfo.profile",
		},
		Endpoint: google.Endpoint,
	}
}

func getRedirectURL() string {
	baseURL := os.Getenv("BASE_URL")
	if baseURL == "" {
		baseURL = "http://localhost:8080"
	}
	return baseURL + "/api/auth/google/callback"
}

// GetGoogleLoginURL returns the URL to redirect user for Google login
func GetGoogleLoginURL(state string) string {
	return googleOAuthConfig.AuthCodeURL(state, oauth2.AccessTypeOffline)
}

// ExchangeCode exchanges auth code for tokens and returns user info
func ExchangeCode(ctx context.Context, code string) (*GoogleUser, error) {
	token, err := googleOAuthConfig.Exchange(ctx, code)
	if err != nil {
		return nil, fmt.Errorf("failed to exchange code: %w", err)
	}

	client := googleOAuthConfig.Client(ctx, token)
	resp, err := client.Get("https://www.googleapis.com/oauth2/v2/userinfo")
	if err != nil {
		return nil, fmt.Errorf("failed to get user info: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var user GoogleUser
	if err := json.Unmarshal(body, &user); err != nil {
		return nil, fmt.Errorf("failed to parse user info: %w", err)
	}

	return &user, nil
}

// IsConfigured returns true if Google OAuth is configured
func IsConfigured() bool {
	return os.Getenv("GOOGLE_CLIENT_ID") != "" && os.Getenv("GOOGLE_CLIENT_SECRET") != ""
}
