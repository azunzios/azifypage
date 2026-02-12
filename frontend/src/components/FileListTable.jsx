import React from 'react';
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
import FolderIcon from '@mui/icons-material/Folder';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DownloadIcon from '@mui/icons-material/Download';
import ListAltIcon from '@mui/icons-material/ListAlt';
import InboxIcon from '@mui/icons-material/Inbox';

export default function FileListTable({ files, loading, onFolderClick, onGetLink }) {
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

    const handleGetLink = async (fileId) => {
        if (onGetLink) {
            onGetLink(fileId);
        } else {
            try {
                const res = await fetch(`/api/file/link?file_id=${fileId}`);
                const data = await res.json();
                if (data.link) {
                    window.open(data.link, '_blank');
                }
            } catch (err) {
                console.error('Failed to get download link:', err);
            }
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
                                        <Button
                                            variant="contained"
                                            size="small"
                                            startIcon={<ListAltIcon />}
                                            onClick={() =>
                                                (window.location.href = `/api/folder/download?folder_id=${file.id}&folder_name=${encodeURIComponent(file.name)}`)
                                            }
                                            sx={{ fontSize: 12, textTransform: 'none' }}
                                        >
                                            Download Folder
                                        </Button>
                                    ) : (
                                        <Button
                                            variant="contained"
                                            size="small"
                                            startIcon={<DownloadIcon />}
                                            onClick={() => handleGetLink(file.id)}
                                            sx={{ fontSize: 12, textTransform: 'none' }}
                                        >
                                            Unduh
                                        </Button>
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
        </Box>
    );
}
