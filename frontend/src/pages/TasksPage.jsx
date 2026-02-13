import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import FileListTable from '../components/FileListTable';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import Toolbar from '@mui/material/Toolbar';
import AppBar from '@mui/material/AppBar';
import Typography from '@mui/material/Typography';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import Fab from '@mui/material/Fab';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import HomeIcon from '@mui/icons-material/Home';
import RefreshIcon from '@mui/icons-material/Refresh';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import FolderIcon from '@mui/icons-material/Folder';
import DownloadIcon from '@mui/icons-material/Download';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import DownloadingIcon from '@mui/icons-material/Downloading';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';

export default function TasksPage() {
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [premiumHistory, setPremiumHistory] = useState([]);
    const [loadingPremium, setLoadingPremium] = useState(true);
    const [premiumPage, setPremiumPage] = useState(1);
    const [premiumTotalPages, setPremiumTotalPages] = useState(1);
    const [premiumTotal, setPremiumTotal] = useState(0);
    const [showInfo, setShowInfo] = useState(false);
    const navigate = useNavigate();

    // Navigation state
    const [currentFolderId, setCurrentFolderId] = useState('');
    const [folderHistory, setFolderHistory] = useState([{ id: '', name: 'Unduhan Kamu' }]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const [breadcrumb, setBreadcrumb] = useState([{ id: '', name: 'Unduhan Kamu' }]);

    const loadFiles = useCallback((folderId = '') => {
        setLoading(true);
        const url = folderId ? `/api/files?parent_id=${folderId}` : '/api/files';
        fetch(url)
            .then((res) => res.json())
            .then((data) => {
                setFiles(data || []);
                setLoading(false);
            })
            .catch((err) => {
                console.error(err);
                setLoading(false);
            });
    }, []);

    useEffect(() => {
        loadFiles(currentFolderId);
    }, [currentFolderId, loadFiles]);

    useEffect(() => {
        setLoadingPremium(true);
        fetch(`/api/premium/request?page=${premiumPage}&page_size=25`)
            .then((res) => res.json())
            .then((data) => {
                if (Array.isArray(data)) {
                    // Backward compatibility if server still returns array
                    const total = data.length;
                    const totalPages = Math.max(1, Math.ceil(total / 25));
                    const page = Math.min(Math.max(1, premiumPage), totalPages);
                    const start = (page - 1) * 25;
                    setPremiumHistory(data.slice(start, start + 25));
                    setPremiumTotal(total);
                    setPremiumTotalPages(totalPages);
                    return;
                }

                const items = Array.isArray(data?.items) ? data.items : [];
                setPremiumHistory(items);
                setPremiumTotal(Number(data?.total || 0));
                setPremiumTotalPages(Math.max(1, Number(data?.total_pages || 1)));
            })
            .catch(() => {
                setPremiumHistory([]);
                setPremiumTotal(0);
                setPremiumTotalPages(1);
            })
            .finally(() => setLoadingPremium(false));
    }, [premiumPage]);

    const formatDateTime = (dateStr) => {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        if (Number.isNaN(d.getTime())) return '-';
        return d.toLocaleString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const formatIDR = (n) => Number(n || 0).toLocaleString('id-ID');

    const navigateToFolder = (folderId, folderName) => {
        const currentBreadcrumbIndex = breadcrumb.findIndex((b) => b.id === currentFolderId);
        const newBreadcrumb = [...breadcrumb.slice(0, currentBreadcrumbIndex + 1), { id: folderId, name: folderName }];
        setBreadcrumb(newBreadcrumb);

        const newHistory = [...folderHistory.slice(0, historyIndex + 1), { id: folderId, name: folderName }];
        setFolderHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
        setCurrentFolderId(folderId);
    };

    const goBack = () => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            const targetFolder = folderHistory[newIndex];
            setHistoryIndex(newIndex);
            setCurrentFolderId(targetFolder.id);
            const breadcrumbIndex = breadcrumb.findIndex((b) => b.id === targetFolder.id);
            if (breadcrumbIndex !== -1) setBreadcrumb(breadcrumb.slice(0, breadcrumbIndex + 1));
        }
    };

    const goForward = () => {
        if (historyIndex < folderHistory.length - 1) {
            const newIndex = historyIndex + 1;
            const targetFolder = folderHistory[newIndex];
            setHistoryIndex(newIndex);
            setCurrentFolderId(targetFolder.id);
            if (!breadcrumb.find((b) => b.id === targetFolder.id)) setBreadcrumb([...breadcrumb, targetFolder]);
        }
    };

    const goUp = () => {
        if (breadcrumb.length > 1) {
            navigateToBreadcrumb(breadcrumb[breadcrumb.length - 2].id, breadcrumb.length - 2);
        }
    };

    const goHome = () => {
        setBreadcrumb([{ id: '', name: 'Unduhan Kamu' }]);
        const newHistory = [...folderHistory.slice(0, historyIndex + 1), { id: '', name: 'Unduhan Kamu' }];
        setFolderHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
        setCurrentFolderId('');
    };

    const navigateToBreadcrumb = (folderId, index) => {
        const newBreadcrumb = breadcrumb.slice(0, index + 1);
        setBreadcrumb(newBreadcrumb);
        const targetFolder = breadcrumb[index];
        const newHistory = [...folderHistory.slice(0, historyIndex + 1), targetFolder];
        setFolderHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
        setCurrentFolderId(folderId);
    };

    const refresh = () => loadFiles(currentFolderId);

    const canGoBack = historyIndex > 0;
    const canGoForward = historyIndex < folderHistory.length - 1;
    const canGoUp = breadcrumb.length > 1;

    return (
        <Box sx={{ maxWidth: 936, margin: 'auto', position: 'relative' }}>
            {/* Navigation Toolbar + File List */}
            <Paper elevation={0} sx={{ overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ px: 2, py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="subtitle2" fontWeight={700}>Unduhan Torrent</Typography>
                </Box>
                <AppBar position="static" color="default" elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Toolbar variant="dense">
                        <Tooltip title="Kembali">
                            <span>
                                <IconButton size="small" onClick={goBack} disabled={!canGoBack}>
                                    <ChevronLeftIcon />
                                </IconButton>
                            </span>
                        </Tooltip>
                        <Tooltip title="Maju">
                            <span>
                                <IconButton size="small" onClick={goForward} disabled={!canGoForward}>
                                    <ChevronRightIcon />
                                </IconButton>
                            </span>
                        </Tooltip>
                        <Tooltip title="Naik ke folder induk">
                            <span>
                                <IconButton size="small" onClick={goUp} disabled={!canGoUp}>
                                    <ArrowUpwardIcon />
                                </IconButton>
                            </span>
                        </Tooltip>

                        <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

                        <Tooltip title="Beranda">
                            <IconButton size="small" onClick={goHome}>
                                <HomeIcon />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Refresh">
                            <IconButton size="small" onClick={refresh}>
                                <RefreshIcon />
                            </IconButton>
                        </Tooltip>

                        <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

                        {/* Breadcrumb */}
                        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', overflow: 'auto', ml: 1 }}>
                            <FolderIcon sx={{ color: 'text.disabled', mr: 1, fontSize: 18 }} />
                            <Breadcrumbs separator="›" sx={{ fontSize: 13 }}>
                                {breadcrumb.map((item, index) =>
                                    index === breadcrumb.length - 1 ? (
                                        <Typography key={item.id || 'root'} variant="body2" fontWeight={500} color="text.primary" noWrap>
                                            {item.name}
                                        </Typography>
                                    ) : (
                                        <Link
                                            key={item.id || 'root'}
                                            component="button"
                                            variant="body2"
                                            underline="hover"
                                            color="text.secondary"
                                            onClick={() => navigateToBreadcrumb(item.id, index)}
                                            sx={{ cursor: 'pointer' }}
                                        >
                                            {item.name}
                                        </Link>
                                    )
                                )}
                            </Breadcrumbs>
                        </Box>

                        <Tooltip title="Info Penting">
                            <IconButton size="small" onClick={() => setShowInfo(true)}>
                                <InfoOutlinedIcon />
                            </IconButton>
                        </Tooltip>
                    </Toolbar>
                </AppBar>

                {/* File list */}
                <Box sx={{ p: 0 }}>
                    <FileListTable files={files} loading={loading} onFolderClick={navigateToFolder} />
                </Box>
            </Paper>

            <Paper elevation={0} sx={{ mt: 2, p: 2, border: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.25 }}>
                    <Typography variant="subtitle2" fontWeight={700}>Unduhan Host Premium</Typography>
                    <Typography variant="caption" color="text.secondary">
                        {premiumTotal} data
                    </Typography>
                </Box>

                {loadingPremium ? (
                    <Typography variant="body2" color="text.secondary">Memuat riwayat premium...</Typography>
                ) : premiumHistory.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">Belum ada riwayat download host premium.</Typography>
                ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {premiumHistory.map((item) => (
                            <Paper key={item.id} variant="outlined" sx={{ p: 1.25 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                                    <Box sx={{ minWidth: 0, flex: 1 }}>
                                        <Typography variant="body2" fontWeight={600} noWrap title={item.filename || item.url}>
                                            {item.filename || item.url}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                            Host: {item.host || '-'} | Tanggal: {formatDateTime(item.created_at)}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                            Ukuran: {(item.size_bytes > 0 ? `${(Number(item.size_bytes) / (1024 * 1024 * 1024)).toFixed(2)} GB` : '-')} |
                                            {' '}<AttachMoneyIcon sx={{ fontSize: 12, verticalAlign: 'middle', mx: 0.25 }} /> Rp {formatIDR(item.price || 0)}
                                        </Typography>
                                    </Box>

                                    <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', flexWrap: 'wrap' }}>
                                        {item.result_url ? (
                                            <Button
                                                size="small"
                                                variant="contained"
                                                startIcon={<DownloadIcon fontSize="small" />}
                                                onClick={() => window.open(item.result_url, '_blank', 'noopener,noreferrer')}
                                                sx={{ textTransform: 'none' }}
                                            >
                                                Unduh
                                            </Button>
                                        ) : null}
                                        {item.stream_url ? (
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                color="success"
                                                startIcon={<PlayArrowIcon fontSize="small" />}
                                                onClick={() => window.open(item.stream_url, '_blank', 'noopener,noreferrer')}
                                                sx={{ textTransform: 'none' }}
                                            >
                                                Streaming
                                            </Button>
                                        ) : null}
                                    </Box>
                                </Box>
                            </Paper>
                        ))}

                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">
                                Halaman {premiumPage} dari {premiumTotalPages}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                                <Button
                                    size="small"
                                    variant="outlined"
                                    disabled={premiumPage <= 1}
                                    onClick={() => setPremiumPage((p) => Math.max(1, p - 1))}
                                    sx={{ textTransform: 'none' }}
                                >
                                    Sebelumnya
                                </Button>
                                <Button
                                    size="small"
                                    variant="outlined"
                                    disabled={premiumPage >= premiumTotalPages}
                                    onClick={() => setPremiumPage((p) => Math.min(premiumTotalPages, p + 1))}
                                    sx={{ textTransform: 'none' }}
                                >
                                    Berikutnya
                                </Button>
                            </Box>
                        </Box>
                    </Box>
                )}
            </Paper>

            {/* FAB: + Tambah Unduhan */}
            <Tooltip title="Tambah Unduhan">
                <Fab
                    color="primary"
                    onClick={() => navigate('/input')}
                    sx={{
                        position: 'fixed',
                        bottom: 32,
                        right: 32,
                    }}
                >
                    <DownloadingIcon />
                </Fab>
            </Tooltip>

            {/* Info Dialog */}
            <Dialog open={showInfo} onClose={() => setShowInfo(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Info Penting</DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1 }}>
                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <DownloadIcon color="primary" />
                            <Typography variant="body2">
                                <strong>Unduhan per-file paling ideal.</strong> File satuan bisa langsung diunduh ke perangkatmu.
                            </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <FolderIcon color="primary" />
                            <Typography variant="body2">
                                <strong>Unduhan folder berupa file .txt.</strong> Gunakan <strong>1DM</strong> di Android, atau{' '}
                                <strong>JDownloader/IDM</strong> di PC untuk import.
                            </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <AccessTimeIcon color="warning" />
                            <Typography variant="body2">
                                <strong>File disimpan maksimal 2 hari.</strong> Setelah itu file akan otomatis dihapus. Segera unduh!
                            </Typography>
                        </Box>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowInfo(false)} variant="contained" fullWidth>
                        Mengerti
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
