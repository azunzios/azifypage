import React, { useCallback, useState, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ToggleButton from '@mui/material/ToggleButton';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import LinkIcon from '@mui/icons-material/Link';
import BoltIcon from '@mui/icons-material/Bolt';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

export default function DragDropInput({ onCheck, loading }) {
    const navigate = useNavigate();
    const [url, setUrl] = useState('');
    const [mode, setMode] = useState('pikpak');
    const [hosts, setHosts] = useState([]);

    useEffect(() => {
        fetch('/api/hosts')
            .then((res) => res.json())
            .then((data) => setHosts(data || []))
            .catch(console.error);
    }, []);

    const onDrop = useCallback((acceptedFiles) => {
        console.log(acceptedFiles);
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, noClick: true });

    const handleFetch = () => {
        if (url) onCheck(url, mode);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && url) handleFetch();
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Mode Toggle */}
            <ToggleButtonGroup
                value={mode}
                exclusive
                onChange={(e, val) => val && setMode(val)}
                size="small"
            >
                <ToggleButton value="pikpak" sx={{ textTransform: 'none', px: 2.5 }}>
                    <BoltIcon sx={{ mr: 1, fontSize: 18 }} />
                    Torrent / Magnet
                </ToggleButton>
                <ToggleButton value="premium" sx={{ textTransform: 'none', px: 2.5 }}>
                    <WorkspacePremiumIcon sx={{ mr: 1, fontSize: 18 }} />
                    Host Premium
                </ToggleButton>
            </ToggleButtonGroup>

            {mode === 'pikpak' ? (
                <Paper
                    {...getRootProps()}
                    elevation={0}
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 2.5,
                        border: '2px dashed',
                        borderColor: isDragActive ? 'primary.main' : 'divider',
                        bgcolor: (theme) => {
                            if (isDragActive) {
                                return theme.palette.mode === 'dark'
                                    ? 'rgba(144, 202, 249, 0.12)'
                                    : 'rgba(25, 118, 210, 0.08)';
                            }
                            return theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'grey.50';
                        },
                        px: 3,
                        py: 4,
                        transition: 'all 0.2s',
                        '&:hover': { borderColor: 'primary.light' },
                    }}
                >
                    <input {...getInputProps()} />
                    <Box sx={{ textAlign: 'center' }}>
                        <Box
                            sx={{
                                width: 48,
                                height: 48,
                                borderRadius: '50%',
                                bgcolor: (theme) =>
                                    theme.palette.mode === 'dark'
                                        ? 'rgba(144, 202, 249, 0.14)'
                                        : 'rgba(25, 118, 210, 0.10)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                mx: 'auto',
                                mb: 1,
                            }}
                        >
                            <LinkIcon color="primary" />
                        </Box>
                        <Typography variant="h6" fontWeight={600} gutterBottom>
                            Download via Torrent
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Tempel magnet link atau URL, atau seret file .torrent ke sini.
                        </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 1.5, width: '100%', maxWidth: 560, flexDirection: { xs: 'column', md: 'row' } }}>
                        <TextField
                            fullWidth
                            size="small"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="magnet:?xt=urn:btih:..."
                            variant="outlined"
                        />
                        <Button
                            variant="contained"
                            onClick={handleFetch}
                            disabled={loading || !url}
                            sx={{ minWidth: 100, whiteSpace: 'nowrap' }}
                        >
                            {loading ? 'Memproses...' : 'Proses'}
                        </Button>
                    </Box>
                </Paper>
            ) : (
                <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                        <Box
                            sx={{
                                width: 40,
                                height: 40,
                                borderRadius: '50%',
                                bgcolor: (theme) =>
                                    theme.palette.mode === 'dark'
                                        ? 'rgba(255, 193, 7, 0.16)'
                                        : 'rgba(255, 193, 7, 0.12)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                            }}
                        >
                            <WorkspacePremiumIcon color="warning" />
                        </Box>
                        <Box>
                            <Typography variant="h6" fontWeight={600}>
                                Download dari Host Premium
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                Masukkan URL dari Rapidgator, Uploaded, Nitroflare, dll.
                            </Typography>
                        </Box>
                    </Box>

                    <Alert severity="warning" icon={<WarningAmberIcon />}>
                        <Typography variant="body2" fontWeight={600} gutterBottom>
                            Proses Manual
                        </Typography>
                        <Typography variant="body2">
                            Untuk menghindari pelanggaran, proses dilakukan secara manual. Estimasi waktu:
                        </Typography>
                        <ul style={{ margin: '4px 0 0 0', paddingLeft: 20 }}>
                            <li><Typography variant="body2">Per file: <strong>15 menit - 1 jam</strong></Typography></li>
                            <li><Typography variant="body2">Hasil berupa <strong>link Google Drive</strong></Typography></li>
                        </ul>
                    </Alert>

                    <Box sx={{ display: 'flex', gap: 1.5, flexDirection: { xs: 'column', md: 'row' } }}>
                        <TextField
                            fullWidth
                            size="small"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="https://rapidgator.net/file/..."
                            variant="outlined"
                        />
                        <Button
                            variant="contained"
                            color="warning"
                            onClick={handleFetch}
                            disabled={loading || !url}
                            sx={{ minWidth: 100, whiteSpace: 'nowrap' }}
                        >
                            {loading ? 'Mengirim...' : 'Kirim'}
                        </Button>
                    </Box>

                    {/* Supported hosts */}
                    <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 1 }}>
                            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase' }}>
                                Host yang Didukung (Real-time):
                            </Typography>
                            <Button
                                size="small"
                                variant="outlined"
                                onClick={() => navigate('/available-hosts')}
                                sx={{ textTransform: 'none', fontSize: 12, py: 0.25, px: 1.25, flexShrink: 0 }}
                            >
                                Tampilkan Host yang Didukung
                            </Button>
                        </Box>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                            {hosts.map((host) => (
                                <Chip
                                    key={host.name}
                                    label={host.name}
                                    size="small"
                                    color={host.status === 'online' ? 'success' : 'default'}
                                    variant={host.status === 'online' ? 'filled' : 'outlined'}
                                    sx={{
                                        fontSize: 11,
                                        ...(host.status !== 'online' && { textDecoration: 'line-through', opacity: 0.5 }),
                                    }}
                                />
                            ))}
                        </Box>
                    </Box>
                </Paper>
            )}
        </Box>
    );
}
