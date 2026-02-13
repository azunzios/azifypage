import * as React from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import OutlinedInput from '@mui/material/OutlinedInput';

export default function ForgotPassword({ open, handleClose }) {
    const [email, setEmail] = React.useState('');
    const [loading, setLoading] = React.useState(false);
    const [message, setMessage] = React.useState('');
    const [error, setError] = React.useState('');
    const [cooldownSeconds, setCooldownSeconds] = React.useState(0);

    React.useEffect(() => {
        if (!open || cooldownSeconds <= 0) return undefined;
        const timer = setInterval(() => {
            setCooldownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(timer);
    }, [open, cooldownSeconds]);

    React.useEffect(() => {
        if (open) {
            setMessage('');
            setError('');
        }
    }, [open]);

    const onSubmit = async (event) => {
        event.preventDefault();
        if (!email || cooldownSeconds > 0) return;

        setLoading(true);
        setError('');
        setMessage('');
        try {
            const res = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            const data = await res.json();
            if (res.ok) {
                setMessage(data.message || 'Jika email terdaftar, link reset akan dikirim.');
                setCooldownSeconds(60);
            } else {
                if (res.status === 429 && Number.isFinite(data.retry_after)) {
                    setCooldownSeconds(Math.max(1, Number(data.retry_after)));
                }
                setError(data.error || data.message || 'Gagal mengirim email reset.');
            }
        } catch {
            setError('Tidak dapat terhubung ke server.');
        } finally {
            setLoading(false);
        }
    };

    const onClose = () => {
        if (loading) return;
        setEmail('');
        setMessage('');
        setError('');
        handleClose();
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            slotProps={{
                paper: {
                    component: 'form',
                    onSubmit,
                    sx: { backgroundImage: 'none' },
                },
            }}
        >
            <DialogTitle>Reset password</DialogTitle>
            <DialogContent
                sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}
            >
                <DialogContentText>
                    Enter your account&apos;s email address, and we&apos;ll send you a link to
                    reset your password.
                </DialogContentText>
                {message && <Alert severity="success">{message}</Alert>}
                {error && <Alert severity="error">{error}</Alert>}
                {cooldownSeconds > 0 && (
                    <Alert severity="info">
                        Kamu bisa request lagi dalam {cooldownSeconds} detik.
                    </Alert>
                )}
                <OutlinedInput
                    autoFocus
                    required
                    margin="dense"
                    id="email"
                    name="email"
                    label="Email address"
                    placeholder="Email address"
                    type="email"
                    fullWidth
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading || cooldownSeconds > 0}
                />
            </DialogContent>
            <DialogActions sx={{ pb: 3, px: 3 }}>
                <Button onClick={onClose} disabled={loading}>Cancel</Button>
                <Button variant="contained" type="submit" disabled={loading || !email || cooldownSeconds > 0}>
                    {loading
                        ? <CircularProgress size={18} color="inherit" />
                        : cooldownSeconds > 0
                            ? `Tunggu ${cooldownSeconds}s`
                            : 'Continue'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
