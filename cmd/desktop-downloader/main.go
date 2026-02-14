package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

type manifestResponse struct {
	FolderID   string          `json:"folder_id"`
	FolderName string          `json:"folder_name"`
	TotalFiles int             `json:"total_files"`
	Items      []manifestEntry `json:"items"`
}

type manifestEntry struct {
	FileID         string `json:"file_id"`
	Name           string `json:"name"`
	RelativePath   string `json:"relative_path"`
	Size           string `json:"size"`
	WebContentLink string `json:"web_content_link"`
}

type fileState struct {
	Status    string `json:"status"` // pending|done|failed
	Attempts  int    `json:"attempts"`
	Error     string `json:"error,omitempty"`
	UpdatedAt string `json:"updated_at"`
	Path      string `json:"path,omitempty"`
}

type stateStore struct {
	FolderID   string               `json:"folder_id"`
	FolderName string               `json:"folder_name"`
	UpdatedAt  string               `json:"updated_at"`
	Files      map[string]*fileState `json:"files"`
}

type downloadJob struct {
	Entry       manifestEntry
	Destination string
	Expected    int64
}

func main() {
	var (
		serverURL  = flag.String("server", "http://localhost:8080", "Base URL server")
		sessionID  = flag.String("session", "", "Nilai cookie azify_session")
		folderID   = flag.String("folder-id", "", "ID folder PikPak")
		folderName = flag.String("folder-name", "", "Nama folder (opsional)")
		outDir     = flag.String("out", "downloads", "Root output directory")
		workers    = flag.Int("workers", 4, "Jumlah worker download paralel")
		retries    = flag.Int("retries", 3, "Retry per file")
		timeoutSec = flag.Int("timeout", 180, "Timeout HTTP download (detik)")
	)
	flag.Parse()

	if strings.TrimSpace(*sessionID) == "" {
		fatal("--session wajib diisi (cookie azify_session)")
	}
	if strings.TrimSpace(*folderID) == "" {
		fatal("--folder-id wajib diisi")
	}
	if *workers < 1 {
		*workers = 1
	}
	if *retries < 1 {
		*retries = 1
	}

	manifest, err := fetchManifest(*serverURL, *sessionID, *folderID, *folderName)
	if err != nil {
		fatal("gagal ambil manifest: %v", err)
	}
	if manifest.FolderName == "" {
		manifest.FolderName = *folderID
	}

	baseDir := filepath.Join(*outDir, sanitizeName(manifest.FolderName))
	if err := os.MkdirAll(baseDir, 0o755); err != nil {
		fatal("gagal membuat folder output: %v", err)
	}

	statePath := filepath.Join(baseDir, ".download_state.json")
	state := loadState(statePath)
	if state.Files == nil {
		state.Files = map[string]*fileState{}
	}
	state.FolderID = manifest.FolderID
	state.FolderName = manifest.FolderName

	jobs := prepareJobs(manifest.Items, baseDir, state)
	if len(jobs) == 0 {
		fmt.Println("Semua file sudah selesai. Tidak ada job baru.")
		return
	}

	fmt.Printf("Manifest: %d file | Pending: %d | Output: %s\n", len(manifest.Items), len(jobs), baseDir)

	httpClient := &http.Client{Timeout: time.Duration(*timeoutSec) * time.Second}
	jobsCh := make(chan downloadJob)
	var completed int64
	var failed int64
	var mu sync.Mutex

	for i := 0; i < *workers; i++ {
		go func() {
			for job := range jobsCh {
				err := downloadWithRetry(httpClient, job, *retries)

				mu.Lock()
				fs := state.Files[job.Entry.FileID]
				if fs == nil {
					fs = &fileState{}
					state.Files[job.Entry.FileID] = fs
				}
				fs.Attempts += 1
				fs.Path = job.Entry.RelativePath
				fs.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
				if err != nil {
					fs.Status = "failed"
					fs.Error = err.Error()
					atomic.AddInt64(&failed, 1)
					fmt.Printf("[FAILED] %s -> %v\n", job.Entry.RelativePath, err)
				} else {
					fs.Status = "done"
					fs.Error = ""
					atomic.AddInt64(&completed, 1)
					fmt.Printf("[DONE]   %s\n", job.Entry.RelativePath)
				}
				state.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
				saveState(statePath, state)
				mu.Unlock()
			}
		}()
	}

	for _, job := range jobs {
		jobsCh <- job
	}
	close(jobsCh)

	for {
		doneCount := atomic.LoadInt64(&completed)
		failCount := atomic.LoadInt64(&failed)
		if int(doneCount+failCount) >= len(jobs) {
			break
		}
		time.Sleep(400 * time.Millisecond)
	}

	fmt.Printf("Selesai. Success=%d Failed=%d State=%s\n", completed, failed, statePath)
}

func fetchManifest(serverURL, sessionID, folderID, folderName string) (*manifestResponse, error) {
	base := strings.TrimRight(serverURL, "/") + "/api/folder/manifest"
	q := url.Values{}
	q.Set("folder_id", folderID)
	if strings.TrimSpace(folderName) != "" {
		q.Set("folder_name", folderName)
	}
	q.Set("format", "json")
	urlWithQuery := base + "?" + q.Encode()

	req, err := http.NewRequest(http.MethodGet, urlWithQuery, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Cookie", "azify_session="+sessionID)

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("status=%d body=%s", resp.StatusCode, string(body))
	}

	var out manifestResponse
	if err := json.Unmarshal(body, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func prepareJobs(items []manifestEntry, baseDir string, state *stateStore) []downloadJob {
	jobs := make([]downloadJob, 0, len(items))
	for _, item := range items {
		if strings.TrimSpace(item.WebContentLink) == "" {
			continue
		}
		if st, ok := state.Files[item.FileID]; ok && st != nil && st.Status == "done" {
			continue
		}

		rel := filepath.FromSlash(strings.TrimPrefix(item.RelativePath, "/"))
		dest := filepath.Join(baseDir, rel)
		expected := parseSize(item.Size)

		if expected > 0 {
			if fi, err := os.Stat(dest); err == nil && fi.Size() == expected {
				state.Files[item.FileID] = &fileState{
					Status:    "done",
					Attempts:  0,
					UpdatedAt: time.Now().UTC().Format(time.RFC3339),
					Path:      item.RelativePath,
				}
				continue
			}
		}

		jobs = append(jobs, downloadJob{Entry: item, Destination: dest, Expected: expected})
	}
	return jobs
}

func downloadWithRetry(client *http.Client, job downloadJob, retries int) error {
	var lastErr error
	for i := 0; i < retries; i++ {
		if err := downloadOne(client, job); err == nil {
			return nil
		} else {
			lastErr = err
			time.Sleep(time.Duration(i+1) * 700 * time.Millisecond)
		}
	}
	return lastErr
}

func downloadOne(client *http.Client, job downloadJob) error {
	if err := os.MkdirAll(filepath.Dir(job.Destination), 0o755); err != nil {
		return err
	}

	tmpPath := job.Destination + ".part"
	var existing int64
	if fi, err := os.Stat(tmpPath); err == nil {
		existing = fi.Size()
	}

	req, err := http.NewRequest(http.MethodGet, job.Entry.WebContentLink, nil)
	if err != nil {
		return err
	}
	if existing > 0 {
		req.Header.Set("Range", fmt.Sprintf("bytes=%d-", existing))
	}

	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusPartialContent {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return fmt.Errorf("status %d: %s", resp.StatusCode, string(body))
	}

	flag := os.O_CREATE | os.O_WRONLY
	if resp.StatusCode == http.StatusPartialContent && existing > 0 {
		flag |= os.O_APPEND
	} else {
		flag |= os.O_TRUNC
		existing = 0
	}

	f, err := os.OpenFile(tmpPath, flag, 0o644)
	if err != nil {
		return err
	}
	_, copyErr := io.Copy(f, resp.Body)
	closeErr := f.Close()
	if copyErr != nil {
		return copyErr
	}
	if closeErr != nil {
		return closeErr
	}

	if job.Expected > 0 {
		fi, err := os.Stat(tmpPath)
		if err != nil {
			return err
		}
		if fi.Size() != job.Expected {
			return fmt.Errorf("size mismatch: got=%d expected=%d", fi.Size(), job.Expected)
		}
	}

	if err := os.Rename(tmpPath, job.Destination); err != nil {
		return err
	}
	return nil
}

func parseSize(sizeStr string) int64 {
	n, err := strconv.ParseInt(strings.TrimSpace(sizeStr), 10, 64)
	if err != nil {
		return -1
	}
	return n
}

func loadState(path string) *stateStore {
	b, err := os.ReadFile(path)
	if err != nil {
		return &stateStore{Files: map[string]*fileState{}}
	}
	var st stateStore
	if err := json.Unmarshal(b, &st); err != nil {
		return &stateStore{Files: map[string]*fileState{}}
	}
	if st.Files == nil {
		st.Files = map[string]*fileState{}
	}
	return &st
}

func saveState(path string, st *stateStore) {
	st.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	b, err := json.MarshalIndent(st, "", "  ")
	if err != nil {
		return
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, b, 0o644); err != nil {
		return
	}
	_ = os.Rename(tmp, path)
}

func sanitizeName(name string) string {
	r := strings.TrimSpace(name)
	if r == "" {
		return "folder"
	}
	replacer := strings.NewReplacer("/", "_", "\\", "_", ":", "_", "*", "_", "?", "_", "\"", "_", "<", "_", ">", "_", "|", "_")
	return replacer.Replace(r)
}

func fatal(format string, args ...any) {
	msg := fmt.Sprintf(format, args...)
	fmt.Fprintln(os.Stderr, "Error:", msg)
	os.Exit(1)
}
