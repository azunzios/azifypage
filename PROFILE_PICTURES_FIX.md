# Fix: Profile Pictures dari Uploads Tidak Tampil

## Masalah
Gambar profile yang tersimpan di folder `uploads/profiles` tidak tampil di website, meskipun file sudah ada di disk.

## Penyebab
1. **Database tidak tersinkronisasi**: File gambar ada di disk, tetapi kolom `picture` di database User belum berisi URL gambar
2. **Cache headers tidak optimal**: File gambar disajikan tanpa caching yang tepat
3. **Data tidak lengkap di response**: Endpoint `/api/user` tidak mengembalikan field `name` untuk pengguna

## Solusi yang Diterapkan

### 1. Auto-Sync pada Startup
File baru ditambahkan: `syncProfilePicturesOnStartup()` di `cmd/server/main.go`

**Fungsi**:
- Berjalan otomatis saat server di-start
- Membaca semua file dari folder `uploads/profiles`
- Update kolom `picture` di database untuk user yang belum memiliki gambar
- Format nama file: `profile_{user_id}_{random_hex}.{ext}`

**Log Output**:
```
✅ Profile pictures sync: X gambar diperbarui dari disk
```

### 2. Admin API Endpoint untuk Manual Sync
Endpoint baru: `POST /api/admin/profile-pictures/sync` (admin-only)

**Request**:
```bash
curl -X POST http://localhost:8080/api/admin/profile-pictures/sync
```

**Response**:
```json
{
  "success": true,
  "message": "Sinkronisasi selesai. Diperbarui: 3, Dilewati: 2, Gagal: 0",
  "synced": 3,
  "skipped": 2,
  "failed": 0,
  "errors": []
}
```

### 3. Cache Headers untuk Static Files
Wrapper baru: `handleUploadsDir()` 

**Improvement**:
- Set `Cache-Control: public, max-age=86400` (1 hari cache)
- Browser tidak perlu download gambar yang sama berkali-kali
- Reduce server load dan improve user experience

### 4. Complete User Response
Endpoint `GET /api/user` dan `GET /api/auth/me` sekarang mengembalikan field `name`:

**Sebelum**:
```json
{
  "picture": "/uploads/profiles/profile_2_abc123.jpg",
  "email": "user@example.com"
}
```

**Sesudah**:
```json
{
  "name": "John Doe",
  "picture": "/uploads/profiles/profile_2_abc123.jpg",
  "email": "user@example.com"
}
```

## Cara Menggunakan

### 1. Update Database (Automatic on Server Restart)
```bash
go run cmd/server/main.go
```

atau jika sudah di-compile:
```bash
./server
```

Server akan otomatis sync profile pictures pada startup.

### 2. Manual Sync via Admin Panel
Jika ada gambar baru di folder `uploads/profiles`, admin bisa trigger sync manual:

```bash
curl -X POST http://localhost:8080/api/admin/profile-pictures/sync \
  -H "Cookie: session_token=YOUR_ADMIN_SESSION"
```

### 3. Verify di Database
Cek kolom `picture` di tabel `users`:
```sql
SELECT id, email, name, picture FROM users WHERE picture IS NOT NULL;
```

## Testing

1. **Upload gambar profil** melalui website
2. **Reload halaman** → gambar harus tampil
3. **Restart server** → gambar tetap tampil di database
4. **Manual sync** → jika ada gambar lama yang belum linked

## File yang Dimodifikasi

- `cmd/server/main.go`
  - Tambah: `syncProfilePicturesOnStartup()`
  - Tambah: `handleUploadsDir()` 
  - Tambah: `handleSyncProfilePictures()`
  - Tambah: Route `/api/admin/profile-pictures/sync`
  - Update: `handleGetUser()` untuk include `name` field

## Benefits

✅ Profile pictures otomatis link ke database saat server start  
✅ Admin bisa manual sync jika diperlukan  
✅ Cache headers improve performance  
✅ Konsistensi data antara database dan disk  
✅ Backward compatible dengan existing code
