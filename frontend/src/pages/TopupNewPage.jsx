import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import CircularProgress from '@mui/material/CircularProgress';

const PAYMENT_OPTIONS = [
    { value: 'gopay', label: 'GoPay', account: '085778135021' },
    { value: 'bri', label: 'BRI', account: '162901006178537' },
    { value: 'bank_jago', label: 'Bank Jago', account: '103325280390' },
    { value: 'crypto_usdt', label: 'Crypto (USDT)', account: 'SEGERA' },
];

export default function TopupNewPage() {
    const navigate = useNavigate();
    const [paymentMethod, setPaymentMethod] = useState('gopay');
    const [amount, setAmount] = useState('');
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [activePaymentOpen, setActivePaymentOpen] = useState(false);
    const [activePayment, setActivePayment] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    const selectedPayment = useMemo(() => {
        return PAYMENT_OPTIONS.find((p) => p.value === paymentMethod) || PAYMENT_OPTIONS[0];
    }, [paymentMethod]);

    const nominal = useMemo(() => {
        const n = parseInt(String(amount).replace(/[^0-9]/g, ''), 10);
        return Number.isFinite(n) ? n : 0;
    }, [amount]);

    const canConfirm = nominal >= 5000;

    const doCreateTopup = async () => {
        if (!canConfirm) {
            alert('Minimal top up Rp 5.000');
            return { status: 'error' };
        }

        setSubmitting(true);

        try {
            const res = await fetch('/api/topups', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: nominal, payment_method: paymentMethod }),
            });

            if (res.status === 409) {
                let data = {};
                try {
                    data = await res.json();
                } catch {
                    // ignore
                }
                const active = data?.active || null;
                setActivePayment(active);
                setActivePaymentOpen(true);
                return { status: 'conflict', active };
            }

            if (!res.ok) {
                const t = await res.text();
                throw new Error(t || 'Gagal membuat top up');
            }
            const created = await res.json();
            navigate(`/topup?id=${encodeURIComponent(String(created.id))}`);
            return { status: 'created', created };
        } catch (e) {
            alert(e.message || 'Terjadi kesalahan');
            return { status: 'error' };
        } finally {
            setSubmitting(false);
        }
    };

    const handleConfirmClick = () => {
        if (!canConfirm) {
            alert('Minimal top up Rp 5.000');
            return;
        }
        setConfirmOpen(true);
    };

    const closeConfirm = () => {
        if (submitting) return;
        setConfirmOpen(false);
    };

    const closeActivePayment = () => {
        if (submitting) return;
        setActivePaymentOpen(false);
    };

    const activePaymentLabel = useMemo(() => {
        const method = activePayment?.payment_method;
        if (!method) return '';
        return PAYMENT_OPTIONS.find((p) => p.value === method)?.label || String(method);
    }, [activePayment]);

    return (
        <Box sx={{ maxWidth: 720, mx: 'auto' }}>
            <Paper variant="outlined" sx={{ p: 2.5 }}>
                <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 0.5 }}>
                    Pilih metode pembayaran
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Minimal top up <strong>Rp 5.000</strong>. Semua top up perlu konfirmasi admin.
                </Typography>

                <Divider sx={{ mb: 2 }} />

                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                    <TextField
                        select
                        size="small"
                        label="Metode Pembayaran"
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                    >
                        {PAYMENT_OPTIONS.map((opt) => (
                            <MenuItem key={opt.value} value={opt.value}>
                                {opt.label}
                            </MenuItem>
                        ))}
                    </TextField>

                    <TextField
                        size="small"
                        label="Nominal (Rp)"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="contoh: 5000"
                        inputProps={{ inputMode: 'numeric' }}
                        helperText="Minimal Rp 5.000"
                    />
                </Box>

                <Alert severity="info" sx={{ mt: 2 }}>
                    Tujuan pembayaran untuk <strong>{selectedPayment.label}</strong>: <strong>{selectedPayment.account}</strong>
                    <br />
                    Nama penerima: <strong>Narangga Khoirul Utama</strong>
                </Alert>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.5, mt: 2.5, flexWrap: 'wrap' }}>
                    <Button variant="outlined" onClick={() => navigate('/balance')} sx={{ textTransform: 'none' }}>
                        Kembali
                    </Button>
                    <Button variant="contained" onClick={handleConfirmClick} disabled={!canConfirm} sx={{ textTransform: 'none', fontWeight: 800 }}>
                        Konfirmasi
                    </Button>
                </Box>

                <Dialog open={confirmOpen} onClose={closeConfirm} maxWidth="xs" fullWidth>
                    <DialogTitle sx={{ fontWeight: 900 }}>Konfirmasi metode pembayaran?</DialogTitle>
                    <DialogContent sx={{ pt: 1 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                            Pastikan metode dan tujuan transfer sudah benar.
                        </Typography>

                        <Alert severity="info">
                            Metode: <strong>{selectedPayment.label}</strong>
                            <br />
                            Tujuan: <strong>{selectedPayment.account}</strong>
                            <br />
                            Nominal: <strong>Rp {Number(nominal || 0).toLocaleString('id-ID')}</strong>
                            <br />
                            Atas nama: <strong>Narangga Khoirul Utama</strong>
                        </Alert>
                    </DialogContent>
                    <DialogActions sx={{ px: 3, pb: 2.5 }}>
                        <Button variant="outlined" onClick={closeConfirm} disabled={submitting} sx={{ textTransform: 'none' }}>
                            Tidak
                        </Button>
                        <Button
                            variant="contained"
                            onClick={async () => {
                                const outcome = await doCreateTopup();
                                if (outcome?.status !== 'error') {
                                    setConfirmOpen(false);
                                }
                            }}
                            disabled={submitting}
                            sx={{ textTransform: 'none', fontWeight: 900 }}
                        >
                            {submitting ? <CircularProgress size={20} color="inherit" /> : 'Ya, lanjut'}
                        </Button>
                    </DialogActions>
                </Dialog>

                <Dialog open={activePaymentOpen} onClose={closeActivePayment} maxWidth="xs" fullWidth>
                    <DialogTitle sx={{ fontWeight: 900 }}>Selesaikan pembayaran sebelumnya</DialogTitle>
                    <DialogContent sx={{ pt: 1 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                            Kamu masih punya 1 pembayaran top up yang belum selesai. Silakan selesaikan dulu sebelum membuat top up baru.
                        </Typography>

                        <Alert severity="warning">
                            {activePayment?.serial ? (
                                <>
                                    Kode: <strong>{activePayment.serial}</strong>
                                    <br />
                                </>
                            ) : null}
                            Metode: <strong>{activePaymentLabel || '-'}</strong>
                            <br />
                            Tujuan: <strong>{activePayment?.payment_account || '-'}</strong>
                            <br />
                            Nominal: <strong>Rp {Number(activePayment?.amount || 0).toLocaleString('id-ID')}</strong>
                        </Alert>
                    </DialogContent>
                    <DialogActions sx={{ px: 3, pb: 2.5 }}>
                        <Button variant="outlined" onClick={closeActivePayment} sx={{ textTransform: 'none' }}>
                            Tutup
                        </Button>
                        <Button
                            variant="contained"
                            onClick={() => {
                                const id = activePayment?.id;
                                if (id) {
                                    navigate(`/topup?id=${encodeURIComponent(String(id))}`);
                                } else {
                                    navigate('/balance');
                                }
                            }}
                            sx={{ textTransform: 'none', fontWeight: 900 }}
                        >
                            Lihat struk
                        </Button>
                    </DialogActions>
                </Dialog>
            </Paper>
        </Box>
    );
}
