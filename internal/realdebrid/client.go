package realdebrid

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// Client is the Real-Debrid API client
type Client struct {
	APIKey     string
	HTTPClient *http.Client
	BaseURL    string
}

// HostStatus represents the status of a single host
type HostStatus struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Image       string `json:"image"`
	ImageBig    string `json:"image_big"`
	Supported   int    `json:"supported"`
	Status      string `json:"status"` // "up", "down", "unsupported"
	CheckTime   string `json:"check_time"`
	Competitors map[string]struct {
		Status string `json:"status"`
	} `json:"competitors_status,omitempty"`
}

// NewClient creates a new Real-Debrid client
func NewClient(apiKey string) *Client {
	return &Client{
		APIKey:  apiKey,
		BaseURL: "https://api.real-debrid.com/rest/1.0",
		HTTPClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// GetHostsStatus fetches the status of all supported hosts
func (c *Client) GetHostsStatus() (map[string]HostStatus, error) {
	req, err := http.NewRequest("GET", c.BaseURL+"/hosts/status", nil)
	if err != nil {
		return nil, err
	}

	// Add auth header if API key is set
	if c.APIKey != "" {
		req.Header.Set("Authorization", "Bearer "+c.APIKey)
	}

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API error %d: %s", resp.StatusCode, string(body))
	}

	var hosts map[string]HostStatus
	if err := json.NewDecoder(resp.Body).Decode(&hosts); err != nil {
		return nil, err
	}

	return hosts, nil
}

// SimplifiedHost represents a simplified host status for frontend
type SimplifiedHost struct {
	Name   string `json:"name"`
	Status string `json:"status"` // "online" or "offline"
}

// GetSimplifiedHosts returns a simplified list of hosts for frontend
func (c *Client) GetSimplifiedHosts() ([]SimplifiedHost, error) {
	hosts, err := c.GetHostsStatus()
	if err != nil {
		return nil, err
	}

	var result []SimplifiedHost

	// Popular hosts to display
	popularHosts := map[string]string{
		"rapidgator.net":  "Rapidgator",
		"uploaded.net":    "Uploaded",
		"nitroflare.com":  "Nitroflare",
		"turbobit.net":    "Turbobit",
		"mediafire.com":   "Mediafire",
		"mega.nz":         "Mega",
		"1fichier.com":    "1Fichier",
		"filefactory.com": "FileFactory",
		"uploadgig.com":   "UploadGig",
	}

	for domain, displayName := range popularHosts {
		status := "offline"
		if host, ok := hosts[domain]; ok {
			if host.Status == "up" {
				status = "online"
			}
		}
		result = append(result, SimplifiedHost{
			Name:   displayName,
			Status: status,
		})
	}

	return result, nil
}
