package database

import (
	"time"
)

// User represents a user in the system
type User struct {
	ID                 uint       `gorm:"primaryKey" json:"id"`
	Email              string     `gorm:"unique;not null" json:"email"`
	Name               string     `json:"name"`
	EmailVerified      bool       `gorm:"default:false" json:"email_verified"`
	EmailVerifyToken   string     `gorm:"index" json:"-"`
	EmailVerifyExp     *time.Time `json:"-"`
	PasswordResetToken string     `gorm:"index" json:"-"`
	PasswordResetExp   *time.Time `json:"-"`
	Password           string     `gorm:"not null" json:"-"`
	Role               string     `gorm:"default:'client'" json:"role"` // "client" or "admin"
	IsActive           bool       `gorm:"default:true" json:"is_active"`
	Picture            string     `json:"picture"`
	Balance            int64      `gorm:"default:0" json:"balance"`
	PikPakFolderID     string     `json:"pikpak_folder_id"`   // User's dedicated folder in PikPak
	PikPakFolderName   string     `json:"pikpak_folder_name"` // Folder name (username_XXXX)
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`

	Transactions    []Transaction    `gorm:"foreignKey:UserID" json:"-"`
	Notifications   []Notification   `gorm:"foreignKey:UserID" json:"-"`
	PremiumRequests []PremiumRequest `gorm:"foreignKey:UserID" json:"-"`
}

// Transaction represents a balance transaction (topup or download)
type Transaction struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	UserID      uint      `gorm:"not null" json:"user_id"`
	Amount      int64     `gorm:"not null" json:"amount"` // Positive for topup, negative for download
	Type        string    `gorm:"not null" json:"type"`   // "topup" or "download"
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
}

// TopUpRequest represents a manual top-up submission that requires admin confirmation.
// It is separate from Transaction so pending requests can be tracked without affecting balance.
type TopUpRequest struct {
	ID             uint       `gorm:"primaryKey" json:"id"`
	Serial         string     `gorm:"index" json:"serial"` // human-friendly reference code
	UserID         uint       `gorm:"index;not null" json:"user_id"`
	Username       string     `json:"username"` // snapshot of user name/email at submission time
	Amount         int64      `gorm:"not null" json:"amount"`
	PaymentMethod  string     `gorm:"not null" json:"payment_method"`                    // gopay, bri, bank_jago, crypto_usdt
	PaymentAccount string     `gorm:"not null" json:"payment_account"`                   // destination identifier displayed to user
	Status         string     `gorm:"not null;default:'awaiting_payment'" json:"status"` // awaiting_payment, pending, approved, rejected, cancelled, expired
	ExpiresAt      time.Time  `gorm:"index" json:"expires_at"`
	PaidAt         *time.Time `json:"paid_at"`
	CancelledAt    *time.Time `json:"cancelled_at"`
	AdminReason    string     `json:"admin_reason"`
	DecidedAt      *time.Time `json:"decided_at"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

// Notification represents a notification for a user
type Notification struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    uint      `gorm:"not null" json:"user_id"`
	Title     string    `gorm:"not null" json:"title"`
	Message   string    `gorm:"not null" json:"message"`
	IsRead    bool      `gorm:"default:false" json:"is_read"`
	CreatedAt time.Time `json:"created_at"`
}

// PremiumRequest represents a premium host download request (Real-Debrid)
type PremiumRequest struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    uint      `gorm:"not null" json:"user_id"`
	URL       string    `gorm:"not null" json:"url"`
	Filename  string    `json:"filename"`
	Host      string    `json:"host"`
	SizeBytes int64     `gorm:"default:0" json:"size_bytes"`
	Price     int64     `gorm:"default:0" json:"price"`
	Status    string    `gorm:"default:'pending'" json:"status"` // pending, processing, done, failed
	ResultURL string    `json:"result_url"`                      // Direct link download
	StreamURL string    `json:"stream_url"`                      // Optional streaming URL
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Pricing represents configurable pricing for different service types
type Pricing struct {
	ID           uint   `gorm:"primaryKey" json:"id"`
	ServiceType  string `gorm:"unique;not null" json:"service_type"`    // "torrent" or "premium"
	DisplayName  string `gorm:"not null" json:"display_name"`           // "Torrent/Magnet" or "Premium Host"
	PricePerUnit int64  `gorm:"not null" json:"price_per_unit"`         // Price in Rupiah
	UnitSizeGB   int    `gorm:"not null;default:1" json:"unit_size_gb"` // GB per unit (1 for torrent, 2 for premium)
	Description  string `json:"description"`                            // e.g. "Rp 650/GB"
	IsActive     bool   `gorm:"default:true" json:"is_active"`
}

// CalculatePrice calculates the total price for a given size in bytes
func (p *Pricing) CalculatePrice(sizeBytes int64) (price int64, chargedUnits int, chargedGB int) {
	sizeGB := float64(sizeBytes) / (1024 * 1024 * 1024)

	// Round up to the nearest unit size
	chargedGB = int(sizeGB)
	if float64(chargedGB) < sizeGB {
		chargedGB++
	}
	if chargedGB < p.UnitSizeGB {
		chargedGB = p.UnitSizeGB
	}

	// Round up to multiple of unit size
	chargedUnits = chargedGB / p.UnitSizeGB
	if chargedGB%p.UnitSizeGB != 0 {
		chargedUnits++
	}
	chargedGB = chargedUnits * p.UnitSizeGB

	price = int64(chargedUnits) * p.PricePerUnit
	return
}

// Voucher represents discount rules that can be applied on /input checkout.
// DiscountType: "percentage" or "fixed"
// AppliesTo: "all", "torrent", or "premium"
type Voucher struct {
	ID                uint       `gorm:"primaryKey" json:"id"`
	Code              string     `gorm:"uniqueIndex;not null" json:"code"`
	Name              string     `json:"name"`
	Description       string     `json:"description"`
	DiscountType      string     `gorm:"not null;default:'percentage'" json:"discount_type"`
	DiscountValue     int64      `gorm:"not null;default:0" json:"discount_value"`
	MinOrderAmount    int64      `gorm:"not null;default:0" json:"min_order_amount"`
	MinDiscountAmount int64      `gorm:"not null;default:0" json:"min_discount_amount"`
	MaxDiscountAmount int64      `gorm:"not null;default:0" json:"max_discount_amount"` // 0 = no cap
	AppliesTo         string     `gorm:"not null;default:'all'" json:"applies_to"`
	UsageScope        string     `gorm:"not null;default:'global'" json:"usage_scope"` // global or per_user
	UsageLimit        int        `gorm:"not null;default:0" json:"usage_limit"` // 0 = unlimited
	UsedCount         int        `gorm:"not null;default:0" json:"used_count"`
	StartsAt          *time.Time `json:"starts_at"`
	EndsAt            *time.Time `json:"ends_at"`
	IsActive          bool       `gorm:"default:true" json:"is_active"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
}

// VoucherUsage stores voucher usage entries to support per-user quota checks.
type VoucherUsage struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	VoucherID uint      `gorm:"index;not null" json:"voucher_id"`
	UserID    uint      `gorm:"index;not null" json:"user_id"`
	CreatedAt time.Time `json:"created_at"`
}

// Banner represents an admin-created banner/slider for information page
type Banner struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Title       string    `gorm:"not null" json:"title"`
	Description string    `json:"description"`
	Image       string    `json:"image"` // Optional image URL
	Color       string    `json:"color"` // Gradient CSS string
	IsActive    bool      `gorm:"default:true" json:"is_active"`
	SortOrder   int       `gorm:"default:0" json:"sort_order"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// OfficialPost represents an admin-created official announcement
type OfficialPost struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Title     string    `gorm:"not null" json:"title"`
	Content   string    `gorm:"type:text;not null" json:"content"`
	Type      string    `gorm:"default:'info'" json:"type"` // info, update, tip, warning
	Author    string    `gorm:"default:'Admin'" json:"author"`
	IsActive  bool      `gorm:"default:true" json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// UserPost represents a user-created post in the feed
type UserPost struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	UserID      uint      `gorm:"not null" json:"user_id"`
	Content     string    `gorm:"type:text;not null" json:"content"`
	AuthorName  string    `json:"author_name"`
	AuthorEmail string    `json:"author_email"`
	Picture     string    `json:"picture"` // User's profile picture URL
	Role        string    `json:"role"`    // User's role (admin, client, etc)
	CreatedAt   time.Time `json:"created_at"`
}

// UserPostReply represents a reply/comment to a UserPost
type UserPostReply struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	PostID      uint      `gorm:"index;not null" json:"post_id"`
	UserID      uint      `gorm:"index;not null" json:"user_id"`
	Content     string    `gorm:"type:text;not null" json:"content"`
	AuthorName  string    `json:"author_name"`
	AuthorEmail string    `json:"author_email"`
	Picture     string    `json:"picture"` // User's profile picture URL
	Role        string    `json:"role"`    // User's role (admin, client, etc)
	CreatedAt   time.Time `json:"created_at"`
}

// UserUsage tracks service usage events for monitoring/analytics.
// service_type: torrent | premium
type UserUsage struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	UserID      uint      `gorm:"index;not null" json:"user_id"`
	ServiceType string    `gorm:"index;not null" json:"service_type"`
	Source      string    `gorm:"type:text" json:"source"`
	CreatedAt   time.Time `json:"created_at"`
}

// HostAvailability represents admin-controlled host availability toggle
type HostAvailability struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Name        string    `gorm:"uniqueIndex;not null" json:"name"`
	IsAvailable bool      `gorm:"default:true" json:"is_available"`
	UpdatedAt   time.Time `json:"updated_at"`
}
