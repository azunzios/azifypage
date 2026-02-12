import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Skeleton from '@mui/material/Skeleton';
import Button from '@mui/material/Button';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CampaignIcon from '@mui/icons-material/Campaign';
import NewReleasesIcon from '@mui/icons-material/NewReleases';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';

const postTypeConfig = {
    info: { color: 'info', icon: <CampaignIcon fontSize="small" />, label: 'Info' },
    tip: { color: 'success', icon: <NewReleasesIcon fontSize="small" />, label: 'Tips' },
    update: { color: 'primary', icon: <NewReleasesIcon fontSize="small" />, label: 'Update' },
    warning: { color: 'warning', icon: <NewReleasesIcon fontSize="small" />, label: 'Penting' },
};

export default function InformasiPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const [banners, setBanners] = useState([]);
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentSlide, setCurrentSlide] = useState(0);
    const timerRef = useRef(null);

    useEffect(() => {
        const loadData = async () => {
            try {
                const [bannersRes, postsRes] = await Promise.allSettled([
                    fetch('/api/banners').then((r) => r.json()),
                    fetch('/api/posts/official').then((r) => r.json()),
                ]);
                setBanners(bannersRes.status === 'fulfilled' && Array.isArray(bannersRes.value) && bannersRes.value.length ? bannersRes.value : []);
                setPosts(postsRes.status === 'fulfilled' && Array.isArray(postsRes.value) && postsRes.value.length ? postsRes.value : []);
            } catch {
                setBanners([]);
                setPosts([]);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    const startTimer = useCallback(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (banners.length > 1) {
            timerRef.current = setInterval(() => {
                setCurrentSlide((prev) => (prev + 1) % banners.length);
            }, 5000);
        }
    }, [banners.length]);

    useEffect(() => {
        startTimer();
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [banners.length, startTimer]);

    const goToSlide = (index) => { setCurrentSlide(index); startTimer(); };
    const prevSlide = () => { setCurrentSlide((prev) => (prev - 1 + banners.length) % banners.length); startTimer(); };
    const nextSlide = () => { setCurrentSlide((prev) => (prev + 1) % banners.length); startTimer(); };

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        if (diffMins < 1) return 'Baru saja';
        if (diffMins < 60) return `${diffMins} menit lalu`;
        if (diffHours < 24) return `${diffHours} jam lalu`;
        if (diffDays < 7) return `${diffDays} hari lalu`;
        return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const query = new URLSearchParams(location.search).get('q')?.trim().toLowerCase() || '';
    const filteredPosts = query
        ? posts.filter((p) => `${p.title || ''} ${p.content || ''} ${p.type || ''} ${p.author || ''}`.toLowerCase().includes(query))
        : posts;

    return (
        <Box sx={{ maxWidth: 936, margin: 'auto' }}>
            {/* Banner Slider — no rounded corners */}
            {loading ? (
                <Skeleton variant="rectangular" height={200} sx={{ mb: 3 }} />
            ) : banners.length > 0 ? (
                <Paper elevation={0} sx={{ position: 'relative', borderRadius: 0, overflow: 'hidden', mb: 4 }}>
                    <Box sx={{ position: 'relative', height: { xs: 180, sm: 200 } }}>
                        {banners.map((banner, index) => (
                            <Box
                                key={banner.id}
                                sx={{
                                    position: 'absolute', inset: 0,
                                    background: banner.image ? `url(${banner.image}) center/cover no-repeat` : banner.color || 'linear-gradient(135deg, #009be5 0%, #0d47a1 100%)',
                                    display: 'flex', alignItems: 'center', px: { xs: 3, sm: 5 },
                                    opacity: index === currentSlide ? 1 : 0,
                                    transition: 'opacity 0.5s ease-in-out',
                                    pointerEvents: index === currentSlide ? 'auto' : 'none',
                                }}
                            >
                                {banner.image && <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.4)' }} />}
                                <Box sx={{ position: 'relative', zIndex: 1, maxWidth: 600 }}>
                                    <Typography variant="h5" fontWeight={700} sx={{ color: '#fff', mb: 1, fontSize: { xs: '1.1rem', sm: '1.5rem' } }}>
                                        {banner.title}
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
                                        {banner.description}
                                    </Typography>
                                </Box>
                            </Box>
                        ))}
                    </Box>
                    {banners.length > 1 && (
                        <>
                            <IconButton onClick={prevSlide} sx={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', bgcolor: 'rgba(0,0,0,0.3)', color: '#fff', '&:hover': { bgcolor: 'rgba(0,0,0,0.5)' }, width: 36, height: 36 }}>
                                <ChevronLeftIcon />
                            </IconButton>
                            <IconButton onClick={nextSlide} sx={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', bgcolor: 'rgba(0,0,0,0.3)', color: '#fff', '&:hover': { bgcolor: 'rgba(0,0,0,0.5)' }, width: 36, height: 36 }}>
                                <ChevronRightIcon />
                            </IconButton>
                            <Box sx={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 0.75 }}>
                                {banners.map((_, index) => (
                                    <Box key={index} onClick={() => goToSlide(index)} sx={{ width: index === currentSlide ? 24 : 8, height: 8, borderRadius: 4, bgcolor: index === currentSlide ? '#fff' : 'rgba(255,255,255,0.5)', cursor: 'pointer', transition: 'all 0.3s' }} />
                                ))}
                            </Box>
                        </>
                    )}
                </Paper>
            ) : null}

            {/* Host list button */}
            <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                    <Box>
                        <Typography variant="subtitle2" fontWeight={700}>Available Host Link Premium</Typography>
                        <Typography variant="caption" color="text.secondary">Menampilkan seluruh host link premium yang disupport.</Typography>
                    </Box>
                    <Button size="small" variant="outlined" onClick={() => navigate('/available-hosts')}>
                        Tampilkan Host yang Didukung
                    </Button>
                </Box>
            </Paper>

            {/* Official Posts */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <CampaignIcon color="primary" />
                <Typography variant="subtitle1" fontWeight={700} sx={{ color: 'text.primary' }}>
                    Pengumuman Resmi
                </Typography>
                <Chip label="Admin" size="small" color="primary" variant="outlined" sx={{ fontSize: 11, height: 22 }} />
            </Box>

            {loading ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {[1, 2].map((i) => <Skeleton key={i} variant="rectangular" height={100} />)}
                </Box>
            ) : filteredPosts.length === 0 ? (
                <Paper variant="outlined" sx={{ textAlign: 'center', py: 5, borderRadius: 0 }}>
                    <CampaignIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                    <Typography variant="body2" color="text.secondary">{query ? 'Tidak ada hasil pencarian.' : 'Belum ada pengumuman resmi.'}</Typography>
                </Paper>
            ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {filteredPosts.map((post) => {
                        const config = postTypeConfig[post.type] || postTypeConfig.info;
                        return (
                            <Card key={post.id} variant="outlined" sx={{ borderRadius: 0, transition: 'box-shadow 0.2s', '&:hover': { boxShadow: 2 } }}>
                                <CardContent sx={{ p: 2.5 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
                                        <Chip icon={config.icon} label={config.label} size="small" color={config.color} variant="outlined" sx={{ fontSize: 11, height: 24 }} />
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <AccessTimeIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                                            <Typography variant="caption" color="text.disabled">{formatDate(post.created_at)}</Typography>
                                        </Box>
                                    </Box>
                                    <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.75 }}>{post.title}</Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>{post.content}</Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
                                        <Avatar sx={{ width: 24, height: 24, bgcolor: 'primary.main', fontSize: 11 }}>
                                            <AdminPanelSettingsIcon sx={{ fontSize: 14 }} />
                                        </Avatar>
                                        <Typography variant="caption" color="text.secondary" fontWeight={500}>{post.author || 'Admin'}</Typography>
                                    </Box>
                                </CardContent>
                            </Card>
                        );
                    })}
                </Box>
            )}
        </Box>
    );
}
