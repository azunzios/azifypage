import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';

export default function BantuanPage() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [guidePost, setGuidePost] = useState(null);

    useEffect(() => {
        let alive = true;
        const run = async () => {
            setLoading(true);
            try {
                const res = await fetch('/api/posts/official?type=guide_help');
                if (!res.ok) throw new Error('failed');
                const data = await res.json();
                if (!alive) return;
                const first = Array.isArray(data) && data.length > 0 ? data[0] : null;
                setGuidePost(first);
            } catch {
                if (!alive) return;
                setGuidePost(null);
            } finally {
                if (alive) setLoading(false);
            }
        };
        run();
        return () => {
            alive = false;
        };
    }, []);

    const updatedAtLabel = useMemo(() => {
        if (!guidePost?.updated_at) return '-';
        const dt = new Date(guidePost.updated_at);
        if (Number.isNaN(dt.getTime())) return '-';
        return dt.toLocaleString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    }, [guidePost?.updated_at]);

    return (
        <Box sx={{ maxWidth: 936, margin: 'auto' }}>
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 0 }}>
                <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 0.5 }}>
                    Panduan & Bantuan
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Jika butuh bantuan terkait top up, download, atau akun, lihat panduan berikut dan hubungi admin.
                </Typography>

                {loading ? (
                    <Box sx={{ py: 2, display: 'flex', justifyContent: 'center' }}>
                        <CircularProgress size={24} />
                    </Box>
                ) : guidePost ? (
                    <Paper variant="outlined" sx={{ p: 2, borderRadius: 0, mb: 2 }}>
                        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                            {guidePost.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
                            {guidePost.content}
                        </Typography>
                        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1.25 }}>
                            Updated at: {updatedAtLabel}
                        </Typography>
                    </Paper>
                ) : (
                    <Alert severity="info" sx={{ borderRadius: 0, mb: 2 }}>
                        Panduan belum tersedia.
                    </Alert>
                )}

                <Divider sx={{ mb: 2 }} />

                <Alert severity="info" sx={{ borderRadius: 0 }}>
                    Hubungi admin: <strong>t.me/6285778135021</strong>
                    <Box sx={{ mt: 1.25, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Button
                            variant="contained"
                            component="a"
                            href="https://t.me/6285778135021"
                            target="_blank"
                            rel="noreferrer"
                            sx={{ textTransform: 'none', fontWeight: 800 }}
                        >
                            Buka Telegram
                        </Button>
                        <Button variant="outlined" onClick={() => navigate('/informasi')} sx={{ textTransform: 'none' }}>
                            Kembali ke Informasi
                        </Button>
                    </Box>
                </Alert>
            </Paper>
        </Box>
    );
}
