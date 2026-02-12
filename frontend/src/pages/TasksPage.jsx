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

export default function TasksPage() {
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
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
