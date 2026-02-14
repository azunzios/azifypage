import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/joy/Box';
import Sheet from '@mui/joy/Sheet';
import Typography from '@mui/joy/Typography';
import Modal from '@mui/joy/Modal';
import ModalDialog from '@mui/joy/ModalDialog';
import DialogTitle from '@mui/joy/DialogTitle';
import DialogContent from '@mui/joy/DialogContent';
import DialogActions from '@mui/joy/DialogActions';
import Button from '@mui/joy/Button';
import Alert from '@mui/joy/Alert';
import Divider from '@mui/joy/Divider';
import DragDropInput from '../components/DragDropInput';
import PreviewModal from '../components/PreviewModal';
import { useAuth } from '../App';
import DownloadIcon from '@mui/icons-material/Download';

export default function InputLinkPage() {
    const [preview, setPreview] = useState(null);
    const [checking, setChecking] = useState(false);
    const [premiumDialog, setPremiumDialog] = useState({ open: false, status: 'info', data: null, message: '', error: '' });
    const [insufficientDialog, setInsufficientDialog] = useState({ open: false, service: '', data: null });
    const navigate = useNavigate();
    const { refreshUser } = useAuth();

    const openPremiumDialog = ({ status = 'info', data = null, message = '', error = '' }) => {
        setPremiumDialog({ open: true, status, data, message, error });
    };

    const closePremiumDialog = () => {
        setPremiumDialog({ open: false, status: 'info', data: null, message: '', error: '' });
    };

    const openInsufficientDialog = (service, data) => {
        setInsufficientDialog({ open: true, service, data: data || null });
    };

    const closeInsufficientDialog = () => {
        setInsufficientDialog({ open: false, service: '', data: null });
    };

    const formatIDR = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

    const handleCheck = async (url, mode, voucher = '', options = {}) => {
        const normalizedVoucher = String(voucher || '').trim().toUpperCase();
        const estimatedSizeGb = Number(options?.estimatedSizeGb || 0);
        setChecking(true);
        try {
            if (mode === 'premium') {
                const res = await fetch('/api/premium/request', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        url,
                        voucher: normalizedVoucher,
                        estimated_size_gb: estimatedSizeGb > 0 ? estimatedSizeGb : 0,
                    }),
                });
                const data = await res.json();
                if (!res.ok) {
                    if (res.status === 402) {
                        openInsufficientDialog('premium', data);
                        setChecking(false);
                        return;
                    }
                    openPremiumDialog({
                        status: 'danger',
                        data,
                        message: data.message || 'Request gagal diproses',
                        error: data.error || '',
                    });
                    setChecking(false);
                    return;
                }

                if (data?.mode === 'automatic' && data?.download_url) {
                    if (refreshUser) await refreshUser();
                    openPremiumDialog({
                        status: 'success',
                        data,
                        message: data.message || 'Link premium valid dan siap diunduh',
                    });
                } else {
                    openPremiumDialog({
                        status: 'warning',
                        data,
                        message: data.message || 'Request berhasil dikirim!',
                    });
                }
                setChecking(false);
                return;
            }

            const res = await fetch('/api/task', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, voucher: normalizedVoucher }),
            });
            const data = await res.json();
            if (res.ok) {
                if (refreshUser) await refreshUser();
                setPreview({ ...data, source_url: url });
            } else {
                if (res.status === 402) {
                    openInsufficientDialog('torrent', data);
                } else {
                    openPremiumDialog({
                        status: 'danger',
                        data,
                        message: data.message || 'Terjadi kesalahan',
                        error: data.error || '',
                    });
                }
            }
        } catch (e) {
            alert('Error: ' + e.message);
        } finally {
            setChecking(false);
        }
    };

    const handleConfirm = () => {
        setPreview(null);
        // Navigate to downloads page after confirming
        setTimeout(() => navigate('/download'), 1500);
    };

    const handleCancelTask = async () => {
        if (!preview?.id) return;
        try {
            await fetch('/api/task?task_id=' + preview.id, { method: 'DELETE' });
            setPreview(null);
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <Box sx={{ maxWidth: 936, margin: 'auto' }}>
            <Sheet variant="outlined" sx={{ p: 2.5, borderRadius: 'md' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
                    <DownloadIcon color="primary" fontSize="small" />
                    <Typography level="title-md" sx={{ fontWeight: 700 }}>
                        Tambah Unduhan
                    </Typography>
                </Box>
                <Typography level="body-sm" color="neutral" sx={{ display: 'block', mb: 2 }}>
                    Tempel link torrent/magnet atau host premium, lalu proses.
                </Typography>
                <DragDropInput onCheck={handleCheck} loading={checking} />
            </Sheet>
            <PreviewModal preview={preview} onConfirm={handleConfirm} onCancel={handleCancelTask} />

            <Modal open={premiumDialog.open} onClose={closePremiumDialog}>
                <ModalDialog size="md" sx={{ width: 'min(560px, 92vw)' }}>
                    <DialogTitle>Hasil Proses Host Premium</DialogTitle>
                    <DialogContent>
                        <Alert color={premiumDialog.status === 'danger' ? 'danger' : premiumDialog.status} variant="soft">
                            {premiumDialog.message || '-'}
                        </Alert>

                        {premiumDialog?.data && (
                            <Box sx={{ mt: 1.5, display: 'grid', gridTemplateColumns: '1fr', gap: 0.75 }}>
                                {premiumDialog.data.filename && (
                                    <Typography level="body-sm">File: <strong>{premiumDialog.data.filename}</strong></Typography>
                                )}
                                {premiumDialog.data.size_gb && (
                                    <Typography level="body-sm">Ukuran: <strong>{premiumDialog.data.size_gb}</strong></Typography>
                                )}
                                {premiumDialog.data.host && (
                                    <Typography level="body-sm">Host: <strong>{premiumDialog.data.host}</strong></Typography>
                                )}
                                {Number.isFinite(Number(premiumDialog.data.price)) && Number(premiumDialog.data.price) > 0 && (
                                    <Typography level="body-sm">Harga: <strong>Rp {Number(premiumDialog.data.price).toLocaleString('id-ID')}</strong></Typography>
                                )}
                                {Number.isFinite(Number(premiumDialog.data.original_price)) && Number(premiumDialog.data.original_price) > 0 && (
                                    <Typography level="body-sm">Harga Awal: <strong>Rp {Number(premiumDialog.data.original_price).toLocaleString('id-ID')}</strong></Typography>
                                )}
                                {Number.isFinite(Number(premiumDialog.data.discount_amount)) && Number(premiumDialog.data.discount_amount) > 0 && (
                                    <Typography level="body-sm">Diskon Voucher: <strong>Rp {Number(premiumDialog.data.discount_amount).toLocaleString('id-ID')}</strong></Typography>
                                )}
                                {premiumDialog.data.voucher_code && (
                                    <Typography level="body-sm">Voucher: <strong>{premiumDialog.data.voucher_code}</strong></Typography>
                                )}
                                {Number.isFinite(Number(premiumDialog.data.required_price)) && Number(premiumDialog.data.required_price) > 0 && (
                                    <Typography level="body-sm">Dibutuhkan: <strong>Rp {Number(premiumDialog.data.required_price).toLocaleString('id-ID')}</strong></Typography>
                                )}
                                {Number.isFinite(Number(premiumDialog.data.current_balance)) && (
                                    <Typography level="body-sm">Saldo Saat Ini: <strong>Rp {Number(premiumDialog.data.current_balance).toLocaleString('id-ID')}</strong></Typography>
                                )}
                                {Number.isFinite(Number(premiumDialog.data.current_balance_after)) && (
                                    <Typography level="body-sm">Saldo Setelah Potong: <strong>Rp {Number(premiumDialog.data.current_balance_after).toLocaleString('id-ID')}</strong></Typography>
                                )}

                                {Number.isFinite(Number(premiumDialog.data.price)) && (
                                    <>
                                        <Divider sx={{ my: 0.75 }} />
                                        <Typography level="body-sm" sx={{ fontWeight: 700 }}>
                                            STRUK PENGURANGAN VOUCHER
                                        </Typography>
                                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 0.35, columnGap: 1 }}>
                                            <Typography level="body-xs" color="neutral">Harga Item</Typography>
                                            <Typography level="body-xs" sx={{ fontWeight: 600 }}>
                                                Rp {Number(premiumDialog.data.original_price ?? premiumDialog.data.price ?? 0).toLocaleString('id-ID')}
                                            </Typography>

                                            <Typography level="body-xs" color="neutral">Potongan Voucher</Typography>
                                            <Typography level="body-xs" sx={{ fontWeight: 600 }}>
                                                - Rp {Number(premiumDialog.data.discount_amount || 0).toLocaleString('id-ID')}
                                            </Typography>

                                            <Typography level="body-xs" color="neutral">Subtotal Setelah Voucher</Typography>
                                            <Typography level="body-xs" sx={{ fontWeight: 700 }}>
                                                Rp {Number(premiumDialog.data.price || 0).toLocaleString('id-ID')}
                                            </Typography>
                                        </Box>
                                    </>
                                )}

                                {premiumDialog.error && (
                                    <Typography level="body-xs" color="danger">Detail: {premiumDialog.error}</Typography>
                                )}
                            </Box>
                        )}
                    </DialogContent>
                    <DialogActions>
                        {premiumDialog?.data?.download_url && (
                            <Button
                                variant="solid"
                                color="primary"
                                onClick={() => window.open(premiumDialog.data.download_url, '_blank', 'noopener,noreferrer')}
                            >
                                Download Sekarang
                            </Button>
                        )}
                        {premiumDialog?.data?.stream_url && (
                            <Button
                                variant="soft"
                                color="success"
                                onClick={() => window.open(premiumDialog.data.stream_url, '_blank', 'noopener,noreferrer')}
                            >
                                Streaming
                            </Button>
                        )}
                        <Button variant="outlined" onClick={closePremiumDialog}>Tutup</Button>
                    </DialogActions>
                </ModalDialog>
            </Modal>

            <Modal open={insufficientDialog.open} onClose={closeInsufficientDialog}>
                <ModalDialog size="md" sx={{ width: 'min(560px, 92vw)' }}>
                    <DialogTitle>Saldo Tidak Mencukupi</DialogTitle>
                    <DialogContent>
                        <Alert color="warning" variant="soft">
                            Saldo kamu belum cukup untuk melanjutkan proses {insufficientDialog.service === 'premium' ? 'host premium' : 'torrent/magnet'}.
                        </Alert>
                        <Box sx={{ mt: 1.25, display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 0.5, columnGap: 1 }}>
                            <Typography level="body-sm" color="neutral">Saldo Saat Ini</Typography>
                            <Typography level="body-sm" sx={{ fontWeight: 700 }}>
                                {formatIDR(insufficientDialog?.data?.current_balance || 0)}
                            </Typography>

                            <Typography level="body-sm" color="neutral">Biaya Dibutuhkan</Typography>
                            <Typography level="body-sm" sx={{ fontWeight: 700 }}>
                                {formatIDR(insufficientDialog?.data?.required_price || insufficientDialog?.data?.price || 0)}
                            </Typography>

                            <Typography level="body-sm" color="neutral">Kekurangan</Typography>
                            <Typography level="body-sm" sx={{ fontWeight: 700, color: 'danger.600' }}>
                                {formatIDR(Math.max(0, Number(insufficientDialog?.data?.required_price || 0) - Number(insufficientDialog?.data?.current_balance || 0)))}
                            </Typography>

                            {Number(insufficientDialog?.data?.discount_amount || 0) > 0 && (
                                <>
                                    <Typography level="body-sm" color="neutral">Diskon Voucher</Typography>
                                    <Typography level="body-sm" sx={{ fontWeight: 700 }}>
                                        - {formatIDR(insufficientDialog?.data?.discount_amount || 0)}
                                    </Typography>
                                </>
                            )}
                        </Box>
                    </DialogContent>
                    <DialogActions>
                        <Button variant="solid" onClick={() => { closeInsufficientDialog(); navigate('/balance'); }}>
                            Top Up Sekarang
                        </Button>
                        <Button variant="outlined" onClick={closeInsufficientDialog}>Tutup</Button>
                    </DialogActions>
                </ModalDialog>
            </Modal>
        </Box>
    );
}
