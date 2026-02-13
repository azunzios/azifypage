package realdebrid

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
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

// LinkCheckResult is a normalized response for link check info.
type LinkCheckResult struct {
	Filename  string `json:"filename"`
	Filesize  int64  `json:"filesize"`
	Host      string `json:"host"`
	Supported bool   `json:"supported"`
}

// UnrestrictedLinkResult contains direct downloadable URL from Real-Debrid.
type UnrestrictedLinkResult struct {
	ID       string `json:"id"`
	Filename string `json:"filename"`
	Filesize int64  `json:"filesize"`
	Host     string `json:"host"`
	Download string `json:"download"`
}

func (c *Client) postForm(endpoint string, form url.Values) (map[string]any, error) {
	req, err := http.NewRequest("POST", c.BaseURL+endpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	if c.APIKey != "" {
		req.Header.Set("Authorization", "Bearer "+c.APIKey)
	}

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("API error %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	var out map[string]any
	if err := json.NewDecoder(bytes.NewReader(body)).Decode(&out); err != nil {
		return nil, err
	}
	return out, nil
}

func parseInt64Any(v any) int64 {
	switch t := v.(type) {
	case float64:
		return int64(t)
	case int64:
		return t
	case int:
		return int64(t)
	case json.Number:
		n, _ := t.Int64()
		return n
	case string:
		n, _ := strconv.ParseInt(strings.TrimSpace(t), 10, 64)
		return n
	default:
		return 0
	}
}

func parseBoolAny(v any) bool {
	switch t := v.(type) {
	case bool:
		return t
	case float64:
		return t != 0
	case string:
		t = strings.ToLower(strings.TrimSpace(t))
		return t == "1" || t == "true" || t == "yes"
	default:
		return false
	}
}

// CheckLink checks URL validity and returns filename/filesize when available.
func (c *Client) CheckLink(link string) (LinkCheckResult, error) {
	if strings.TrimSpace(c.APIKey) == "" {
		return LinkCheckResult{}, fmt.Errorf("REALDEBRID_API_KEY belum diatur")
	}
	out, err := c.postForm("/unrestrict/check", url.Values{"link": []string{strings.TrimSpace(link)}})
	if err != nil {
		return LinkCheckResult{}, err
	}

	result := LinkCheckResult{
		Filename:  strings.TrimSpace(fmt.Sprintf("%v", out["filename"])),
		Filesize:  parseInt64Any(out["filesize"]),
		Host:      strings.TrimSpace(fmt.Sprintf("%v", out["host"])),
		Supported: true,
	}
	if _, ok := out["supported"]; ok {
		result.Supported = parseBoolAny(out["supported"])
	}
	return result, nil
}

// UnrestrictLink converts a premium host link into direct downloadable link.
func (c *Client) UnrestrictLink(link string) (UnrestrictedLinkResult, error) {
	if strings.TrimSpace(c.APIKey) == "" {
		return UnrestrictedLinkResult{}, fmt.Errorf("REALDEBRID_API_KEY belum diatur")
	}
	out, err := c.postForm("/unrestrict/link", url.Values{"link": []string{strings.TrimSpace(link)}})
	if err != nil {
		return UnrestrictedLinkResult{}, err
	}

	result := UnrestrictedLinkResult{
		ID:       strings.TrimSpace(fmt.Sprintf("%v", out["id"])),
		Filename: strings.TrimSpace(fmt.Sprintf("%v", out["filename"])),
		Filesize: parseInt64Any(out["filesize"]),
		Host:     strings.TrimSpace(fmt.Sprintf("%v", out["host"])),
		Download: strings.TrimSpace(fmt.Sprintf("%v", out["download"])),
	}
	if result.Download == "" || result.Download == "<nil>" {
		return UnrestrictedLinkResult{}, fmt.Errorf("link direct download tidak tersedia")
	}
	return result, nil
}

// GetStreamingLink returns one available transcoding URL for a file id.
func (c *Client) GetStreamingLink(fileID string) (string, error) {
	fileID = strings.TrimSpace(fileID)
	if fileID == "" {
		return "", fmt.Errorf("file id kosong")
	}
	req, err := http.NewRequest("GET", c.BaseURL+"/streaming/transcode/"+url.PathEscape(fileID), nil)
	if err != nil {
		return "", err
	}
	if c.APIKey != "" {
		req.Header.Set("Authorization", "Bearer "+c.APIKey)
	}

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("API error %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	var out map[string]any
	if err := json.NewDecoder(bytes.NewReader(body)).Decode(&out); err != nil {
		return "", err
	}

	priorities := []string{"dash", "hls", "full", "1080", "720", "480", "360", "240"}
	for _, k := range priorities {
		if v, ok := out[k]; ok {
			s := strings.TrimSpace(fmt.Sprintf("%v", v))
			if s != "" && s != "<nil>" {
				return s, nil
			}
		}
	}
	for _, v := range out {
		s := strings.TrimSpace(fmt.Sprintf("%v", v))
		if strings.HasPrefix(s, "http") {
			return s, nil
		}
	}

	return "", nil
}
