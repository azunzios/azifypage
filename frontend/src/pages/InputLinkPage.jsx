import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/joy/Box';
import Sheet from '@mui/joy/Sheet';
import Typography from '@mui/joy/Typography';
import Chip from '@mui/joy/Chip';
import Modal from '@mui/joy/Modal';
import ModalDialog from '@mui/joy/ModalDialog';
import DialogTitle from '@mui/joy/DialogTitle';
import DialogContent from '@mui/joy/DialogContent';
import DialogActions from '@mui/joy/DialogActions';
import Button from '@mui/joy/Button';
import Alert from '@mui/joy/Alert';
import DragDropInput from '../components/DragDropInput';
import PreviewModal from '../components/PreviewModal';
import { useAuth } from '../App';

export default function InputLinkPage() {
    const [preview, setPreview] = useState(null);
    const [checking, setChecking] = useState(false);
    const [premiumDialog, setPremiumDialog] = useState({ open: false, status: 'info', data: null, message: '', error: '' });
    const navigate = useNavigate();
    const { refreshUser } = useAuth();

    const openPremiumDialog = ({ status = 'info', data = null, message = '', error = '' }) => {
        setPremiumDialog({ open: true, status, data, message, error });
    };

    const closePremiumDialog = () => {
        setPremiumDialog({ open: false, status: 'info', data: null, message: '', error: '' });
    };

    const handleCheck = async (url, mode) => {
        setChecking(true);
        try {
            if (mode === 'premium') {
                const res = await fetch('/api/premium/request', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url }),
                });
                const data = await res.json();
                if (!res.ok) {
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
                body: JSON.stringify({ url }),
            });
            const data = await res.json();
            if (res.ok) {
                if (refreshUser) await refreshUser();
                setPreview(data);
            } else {
                alert('Gagal: ' + (data.message || 'Terjadi kesalahan'));
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
                    <Chip size="sm" variant="soft" color="primary">Input</Chip>
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
                                {Number.isFinite(Number(premiumDialog.data.required_price)) && Number(premiumDialog.data.required_price) > 0 && (
                                    <Typography level="body-sm">Dibutuhkan: <strong>Rp {Number(premiumDialog.data.required_price).toLocaleString('id-ID')}</strong></Typography>
                                )}
                                {Number.isFinite(Number(premiumDialog.data.current_balance)) && (
                                    <Typography level="body-sm">Saldo Saat Ini: <strong>Rp {Number(premiumDialog.data.current_balance).toLocaleString('id-ID')}</strong></Typography>
                                )}
                                {Number.isFinite(Number(premiumDialog.data.current_balance_after)) && (
                                    <Typography level="body-sm">Saldo Setelah Potong: <strong>Rp {Number(premiumDialog.data.current_balance_after).toLocaleString('id-ID')}</strong></Typography>
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
        </Box>
    );
}
