import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';

const PAYMENT_OPTIONS = [
    { value: 'gopay', label: 'GoPay', account: '085778135021', logo: '/logo-pembayaran/gopay.png' },
    { value: 'bri', label: 'BRI', account: '162901006178537', logo: '/logo-pembayaran/bri.svg' },
    { value: 'bank_jago', label: 'Bank Jago', account: '103325280390', logo: '/logo-pembayaran/bank_jago.png' },
    { value: 'crypto_usdt', label: 'Crypto (USDT)', account: 'SEGERA', logo: '/logo-pembayaran/usdt.png' },
];

function useQuery() {
    const { search } = useLocation();
    return useMemo(() => new URLSearchParams(search), [search]);
}

function formatCountdown(ms) {
    const safe = Math.max(0, ms);
    const min = Math.floor(safe / 60000);
    const sec = Math.floor((safe % 60000) / 1000);
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export default function TopupReceiptPage() {
    const navigate = useNavigate();
    const query = useQuery();

    const id = parseInt(String(query.get('id') || '0'), 10);
    const [topup, setTopup] = useState(null);
    const [loading, setLoading] = useState(true);
    const [now, setNow] = useState(Date.now());
    const [submitting, setSubmitting] = useState(false);
    const [paidConfirmOpen, setPaidConfirmOpen] = useState(false);
    const [errorText, setErrorText] = useState('');

    const refresh = async () => {
        if (!id) {
            setTopup(null);
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const res = await fetch('/api/topups');
            const data = await res.json();
            const found = Array.isArray(data) ? data.find((t) => Number(t.id) === id) : null;
            setTopup(found || null);
        } catch {
            setTopup(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refresh();
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const selected = useMemo(() => {
        const method = topup?.payment_method || 'gopay';
        return PAYMENT_OPTIONS.find((p) => p.value === method) || PAYMENT_OPTIONS[0];
    }, [topup?.payment_method]);

    const amount = Number(topup?.amount || 0);
    const expiresAtMs = topup?.expires_at ? new Date(topup.expires_at).getTime() : 0;
    const remainingMs = expiresAtMs ? Math.max(0, expiresAtMs - now) : 0;
    const isExpired = !!expiresAtMs && remainingMs <= 0;

    const statusLabel = useMemo(() => {
        if (!topup?.status) return '-';
        if (topup.status === 'awaiting_payment') return 'Menunggu Pembayaran';
        if (topup.status === 'pending') return 'On Progress (menunggu admin)';
        if (topup.status === 'approved') return 'Approved';
        if (topup.status === 'rejected') return 'Rejected';
        if (topup.status === 'cancelled') return 'Cancelled';
        if (topup.status === 'expired') return 'Expired';
        return topup.status;
    }, [topup?.status]);

    const canPaid = topup?.status === 'awaiting_payment' && !isExpired && amount >= 5000;
    const canCancel = topup?.status === 'awaiting_payment' && !isExpired;

    const patchAction = async (action) => {
        setSubmitting(true);
        setErrorText('');
        try {
            const res = await fetch('/api/topups', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, action }),
            });
            if (!res.ok) {
                const t = await res.text();
                throw new Error(t || 'Gagal memproses');
            }
            await refresh();
            if (action === 'paid') {
                navigate('/balance', {
                    state: {
                        flash: {
                            severity: 'success',
                            text: 'Konfirmasi terkirim. Status: On Progress (menunggu admin).',
                        },
                    },
                });
                return;
            }
            navigate('/balance', {
                state: {
                    flash: {
                        severity: 'info',
                        text: 'Top up dibatalkan.',
                    },
                },
            });
        } catch (e) {
            setErrorText(e.message || 'Terjadi kesalahan');
        } finally {
            setSubmitting(false);
        }
    };

    const closePaidConfirm = () => {
        if (submitting) return;
        setPaidConfirmOpen(false);
    };

    return (
        <Box sx={{ maxWidth: 720, mx: 'auto' }}>
            <Paper
                variant="outlined"
                sx={(theme) => {
                    return {
                        p: 2.5,
                        borderRadius: 0,
                        borderColor: 'divider',
                        boxShadow: `inset 4px 0 0 ${theme.palette.primary.main}`,
                        bgcolor:
                            theme.palette.mode === 'dark'
                                ? 'rgba(144, 202, 249, 0.06)'
                                : 'rgba(25, 118, 210, 0.03)',
                    };
                }}
            >
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 1.5,
                        flexWrap: 'wrap',
                    }}
                >
                    <Typography variant="subtitle1" fontWeight={900}>
                        Struk Top Up
                    </Typography>
                    <Chip size="small" label="Perlu Konfirmasi" color="warning" variant="outlined" />
                </Box>

                <Typography
                    variant="caption"
                    sx={{
                        mt: 0.75,
                        display: 'block',
                        fontFamily:
                            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                        color: 'text.secondary',
                    }}
                >
                    {String(topup?.serial || '').trim() ? topup.serial : `TOPUP-${id}`}
                </Typography>

                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    Top up harus diselesaikan dalam <strong>30 menit</strong> atau bisa dibatalkan.
                </Typography>

                <Divider sx={{ my: 2 }} />

                {errorText ? (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {errorText}
                    </Alert>
                ) : null}

                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                        <CircularProgress />
                    </Box>
                ) : !topup ? (
                    <Alert severity="error">
                        Struk tidak ditemukan. Silakan mulai dari halaman isi saldo.
                        <Box sx={{ mt: 1.25 }}>
                            <Button variant="outlined" onClick={() => navigate('/topup/new')} sx={{ textTransform: 'none' }}>
                                Ke halaman Isi Saldo
                            </Button>
                        </Box>
                    </Alert>
                ) : (
                    <Box sx={{ display: 'grid', gap: 1.25 }}>
                        <Box>
                            <Typography variant="caption" color="text.secondary">
                                Kirim
                            </Typography>
                            <Typography variant="h5" fontWeight={900}>
                                Rp {Number(amount || 0).toLocaleString('id-ID')}
                            </Typography>
                        </Box>

                        <Box>
                            <Typography variant="caption" color="text.secondary">
                                Ke
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Box component="img" src={selected.logo} alt={selected.label} sx={{ width: 24, height: 20, objectFit: 'contain' }} />
                                <Typography variant="body1" fontWeight={800}>
                                    {selected.label} — {selected.account}
                                </Typography>
                            </Box>
                        </Box>

                        <Box>
                            <Typography variant="caption" color="text.secondary">
                                Atas nama
                            </Typography>
                            <Typography variant="body1" fontWeight={800}>
                                Narangga Khoirul Utama
                            </Typography>
                        </Box>

                        <Box>
                            <Typography variant="caption" color="text.secondary">
                                Status
                            </Typography>
                            <Typography variant="body2" fontWeight={800}>
                                {statusLabel}
                            </Typography>
                        </Box>

                        {topup.status === 'awaiting_payment' && (
                            <Alert severity={isExpired ? 'error' : 'warning'}>
                                {isExpired ? (
                                    <span>Waktu pembayaran habis. Silakan buat top up baru.</span>
                                ) : (
                                    <span>
                                        Sisa waktu: <strong>{formatCountdown(remainingMs)}</strong>
                                    </span>
                                )}
                            </Alert>
                        )}

                        {topup.status === 'pending' && (
                            <Alert severity="info">
                                Konfirmasi sudah terkirim. Jika ada masalah, silakan hubungi admin.
                            </Alert>
                        )}

                        {(topup.status === 'expired' || topup.status === 'cancelled') && (
                            <Alert severity="info">
                                Top up sudah {topup.status}. Kamu bisa membuat top up baru.
                            </Alert>
                        )}
                    </Box>
                )}

                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, mt: 2.5, flexWrap: 'wrap' }}>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <Button
                            variant="outlined"
                            color="error"
                            onClick={() => patchAction('cancel')}
                            disabled={submitting || !canCancel}
                            sx={{ textTransform: 'none' }}
                        >
                            Batalkan
                        </Button>
                        <Button
                            variant="contained"
                            onClick={() => setPaidConfirmOpen(true)}
                            disabled={submitting || !canPaid}
                            sx={{ textTransform: 'none', fontWeight: 900 }}
                        >
                            {submitting ? <CircularProgress size={20} color="inherit" /> : 'Telah dibayar'}
                        </Button>
                    </Box>
                </Box>

                <Box sx={{ mt: 1.5 }}>
                    <Button variant="text" onClick={() => navigate('/balance')} sx={{ textTransform: 'none' }}>
                        Kembali ke Saldo
                    </Button>
                </Box>

                <Dialog open={paidConfirmOpen} onClose={closePaidConfirm} maxWidth="xs" fullWidth>
                    <DialogTitle sx={{ fontWeight: 900 }}>Konfirmasi pembayaran</DialogTitle>
                    <DialogContent sx={{ pt: 1 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                            Kamu yakin sudah transfer sesuai struk ini?
                        </Typography>
                        <Alert severity="warning">
                            Nominal: <strong>Rp {Number(amount || 0).toLocaleString('id-ID')}</strong>
                            <br />
                            Tujuan: <strong>{selected.label} — {selected.account}</strong>
                            <br />
                            Serial: <strong>{String(topup?.serial || '').trim() ? topup.serial : `TOPUP-${id}`}</strong>
                        </Alert>
                    </DialogContent>
                    <DialogActions sx={{ px: 3, pb: 2.5 }}>
                        <Button variant="outlined" onClick={closePaidConfirm} disabled={submitting} sx={{ textTransform: 'none' }}>
                            Belum
                        </Button>
                        <Button
                            variant="contained"
                            onClick={async () => {
                                await patchAction('paid');
                                setPaidConfirmOpen(false);
                            }}
                            disabled={submitting || !canPaid}
                            sx={{ textTransform: 'none', fontWeight: 900 }}
                        >
                            {submitting ? <CircularProgress size={20} color="inherit" /> : 'Ya, telah dibayar'}
                        </Button>
                    </DialogActions>
                </Dialog>
            </Paper>
        </Box>
    );
}
