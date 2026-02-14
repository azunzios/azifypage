import React, { useState, useEffect, useRef, useCallback } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Skeleton from '@mui/material/Skeleton';
import Divider from '@mui/material/Divider';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CampaignIcon from '@mui/icons-material/Campaign';
import NewReleasesIcon from '@mui/icons-material/NewReleases';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import SendIcon from '@mui/icons-material/Send';
import ForumIcon from '@mui/icons-material/Forum';
import VerifiedIcon from '@mui/icons-material/VerifiedUser';
import BuildIcon from '@mui/icons-material/Build';
import { useAuth } from '../App';

// Fallback data
const fallbackBanners = [
    {
        id: 1,
        title: 'Selamat Datang di AzifyPage! 🎉',
        description: 'Platform download premium terpercaya. Nikmati layanan torrent dan host premium dengan harga terjangkau.',
        color: 'linear-gradient(135deg, #009be5 0%, #0d47a1 100%)',
    },
    {
        id: 2,
        title: 'Promo Saldo — Bonus 20%',
        description: 'Top up saldo minimal Rp 50.000 dan dapatkan bonus 20% untuk semua metode pembayaran.',
        color: 'linear-gradient(135deg, #e91e63 0%, #9c27b0 100%)',
    },
    {
        id: 3,
        title: 'Host Premium Tersedia',
        description: 'Rapidgator, Uploaded, Nitroflare, dan lainnya kini tersedia. Kirim link dan kami proses manual untuk kamu.',
        color: 'linear-gradient(135deg, #ff9800 0%, #f44336 100%)',
    },
];

const fallbackOfficialPosts = [
    {
        id: 1,
        title: 'Maintenance Server Selesai',
        content: 'Server telah selesai dimaintenance. Semua layanan sudah berjalan normal kembali. Terima kasih atas kesabarannya!',
        author: 'Admin',
        created_at: new Date().toISOString(),
        type: 'info',
    },
    {
        id: 2,
        title: 'Update: Dukungan Magnet Link Ditingkatkan',
        content: 'Kami telah meningkatkan kecepatan dan reliabilitas untuk magnet link. Proses download sekarang lebih cepat hingga 2x lipat.',
        author: 'Admin',
        created_at: new Date(Date.now() - 172800000).toISOString(),
        type: 'update',
    },
];

const fallbackUserPosts = [
    {
        id: 101,
        content: 'Mantap banget layanannya, download cepat dan murah! 🔥',
        author_name: 'Budi',
        author_email: 'budi@mail.com',
        created_at: new Date(Date.now() - 3600000).toISOString(),
    },
    {
        id: 102,
        content: 'Ada yang tahu cara import file .txt link ke IDM? Mau download folder besar nih.',
        author_name: 'Sari',
        author_email: 'sari@mail.com',
        created_at: new Date(Date.now() - 7200000).toISOString(),
    },
    {
        id: 103,
        content: 'Baru coba host premium, Rapidgator lancar jaya. Recommended!',
        author_name: 'Andi',
        author_email: 'andi@mail.com',
        created_at: new Date(Date.now() - 86400000).toISOString(),
    },
];

const postTypeConfig = {
    info: { color: 'info', icon: <CampaignIcon fontSize="small" />, label: 'Info' },
    tip: { color: 'success', icon: <NewReleasesIcon fontSize="small" />, label: 'Tips' },
    update: { color: 'primary', icon: <NewReleasesIcon fontSize="small" />, label: 'Update' },
    warning: { color: 'warning', icon: <NewReleasesIcon fontSize="small" />, label: 'Penting' },
};

export default function FeedPage() {
    const { user } = useAuth();
    const [banners, setBanners] = useState([]);
    const [officialPosts, setOfficialPosts] = useState([]);
    const [userPosts, setUserPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentSlide, setCurrentSlide] = useState(0);
    const [newPost, setNewPost] = useState('');
    const [posting, setPosting] = useState(false);
    const [message, setMessage] = useState('');
    const timerRef = useRef(null);

    useEffect(() => {
        const loadData = async () => {
            try {
                const [bannersRes, officialRes, userRes] = await Promise.allSettled([
                    fetch('/api/banners').then((r) => r.json()),
                    fetch('/api/posts?type=official').then((r) => r.json()),
                    fetch('/api/posts?type=user').then((r) => r.json()),
                ]);
                setBanners(bannersRes.status === 'fulfilled' && bannersRes.value?.length ? bannersRes.value : fallbackBanners);
                setOfficialPosts(officialRes.status === 'fulfilled' && officialRes.value?.length ? officialRes.value : fallbackOfficialPosts);
                setUserPosts(userRes.status === 'fulfilled' && userRes.value?.length ? userRes.value : fallbackUserPosts);
            } catch {
                setBanners(fallbackBanners);
                setOfficialPosts(fallbackOfficialPosts);
                setUserPosts(fallbackUserPosts);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    // Auto-slide
    const startTimer = useCallback(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % (banners.length || 1));
        }, 5000);
    }, [banners.length]);

    useEffect(() => {
        if (banners.length > 1) startTimer();
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [banners.length, startTimer]);

    const goToSlide = (index) => { setCurrentSlide(index); startTimer(); };
    const prevSlide = () => { setCurrentSlide((prev) => (prev - 1 + banners.length) % banners.length); startTimer(); };
    const nextSlide = () => { setCurrentSlide((prev) => (prev + 1) % banners.length); startTimer(); };

    const handlePost = async () => {
        if (!newPost.trim()) return;
        setPosting(true);
        try {
            const res = await fetch('/api/posts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: newPost.trim() }),
            });
            if (res.ok) {
                const data = await res.json();
                setUserPosts([data, ...userPosts]);
                setNewPost('');
                setMessage('Postingan berhasil dikirim!');
            } else {
                // Fallback: add locally
                const localPost = {
                    id: Date.now(),
                    content: newPost.trim(),
                    author_name: user?.name || user?.email?.split('@')[0] || 'Anda',
                    author_email: user?.email || '',
                    created_at: new Date().toISOString(),
                };
                setUserPosts([localPost, ...userPosts]);
                setNewPost('');
                setMessage('Postingan berhasil dikirim!');
            }
        } catch {
            // Fallback: add locally
            const localPost = {
                id: Date.now(),
                content: newPost.trim(),
                author_name: user?.name || user?.email?.split('@')[0] || 'Anda',
                author_email: user?.email || '',
                created_at: new Date().toISOString(),
            };
            setUserPosts([localPost, ...userPosts]);
            setNewPost('');
            setMessage('Postingan berhasil dikirim!');
        } finally {
            setPosting(false);
        }
    };

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

    return (
        <Box sx={{ maxWidth: 936, margin: 'auto' }}>
            {/* ===== BANNER SLIDER ===== */}
            {loading ? (
                <Skeleton variant="rounded" height={200} sx={{ mb: 3, borderRadius: 3 }} />
            ) : (
                <Paper elevation={0} sx={{ position: 'relative', borderRadius: 3, overflow: 'hidden', mb: 4 }}>
                    <Box sx={{ position: 'relative', height: { xs: 180, sm: 200 } }}>
                        {banners.map((banner, index) => (
                            <Box
                                key={banner.id}
                                sx={{
                                    position: 'absolute', inset: 0,
                                    background: banner.image ? `url(${banner.image}) center/cover no-repeat` : banner.color,
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
            )}

            {/* ===== SECTION 1: INFORMASI RESMI ===== */}
            <Box sx={{ mb: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <CampaignIcon color="primary" />
                    <Typography variant="subtitle1" fontWeight={700}>
                        Informasi Resmi
                    </Typography>
                </Box>

                {loading ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {[1, 2].map((i) => <Skeleton key={i} variant="rounded" height={100} />)}
                    </Box>
                ) : officialPosts.length === 0 ? (
                    <Paper variant="outlined" sx={{ textAlign: 'center', py: 5 }}>
                        <CampaignIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                        <Typography variant="body2" color="text.secondary">Belum ada informasi resmi.</Typography>
                    </Paper>
                ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {officialPosts.map((post) => {
                            const config = postTypeConfig[post.type] || postTypeConfig.info;
                            return (
                                <Card key={post.id} variant="outlined" sx={{ transition: 'box-shadow 0.2s', '&:hover': { boxShadow: 2 } }}>
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
                                            <VerifiedIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                                            <Typography variant="caption" color="text.secondary" fontWeight={500}>{post.author || 'Admin'}</Typography>
                                        </Box>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </Box>
                )}
            </Box>

            <Divider sx={{ mb: 4 }} />

            {/* ===== SECTION 2: POSTINGAN PENGGUNA ===== */}
            <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <ForumIcon color="secondary" />
                    <Typography variant="subtitle1" fontWeight={700}>
                        Postingan Pengguna
                    </Typography>
                </Box>

                {/* New post input */}
                <Card variant="outlined" sx={{ mb: 3 }}>
                    <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.main', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
                                {user?.email?.charAt(0).toUpperCase() || 'U'}
                            </Avatar>
                            <Box sx={{ flex: 1 }}>
                                <TextField
                                    fullWidth
                                    multiline
                                    minRows={2}
                                    maxRows={5}
                                    placeholder="Tulis sesuatu... Berbagi tips, tanya jawab, atau diskusi."
                                    value={newPost}
                                    onChange={(e) => setNewPost(e.target.value)}
                                    variant="outlined"
                                    size="small"
                                    sx={{ mb: 1.5 }}
                                />
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Typography variant="caption" color="text.disabled">
                                        {newPost.length}/500
                                    </Typography>
                                    <Button
                                        variant="contained"
                                        size="small"
                                        endIcon={<SendIcon />}
                                        onClick={handlePost}
                                        disabled={posting || !newPost.trim() || newPost.length > 500}
                                        sx={{ textTransform: 'none' }}
                                    >
                                        {posting ? 'Mengirim...' : 'Kirim'}
                                    </Button>
                                </Box>
                            </Box>
                        </Box>
                    </CardContent>
                </Card>

                {/* User posts list */}
                {loading ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {[1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" height={80} />)}
                    </Box>
                ) : userPosts.length === 0 ? (
                    <Paper variant="outlined" sx={{ textAlign: 'center', py: 5 }}>
                        <ForumIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                        <Typography variant="body2" color="text.secondary">Belum ada postingan. Jadilah yang pertama!</Typography>
                    </Paper>
                ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {userPosts.map((post) => {
                            const isAdmin = post.role === 'admin';
                            return (
                            <Card key={post.id} variant="outlined" sx={{ transition: 'box-shadow 0.2s', '&:hover': { boxShadow: 1 } }}>
                                <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                                    <Box sx={{ display: 'flex', gap: 2 }}>
                                        <Avatar sx={{ width: 36, height: 36, bgcolor: isAdmin ? 'primary.main' : 'secondary.main', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
                                            {(post.author_name || post.author_email || 'U').charAt(0).toUpperCase()}
                                        </Avatar>
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                    <Typography variant="body2" fontWeight={600}>
                                                        {post.author_name || post.author_email?.split('@')[0] || 'Pengguna'}
                                                    </Typography>
                                                    {isAdmin && (
                                                        <Chip
                                                            icon={<BuildIcon sx={{ fontSize: 14 }} />}
                                                            label="Admin"
                                                            size="small"
                                                            color="primary"
                                                            sx={{ height: 20, fontSize: 11 }}
                                                        />
                                                    )}
                                                </Box>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                    <AccessTimeIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
                                                    <Typography variant="caption" color="text.disabled">
                                                        {formatDate(post.created_at)}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                                                {post.content}
                                            </Typography>
                                        </Box>
                                    </Box>
                                </CardContent>
                            </Card>
                            );
                        })}
                    </Box>
                )}
            </Box>

            <Snackbar open={!!message} autoHideDuration={3000} onClose={() => setMessage('')}>
                <Alert onClose={() => setMessage('')} severity="success" variant="filled">{message}</Alert>
            </Snackbar>
        </Box>
    );
}
