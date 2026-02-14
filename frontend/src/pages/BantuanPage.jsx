import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import RemoveIcon from '@mui/icons-material/Remove';
import BoltIcon from '@mui/icons-material/Bolt';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';

export default function BantuanPage() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [guidePost, setGuidePost] = useState(null);
    const [previousPrice, setPreviousPrice] = useState({ torrent: null, premium: null });
    const [pricing, setPricing] = useState({
        torrent: { price_per_unit: 1000, unit_size_gb: 1, updated_at: null, description: '' },
        premium: { price_per_unit: 2000, unit_size_gb: 2, updated_at: null, description: '' },
    });

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

    useEffect(() => {
        let alive = true;
        const snapshotKey = 'pricing_previous_snapshot_v1';
        fetch('/api/pricing')
            .then((res) => res.json())
            .then((data) => {
                if (!alive) return;
                const all = Array.isArray(data) ? data : [];
                const torrent = all.find((p) => String(p?.service_type || '').toLowerCase() === 'torrent');
                const premium = all.find((p) => String(p?.service_type || '').toLowerCase() === 'premium');

                const nextPricing = {
                    torrent: {
                        price_per_unit: Number(torrent?.price_per_unit) > 0 ? Number(torrent.price_per_unit) : 1000,
                        unit_size_gb: Number(torrent?.unit_size_gb) > 0 ? Number(torrent.unit_size_gb) : 1,
                        updated_at: torrent?.updated_at || null,
                        description: String(torrent?.description || '').trim(),
                    },
                    premium: {
                        price_per_unit: Number(premium?.price_per_unit) > 0 ? Number(premium.price_per_unit) : 2000,
                        unit_size_gb: Number(premium?.unit_size_gb) > 0 ? Number(premium.unit_size_gb) : 2,
                        updated_at: premium?.updated_at || null,
                        description: String(premium?.description || '').trim(),
                    },
                };

                setPricing(nextPricing);

                try {
                    const raw = localStorage.getItem(snapshotKey);
                    const prev = raw ? JSON.parse(raw) : null;
                    const prevTorrent = Number(prev?.torrent?.price_per_unit);
                    const prevPremium = Number(prev?.premium?.price_per_unit);
                    setPreviousPrice({
                        torrent: Number.isFinite(prevTorrent) && prevTorrent > 0 ? prevTorrent : null,
                        premium: Number.isFinite(prevPremium) && prevPremium > 0 ? prevPremium : null,
                    });

                    localStorage.setItem(
                        snapshotKey,
                        JSON.stringify({
                            torrent: { price_per_unit: nextPricing.torrent.price_per_unit, updated_at: nextPricing.torrent.updated_at },
                            premium: { price_per_unit: nextPricing.premium.price_per_unit, updated_at: nextPricing.premium.updated_at },
                        })
                    );
                } catch {
                    setPreviousPrice({ torrent: null, premium: null });
                }
            })
            .catch(() => {
                if (!alive) return;
                setPreviousPrice({ torrent: null, premium: null });
                setPricing({
                    torrent: { price_per_unit: 1000, unit_size_gb: 1, updated_at: null, description: '' },
                    premium: { price_per_unit: 2000, unit_size_gb: 2, updated_at: null, description: '' },
                });
            });

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

    const formatIDR = (n) => Number(n || 0).toLocaleString('id-ID');

    const getPriceSignal = (serviceType) => {
        const current = Number(pricing?.[serviceType]?.price_per_unit || 0);
        const prev = Number(previousPrice?.[serviceType]);
        if (!Number.isFinite(prev) || prev <= 0) {
            return { label: 'Belum ada data sebelumnya', color: 'default', icon: <RemoveIcon sx={{ fontSize: 14 }} /> };
        }
        if (current > prev) {
            return { label: `Naik ${formatIDR(current - prev)}`, color: 'error', icon: <TrendingUpIcon sx={{ fontSize: 14 }} /> };
        }
        if (current < prev) {
            return { label: `Turun ${formatIDR(prev - current)}`, color: 'success', icon: <TrendingDownIcon sx={{ fontSize: 14 }} /> };
        }
        return { label: 'Tetap dari sebelumnya', color: 'default', icon: <RemoveIcon sx={{ fontSize: 14 }} /> };
    };

    const getPriceDescription = (serviceType) => {
        const text = String(pricing?.[serviceType]?.description || '').trim();
        return text || 'Deskripsi harga belum diatur di admin panel';
    };

    return (
        <Box sx={{ maxWidth: 936, margin: 'auto' }}>
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 0 }}>
                <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 0, mb: 2 }}>
                    <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>
                        Info Harga Hari Ini
                    </Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1 }}>
                        {[
                            { key: 'torrent', label: 'Torrent / Magnet', icon: <BoltIcon color="primary" fontSize="small" /> },
                            { key: 'premium', label: 'Host Premium', icon: <WorkspacePremiumIcon color="primary" fontSize="small" /> },
                        ].map((item) => {
                            const current = pricing?.[item.key] || { price_per_unit: 0, unit_size_gb: 1, updated_at: null, description: '' };
                            const signal = getPriceSignal(item.key);
                            return (
                                <Paper key={item.key} variant="outlined" sx={{ p: 1.5, borderRadius: 0 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 0.5 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                            {item.icon}
                                            <Typography variant="body2" fontWeight={700}>{item.label}</Typography>
                                        </Box>
                                        <Chip size="small" label={signal.label} color={signal.color} icon={signal.icon} variant="outlined" />
                                    </Box>
                                    <Typography variant="subtitle2" fontWeight={800}>
                                        Rp {formatIDR(current.price_per_unit)} / {current.unit_size_gb} GB
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {getPriceDescription(item.key)}
                                    </Typography>
                                </Paper>
                            );
                        })}
                    </Box>
                </Paper>

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
