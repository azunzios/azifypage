import React, { useState } from 'react';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import FolderIcon from '@mui/icons-material/Folder';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DownloadIcon from '@mui/icons-material/Download';
import ListAltIcon from '@mui/icons-material/ListAlt';
import InboxIcon from '@mui/icons-material/Inbox';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

export default function FileListTable({ files, loading, onFolderClick, onGetLink, onDeleted, onFolderDownload }) {
    const [deletingId, setDeletingId] = useState('');
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [downloadingFolder, setDownloadingFolder] = useState({ id: '', done: 0, total: 0 });

    if (loading) {
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 256 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (files.length === 0) {
        return (
            <Paper
                elevation={0}
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    py: 8,
                    border: '2px dashed',
                    borderColor: 'divider',
                }}
            >
                <InboxIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                <Typography variant="body1" color="text.secondary" fontWeight={500}>
                    Folder ini kosong.
                </Typography>
                <Typography variant="body2" color="text.disabled">
                    Masukkan link di atas untuk memulai download.
                </Typography>
            </Paper>
        );
    }

    const handleGetLink = async (file) => {
        if (onGetLink) {
            onGetLink(file);
        } else {
            try {
                const fileId = file?.id;
                const fileName = file?.name || '';
                window.open(`/api/file/download?file_id=${encodeURIComponent(fileId)}&file_name=${encodeURIComponent(fileName)}`, '_blank');
            } catch (err) {
                console.error('Failed to get download link:', err);
            }
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget?.id) return;

        setDeletingId(deleteTarget.id);
        try {
            const res = await fetch(`/api/file?file_id=${encodeURIComponent(deleteTarget.id)}`, { method: 'DELETE' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                alert(data.message || 'Gagal menghapus file.');
                return;
            }
            if (onDeleted) onDeleted(deleteTarget);
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            setDeleteTarget(null);
            setDeletingId('');
        }
    };

    const getOrCreateDir = async (rootHandle, folderPath) => {
        if (!folderPath || folderPath === '.') return rootHandle;
        const parts = folderPath.split('/').filter(Boolean);
        let current = rootHandle;
        for (const part of parts) {
            current = await current.getDirectoryHandle(part, { create: true });
        }
        return current;
    };

    const downloadFileToDirectory = async (rootHandle, item) => {
        const normalized = (item.relative_path || item.name || '').replace(/^\/+/, '');
        const parts = normalized.split('/').filter(Boolean);
        const fileName = parts.pop() || item.name || item.file_id;
        const folderPath = parts.join('/');
        const dirHandle = await getOrCreateDir(rootHandle, folderPath);
        const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });

        const res = await fetch(item.web_content_link);
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }

        const writable = await fileHandle.createWritable();
        if (res.body && writable && typeof res.body.pipeTo === 'function') {
            await res.body.pipeTo(writable);
            return;
        }

        const blob = await res.blob();
        await writable.write(blob);
        await writable.close();
    };

    const handleDownloadFolder = async (file) => {
        if (onFolderDownload) {
            onFolderDownload(file);
            return;
        }

        const isDesktop = !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        const isChromeOrEdge = /Chrome|Edg/i.test(navigator.userAgent);
        if (!window.showDirectoryPicker || !isDesktop || !isChromeOrEdge) {
            alert('Download folder langsung hanya didukung di Chrome/Edge desktop (Windows/macOS/Linux).');
            return;
        }

        try {
            const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
            const res = await fetch(`/api/folder/manifest?folder_id=${file.id}&folder_name=${encodeURIComponent(file.name)}&format=json`);
            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || `HTTP ${res.status}`);
            }

            const data = await res.json();
            const items = Array.isArray(data?.items) ? data.items.filter((item) => item?.web_content_link) : [];
            if (!items.length) {
                alert('Tidak ada file yang bisa diunduh pada folder ini.');
                return;
            }

            setDownloadingFolder({ id: file.id, done: 0, total: items.length });

            const concurrency = 3;
            const queue = [...items];
            const failed = [];

            const worker = async () => {
                while (queue.length > 0) {
                    const item = queue.shift();
                    if (!item) continue;

                    try {
                        await downloadFileToDirectory(dirHandle, item);
                    } catch (err) {
                        failed.push({ name: item.relative_path || item.name, error: err?.message || 'unknown error' });
                    } finally {
                        setDownloadingFolder((prev) => {
                            if (prev.id !== file.id) return prev;
                            return { ...prev, done: prev.done + 1 };
                        });
                    }
                }
            };

            await Promise.all(Array.from({ length: concurrency }, () => worker()));

            if (failed.length > 0) {
                alert(`Download selesai dengan ${failed.length} gagal. Anda bisa ulangi tombol Download Folder untuk retry.`);
            } else {
                alert('Download folder selesai.');
            }
        } catch (err) {
            if (err?.name === 'AbortError') return;
            console.error('Failed to download folder directly:', err);
            alert(`Gagal download langsung: ${err?.message || 'unknown error'}`);
        } finally {
            setDownloadingFolder({ id: '', done: 0, total: 0 });
        }
    };

    return (
        <Box>
            <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
                <Table size="small">
                    <TableHead>
                        <TableRow
                            sx={{
                                bgcolor: (theme) =>
                                    theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'grey.50',
                            }}
                        >
                            <TableCell sx={{ fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                Nama File
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                Status
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                Ukuran
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                Aksi
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {files.map((file) => (
                            <TableRow
                                key={file.id}
                                hover
                                sx={{ cursor: 'pointer' }}
                                onDoubleClick={() => {
                                    if (file.kind === 'drive#folder' && onFolderClick) {
                                        onFolderClick(file.id, file.name);
                                    }
                                }}
                            >
                                <TableCell>
                                    {file.kind === 'drive#folder' ? (
                                        <Box
                                            component="button"
                                            onClick={() => onFolderClick && onFolderClick(file.id, file.name)}
                                            sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 1.5,
                                                border: 'none',
                                                background: 'none',
                                                cursor: 'pointer',
                                                p: 0,
                                                color: 'text.primary',
                                                '&:hover': { color: 'primary.main' },
                                            }}
                                        >
                                            <FolderIcon color="primary" fontSize="small" />
                                            <Typography
                                                variant="body2"
                                                fontWeight={500}
                                                noWrap
                                                sx={{ maxWidth: { xs: 200, md: 300 } }}
                                                title={file.name}
                                            >
                                                {file.name}
                                            </Typography>
                                        </Box>
                                    ) : (
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                            <InsertDriveFileIcon color="action" fontSize="small" />
                                            <Typography
                                                variant="body2"
                                                fontWeight={500}
                                                noWrap
                                                sx={{ maxWidth: { xs: 200, md: 300 } }}
                                                title={file.name}
                                            >
                                                {file.name}
                                            </Typography>
                                        </Box>
                                    )}
                                </TableCell>

                                <TableCell>
                                    <Chip
                                        icon={<CheckCircleIcon />}
                                        label="Siap"
                                        size="small"
                                        color="success"
                                        variant="outlined"
                                        sx={{ fontSize: 12 }}
                                    />
                                </TableCell>

                                <TableCell>
                                    <Typography variant="body2" color="text.secondary">
                                        {file.kind === 'drive#folder' ? '-' : file.size_str || '-'}
                                    </Typography>
                                </TableCell>

                                <TableCell align="right">
                                    {file.kind === 'drive#folder' ? (
                                        <Box sx={{ display: 'inline-flex', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                            <Button
                                                variant="contained"
                                                size="small"
                                                startIcon={<ListAltIcon />}
                                                onClick={() => handleDownloadFolder(file)}
                                                disabled={downloadingFolder.id === file.id}
                                                sx={{ fontSize: 12, textTransform: 'none' }}
                                            >
                                                {downloadingFolder.id === file.id
                                                    ? `Mengunduh ${downloadingFolder.done}/${downloadingFolder.total}`
                                                    : 'Download Folder'}
                                            </Button>
                                            <Button
                                                variant="outlined"
                                                color="error"
                                                size="small"
                                                startIcon={<DeleteOutlineIcon />}
                                                onClick={() => setDeleteTarget(file)}
                                                disabled={deletingId === file.id}
                                                sx={{ fontSize: 12, textTransform: 'none' }}
                                            >
                                                {deletingId === file.id ? 'Menghapus...' : 'Hapus'}
                                            </Button>
                                        </Box>
                                    ) : (
                                        <Box sx={{ display: 'inline-flex', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                            <Button
                                                variant="contained"
                                                size="small"
                                                startIcon={<DownloadIcon />}
                                                onClick={() => handleGetLink(file)}
                                                sx={{ fontSize: 12, textTransform: 'none' }}
                                            >
                                                Unduh
                                            </Button>
                                            <Button
                                                variant="outlined"
                                                color="error"
                                                size="small"
                                                startIcon={<DeleteOutlineIcon />}
                                                onClick={() => setDeleteTarget(file)}
                                                disabled={deletingId === file.id}
                                                sx={{ fontSize: 12, textTransform: 'none' }}
                                            >
                                                {deletingId === file.id ? 'Menghapus...' : 'Hapus'}
                                            </Button>
                                        </Box>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Status bar */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1, px: 1 }}>
                <Typography variant="caption" color="text.disabled">
                    {files.length} item{files.length !== 1 ? 's' : ''}
                </Typography>
                <Typography variant="caption" color="text.disabled">
                    Double-click folder untuk membuka
                </Typography>
            </Box>

            <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
                <DialogTitle>Konfirmasi Hapus</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                        Hapus {deleteTarget?.kind === 'drive#folder' ? 'folder' : 'file'} ini?
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1, wordBreak: 'break-word' }}>
                        {deleteTarget?.name}
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteTarget(null)} variant="outlined">
                        Batal
                    </Button>
                    <Button
                        onClick={handleDelete}
                        color="error"
                        variant="contained"
                        disabled={deletingId === deleteTarget?.id}
                    >
                        {deletingId === deleteTarget?.id ? 'Menghapus...' : 'Hapus'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
