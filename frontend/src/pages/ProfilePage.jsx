import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import Switch from '@mui/material/Switch';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import CircularProgress from '@mui/material/CircularProgress';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import EmailIcon from '@mui/icons-material/Email';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import BadgeIcon from '@mui/icons-material/Badge';
import LockIcon from '@mui/icons-material/Lock';
import { useColorScheme } from '@mui/joy/styles';
import { useAuth } from '../App';

export default function ProfilePage() {
    const { user, logout, refreshUser } = useAuth();
    const navigate = useNavigate();
    const { mode, setMode } = useColorScheme();
    const fileInputRef = useRef(null);

    const [email, setEmail] = useState(user?.email || '');
    const [verifying, setVerifying] = useState(false);
    const [verificationSent, setVerificationSent] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState('success');
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState('');
    const [deleting, setDeleting] = useState(false);

    // Name change
    const [displayName, setDisplayName] = useState(user?.name || '');
    const [savingName, setSavingName] = useState(false);

    // Password change
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [savingPassword, setSavingPassword] = useState(false);

    const showMessage = (msg, type = 'success') => {
        setMessage(msg);
        setMessageType(type);
    };

    // Send email verification
    const handleSendVerification = async () => {
        if (!email || !email.includes('@')) {
            showMessage('Masukkan email yang valid', 'error');
            return;
        }
        setVerifying(true);
        try {
            const res = await fetch('/api/user/email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            const data = await res.json();
            if (res.ok) {
                setVerificationSent(true);
                showMessage('Link verifikasi telah dikirim ke email kamu!');
            } else {
                showMessage(data.message || 'Gagal mengirim verifikasi', 'error');
            }
        } catch (err) {
            showMessage('Error: ' + err.message, 'error');
        } finally {
            setVerifying(false);
        }
    };

    // Upload profile photo
    const handlePhotoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Check file size (max 1MB)
        if (file.size > 1024 * 1024) {
            showMessage('Ukuran file maksimal 1MB', 'error');
            return;
        }

        // Check file type
        if (!file.type.startsWith('image/')) {
            showMessage('File harus berupa gambar', 'error');
            return;
        }

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('photo', file);

            const res = await fetch('/api/user/photo', {
                method: 'POST',
                body: formData,
            });
            const data = await res.json();
            if (res.ok) {
                showMessage('Foto profil berhasil diperbarui!');
                // Reload to reflect new photo
                setTimeout(() => window.location.reload(), 1000);
            } else {
                showMessage(data.message || 'Gagal upload foto', 'error');
            }
        } catch (err) {
            showMessage('Error: ' + err.message, 'error');
        } finally {
            setUploading(false);
        }
    };

    // Delete account
    const handleDeleteAccount = async () => {
        if (deleteConfirm !== 'HAPUS AKUN') return;
        setDeleting(true);
        try {
            const res = await fetch('/api/user/delete', { method: 'DELETE' });
            if (res.ok) {
                showMessage('Akun berhasil dihapus.');
                setTimeout(() => {
                    logout();
                }, 1500);
            } else {
                const data = await res.json();
                showMessage(data.message || 'Gagal menghapus akun', 'error');
            }
        } catch (err) {
            showMessage('Error: ' + err.message, 'error');
        } finally {
            setDeleting(false);
            setShowDeleteDialog(false);
        }
    };

    const handleDarkModeToggle = () => {
        setMode(mode === 'dark' ? 'light' : 'dark');
    };

    // Change name
    const handleChangeName = async () => {
        if (!displayName.trim()) {
            showMessage('Nama tidak boleh kosong', 'error');
            return;
        }
        setSavingName(true);
        try {
            const res = await fetch('/api/user/name', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: displayName.trim() }),
            });
            const data = await res.json();
            if (res.ok) {
                showMessage('Nama berhasil diperbarui!');
                if (refreshUser) refreshUser();
            } else {
                showMessage(data.message || data.error || 'Gagal mengubah nama', 'error');
            }
        } catch (err) {
            showMessage('Error: ' + err.message, 'error');
        } finally {
            setSavingName(false);
        }
    };

    // Change password
    const handleChangePassword = async () => {
        if (!newPassword || newPassword.length < 6) {
            showMessage('Password baru minimal 6 karakter', 'error');
            return;
        }
        if (newPassword !== confirmPassword) {
            showMessage('Password baru tidak cocok', 'error');
            return;
        }
        setSavingPassword(true);
        try {
            const res = await fetch('/api/user/password', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
            });
            const data = await res.json();
            if (res.ok) {
                showMessage('Password berhasil diubah!');
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
            } else {
                showMessage(data.message || data.error || 'Gagal mengubah password', 'error');
            }
        } catch (err) {
            showMessage('Error: ' + err.message, 'error');
        } finally {
            setSavingPassword(false);
        }
    };

    return (
        <Box sx={{ maxWidth: 640, margin: 'auto' }}>
            {/* Profile header */}
            <Card variant="outlined" sx={{ mb: 3 }}>
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 3, p: 3 }}>
                    <Box sx={{ position: 'relative' }}>
                        {user?.picture ? (
                            <Avatar src={user.picture} sx={{ width: 80, height: 80, fontSize: 28 }} />
                        ) : (
                            <Avatar sx={{ width: 80, height: 80, fontSize: 28, bgcolor: 'primary.main' }}>
                                {user?.email?.charAt(0).toUpperCase() || 'U'}
                            </Avatar>
                        )}
                        <IconButton
                            size="small"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            sx={{
                                position: 'absolute',
                                bottom: -4,
                                right: -4,
                                bgcolor: 'background.paper',
                                border: '2px solid',
                                borderColor: 'divider',
                                '&:hover': { bgcolor: 'grey.100' },
                                width: 32,
                                height: 32,
                            }}
                        >
                            {uploading ? <CircularProgress size={16} /> : <CameraAltIcon sx={{ fontSize: 16 }} />}
                        </IconButton>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            hidden
                            onChange={handlePhotoUpload}
                        />
                    </Box>
                    <Box>
                        <Typography variant="h6" fontWeight={700}>
                            {user?.name || user?.email || 'User'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {user?.email || 'Belum ada email'}
                        </Typography>
                        <Typography variant="caption" color="text.disabled">
                            Maks. 1MB untuk foto profil (JPG, PNG)
                        </Typography>
                    </Box>
                </CardContent>
            </Card>

            {/* Email Section */}
            <Card variant="outlined" sx={{ mb: 3 }}>
                <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <EmailIcon color="primary" />
                        <Typography variant="subtitle1" fontWeight={600}>
                            Email
                        </Typography>
                        {user?.email_verified && (
                            <CheckCircleIcon color="success" sx={{ fontSize: 18, ml: 0.5 }} />
                        )}
                    </Box>

                    {user?.email_verified ? (
                        <Alert severity="success" sx={{ mb: 2 }}>
                            Email sudah terverifikasi: <strong>{user.email}</strong>
                        </Alert>
                    ) : (
                        <>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                Tambahkan email untuk keamanan akun dan menerima notifikasi.
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1.5, flexDirection: { xs: 'column', sm: 'row' } }}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="nama@email.com"
                                    disabled={verificationSent}
                                />
                                <Button
                                    variant="contained"
                                    onClick={handleSendVerification}
                                    disabled={verifying || verificationSent || !email}
                                    sx={{ minWidth: 160, whiteSpace: 'nowrap' }}
                                >
                                    {verifying ? 'Mengirim...' : verificationSent ? 'Terkirim ✓' : 'Kirim Verifikasi'}
                                </Button>
                            </Box>
                            {verificationSent && (
                                <Alert severity="info" sx={{ mt: 2 }}>
                                    Link verifikasi telah dikirim. Cek inbox dan folder spam kamu.
                                </Alert>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Name Section */}
            <Card variant="outlined" sx={{ mb: 3 }}>
                <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <BadgeIcon color="primary" />
                        <Typography variant="subtitle1" fontWeight={600}>
                            Ganti Nama
                        </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Ubah nama tampilan kamu yang terlihat oleh pengguna lain.
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1.5, flexDirection: { xs: 'column', sm: 'row' } }}>
                        <TextField
                            fullWidth
                            size="small"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="Nama tampilan"
                        />
                        <Button
                            variant="contained"
                            onClick={handleChangeName}
                            disabled={savingName || !displayName.trim() || displayName.trim() === (user?.name || '')}
                            sx={{ minWidth: 120, whiteSpace: 'nowrap' }}
                        >
                            {savingName ? 'Menyimpan...' : 'Simpan'}
                        </Button>
                    </Box>
                </CardContent>
            </Card>

            {/* Password Section */}
            <Card variant="outlined" sx={{ mb: 3 }}>
                <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <LockIcon color="primary" />
                        <Typography variant="subtitle1" fontWeight={600}>
                            Ganti Password
                        </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Gunakan password yang kuat minimal 6 karakter.
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, maxWidth: 400 }}>
                        <TextField
                            fullWidth
                            size="small"
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="Password saat ini"
                        />
                        <TextField
                            fullWidth
                            size="small"
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Password baru (min. 6 karakter)"
                        />
                        <TextField
                            fullWidth
                            size="small"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Konfirmasi password baru"
                        />
                        <Button
                            variant="contained"
                            onClick={handleChangePassword}
                            disabled={savingPassword || !newPassword || !confirmPassword}
                            sx={{ alignSelf: 'flex-start' }}
                        >
                            {savingPassword ? 'Mengubah...' : 'Ubah Password'}
                        </Button>
                    </Box>
                </CardContent>
            </Card>

            {/* Appearance Section */}
            <Card variant="outlined" sx={{ mb: 3 }}>
                <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <DarkModeIcon color="primary" />
                        <Typography variant="subtitle1" fontWeight={600}>
                            Tampilan
                        </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box>
                            <Typography variant="body2" fontWeight={500}>
                                Mode Gelap
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                Gunakan tema gelap untuk tampilan yang nyaman di malam hari
                            </Typography>
                        </Box>
                        <Switch
                            checked={mode === 'dark'}
                            onChange={handleDarkModeToggle}
                            color="primary"
                        />
                    </Box>
                </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card
                variant="outlined"
                sx={{
                    borderColor: 'error.light',
                    mb: 3,
                }}
            >
                <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <DeleteForeverIcon color="error" />
                        <Typography variant="subtitle1" fontWeight={600} color="error.main">
                            Hapus Akun
                        </Typography>
                    </Box>

                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Menghapus akun bersifat permanen. Semua data, saldo, dan riwayat akan hilang dan tidak bisa dikembalikan.
                    </Typography>

                    <Button
                        variant="outlined"
                        color="error"
                        onClick={() => setShowDeleteDialog(true)}
                        startIcon={<DeleteForeverIcon />}
                    >
                        Hapus Akun Saya
                    </Button>
                </CardContent>
            </Card>

            {/* Delete Confirmation Dialog */}
            <Dialog open={showDeleteDialog} onClose={() => setShowDeleteDialog(false)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <WarningAmberIcon color="error" />
                    Konfirmasi Hapus Akun
                </DialogTitle>
                <DialogContent>
                    <Alert severity="error" sx={{ mb: 2 }}>
                        Tindakan ini tidak bisa dibatalkan!
                    </Alert>
                    <Typography variant="body2" sx={{ mb: 2 }}>
                        Ketik <strong>HAPUS AKUN</strong> di bawah ini untuk konfirmasi penghapusan:
                    </Typography>
                    <TextField
                        fullWidth
                        size="small"
                        value={deleteConfirm}
                        onChange={(e) => setDeleteConfirm(e.target.value)}
                        placeholder="HAPUS AKUN"
                        autoFocus
                    />
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setShowDeleteDialog(false)} variant="outlined">
                        Batal
                    </Button>
                    <Button
                        onClick={handleDeleteAccount}
                        variant="contained"
                        color="error"
                        disabled={deleteConfirm !== 'HAPUS AKUN' || deleting}
                    >
                        {deleting ? 'Menghapus...' : 'Hapus Permanen'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Snackbar */}
            <Snackbar
                open={!!message}
                autoHideDuration={4000}
                onClose={() => setMessage('')}
            >
                <Alert onClose={() => setMessage('')} severity={messageType} variant="filled">
                    {message}
                </Alert>
            </Snackbar>
        </Box>
    );
}
