import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemText from '@mui/material/ListItemText';
import Avatar from '@mui/material/Avatar';
import Paper from '@mui/material/Paper';
import Divider from '@mui/material/Divider';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import HistoryIcon from '@mui/icons-material/History';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import IconButton from '@mui/material/IconButton';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

export default function TopUpPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [topups, setTopups] = useState([]);
    const [loadingTransactions, setLoadingTransactions] = useState(true);
    const [loadingTopups, setLoadingTopups] = useState(true);
    const [txPage, setTxPage] = useState(1);
    const [txTotalPages, setTxTotalPages] = useState(1);
    const [txTotal, setTxTotal] = useState(0);
    const [topupPage, setTopupPage] = useState(1);
    const [topupTotalPages, setTopupTotalPages] = useState(1);
    const [topupTotal, setTopupTotal] = useState(0);
    const [historyTab, setHistoryTab] = useState(0);
    const [flash, setFlash] = useState(null);

    useEffect(() => {
        const incoming = location?.state?.flash;
        if (incoming?.text) {
            setFlash(incoming);
            navigate('/balance', { replace: true, state: null });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location?.state]);

    useEffect(() => {
        if (!flash?.text) return;
        const t = setTimeout(() => setFlash(null), 5000);
        return () => clearTimeout(t);
    }, [flash]);

    useEffect(() => {
        fetch('/api/user')
            .then((res) => res.json())
            .then((data) => setUser(data))
            .catch(console.error);
    }, []);

    useEffect(() => {
        setLoadingTransactions(true);
        fetch(`/api/transactions?page=${txPage}&page_size=10`)
            .then((res) => res.json())
            .then((data) => {
                if (Array.isArray(data)) {
                    const total = data.length;
                    const totalPages = Math.max(1, Math.ceil(total / 10));
                    const page = Math.min(Math.max(1, txPage), totalPages);
                    const start = (page - 1) * 10;
                    setTransactions(data.slice(start, start + 10));
                    setTxTotal(total);
                    setTxTotalPages(totalPages);
                    return;
                }
                const items = Array.isArray(data?.items) ? data.items : [];
                setTransactions(items);
                setTxTotal(Number(data?.total || 0));
                setTxTotalPages(Math.max(1, Number(data?.total_pages || 1)));
                if (Number(data?.page || 0) > 0 && Number(data.page) !== txPage) {
                    setTxPage(Number(data.page));
                }
            })
            .catch(console.error)
            .finally(() => setLoadingTransactions(false));
    }, [txPage]);

    useEffect(() => {
        setLoadingTopups(true);
        fetch(`/api/topups?page=${topupPage}&page_size=10`)
            .then((res) => res.json())
            .then((data) => {
                if (Array.isArray(data)) {
                    const total = data.length;
                    const totalPages = Math.max(1, Math.ceil(total / 10));
                    const page = Math.min(Math.max(1, topupPage), totalPages);
                    const start = (page - 1) * 10;
                    setTopups(data.slice(start, start + 10));
                    setTopupTotal(total);
                    setTopupTotalPages(totalPages);
                    return;
                }
                const items = Array.isArray(data?.items) ? data.items : [];
                setTopups(items);
                setTopupTotal(Number(data?.total || 0));
                setTopupTotalPages(Math.max(1, Number(data?.total_pages || 1)));
                if (Number(data?.page || 0) > 0 && Number(data.page) !== topupPage) {
                    setTopupPage(Number(data.page));
                }
            })
            .catch(console.error)
            .finally(() => setLoadingTopups(false));
    }, [topupPage]);

    const statusChip = (status) => {
        if (status === 'approved') return <Chip size="small" label="Approved" color="success" variant="outlined" />;
        if (status === 'rejected') return <Chip size="small" label="Rejected" color="error" variant="outlined" />;
        if (status === 'cancelled') return <Chip size="small" label="Cancelled" color="default" variant="outlined" />;
        if (status === 'expired') return <Chip size="small" label="Expired" color="default" variant="outlined" />;
        if (status === 'awaiting_payment') return <Chip size="small" label="Menunggu Bayar" color="info" variant="outlined" />;
        return <Chip size="small" label="On Progress" color="warning" variant="outlined" />;
    };

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const formatIDRNumber = (value) => {
        const n = typeof value === 'number' ? value : parseInt(String(value || '').replace(/[^0-9]/g, ''), 10);
        const safe = Number.isFinite(n) ? n : 0;
        return safe.toLocaleString('id-ID');
    };

    const methodMeta = (method) => {
        const m = String(method || '').toLowerCase();
        if (m === 'gopay') return { label: 'GoPay', logo: '/logo-pembayaran/gopay.png' };
        if (m === 'bri') return { label: 'BRI', logo: '/logo-pembayaran/bri.svg' };
        if (m === 'bank_jago') return { label: 'Bank Jago', logo: '/logo-pembayaran/bank_jago.png' };
        if (m === 'crypto_usdt') return { label: 'USDT', logo: '/logo-pembayaran/usdt.png' };
        return { label: method || '-', logo: '' };
    };

    const displaySerial = (t) => {
        const s = String(t?.serial || '').trim();
        if (s) return s;
        return `TOPUP-${t?.id || ''}`;
    };

    return (
        <Box sx={{ maxWidth: 936, margin: 'auto' }}>
            {flash?.text ? (
                <Alert severity={flash.severity || 'info'} sx={{ mb: 2, borderRadius: 0 }}>
                    {flash.text}
                </Alert>
            ) : null}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2.5, mb: 4 }}>
                {/* Balance Card */}
                <Card variant="outlined" sx={{ position: 'relative', overflow: 'hidden', bgcolor: 'background.paper' }}>
                    <CardContent sx={{ p: 3 }}>
                        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                            Saldo Saat Ini
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 3 }}>
                            <Typography variant="h4" fontWeight={700} sx={{ color: 'primary.main', lineHeight: 1.1 }}>
                                {formatIDRNumber(user?.balance ?? user?.balance_formatted)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 0.6 }}>
                                IDR
                            </Typography>
                        </Box>
                        <Button
                            variant="outlined"
                            color="primary"
                            sx={{ fontWeight: 600 }}
                            onClick={() => navigate('/topup/new')}
                        >
                            + Isi Saldo
                        </Button>
                    </CardContent>
                </Card>

                {/* Stats Cards */}
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                    <Card variant="outlined">
                        <CardContent>
                            <CloudDownloadIcon color="primary" sx={{ fontSize: 28, mb: 1 }} />
                            <Typography variant="h5" fontWeight={700}>
                                {formatIDRNumber(user?.total_downloads ?? 0)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" fontWeight={500}>
                                Total Diunduh
                            </Typography>
                            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.25 }}>
                                Torrent {formatIDRNumber(user?.torrent_count ?? 0)} • Premium {formatIDRNumber(user?.premium_count ?? 0)}
                            </Typography>
                        </CardContent>
                    </Card>
                    <Card variant="outlined">
                        <CardContent>
                            <HistoryIcon color="warning" sx={{ fontSize: 28, mb: 1 }} />
                            <Typography variant="h5" fontWeight={700}>
                                {txTotal}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" fontWeight={500}>
                                Transaksi
                            </Typography>
                        </CardContent>
                    </Card>
                </Box>
            </Box>

            {/* Combined History */}
            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1, pb: 1.25 }}>
                    <Typography variant="subtitle2" fontWeight={700}>
                        Riwayat
                    </Typography>
                    <Typography variant="caption" color="text.secondary">Top up: {topupTotal} | Transaksi: {txTotal}</Typography>
                </Box>

                <Tabs
                    value={historyTab}
                    onChange={(_, v) => setHistoryTab(v)}
                    variant="fullWidth"
                    sx={{ px: 1, mb: 1 }}
                >
                    <Tab label="Status Top Up" />
                    <Tab label="Riwayat Transaksi" />
                </Tabs>

                {historyTab === 0 ? (
                    <>
                        {loadingTopups ? (
                            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                                Memuat...
                            </Typography>
                        ) : topups.length === 0 ? (
                            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                                Belum ada permintaan top up.
                            </Typography>
                        ) : (
                            <List disablePadding>
                                {topups.map((t, idx) => (
                                    <React.Fragment key={t.id}>
                                        <ListItem disablePadding>
                                            <ListItemButton
                                                onClick={() => navigate(`/topup?id=${encodeURIComponent(String(t.id))}`)}
                                                sx={(theme) => ({
                                                    alignItems: 'flex-start',
                                                    px: 1,
                                                    py: 1.1,
                                                    gap: 1.5,
                                                    borderRadius: 0,
                                                    bgcolor:
                                                        theme.palette.mode === 'dark'
                                                            ? 'rgba(144, 202, 249, 0.08)'
                                                            : 'rgba(25, 118, 210, 0.06)',
                                                    '&:hover': {
                                                        bgcolor:
                                                            theme.palette.mode === 'dark'
                                                                ? 'rgba(144, 202, 249, 0.12)'
                                                                : 'rgba(25, 118, 210, 0.10)',
                                                    },
                                                })}
                                            >
                                                <ListItemAvatar sx={{ minWidth: 44, mt: 0.2 }}>
                                                    <Avatar
                                                        src={methodMeta(t.payment_method).logo || undefined}
                                                        variant="rounded"
                                                        sx={{ width: 36, height: 30, bgcolor: 'transparent' }}
                                                        imgProps={{ style: { objectFit: 'contain' } }}
                                                    >
                                                        {methodMeta(t.payment_method).label?.slice(0, 1) || 'T'}
                                                    </Avatar>
                                                </ListItemAvatar>

                                                <Box sx={{ minWidth: 0, flex: 1 }}>
                                                    <Typography
                                                        variant="caption"
                                                        sx={{
                                                            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                                                            color: 'text.secondary',
                                                            display: 'block',
                                                        }}
                                                    >
                                                        {displaySerial(t)}
                                                    </Typography>
                                                    <Typography variant="body2" fontWeight={500} sx={{ mt: 0.25 }} noWrap>
                                                        {formatIDRNumber(t.amount || 0)}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }} noWrap>
                                                        {methodMeta(t.payment_method).label} • {formatDate(t.created_at)}
                                                        {t.status === 'rejected' && t.admin_reason ? ` • Ditolak: ${t.admin_reason}` : ''}
                                                    </Typography>
                                                </Box>

                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 1 }}>
                                                    {statusChip(t.status)}
                                                </Box>
                                            </ListItemButton>
                                        </ListItem>
                                        {idx < topups.length - 1 && (
                                            <Divider component="li" sx={{ my: 0.75, opacity: 0.6 }} />
                                        )}
                                    </React.Fragment>
                                ))}
                            </List>
                        )}

                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 1, pt: 1 }}>
                            <Typography variant="caption" color="text.secondary">
                                Halaman {topupPage} dari {topupTotalPages}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <IconButton
                                    size="small"
                                    disabled={topupPage <= 1}
                                    onClick={() => setTopupPage((p) => Math.max(1, p - 1))}
                                >
                                    <ChevronLeftIcon fontSize="small" />
                                </IconButton>
                                <IconButton
                                    size="small"
                                    disabled={topupPage >= topupTotalPages}
                                    onClick={() => setTopupPage((p) => Math.min(topupTotalPages, p + 1))}
                                >
                                    <ChevronRightIcon fontSize="small" />
                                </IconButton>
                            </Box>
                        </Box>
                    </>
                ) : (
                    <>
                        {loadingTransactions ? (
                            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                                Memuat...
                            </Typography>
                        ) : transactions.length === 0 ? (
                            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                                Belum ada transaksi
                            </Typography>
                        ) : (
                            <List disablePadding>
                                {transactions.map((tx, idx) => (
                                    <React.Fragment key={tx.id}>
                                        <ListItem
                                            secondaryAction={
                                                <Typography
                                                    variant="body2"
                                                    fontWeight={500}
                                                    color={tx.amount > 0 ? 'success.main' : 'error.main'}
                                                >
                                                    {tx.amount > 0 ? '+' : ''} {formatIDRNumber(Math.abs(tx.amount || 0))}
                                                </Typography>
                                            }
                                        >
                                            <ListItemAvatar>
                                                <Avatar
                                                    sx={{
                                                        bgcolor: tx.amount > 0 ? 'success.50' : 'error.50',
                                                        color: tx.amount > 0 ? 'success.main' : 'error.main',
                                                        width: 36,
                                                        height: 36,
                                                    }}
                                                >
                                                    {tx.amount > 0 ? <AddIcon fontSize="small" /> : <RemoveIcon fontSize="small" />}
                                                </Avatar>
                                            </ListItemAvatar>
                                            <ListItemText
                                                primary={tx.description}
                                                secondary={formatDate(tx.created_at)}
                                                primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                                                secondaryTypographyProps={{ variant: 'caption' }}
                                            />
                                        </ListItem>
                                        {idx < transactions.length - 1 && <Divider component="li" />}
                                    </React.Fragment>
                                ))}
                            </List>
                        )}

                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 1, pt: 1 }}>
                            <Typography variant="caption" color="text.secondary">
                                Halaman {txPage} dari {txTotalPages}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <IconButton
                                    size="small"
                                    disabled={txPage <= 1}
                                    onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                                >
                                    <ChevronLeftIcon fontSize="small" />
                                </IconButton>
                                <IconButton
                                    size="small"
                                    disabled={txPage >= txTotalPages}
                                    onClick={() => setTxPage((p) => Math.min(txTotalPages, p + 1))}
                                >
                                    <ChevronRightIcon fontSize="small" />
                                </IconButton>
                            </Box>
                        </Box>
                    </>
                )}
            </Paper>
        </Box>
    );
}
