import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import DragDropInput from '../components/DragDropInput';
import PreviewModal from '../components/PreviewModal';

export default function InputLinkPage() {
    const [preview, setPreview] = useState(null);
    const [checking, setChecking] = useState(false);
    const navigate = useNavigate();

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
                alert(data.message || 'Request berhasil dikirim!');
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
            <Paper variant="outlined" sx={{ p: 2.5 }}>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
                    Tambah Unduhan
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                    Tempel link torrent/magnet atau host premium, lalu proses.
                </Typography>
                <DragDropInput onCheck={handleCheck} loading={checking} />
            </Paper>
            <PreviewModal preview={preview} onConfirm={handleConfirm} onCancel={handleCancelTask} />
        </Box>
    );
}
