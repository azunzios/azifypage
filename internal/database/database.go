package database

import (
	"fmt"
	"log"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

// Config holds database configuration
type Config struct {
	Host     string
	Port     string
	User     string
	Password string
	DBName   string
}

// DefaultConfig returns the default database configuration
func DefaultConfig() Config {
	return Config{
		Host:     "localhost",
		Port:     "3306",
		User:     "root",
		Password: "",
		DBName:   "azify_db",
	}
}

// Connect establishes a connection to the MySQL database
func Connect(cfg Config) error {
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		cfg.User,
		cfg.Password,
		cfg.Host,
		cfg.Port,
		cfg.DBName,
	)

	var err error
	DB, err = gorm.Open(mysql.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		return fmt.Errorf("failed to connect to database: %w", err)
	}

	log.Println("✅ Database connected successfully")
	return nil
}

// AutoMigrate runs auto-migration for all models
func AutoMigrate() error {
	err := DB.AutoMigrate(
		&User{},
		&Transaction{},
		&TopUpRequest{},
		&Notification{},
		&PremiumRequest{},
		&Pricing{},
		&Banner{},
		&OfficialPost{},
		&UserPost{},
		&UserPostReply{},
		&UserUsage{},
		&HostAvailability{},
	)
	if err != nil {
		return fmt.Errorf("failed to auto-migrate: %w", err)
	}

	log.Println("✅ Database migration completed")
	return nil
}

// CreateDatabaseIfNotExists creates the database if it doesn't exist
func CreateDatabaseIfNotExists(cfg Config) error {
	// Connect without specifying database name
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/?charset=utf8mb4&parseTime=True&loc=Local",
		cfg.User,
		cfg.Password,
		cfg.Host,
		cfg.Port,
	)

	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		return fmt.Errorf("failed to connect to MySQL: %w", err)
	}

	// Create database if not exists
	createDBSQL := fmt.Sprintf("CREATE DATABASE IF NOT EXISTS %s CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci", cfg.DBName)
	if err := db.Exec(createDBSQL).Error; err != nil {
		return fmt.Errorf("failed to create database: %w", err)
	}

	log.Printf("✅ Database '%s' ready\n", cfg.DBName)
	return nil
}

// SeedDemoUser creates a demo user if none exists
func SeedDemoUser() error {
	var count int64
	DB.Model(&User{}).Count(&count)

	if count == 0 {
		user := User{
			Email:    "demo@azify.page",
			Password: "demo123", // In production, this should be hashed
			Role:     "admin",
			Balance:  50000,
		}
		if err := DB.Create(&user).Error; err != nil {
			return err
		}

		// Add some demo transactions
		transactions := []Transaction{
			{UserID: user.ID, Amount: 100000, Type: "topup", Description: "Top Up (BCA)"},
			{UserID: user.ID, Amount: -9500, Type: "download", Description: "Unduh: Inception.mkv"},
			{UserID: user.ID, Amount: -40500, Type: "download", Description: "Unduh: Ubuntu.iso"},
		}
		DB.Create(&transactions)

		// Add demo notification
		notification := Notification{
			UserID:  user.ID,
			Title:   "Selamat datang!",
			Message: "Terima kasih telah mendaftar di azify.page",
			IsRead:  false,
		}
		DB.Create(&notification)

		log.Println("✅ Demo user created: demo@azify.page")
	}

	return nil
}

// SeedDefaultPricing creates default pricing if none exists
func SeedDefaultPricing() error {
	var count int64
	DB.Model(&Pricing{}).Count(&count)

	if count == 0 {
		pricings := []Pricing{
			{
				ServiceType:  "torrent",
				DisplayName:  "Torrent/Magnet",
				PricePerUnit: 650,
				UnitSizeGB:   1,
				Description:  "Rp 650/GB",
				IsActive:     true,
			},
			{
				ServiceType:  "premium",
				DisplayName:  "Premium Host",
				PricePerUnit: 2000,
				UnitSizeGB:   2,
				Description:  "Rp 2.000/2GB",
				IsActive:     true,
			},
		}
		if err := DB.Create(&pricings).Error; err != nil {
			return err
		}

		log.Println("✅ Default pricing created")
	}

	return nil
}

// GetPricing retrieves pricing by service type
func GetPricing(serviceType string) (*Pricing, error) {
	var pricing Pricing
	if err := DB.Where("service_type = ? AND is_active = ?", serviceType, true).First(&pricing).Error; err != nil {
		return nil, err
	}
	return &pricing, nil
}

// GetAllPricing retrieves all active pricing
func GetAllPricing() ([]Pricing, error) {
	var pricings []Pricing
	if err := DB.Where("is_active = ?", true).Find(&pricings).Error; err != nil {
		return nil, err
	}
	return pricings, nil
}

// SeedDefaultBanners creates default banners if none exist
func SeedDefaultBanners() error {
	var count int64
	DB.Model(&Banner{}).Count(&count)

	if count == 0 {
		banners := []Banner{
			{
				Title:       "Selamat Datang di AzifyPage! 🎉",
				Description: "Platform download premium terpercaya. Nikmati layanan torrent dan host premium dengan harga terjangkau.",
				Color:       "linear-gradient(135deg, #009be5 0%, #0d47a1 100%)",
				IsActive:    true,
				SortOrder:   1,
			},
			{
				Title:       "Promo Saldo — Bonus 20%",
				Description: "Top up saldo minimal Rp 50.000 dan dapatkan bonus 20% untuk semua metode pembayaran.",
				Color:       "linear-gradient(135deg, #e91e63 0%, #9c27b0 100%)",
				IsActive:    true,
				SortOrder:   2,
			},
			{
				Title:       "Host Premium Tersedia",
				Description: "Rapidgator, Uploaded, Nitroflare, dan lainnya kini tersedia.",
				Color:       "linear-gradient(135deg, #ff9800 0%, #f44336 100%)",
				IsActive:    true,
				SortOrder:   3,
			},
		}
		if err := DB.Create(&banners).Error; err != nil {
			return err
		}
		log.Println("✅ Default banners created")
	}
	return nil
}

// SeedDefaultPosts creates default official posts if none exist
func SeedDefaultPosts() error {
	var count int64
	DB.Model(&OfficialPost{}).Count(&count)

	if count == 0 {
		posts := []OfficialPost{
			{
				Title:   "Selamat Datang!",
				Content: "Platform AzifyPage kini hadir untuk membantu kamu download dari berbagai host premium. Selamat menggunakan!",
				Type:    "info",
				Author:  "Admin",
			},
			{
				Title:   "Tips: Gunakan 1DM untuk Download Folder",
				Content: "Untuk download folder yang berisi banyak file, kami sarankan menggunakan 1DM di Android atau JDownloader di PC.",
				Type:    "tip",
				Author:  "Admin",
			},
		}
		if err := DB.Create(&posts).Error; err != nil {
			return err
		}
		log.Println("✅ Default official posts created")
	}
	return nil
}
