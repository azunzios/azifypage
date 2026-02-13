import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import CampaignIcon from '@mui/icons-material/Campaign';
import NewReleasesIcon from '@mui/icons-material/NewReleases';
import AccessTimeIcon from '@mui/icons-material/AccessTime';

const postTypeConfig = {
    info: { color: 'info', icon: <CampaignIcon fontSize="small" />, label: 'Info' },
    tip: { color: 'success', icon: <NewReleasesIcon fontSize="small" />, label: 'Tips' },
    update: { color: 'primary', icon: <NewReleasesIcon fontSize="small" />, label: 'Update' },
    warning: { color: 'warning', icon: <NewReleasesIcon fontSize="small" />, label: 'Penting' },
};

export default function InformasiPostPage() {
    const navigate = useNavigate();
    const params = useParams();
    const id = params?.id ? String(params.id) : '';

    const [loading, setLoading] = useState(true);
    const [post, setPost] = useState(null);

    useEffect(() => {
        let alive = true;
        const run = async () => {
            if (!id) {
                setPost(null);
                setLoading(false);
                return;
            }
            setLoading(true);
            try {
                const res = await fetch(`/api/posts/official?id=${encodeURIComponent(id)}`);
                if (!res.ok) throw new Error(await res.text());
                const data = await res.json();
                if (!alive) return;
                setPost(data || null);
            } catch {
                if (!alive) return;
                setPost(null);
            } finally {
                if (alive) setLoading(false);
            }
        };
        run();
        return () => {
            alive = false;
        };
    }, [id]);

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        if (Number.isNaN(date.getTime())) return '';
        return date.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const typeConfig = useMemo(() => {
        const t = post?.type || 'info';
        return postTypeConfig[t] || postTypeConfig.info;
    }, [post?.type]);

    return (
        <Box sx={{ maxWidth: 936, margin: 'auto' }}>
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                    <Typography variant="subtitle1" fontWeight={800}>
                        Detail Post
                    </Typography>
                    <Button variant="outlined" onClick={() => navigate('/informasi')} sx={{ textTransform: 'none' }}>
                        Kembali
                    </Button>
                </Box>

                <Divider sx={{ my: 2 }} />

                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                        <CircularProgress />
                    </Box>
                ) : !post ? (
                    <Alert severity="error" sx={{ borderRadius: 0 }}>
                        Post tidak ditemukan.
                    </Alert>
                ) : (
                    <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, flexWrap: 'wrap' }}>
                            <Chip icon={typeConfig.icon} label={typeConfig.label} size="small" color={typeConfig.color} variant="outlined" />
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <AccessTimeIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                                <Typography variant="caption" color="text.disabled">
                                    {formatDate(post.created_at)}
                                </Typography>
                            </Box>
                        </Box>

                        <Typography variant="h6" fontWeight={800} sx={{ mt: 1.25 }}>
                            {post.title}
                        </Typography>
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mt: 1.25, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}
                        >
                            {post.content}
                        </Typography>
                    </Box>
                )}
            </Paper>
        </Box>
    );
}
