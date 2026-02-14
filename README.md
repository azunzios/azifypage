# PikPak SaaS Server (Go)

High-performance, lightweight backend for PikPak SaaS, written in Go.

## 🚀 Features

- **Blazing Fast**: Uses Go's efficiency to handle high concurrency.
- **Auto Login**: Automatically logs in and refreshes tokens using credentials from `.env`.
- **Smart Device ID**: Deterministic Device ID generation to bypass PikPak's CAPTCHA security.
- **Chrome User Agent**: Mimics a standard browser for API compatibility.
- **Simple Frontend**: Integrated lightweight HTML frontend for file management.

## 🛠️ Setup & Run

1.  **Configure `.env`**:
    Ensure you have a `.env` file in the root directory:
    ```env
    PIKPAK_USERNAME=your_email@example.com
    PIKPAK_PASSWORD=your_password
    PORT=8080
    ```

2.  **Run Server**:
    ```bash
    go run cmd/server/main.go
    ```
    OR using Makefile:
    ```bash
    make run
    ```

3.  **Access**:
    Open Browser: [http://localhost:8080](http://localhost:8080)

## 📁 Structure

- `cmd/server/main.go`: Main server entry point (Auth & API).
- `internal/pikpak/`: Core API logic (Client, Login, Devices).
- `static/`: Frontend assets (HTML).
- `PikPakAPI/`: Python Prototype (Reference).

## 🔒 Security Note
This project mimics a real device to authenticate with PikPak. Use responsibly.

## 📦 Prosedur Download Folder Besar (Tanpa ZIP)

Untuk folder besar (mis. game dengan ribuan file), gunakan **manifest-based download** supaya struktur folder tetap utuh dan proses bisa di-resume.

### 1) Ambil manifest metadata

Endpoint baru:

- `GET /api/folder/manifest?folder_id=<ID>&folder_name=<NAMA>&format=json`
- `GET /api/folder/manifest?folder_id=<ID>&folder_name=<NAMA>&format=jsonl`
- `GET /api/folder/manifest?folder_id=<ID>&folder_name=<NAMA>&format=aria2`

Contoh `curl` (perlu cookie login/session):

```bash
curl "http://localhost:8080/api/folder/manifest?folder_id=FOLDER_ID&folder_name=MyGame&format=json" -o manifest.json
```

Field penting per file:

- `file_id`
- `relative_path` (path relatif di dalam folder)
- `size`, `size_str`
- `modified_time`
- `web_content_link` (link download)

---

### 2) Cara pakai paling mudah (non-teknis)

Download folder sekarang difokuskan untuk **Chrome/Edge desktop** (Windows/macOS/Linux):

1. Login ke web app
2. Buka folder yang ingin diunduh
3. Klik **Download Folder**
4. Sistem membuka halaman baru `/download/folder` (fokus proses)
5. Klik **Pilih Folder & Mulai**
6. Pilih folder tujuan saat diminta browser
7. Pantau progres download sampai selesai

Catatan:

- Fitur ini tidak untuk Android/iOS
- Jika bukan Chrome/Edge desktop, tombol akan menampilkan peringatan browser tidak didukung

---

### 3) Cara cepat teknis: pakai aria2

Ambil format aria2:

```bash
curl "http://localhost:8080/api/folder/manifest?folder_id=FOLDER_ID&folder_name=MyGame&format=aria2" -o mygame_aria2.txt
```

Jalankan download:

```bash
aria2c --input-file=mygame_aria2.txt --continue=true --max-concurrent-downloads=5 --split=4 --retry-wait=5 --max-tries=0
```

Hasil download akan otomatis mengikuti struktur folder dari `relative_path`.

---

### 4) Opsi client custom (resumable + status file)

Gunakan format `jsonl` lalu simpan status per `file_id` (`pending/done/failed`).

Saran struktur lokal:

- `exports/<folder_id>/manifest.jsonl`
- `exports/<folder_id>/state.json`
- `downloads/<folder_name>/<relative_path>`

Flow minimal:

1. load manifest
2. skip file dengan status `done`
3. download paralel kecil (4–8 worker)
4. update state tiap file selesai
5. retry hanya `failed`

---

### 5) Client Go Desktop (langsung pakai)

Sudah tersedia command desktop:

- `cmd/desktop-downloader/main.go`

Fitur:

- fetch manifest otomatis dari API server
- download paralel (`--workers`)
- resume via file `.part`
- state file `.download_state.json` (retry hanya file gagal)
- mempertahankan struktur folder dari `relative_path`

Contoh pakai (desktop):

```bash
go run ./cmd/desktop-downloader \
    --server http://localhost:8080 \
    --session <AZIFY_SESSION_COOKIE> \
    --folder-id <FOLDER_ID> \
    --folder-name "MyGame" \
    --out downloads \
    --workers 6 \
    --retries 3
```

Build menjadi executable desktop:

```bash
go build -o pikpak-desktop-downloader.exe ./cmd/desktop-downloader
```

Cara ambil nilai `--session`:

1. Login di web app (`/`)
2. Buka DevTools browser → Application/Storage → Cookies
3. Ambil cookie `azify_session`
