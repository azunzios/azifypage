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