package pikpak

import (
	"crypto/md5"
	"crypto/rand"
	"crypto/sha1"
	"encoding/hex"
	"fmt"
	"strconv"
	"strings"
	"time"
)

// FormatBytes converts bytes to human readable string
func FormatBytes(bytes int64) string {
	const unit = 1024
	if bytes < unit {
		return fmt.Sprintf("%d B", bytes)
	}
	div, exp := int64(unit), 0
	for n := bytes / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.2f %cB", float64(bytes)/float64(div), "KMGTPE"[exp])
}

// FormatTime formats time to string
func FormatTime(t time.Time) string {
	return t.Format("2006-01-02 15:04:05")
}

const (
	ClientID      = "YNxT9w7GMdWvEOKa"
	ClientSecret  = "dbw2OtmVEeuUvIptb1Coyg"
	ClientVersion = "1.47.1"
	PackageName   = "com.pikcloud.pikpak"
	SDKVersion    = "2.0.4.204000 "
	AppName       = PackageName
)

var Salts = []string{
	"Gez0T9ijiI9WCeTsKSg3SMlx",
	"zQdbalsolyb1R/",
	"ftOjr52zt51JD68C3s",
	"yeOBMH0JkbQdEFNNwQ0RI9T3wU/v",
	"BRJrQZiTQ65WtMvwO",
	"je8fqxKPdQVJiy1DM6Bc9Nb1",
	"niV",
	"9hFCW2R1",
	"sHKHpe2i96",
	"p7c5E6AcXQ/IJUuAEC9W6",
	"",
	"aRv9hjc9P+Pbn+u3krN6",
	"BzStcgE8qVdqjEH16l4",
	"SqgeZvL5j9zoHP95xWHt",
	"zVof5yaJkPe3VFpadPof",
}

func GetTimestamp() string {
	return strconv.FormatInt(time.Now().UnixMilli(), 10)
}

func GenerateDeviceID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func GenerateDeterministicDeviceID(data string) string {
	hash := md5.Sum([]byte(data))
	return hex.EncodeToString(hash[:])
}

func MD5(text string) string {
	hash := md5.Sum([]byte(text))
	return hex.EncodeToString(hash[:])
}

func SHA1(text string) string {
	hash := sha1.Sum([]byte(text))
	return hex.EncodeToString(hash[:])
}

func CaptchaSign(deviceID, timestamp string) string {
	sign := ClientID + ClientVersion + PackageName + deviceID + timestamp
	for _, salt := range Salts {
		sign = MD5(sign + salt)
	}
	return "1." + sign
}

func GenerateDeviceSign(deviceID, packageName string) string {
	signatureBase := deviceID + packageName + "1appkey"
	sha1Result := SHA1(signatureBase)
	md5Result := MD5(sha1Result)
	return fmt.Sprintf("div101.%s%s", deviceID, md5Result)
}

func BuildCustomUserAgent(deviceID, userID string) string {
	deviceSign := GenerateDeviceSign(deviceID, PackageName)

	parts := []string{
		fmt.Sprintf("ANDROID-%s/%s", AppName, ClientVersion),
		"protocolVersion/200",
		"accesstype/",
		fmt.Sprintf("clientid/%s", ClientID),
		fmt.Sprintf("clientversion/%s", ClientVersion),
		"action_type/",
		"networktype/WIFI",
		"sessionid/",
		fmt.Sprintf("deviceid/%s", deviceID),
		"providername/NONE",
		fmt.Sprintf("devicesign/%s", deviceSign),
		"refresh_token/",
		fmt.Sprintf("sdkversion/%s", SDKVersion),
		fmt.Sprintf("datetime/%s", GetTimestamp()),
		fmt.Sprintf("usrno/%s", userID),
		fmt.Sprintf("appname/%s", AppName),
		"session_origin/",
		"grant_type/",
		"appid/",
		"clientip/",
		"devicename/Xiaomi_M2004j7ac",
		"osversion/13",
		"platformversion/10",
		"accessmode/",
		"devicemodel/M2004J7AC",
	}

	return strings.Join(parts, " ")
}
