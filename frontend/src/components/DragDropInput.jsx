import React, { useCallback, useState, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import Box from '@mui/joy/Box';
import Sheet from '@mui/joy/Sheet';
import Input from '@mui/joy/Input';
import Button from '@mui/joy/Button';
import Typography from '@mui/joy/Typography';
import Alert from '@mui/joy/Alert';
import Chip from '@mui/joy/Chip';
import Divider from '@mui/joy/Divider';
import Modal from '@mui/joy/Modal';
import ModalDialog from '@mui/joy/ModalDialog';
import DialogTitle from '@mui/joy/DialogTitle';
import DialogContent from '@mui/joy/DialogContent';
import DialogActions from '@mui/joy/DialogActions';
import LinkIcon from '@mui/icons-material/Link';
import BoltIcon from '@mui/icons-material/Bolt';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CalculateOutlinedIcon from '@mui/icons-material/CalculateOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

export default function DragDropInput({ onCheck, loading }) {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [url, setUrl] = useState('');
    const [mode, setMode] = useState('pikpak');
    const [hosts, setHosts] = useState([]);
    const [premiumPricing, setPremiumPricing] = useState({ price_per_unit: 2000, unit_size_gb: 2 });
    const [estimatedSizeGb, setEstimatedSizeGb] = useState('2');
    const [showPremiumReceipt, setShowPremiumReceipt] = useState(false);
    const [showEstimateResult, setShowEstimateResult] = useState(false);

    useEffect(() => {
        fetch('/api/hosts')
            .then((res) => res.json())
            .then((data) => setHosts(data || []))
            .catch(console.error);

        fetch('/api/pricing')
            .then((res) => res.json())
            .then((data) => {
                const all = Array.isArray(data) ? data : [];
                const premium = all.find((p) => String(p?.service_type || '').toLowerCase() === 'premium');
                if (!premium) return;
                setPremiumPricing({
                    price_per_unit: Number(premium.price_per_unit) > 0 ? Number(premium.price_per_unit) : 2000,
                    unit_size_gb: Number(premium.unit_size_gb) > 0 ? Number(premium.unit_size_gb) : 2,
                });
            })
            .catch(() => {
                setPremiumPricing({ price_per_unit: 2000, unit_size_gb: 2 });
            });
    }, []);

    const onDrop = useCallback((acceptedFiles) => {
        console.log(acceptedFiles);
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, noClick: true });

    const handleFetch = () => {
        if (!url) return;
        if (mode === 'premium') {
            setShowPremiumReceipt(true);
            return;
        }
        onCheck(url, mode);
    };

    const parseBalance = () => {
        const raw = user?.balance ?? user?.balance_formatted ?? 0;
        if (typeof raw === 'number') return raw;
        const parsed = parseInt(String(raw).replace(/[^0-9-]/g, ''), 10);
        return Number.isFinite(parsed) ? parsed : 0;
    };

    const formatIDR = (value) => `Rp${Number(value || 0).toLocaleString('id-ID')}`;

    const unitSize = Number(premiumPricing.unit_size_gb) > 0 ? Number(premiumPricing.unit_size_gb) : 2;
    const pricePerUnit = Number(premiumPricing.price_per_unit) > 0 ? Number(premiumPricing.price_per_unit) : 2000;
    const sizeNum = Math.max(0, Number(estimatedSizeGb) || 0);
    const chargedUnits = Math.max(1, Math.ceil(sizeNum / unitSize));
    const chargedGb = chargedUnits * unitSize;
    const estimatedTotal = chargedUnits * pricePerUnit;
    const currentBalance = parseBalance();
    const estimatedChange = Math.max(0, currentBalance - estimatedTotal);

    const submitPremium = () => {
        setShowPremiumReceipt(false);
        onCheck(url, 'premium');
    };

    const calculateEstimate = () => {
        setShowEstimateResult(true);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && url) handleFetch();
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Sheet variant="outlined" sx={{ p: 0.75, borderRadius: 'md', display: 'inline-flex', gap: 1, alignSelf: 'flex-start' }}>
                <Button
                    size="sm"
                    variant={mode === 'pikpak' ? 'solid' : 'plain'}
                    color={mode === 'pikpak' ? 'primary' : 'neutral'}
                    onClick={() => setMode('pikpak')}
                    sx={{ textTransform: 'none', borderRadius: 'sm' }}
                >
                    <BoltIcon sx={{ mr: 0.75, fontSize: 18 }} />
                    Torrent / Magnet
                </Button>
                <Button
                    size="sm"
                    variant={mode === 'premium' ? 'solid' : 'plain'}
                    color={mode === 'premium' ? 'warning' : 'neutral'}
                    onClick={() => setMode('premium')}
                    sx={{ textTransform: 'none', borderRadius: 'sm' }}
                >
                    <WorkspacePremiumIcon sx={{ mr: 0.75, fontSize: 18 }} />
                    Host Premium
                </Button>
            </Sheet>

            {mode === 'pikpak' ? (
                <Sheet
                    {...getRootProps()}
                    variant="outlined"
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 2.5,
                        border: '2px dashed',
                        borderColor: isDragActive ? 'primary.400' : 'neutral.outlinedBorder',
                        backgroundColor: isDragActive ? 'primary.softBg' : 'background.surface',
                        px: 3,
                        py: 4,
                        borderRadius: 'md',
                        transition: 'border-color .2s ease',
                    }}
                >
                    <input {...getInputProps()} />
                    <Box sx={{ textAlign: 'center' }}>
                        <Box
                            sx={{
                                width: 48,
                                height: 48,
                                borderRadius: '50%',
                                bgcolor: 'primary.softBg',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                mx: 'auto',
                                mb: 1,
                            }}
                        >
                            <LinkIcon color="primary" />
                        </Box>
                        <Typography level="title-lg" sx={{ fontWeight: 700, mb: 0.5 }}>
                            Download via Torrent
                        </Typography>
                        <Typography level="body-sm" color="neutral">
                            Tempel magnet link atau URL, atau seret file .torrent ke sini.
                        </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 1.5, width: '100%', maxWidth: 560, flexDirection: { xs: 'column', md: 'row' } }}>
                        <Input
                            fullWidth
                            size="small"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="magnet:?xt=urn:btih:..."
                            startDecorator={<LinkIcon fontSize="small" />}
                        />
                        <Button
                            variant="solid"
                            onClick={handleFetch}
                            disabled={loading || !url}
                            sx={{ minWidth: 100, whiteSpace: 'nowrap' }}
                        >
                            {loading ? 'Memproses...' : 'Proses'}
                        </Button>
                    </Box>
                </Sheet>
            ) : (
                <>
                    <Sheet variant="outlined" sx={{ p: 3, borderRadius: 'md', display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                            <Box>
                                <Typography level="title-lg" sx={{ fontWeight: 700 }}>
                                    Download dari Host Premium
                                </Typography>
                                <Typography level="body-sm" color="neutral" sx={{ mt: 0.5 }}>
                                    Masukkan URL dari Rapidgator, Uploaded, Nitroflare, dll.
                                </Typography>
                            </Box>
                        </Box>

                        <Box sx={{ display: 'flex', gap: 1.5, flexDirection: { xs: 'column', md: 'row' } }}>
                            <Input
                                fullWidth
                                size="small"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="https://rapidgator.net/file/..."
                                startDecorator={<LinkIcon fontSize="small" />}
                            />
                            <Button
                                variant="solid"
                                color="warning"
                                onClick={handleFetch}
                                disabled={loading || !url}
                                sx={{ minWidth: 100, whiteSpace: 'nowrap' }}
                            >
                                {loading ? 'Mengirim...' : 'Proses'}
                            </Button>
                        </Box>
                    </Sheet>

                    <Sheet variant="outlined" sx={{ p: 2, borderRadius: 'md', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            <WarningAmberIcon color="warning" fontSize="small" />
                            <Typography level="title-sm" sx={{ fontWeight: 700 }}>
                                Catatan
                            </Typography>
                        </Box>

                        <Sheet variant="soft" color="neutral" sx={{ p: 1.5, borderRadius: 'sm' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
                                <CalculateOutlinedIcon fontSize="small" color="warning" />
                                <Typography level="body-xs" sx={{ fontWeight: 700, textTransform: 'uppercase' }}>
                                    Hitung Estimasi Harga
                                </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                <Input
                                    size="sm"
                                    type="number"
                                    slotProps={{ input: { min: 0, step: '0.1' } }}
                                    value={estimatedSizeGb}
                                    onChange={(e) => {
                                        setEstimatedSizeGb(e.target.value);
                                        setShowEstimateResult(false);
                                    }}
                                    startDecorator="Ukuran file"
                                    endDecorator="GB"
                                    sx={{ flex: 1, minWidth: 0 }}
                                />
                                <Button
                                    size="sm"
                                    variant="outlined"
                                    color="warning"
                                    onClick={calculateEstimate}
                                    sx={{ minHeight: 28, px: 1.25, flexShrink: 0 }}
                                >
                                    Hitung
                                </Button>
                            </Box>
                            {showEstimateResult ? (
                                <Typography level="body-sm" color="neutral" sx={{ mt: 1 }}>
                                    Estimasi total: {formatIDR(estimatedTotal)} ({chargedGb} GB pembulatan paket)
                                </Typography>
                            ) : null}
                        </Sheet>

                        {/* Supported hosts */}
                        <Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                                <Typography level="body-xs" color="neutral" sx={{ textTransform: 'uppercase', fontWeight: 700 }}>
                                    Host yang Didukung (Real-time):
                                </Typography>
                                <Button
                                    size="small"
                                    variant="outlined"
                                    onClick={() => navigate('/available-hosts')}
                                    sx={{ textTransform: 'none', fontSize: 12, py: 0.25, px: 1.25, flexShrink: 0 }}
                                >
                                    Lihat Host
                                </Button>
                            </Box>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                                {hosts.map((host) => (
                                    <Chip
                                        key={host.name}
                                        label={host.name}
                                        size="small"
                                        color={host.status === 'online' ? 'success' : 'default'}
                                        variant={host.status === 'online' ? 'soft' : 'outlined'}
                                        sx={{
                                            fontSize: 11,
                                            ...(host.status !== 'online' && { textDecoration: 'line-through', opacity: 0.5 }),
                                        }}
                                    />
                                ))}
                            </Box>
                        </Box>

                        <Alert color="warning" variant="soft" icon={<InfoOutlinedIcon />}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.35 }}>
                                <Typography level="body-sm" sx={{ fontWeight: 700 }}>
                                    Proses manual untuk menghindari pelanggaran.
                                </Typography>
                                <Typography level="body-sm">
                                    Estimasi waktu: <strong>15 menit - 1 jam per file</strong>
                                </Typography>
                                <Typography level="body-sm">
                                    Hasil: <strong>direct link</strong>
                                </Typography>
                                <Typography level="body-sm">
                                    Saldo akan langsung terpotong saat klik <strong>Kirim</strong>, kecuali jika link tidak ada/tidak valid.
                                </Typography>
                            </Box>
                        </Alert>
                    </Sheet>
                </>
            )}

            <Modal open={showPremiumReceipt} onClose={() => setShowPremiumReceipt(false)}>
                <ModalDialog size="md" sx={{ width: 'min(560px, 92vw)' }}>
                    <DialogTitle>Struk Pembelanjaan</DialogTitle>
                    <DialogContent>
                        <Sheet variant="outlined" sx={{ p: 1.25, borderRadius: 'sm' }}>
                            <Box sx={{ display: 'grid', gridTemplateColumns: '96px 1fr', rowGap: 0.8, columnGap: 1 }}>
                                <Typography level="body-sm" sx={{ fontWeight: 700 }}>LINK</Typography>
                                <Typography level="body-sm" sx={{ overflowWrap: 'anywhere' }}>{url || '-'}</Typography>

                                <Typography level="body-sm" sx={{ fontWeight: 700 }}>SIZE</Typography>
                                <Typography level="body-sm">{chargedGb} GB</Typography>

                                <Typography level="body-sm" sx={{ fontWeight: 700 }}>TOTAL</Typography>
                                <Typography level="body-sm">{formatIDR(estimatedTotal)}</Typography>

                                <Typography level="body-sm" sx={{ fontWeight: 700 }}>KEMBALIAN</Typography>
                                <Typography level="body-sm">{formatIDR(estimatedChange)}</Typography>
                            </Box>
                            <Divider sx={{ my: 1 }} />
                            <Typography level="body-xs" color="warning">
                                Konfirmasi: saldo akan langsung terpotong ketika klik "Kirim", kecuali jika link tidak ada/tidak valid.
                            </Typography>
                        </Sheet>
                    </DialogContent>
                    <DialogActions>
                        <Button variant="plain" color="neutral" onClick={() => setShowPremiumReceipt(false)}>
                            Batal
                        </Button>
                        <Button variant="solid" color="warning" onClick={submitPremium} loading={loading}>
                            Kirim
                        </Button>
                    </DialogActions>
                </ModalDialog>
            </Modal>
        </Box>
    );
}
