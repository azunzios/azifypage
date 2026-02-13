import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';

export default function ResetPasswordPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token') || '';

    const [password, setPassword] = React.useState('');
    const [confirmPassword, setConfirmPassword] = React.useState('');
    const [loading, setLoading] = React.useState(false);
    const [message, setMessage] = React.useState('');
    const [error, setError] = React.useState('');

    const handleSubmit = async (event) => {
        event.preventDefault();
        setMessage('');
        setError('');

        if (!token) {
            setError('Token reset tidak ditemukan.');
            return;
        }
        if (password.length < 6) {
            setError('Password minimal 6 karakter.');
            return;
        }
        if (password !== confirmPassword) {
            setError('Konfirmasi password tidak cocok.');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, new_password: password }),
            });
            const data = await res.json();
            if (res.ok) {
                setMessage(data.message || 'Password berhasil direset.');
                setTimeout(() => navigate('/login'), 1200);
            } else {
                setError(data.error || data.message || 'Gagal reset password.');
            }
        } catch {
            setError('Tidak dapat terhubung ke server.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
            <Card variant="outlined" sx={{ width: '100%', maxWidth: 460 }}>
                <CardContent sx={{ p: 3 }}>
                    <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>
                        Reset Password
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Masukkan password baru untuk akun kamu.
                    </Typography>

                    {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
                    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                    <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        <TextField
                            type="password"
                            label="Password Baru"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            fullWidth
                            required
                            disabled={loading}
                        />
                        <TextField
                            type="password"
                            label="Konfirmasi Password Baru"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            fullWidth
                            required
                            disabled={loading}
                        />
                        <Button type="submit" variant="contained" disabled={loading}>
                            {loading ? <CircularProgress size={20} color="inherit" /> : 'Simpan Password Baru'}
                        </Button>
                        <Button variant="text" onClick={() => navigate('/login')} disabled={loading}>
                            Kembali ke Login
                        </Button>
                    </Box>
                </CardContent>
            </Card>
        </Box>
    );
}
