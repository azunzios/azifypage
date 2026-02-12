.PHONY: build run clean deps help
    
# Default target
help:
	@echo "PikPak SaaS Server"
	@echo ""
	@echo "Available commands:"
	@echo "  deps      - Install dependencies"
	@echo "  build     - Build server"
	@echo "  run       - Run server"
	@echo "  clean     - Clean build files"
	@echo "  help      - Show this help information"

# Install dependencies
deps:
	@echo "📦 Installing dependencies..."
	go mod tidy

# Build Server
build: deps
	@echo "🔨 Building Server..."
	go build -o saas-server cmd/server/main.go
	@echo "✅ Build completed: ./saas-server"

# Run Server
run:
	@echo "🚀 Starting Server..."
	go run cmd/server/main.go

# Clean build files
clean:
	@echo "🧹 Cleaning files..."
	rm -f saas-server pikpak-cli pikpak-cli.exe
	go clean -cache
