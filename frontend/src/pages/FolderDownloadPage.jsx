import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import DownloadingIcon from '@mui/icons-material/Downloading';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) return '-';
    if (bytes < 1024) return `${bytes} B`;
    const units = ['KB', 'MB', 'GB', 'TB'];
    let value = bytes / 1024;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex += 1;
    }
    return `${value.toFixed(2)} ${units[unitIndex]}`;
}

async function getOrCreateDir(rootHandle, folderPath) {
    if (!folderPath || folderPath === '.') return rootHandle;
    const parts = folderPath.split('/').filter(Boolean);
    let current = rootHandle;
    for (const part of parts) {
        current = await current.getDirectoryHandle(part, { create: true });
    }
    return current;
}

export default function FolderDownloadPage() {
    const navigate = useNavigate();
    const location = useLocation();

    const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const folderId = query.get('folder_id') || '';
    const folderName = query.get('folder_name') || folderId || 'Folder';

    const [targetDirName, setTargetDirName] = useState('Belum dipilih');
    const [status, setStatus] = useState('idle'); // idle|running|done|error
    const [errorMsg, setErrorMsg] = useState('');
    const [totalFiles, setTotalFiles] = useState(0);
    const [doneFiles, setDoneFiles] = useState(0);
    const [failedFiles, setFailedFiles] = useState(0);
    const [currentFile, setCurrentFile] = useState('Menunggu...');
    const [currentFilePercent, setCurrentFilePercent] = useState(0);

    const overallPercent = totalFiles > 0 ? Math.round((doneFiles / totalFiles) * 100) : 0;

    const startDownload = async () => {
        const isDesktop = !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        const isChromeOrEdge = /Chrome|Edg/i.test(navigator.userAgent);

        if (!window.showDirectoryPicker || !isDesktop || !isChromeOrEdge) {
            setStatus('error');
            setErrorMsg('Fitur ini hanya didukung di Chrome/Edge desktop (Windows/macOS/Linux).');
            return;
        }

        if (!folderId) {
            setStatus('error');
            setErrorMsg('folder_id tidak ditemukan. Kembali ke daftar lalu pilih folder lagi.');
            return;
        }

        setErrorMsg('');
        setStatus('running');
        setDoneFiles(0);
        setFailedFiles(0);
        setCurrentFilePercent(0);

        try {
            const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
            setTargetDirName(dirHandle.name || 'Folder dipilih');

            const res = await fetch(`/api/folder/manifest?folder_id=${folderId}&folder_name=${encodeURIComponent(folderName)}&format=json`);
            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || `HTTP ${res.status}`);
            }

            const data = await res.json();
            const items = Array.isArray(data?.items) ? data.items.filter((item) => item?.web_content_link) : [];
            setTotalFiles(items.length);

            if (!items.length) {
                setStatus('error');
                setErrorMsg('Tidak ada file yang bisa diunduh dari folder ini.');
                return;
            }

            for (const item of items) {
                try {
                    const normalized = (item.relative_path || item.name || '').replace(/^\/+/, '');
                    setCurrentFile(normalized || item.name || 'unknown-file');
                    setCurrentFilePercent(0);

                    const parts = normalized.split('/').filter(Boolean);
                    const fileName = parts.pop() || item.name || item.file_id;
                    const folderPath = parts.join('/');
                    const targetDir = await getOrCreateDir(dirHandle, folderPath);
                    const fileHandle = await targetDir.getFileHandle(fileName, { create: true });

                    const response = await fetch(item.web_content_link);
                    if (!response.ok || !response.body) {
                        throw new Error(`HTTP ${response.status}`);
                    }

                    const writable = await fileHandle.createWritable();
                    const reader = response.body.getReader();
                    const total = Number(response.headers.get('content-length') || 0);
                    let loaded = 0;

                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        await writable.write(value);
                        loaded += value.byteLength;
                        if (total > 0) {
                            setCurrentFilePercent(Math.min(100, Math.round((loaded / total) * 100)));
                        }
                    }

                    await writable.close();
                    setDoneFiles((v) => v + 1);
                } catch {
                    setFailedFiles((v) => v + 1);
                    setDoneFiles((v) => v + 1);
                }
            }

            setCurrentFile('Selesai');
            setCurrentFilePercent(100);
            setStatus('done');
        } catch (err) {
            if (err?.name === 'AbortError') {
                setStatus('idle');
                return;
            }
            setStatus('error');
            setErrorMsg(err?.message || 'Terjadi kesalahan saat download.');
        }
    };

    return (
        <Box sx={{ maxWidth: 936, margin: 'auto' }}>
            <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', p: { xs: 2, md: 3 } }}>
                <Stack spacing={2}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                        <Box>
                            <Typography variant="h6" fontWeight={700}>Proses Download Folder</Typography>
                            <Typography variant="body2" color="text.secondary">
                                Fokus proses unduhan untuk: <strong>{folderName}</strong>
                            </Typography>
                        </Box>
                        <Button startIcon={<ArrowBackIcon />} variant="outlined" onClick={() => navigate('/download')}>
                            Kembali
                        </Button>
                    </Box>

                    <Divider />

                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
                        <Paper variant="outlined" sx={{ p: 2 }}>
                            <Typography variant="overline" color="text.secondary">Folder Tujuan</Typography>
                            <Typography variant="body1" fontWeight={600} sx={{ mt: 0.5 }}>{targetDirName}</Typography>
                            <Button
                                fullWidth
                                sx={{ mt: 1.5, textTransform: 'none' }}
                                variant="contained"
                                startIcon={<FolderOpenIcon />}
                                onClick={startDownload}
                                disabled={status === 'running'}
                            >
                                {status === 'running' ? 'Sedang Mengunduh...' : 'Pilih Folder & Mulai'}
                            </Button>
                        </Paper>

                        <Paper variant="outlined" sx={{ p: 2 }}>
                            <Typography variant="overline" color="text.secondary">Ringkasan</Typography>
                            <Typography variant="body2" sx={{ mt: 0.75 }}>Total file: <strong>{totalFiles}</strong></Typography>
                            <Typography variant="body2">Selesai diproses: <strong>{doneFiles}</strong></Typography>
                            <Typography variant="body2">Gagal: <strong>{failedFiles}</strong></Typography>
                            <Typography variant="body2">Status: <strong>{status === 'running' ? 'Berjalan' : status === 'done' ? 'Selesai' : status === 'error' ? 'Error' : 'Siap'}</strong></Typography>
                        </Paper>
                    </Box>

                    <Paper variant="outlined" sx={{ p: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                            <Typography variant="body2" fontWeight={600}>Progress Keseluruhan</Typography>
                            <Typography variant="body2" color="text.secondary">{overallPercent}%</Typography>
                        </Box>
                        <LinearProgress variant="determinate" value={overallPercent} sx={{ height: 8, borderRadius: 4 }} />

                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2, mb: 0.75 }}>
                            <Typography variant="body2" fontWeight={600}>File Sedang Diproses</Typography>
                            <Typography variant="body2" color="text.secondary">{currentFilePercent}%</Typography>
                        </Box>
                        <LinearProgress variant="determinate" value={currentFilePercent} sx={{ height: 6, borderRadius: 4 }} />
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                            {currentFile}
                        </Typography>
                    </Paper>

                    {status === 'running' ? (
                        <Alert icon={<DownloadingIcon />} severity="warning">
                            Jangan tutup tab ini selama proses berjalan.
                        </Alert>
                    ) : null}

                    {status === 'done' ? (
                        <Alert icon={<CheckCircleOutlineIcon />} severity={failedFiles > 0 ? 'warning' : 'success'}>
                            Download selesai. {failedFiles > 0 ? `${failedFiles} file gagal, klik "Pilih Folder & Mulai" untuk coba lagi.` : 'Semua file berhasil diunduh.'}
                        </Alert>
                    ) : null}

                    {status === 'error' ? (
                        <Alert severity="error">{errorMsg}</Alert>
                    ) : null}
                </Stack>
            </Paper>
        </Box>
    );
}
