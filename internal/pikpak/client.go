package pikpak

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/url"
	"net/http"
	"path"
	"strings"
	"time"
)

const (
	AuthURL  = "https://user.mypikpak.com/v1/auth/token"
	DriveURL = "https://api-drive.mypikpak.com/drive/v1/files"
)

type Client struct {
	RefreshToken string
	AccessToken  string
	HTTPClient   *http.Client
	DeviceID     string
	UserID       string
}

// AuthResponse structure for login response
type AuthResponse struct {
	TokenType    string `json:"token_type"`
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
	Sub          string `json:"sub"`
	CaptchaToken string `json:"captcha_token"` // For captcha init response
}

// File structure for file list
type File struct {
	ID             string    `json:"id"`
	ParentID       string    `json:"parent_id"`
	Name           string    `json:"name"`
	Size           string    `json:"size"`
	Kind           string    `json:"kind"` // "drive#folder" or "drive#file"
	MimeType       string    `json:"mime_type"`
	Thumbnail      string    `json:"thumbnail_link"`
	WebContentLink string    `json:"web_content_link"`
	Created        time.Time `json:"created_time"`
	Modified       time.Time `json:"modified_time"`
}

// FileListResponse structure for file listing
type FileListResponse struct {
	Kind          string `json:"kind"`
	NextPageToken string `json:"next_page_token"`
	Files         []File `json:"files"`
}

// ManifestFile stores file metadata with relative path info for folder export/download manifests.
type ManifestFile struct {
	File
	RelativePath string `json:"relative_path"`
	FolderPath   string `json:"folder_path"`
}

func NewClient(refreshToken string, accessToken string) *Client {
	return &Client{
		RefreshToken: refreshToken,
		AccessToken:  accessToken,
		DeviceID:     GenerateDeviceID(),
		HTTPClient:   &http.Client{Timeout: 30 * time.Second},
	}
}

func (c *Client) getHeaders(captchaToken string) map[string]string {
	// Logic from Python: Use custom UA only if captcha token is present (login flow usually)

	// Default Chrome UA
	ua := "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"

	if captchaToken != "" {
		ua = BuildCustomUserAgent(c.DeviceID, c.UserID)
	}

	h := map[string]string{
		"Content-Type": "application/json; charset=utf-8",
		"User-Agent":   ua,
	}

	// Python code adds "X-Device-Id" always
	if c.DeviceID != "" {
		h["X-Device-Id"] = c.DeviceID
	}

	if captchaToken != "" {
		h["X-Captcha-Token"] = captchaToken
	}

	if c.AccessToken != "" {
		h["Authorization"] = "Bearer " + c.AccessToken
	}
	return h
}

// CaptchaInit gets the captcha token needed for login or other actions
func (c *Client) CaptchaInit(action string, meta map[string]any) (string, error) {
	url := "https://user.mypikpak.com/v1/shield/captcha/init"

	if meta == nil {
		ts := GetTimestamp()
		meta = map[string]any{
			"captcha_sign":   CaptchaSign(c.DeviceID, ts),
			"client_version": ClientVersion,
			"package_name":   PackageName,
			"user_id":        c.UserID,
			"timestamp":      ts,
		}
	}

	data := map[string]any{
		"client_id": ClientID,
		"action":    action,
		"device_id": c.DeviceID,
		"meta":      meta,
	}

	jsonData, _ := json.Marshal(data)
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", err
	}

	for k, v := range c.getHeaders("") {
		req.Header.Set(k, v)
	}

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return "", fmt.Errorf("captcha init failed: %s", string(body))
	}

	var rResp AuthResponse
	if err := json.Unmarshal(body, &rResp); err != nil {
		return "", err
	}
	return rResp.CaptchaToken, nil
}

// GetDownloadUrl retrieves the download link for a file
func (c *Client) GetDownloadUrl(fileID string) (string, error) {
	action := fmt.Sprintf("GET:/drive/v1/files/%s", fileID)

	// 1. Get Captcha Token for this action
	captchaToken, err := c.CaptchaInit(action, nil)
	if err != nil {
		return "", fmt.Errorf("failed to init captcha for download: %v", err)
	}

	// 2. Get File Details with Captcha Token
	url := fmt.Sprintf("https://api-drive.mypikpak.com/drive/v1/files/%s?thumbnail_size=SIZE_LARGE", fileID)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return "", err
	}

	headers := c.getHeaders(captchaToken)
	for k, v := range headers {
		req.Header.Set(k, v)
	}

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return "", fmt.Errorf("get file info failed: %s", string(body))
	}

	var fileResp map[string]any
	if err := json.Unmarshal(body, &fileResp); err != nil {
		return "", err
	}

	if link, ok := fileResp["web_content_link"].(string); ok {
		return link, nil
	}

	return "", fmt.Errorf("web_content_link not found in response")
}

// CreateFolder creates a new folder in PikPak
func (c *Client) CreateFolder(name string, parentID string) (string, error) {
	url := "https://api-drive.mypikpak.com/drive/v1/files"

	data := map[string]any{
		"kind":      "drive#folder",
		"name":      name,
		"parent_id": parentID, // Empty string = root
	}

	jsonData, _ := json.Marshal(data)
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", err
	}

	for k, v := range c.getHeaders("") {
		req.Header.Set(k, v)
	}

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return "", fmt.Errorf("create folder failed: %s", string(body))
	}

	var result map[string]any
	if err := json.Unmarshal(body, &result); err != nil {
		return "", err
	}

	file, ok := result["file"].(map[string]any)
	if !ok {
		// Sometimes the response is the file object directly
		file = result
	}

	folderID, _ := file["id"].(string)
	return folderID, nil
}

// AddOfflineTask adds a magnet link or URL to be downloaded
func (c *Client) AddOfflineTask(fileURL string) (map[string]any, error) {
	return c.AddOfflineTaskToFolder(fileURL, "")
}

// AddOfflineTaskToFolder adds a magnet/URL to be downloaded to a specific folder
func (c *Client) AddOfflineTaskToFolder(fileURL string, parentFolderID string) (map[string]any, error) {
	url := "https://api-drive.mypikpak.com/drive/v1/files"

	data := map[string]any{
		"kind":        "drive#file",
		"upload_type": "UPLOAD_TYPE_URL",
		"url":         map[string]string{"url": fileURL},
	}

	// If parentFolderID is provided, use it; otherwise use default DOWNLOAD folder
	if parentFolderID != "" {
		data["parent_id"] = parentFolderID
	} else {
		data["folder_type"] = "DOWNLOAD"
	}

	jsonData, _ := json.Marshal(data)
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, err
	}

	// Standard headers
	for k, v := range c.getHeaders("") {
		req.Header.Set(k, v)
	}

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("add task failed: %s", string(body))
	}

	// Typically returns the file/task object
	var taskResp map[string]any
	if err := json.Unmarshal(body, &taskResp); err != nil {
		return nil, err
	}

	// Check for explicit error in body even if 200 OK (PikPak sometimes does this)
	if errCode, ok := taskResp["error_code"]; ok && errCode != 0 {
		return nil, fmt.Errorf("pikpak error: %v - %v", errCode, taskResp["error_description"])
	}

	return taskResp, nil
}

// DeleteTasks deletes tasks by ID
func (c *Client) DeleteTasks(taskIDs []string) error {
	url := "https://api-drive.mypikpak.com/drive/v1/tasks?task_ids=" + strings.Join(taskIDs, ",")

	req, err := http.NewRequest("DELETE", url, nil)
	if err != nil {
		return err
	}

	// Standard headers
	for k, v := range c.getHeaders("") {
		req.Header.Set(k, v)
	}

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 && resp.StatusCode != 204 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("delete failed: %d %s", resp.StatusCode, string(body))
	}

	return nil
}

// DeleteFile deletes (or trashes) a file/folder by ID
func (c *Client) DeleteFile(fileID string) error {
	action := "POST:/drive/v1/files:batchDelete"
	captchaToken, err := c.CaptchaInit(action, nil)
	if err != nil {
		return fmt.Errorf("failed to init captcha for delete: %v", err)
	}

	url := "https://api-drive.mypikpak.com/drive/v1/files:batchDelete"
	payload := map[string]any{
		"ids": []string{fileID},
	}
	jsonData, _ := json.Marshal(payload)
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return err
	}
	for k, v := range c.getHeaders(captchaToken) {
		req.Header.Set(k, v)
	}

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != 200 && resp.StatusCode != 204 {
		return fmt.Errorf("batch delete failed: %d %s", resp.StatusCode, string(body))
	}

	return nil
}

// Login performs the full login flow with username and password
func (c *Client) Login(username, password string) error {
	// Mimic Python: device_id = md5(username + password)
	c.DeviceID = GenerateDeterministicDeviceID(username + password)

	signinURL := "https://user.mypikpak.com/v1/auth/signin"
	action := "POST:" + signinURL

	// Construct meta for login
	ts := GetTimestamp()
	meta := map[string]any{
		"captcha_sign":   CaptchaSign(c.DeviceID, ts),
		"client_version": ClientVersion,
		"package_name":   PackageName,
		"user_id":        c.UserID,
		"timestamp":      ts,
	}

	// Heuristic using strings
	if strings.Contains(username, "@") {
		meta["email"] = username
	} else if len(username) >= 11 && len(username) <= 18 && strings.Trim(username, "0123456789") == "" {
		meta["phone_number"] = username
	} else {
		meta["username"] = username
	}

	captchaToken, err := c.CaptchaInit(action, meta)
	if err != nil {
		return err
	}

	data := map[string]string{
		"client_id":     ClientID,
		"client_secret": ClientSecret,
		"username":      username,
		"password":      password,
		"captcha_token": captchaToken,
	}

	// Login endpoint expects Content-Type: application/json or x-www-form-urlencoded?
	// Python code says: "Content-Type": "application/x-www-form-urlencoded" for login
	// BUT, it passes `login_data` to `_request_post`.
	// And `_request_post` calls `_make_request` which uses `json=data` by default UNLESS headers are set?
	// Wait, line 333 in python:
	// user_info = await self._request_post(login_url, login_data, {"Content-Type": "application/x-www-form-urlencoded"})
	// But `_request_post` implementation at line 242:
	// return await self._make_request("post", url, data=data, headers=headers)
	// And `_make_request` at line 200:
	// return await self.httpx_client.request(..., json=data, ...)
	// If json=data is used, it sets application/json.
	// If the python code forces header x-www-form-urlencoded but sends JSON, that's weird.
	// OPTION: The Python `httpx` client behavior with `json` param is to send JSON.
	// HOWEVER, the `_request_post` signature is `data` (dict).
	// The `_make_request` takes `data` (dict) and passes it to `json=` param of httpx.
	// So it IS sending JSON payload. The Content-Type header override might be ignored or conflicting.
	// Let's try JSON first as it's standard for their other endpoints.

	jsonData, _ := json.Marshal(data)
	req, err := http.NewRequest("POST", signinURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return err
	}

	// Use JSON content type
	req.Header.Set("Content-Type", "application/json; charset=utf-8")
	// Use custom User Agent
	req.Header.Set("User-Agent", BuildCustomUserAgent(c.DeviceID, c.UserID))

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return fmt.Errorf("login failed: %s", string(body))
	}

	var authResp AuthResponse
	if err := json.Unmarshal(body, &authResp); err != nil {
		return err
	}

	c.AccessToken = authResp.AccessToken
	c.RefreshToken = authResp.RefreshToken
	c.UserID = authResp.Sub

	return nil
}

// ValidateToken tries to use the current access token to ensure it works
func (c *Client) ValidateToken() error {
	// Try to list files with a limit of 1 just to check auth
	// Or we could check user info if there was an endpoint, but list files is sufficient
	_, err := c.ListFiles("")
	return err
}

// RefreshAccessToken gets a new access token using the refresh token
func (c *Client) RefreshAccessToken() error {
	if c.RefreshToken == "" {
		return fmt.Errorf("no refresh token provided")
	}
	data := map[string]string{
		"client_id":     ClientID,
		"grant_type":    "refresh_token",
		"refresh_token": c.RefreshToken,
	}
	jsonData, err := json.Marshal(data)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", AuthURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return fmt.Errorf("auth failed: status %d, body: %s", resp.StatusCode, string(body))
	}

	var authResp AuthResponse
	if err := json.Unmarshal(body, &authResp); err != nil {
		return err
	}

	c.AccessToken = authResp.AccessToken
	if authResp.RefreshToken != "" {
		c.RefreshToken = authResp.RefreshToken // Update refresh token if rotated
	}

	return nil
}

func (c *Client) listFilesPage(parentID, pageToken string, allowRefresh bool) (FileListResponse, error) {
	var emptyResp FileListResponse

	if c.AccessToken == "" {
		if err := c.RefreshAccessToken(); err != nil {
			return emptyResp, err
		}
	}

	// Match filters from Python client: {"trashed":{"eq":false},"phase":{"eq":"PHASE_TYPE_COMPLETE"}}
	reqURL := DriveURL + "?filters=%7B%22trashed%22%3A%7B%22eq%22%3Afalse%7D%2C%22phase%22%3A%7B%22eq%22%3A%22PHASE_TYPE_COMPLETE%22%7D%7D"
	if parentID != "" {
		reqURL += "&parent_id=" + url.QueryEscape(parentID)
	}
	if pageToken != "" {
		reqURL += "&page_token=" + url.QueryEscape(pageToken)
	}

	req, err := http.NewRequest("GET", reqURL, nil)
	if err != nil {
		return emptyResp, err
	}

	for k, v := range c.getHeaders("") {
		req.Header.Set(k, v)
	}

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return emptyResp, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != 200 {
		if resp.StatusCode == 401 && allowRefresh {
			if err := c.RefreshAccessToken(); err == nil {
				return c.listFilesPage(parentID, pageToken, false)
			}
		}
		return emptyResp, fmt.Errorf("list files failed: status %d, body: %s", resp.StatusCode, string(body))
	}

	var listResp FileListResponse
	if err := json.Unmarshal(body, &listResp); err != nil {
		return emptyResp, err
	}

	return listResp, nil
}

// ListFilesPage lists files in one page for a specific parent folder.
func (c *Client) ListFilesPage(parentID, pageToken string) ([]File, string, error) {
	listResp, err := c.listFilesPage(parentID, pageToken, true)
	if err != nil {
		return nil, "", err
	}
	return listResp.Files, listResp.NextPageToken, nil
}

// ListAllFiles lists all files in a specific folder (handles pagination via next_page_token).
func (c *Client) ListAllFiles(parentID string) ([]File, error) {
	var allFiles []File
	pageToken := ""

	for {
		files, nextPageToken, err := c.ListFilesPage(parentID, pageToken)
		if err != nil {
			return nil, err
		}

		allFiles = append(allFiles, files...)
		if nextPageToken == "" {
			break
		}
		pageToken = nextPageToken
	}

	return allFiles, nil
}

// ListFiles lists all files in a specific folder (backward compatible helper).
func (c *Client) ListFiles(parentID string) ([]File, error) {
	return c.ListAllFiles(parentID)
}

// WalkFolder recursively lists all files in a folder and returns plain download links
func (c *Client) WalkFolder(parentID string) ([]string, error) {
	var links []string

	files, err := c.ListAllFiles(parentID)
	if err != nil {
		return nil, err
	}

	for _, f := range files {
		if f.Kind == "drive#folder" {
			// Recurse
			subLinks, err := c.WalkFolder(f.ID)
			if err != nil {
				// Log error but continue? Or fail? Best to continue for partial results or fail hard.
				// Let's return error to be safe.
				return nil, err
			}
			links = append(links, subLinks...)
		} else {
			// It's a file
			if f.WebContentLink != "" {
				links = append(links, f.WebContentLink)
			} else {
				// Try to get link explicitly if missing (expensive fallback)
				// But usually ListFiles returns it.
				// If strictly missing, we might need a separate call.
				// For now, assume it's there or skip. Can add expensive fallback if user complains.
				l, _ := c.GetDownloadUrl(f.ID)
				if l != "" {
					links = append(links, l)
				}
			}
		}
	}

	return links, nil
}

// WalkFolderFiles recursively lists all files in a folder and returns File objects
func (c *Client) WalkFolderFiles(parentID string) ([]File, error) {
	var allFiles []File

	files, err := c.ListAllFiles(parentID)
	if err != nil {
		return nil, err
	}

	for _, f := range files {
		if f.Kind == "drive#folder" {
			// Recurse
			subFiles, err := c.WalkFolderFiles(f.ID)
			if err != nil {
				return nil, err
			}
			allFiles = append(allFiles, subFiles...)
		} else {
			// It's a file
			if f.WebContentLink == "" {
				l, _ := c.GetDownloadUrl(f.ID)
				f.WebContentLink = l
			}
			if f.WebContentLink != "" {
				allFiles = append(allFiles, f)
			}
		}
	}

	return allFiles, nil
}

// WalkFolderManifest recursively lists all files in a folder and returns metadata with relative paths.
func (c *Client) WalkFolderManifest(parentID string) ([]ManifestFile, error) {
	var allFiles []ManifestFile

	var walk func(currentID, currentPath string) error
	walk = func(currentID, currentPath string) error {
		files, err := c.ListAllFiles(currentID)
		if err != nil {
			return err
		}

		for _, f := range files {
			if f.Kind == "drive#folder" {
				nextPath := f.Name
				if currentPath != "" {
					nextPath = path.Join(currentPath, f.Name)
				}
				if err := walk(f.ID, nextPath); err != nil {
					return err
				}
				continue
			}

			if f.WebContentLink == "" {
				l, _ := c.GetDownloadUrl(f.ID)
				f.WebContentLink = l
			}
			if f.WebContentLink == "" {
				continue
			}

			relPath := f.Name
			folderPath := currentPath
			if currentPath != "" {
				relPath = path.Join(currentPath, f.Name)
			}

			allFiles = append(allFiles, ManifestFile{
				File:         f,
				RelativePath: relPath,
				FolderPath:   folderPath,
			})
		}

		return nil
	}

	if err := walk(parentID, ""); err != nil {
		return nil, err
	}

	return allFiles, nil
}
