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
import Tabs from '@mui/joy/Tabs';
import TabList from '@mui/joy/TabList';
import Tab from '@mui/joy/Tab';
import Modal from '@mui/joy/Modal';
import ModalDialog from '@mui/joy/ModalDialog';
import DialogTitle from '@mui/joy/DialogTitle';
import DialogContent from '@mui/joy/DialogContent';
import DialogActions from '@mui/joy/DialogActions';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import RemoveIcon from '@mui/icons-material/Remove';
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
    const [voucherCode, setVoucherCode] = useState('');
    const [mode, setMode] = useState('pikpak');
    const [hosts, setHosts] = useState([]);
    const [previousPrice, setPreviousPrice] = useState({ torrent: null, premium: null });
    const [pricingMap, setPricingMap] = useState({
        torrent: { price_per_unit: 1000, unit_size_gb: 1, updated_at: null, description: '' },
        premium: { price_per_unit: 2000, unit_size_gb: 2, updated_at: null, description: '' },
    });
    const [premiumPricing, setPremiumPricing] = useState({ price_per_unit: 2000, unit_size_gb: 2 });
    const [estimatedSizeGb, setEstimatedSizeGb] = useState('2');
    const [showTorrentConfirm, setShowTorrentConfirm] = useState(false);
    const [showPremiumReceipt, setShowPremiumReceipt] = useState(false);
    const [showEstimateResult, setShowEstimateResult] = useState(false);
    const [voucherPreview, setVoucherPreview] = useState(null);
    const [checkingVoucher, setCheckingVoucher] = useState(false);

    useEffect(() => {
        const snapshotKey = 'pricing_previous_snapshot_v1';

        fetch('/api/hosts')
            .then((res) => res.json())
            .then((data) => setHosts(data || []))
            .catch(console.error);

        fetch('/api/pricing')
            .then((res) => res.json())
            .then((data) => {
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

                setPricingMap(nextPricing);

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

                if (!premium) return;
                setPremiumPricing({
                    price_per_unit: Number(premium.price_per_unit) > 0 ? Number(premium.price_per_unit) : 2000,
                    unit_size_gb: Number(premium.unit_size_gb) > 0 ? Number(premium.unit_size_gb) : 2,
                });
            })
            .catch(() => {
                setPreviousPrice({ torrent: null, premium: null });
                setPricingMap({
                    torrent: { price_per_unit: 1000, unit_size_gb: 1, updated_at: null, description: '' },
                    premium: { price_per_unit: 2000, unit_size_gb: 2, updated_at: null, description: '' },
                });
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
        setShowTorrentConfirm(true);
    };

    const parseBalance = () => {
        const raw = user?.balance ?? user?.balance_formatted ?? 0;
        if (typeof raw === 'number') return raw;
        const parsed = parseInt(String(raw).replace(/[^0-9-]/g, ''), 10);
        return Number.isFinite(parsed) ? parsed : 0;
    };

    const formatIDR = (value) => `Rp${Number(value || 0).toLocaleString('id-ID')}`;

    const getPriceSignal = (serviceType) => {
        const current = Number(pricingMap?.[serviceType]?.price_per_unit || 0);
        const prev = Number(previousPrice?.[serviceType]);
        if (!Number.isFinite(prev) || prev <= 0) {
            return { label: 'Belum ada data sebelumnya', color: 'neutral', icon: <RemoveIcon sx={{ fontSize: 12 }} /> };
        }
        if (current > prev) {
            return { label: `Naik ${formatIDR(current - prev)}`, color: 'danger', icon: <ArrowUpwardIcon sx={{ fontSize: 12 }} /> };
        }
        if (current < prev) {
            return { label: `Turun ${formatIDR(prev - current)}`, color: 'success', icon: <ArrowDownwardIcon sx={{ fontSize: 12 }} /> };
        }
        return { label: 'Tetap dari sebelumnya', color: 'neutral', icon: <RemoveIcon sx={{ fontSize: 12 }} /> };
    };

    const getPriceDescription = (serviceType) => {
        const text = String(pricingMap?.[serviceType]?.description || '').trim();
        return text || 'Deskripsi harga belum diatur di admin panel';
    };

    const checkVoucherPreview = () => {
        const code = String(voucherCode || '').trim().toUpperCase();
        if (!code) {
            setVoucherPreview({ valid: false, message: 'Masukkan kode voucher dulu' });
            return;
        }

        const serviceType = mode === 'premium' ? 'premium' : 'torrent';
        const basePrice = serviceType === 'premium'
            ? Number(estimatedTotal || pricingMap?.premium?.price_per_unit || 0)
            : Number(pricingMap?.torrent?.price_per_unit || 0);

        setCheckingVoucher(true);
        fetch(`/api/voucher/preview?code=${encodeURIComponent(code)}&service_type=${encodeURIComponent(serviceType)}&base_price=${encodeURIComponent(String(basePrice))}`)
            .then((res) => res.json())
            .then((data) => setVoucherPreview(data || null))
            .catch(() => setVoucherPreview({ valid: false, message: 'Gagal cek voucher' }))
            .finally(() => setCheckingVoucher(false));
    };

            const activeServiceType = mode === 'premium' ? 'premium' : 'torrent';
            const activeUnitSize = Number(pricingMap?.[activeServiceType]?.unit_size_gb || 1);
            const activeUnitLabel = `${activeUnitSize} GB`;

    useEffect(() => {
        setVoucherPreview(null);
        setCheckingVoucher(false);
    }, [mode]);

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
        onCheck(url, 'premium', voucherCode, { estimatedSizeGb: sizeNum });
    };

    const submitTorrent = () => {
        setShowTorrentConfirm(false);
        onCheck(url, 'pikpak', voucherCode, { estimatedSizeGb: sizeNum });
    };

    const calculateEstimate = () => {
        setShowEstimateResult(true);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && url) handleFetch();
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Sheet variant="soft" color="neutral" sx={{ p: 1.25, borderRadius: 'md' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                    <Typography level="title-sm" sx={{ fontWeight: 700 }}>
                        Info Harga Hari Ini
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                        <Button size="sm" variant="outlined" onClick={() => navigate('/bantuan')} sx={{ textTransform: 'none' }}>
                            Panduan Penggunaan
                        </Button>
                    </Box>
                </Box>

                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1 }}>
                    {[
                        { key: 'torrent', label: 'Torrent / Magnet', icon: <BoltIcon color="primary" sx={{ fontSize: 18 }} /> },
                        { key: 'premium', label: 'Host Premium', icon: <WorkspacePremiumIcon color="primary" sx={{ fontSize: 18 }} /> },
                    ].map((item) => {
                        const signal = getPriceSignal(item.key);
                        const current = pricingMap?.[item.key] || { price_per_unit: 0, unit_size_gb: 1, updated_at: null, description: '' };
                        return (
                            <Sheet key={item.key} variant="outlined" sx={{ p: 1.25, borderRadius: 'sm', bgcolor: 'background.surface' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                        {item.icon}
                                        <Typography level="body-sm" sx={{ fontWeight: 700 }}>{item.label}</Typography>
                                    </Box>
                                    <Chip size="sm" variant="soft" color={signal.color} startDecorator={signal.icon}>
                                        {signal.label}
                                    </Chip>
                                </Box>
                                <Typography level="title-sm" sx={{ mt: 0.75, fontWeight: 800 }}>
                                    {formatIDR(current.price_per_unit)} / {current.unit_size_gb} GB
                                </Typography>
                                <Typography level="body-xs" color="neutral" sx={{ mt: 0.35 }}>
                                    {getPriceDescription(item.key)}
                                </Typography>
                            </Sheet>
                        );
                    })}
                </Box>
            </Sheet>

            <Tabs value={mode} onChange={(_, v) => setMode(v || 'pikpak')}>
                <TabList
                    variant="outlined"
                    sx={{
                        borderRadius: 'md',
                        p: 0.5,
                        gap: 0.5,
                    }}
                >
                    <Tab
                        value="pikpak"
                        sx={{ textTransform: 'none', fontWeight: 600 }}
                        startDecorator={
                            <Box
                                component="img"
                                src="/brands/utorrent.png"
                                alt="Torrent"
                                sx={{ width: 16, height: 16, objectFit: 'contain' }}
                            />
                        }
                    >
                        Torrent / Magnet
                    </Tab>
                    <Tab
                        value="premium"
                        sx={{ textTransform: 'none', fontWeight: 600 }}
                        startDecorator={<WorkspacePremiumIcon sx={{ fontSize: 18 }} />}
                    >
                        Host Premium
                    </Tab>
                </TabList>
            </Tabs>

            {mode === 'pikpak' ? (
                <Sheet
                    {...getRootProps()}
                    variant="outlined"
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 2.5,
                        border: '2px solid',
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
                            <Box
                                component="img"
                                src="/brands/utorrent.png"
                                alt="Torrent"
                                sx={{ width: 24, height: 24, objectFit: 'contain' }}
                            />
                        </Box>
                        <Typography level="title-lg" sx={{ fontWeight: 700, mb: 0.5 }}>
                            Download via Torrent
                        </Typography>
                        <Typography level="body-sm" color="neutral">
                            Tempel magnet link atau URL, atau seret file .torrent ke sini.
                        </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: '100%', maxWidth: 560 }}>
                        <Input
                            fullWidth
                            size="small"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="magnet:?xt=urn:btih:..."
                            startDecorator={<LinkIcon fontSize="small" />}
                        />
                        <Box sx={{ display: 'flex', gap: 1, flexDirection: { xs: 'column', sm: 'row' } }}>
                            <Input
                                fullWidth
                                size="small"
                                value={voucherCode}
                                onChange={(e) => {
                                    setVoucherCode(e.target.value.toUpperCase());
                                    setVoucherPreview(null);
                                }}
                                placeholder="Voucher (opsional)"
                            />
                            <Button
                                size="sm"
                                variant="outlined"
                                onClick={checkVoucherPreview}
                                disabled={checkingVoucher || !voucherCode.trim()}
                                sx={{ minWidth: { xs: '100%', sm: 120 }, whiteSpace: 'nowrap', textTransform: 'none' }}
                            >
                                {checkingVoucher ? 'Mengecek...' : 'Cek Voucher'}
                            </Button>
                        </Box>
                        {checkingVoucher ? (
                            <Alert color="neutral" variant="soft" sx={{ py: 0.75 }}>
                                Mengecek voucher...
                            </Alert>
                        ) : voucherPreview ? (
                            <Alert color={voucherPreview.valid ? 'success' : 'warning'} variant="soft" sx={{ py: 0.75 }}>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                                    <Typography level="body-sm" sx={{ fontWeight: 700 }}>
                                        {voucherPreview.message || (voucherPreview.valid ? 'Voucher valid' : 'Voucher tidak valid')}
                                    </Typography>
                                    {voucherPreview.valid ? (
                                        <>
                                            <Typography level="body-xs" sx={{ fontWeight: 700, mt: 0.25 }}>
                                                STATUS VOUCHER: BISA DIPAKAI
                                            </Typography>
                                            <Divider sx={{ my: 0.5 }} />
                                            <Typography level="body-xs" sx={{ fontWeight: 700 }}>Detail Potongan:</Typography>
                                            <Typography level="body-xs" color="neutral">
                                                Jenis Potongan: {String(voucherPreview.discount_type || '').toLowerCase() === 'fixed' ? 'Nominal Tetap' : 'Persentase'}
                                            </Typography>
                                            <Typography level="body-xs" color="neutral">
                                                Besaran: {String(voucherPreview.discount_type || '').toLowerCase() === 'fixed' ? formatIDR(voucherPreview.discount_value || 0) : `${Number(voucherPreview.discount_value || 0)}%`}
                                            </Typography>
                                            <Typography level="body-xs" color="neutral">
                                                Maksimal Potongan: {Number(voucherPreview.max_discount_amount || 0) > 0 ? formatIDR(voucherPreview.max_discount_amount || 0) : 'Tanpa batas'}
                                            </Typography>
                                            <Typography level="body-xs" color="neutral">
                                                Syarat Minimum: {formatIDR(voucherPreview.min_order_amount || 0)}
                                            </Typography>
                                            <Divider sx={{ my: 0.5 }} />
                                            <Typography level="body-xs" sx={{ fontWeight: 700 }}>STRUK PENGURANGAN VOUCHER</Typography>
                                            <Typography level="body-xs" color="neutral">
                                                Harga Item: {formatIDR(voucherPreview.estimated_base || pricingMap?.torrent?.price_per_unit || 0)}
                                            </Typography>
                                            <Typography level="body-xs" color="neutral">
                                                Potongan Voucher: - {formatIDR(voucherPreview.estimated_discount || 0)}
                                            </Typography>
                                            <Typography level="body-xs" color="neutral">
                                                Subtotal Setelah Voucher: {formatIDR(voucherPreview.estimated_final || 0)}
                                            </Typography>
                                        </>
                                    ) : null}
                                </Box>
                            </Alert>
                        ) : null}
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <Button
                                variant="solid"
                                onClick={handleFetch}
                                disabled={loading || !url}
                                sx={{ minWidth: 120, whiteSpace: 'nowrap' }}
                            >
                                {loading ? 'Memproses...' : 'Proses'}
                            </Button>
                        </Box>
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

                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <Input
                                fullWidth
                                size="small"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="https://rapidgator.net/file/..."
                                startDecorator={<LinkIcon fontSize="small" />}
                            />
                            <Box sx={{ display: 'flex', gap: 1, flexDirection: { xs: 'column', sm: 'row' } }}>
                                <Input
                                    fullWidth
                                    size="small"
                                    value={voucherCode}
                                    onChange={(e) => {
                                        setVoucherCode(e.target.value.toUpperCase());
                                        setVoucherPreview(null);
                                    }}
                                    placeholder="Voucher (opsional)"
                                />
                                <Button
                                    size="sm"
                                    variant="outlined"
                                    onClick={checkVoucherPreview}
                                    disabled={checkingVoucher || !voucherCode.trim()}
                                    sx={{ minWidth: { xs: '100%', sm: 120 }, whiteSpace: 'nowrap', textTransform: 'none' }}
                                >
                                    {checkingVoucher ? 'Mengecek...' : 'Cek Voucher'}
                                </Button>
                            </Box>
                            {checkingVoucher ? (
                                <Alert color="neutral" variant="soft" sx={{ py: 0.75 }}>
                                    Mengecek voucher...
                                </Alert>
                            ) : voucherPreview ? (
                                <Alert color={voucherPreview.valid ? 'success' : 'warning'} variant="soft" sx={{ py: 0.75 }}>
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                                        <Typography level="body-sm" sx={{ fontWeight: 700 }}>
                                            {voucherPreview.message || (voucherPreview.valid ? 'Voucher valid' : 'Voucher tidak valid')}
                                        </Typography>
                                        {voucherPreview.valid ? (
                                                <>
                                                <Typography level="body-xs" sx={{ fontWeight: 700, mt: 0.25 }}>
                                                    STATUS VOUCHER: BISA DIPAKAI
                                                </Typography>
                                                <Divider sx={{ my: 0.5 }} />
                                                <Typography level="body-xs" sx={{ fontWeight: 700 }}>Detail Potongan:</Typography>
                                                <Typography level="body-xs" color="neutral">
                                                    Jenis Potongan: {String(voucherPreview.discount_type || '').toLowerCase() === 'fixed' ? 'Nominal Tetap' : 'Persentase'}
                                                </Typography>
                                                <Typography level="body-xs" color="neutral">
                                                    Besaran: {String(voucherPreview.discount_type || '').toLowerCase() === 'fixed' ? formatIDR(voucherPreview.discount_value || 0) : `${Number(voucherPreview.discount_value || 0)}%`}
                                                </Typography>
                                                <Typography level="body-xs" color="neutral">
                                                    Maksimal Potongan: {Number(voucherPreview.max_discount_amount || 0) > 0 ? formatIDR(voucherPreview.max_discount_amount || 0) : 'Tanpa batas'}
                                                </Typography>
                                                <Typography level="body-xs" color="neutral">
                                                    Syarat Minimum: {formatIDR(voucherPreview.min_order_amount || 0)}
                                                </Typography>
                                                <Divider sx={{ my: 0.5 }} />
                                                <Typography level="body-xs" sx={{ fontWeight: 700 }}>STRUK PENGURANGAN VOUCHER</Typography>
                                                <Typography level="body-xs" color="neutral">
                                                    Harga Item: {formatIDR(voucherPreview.estimated_base || pricingMap?.premium?.price_per_unit || 0)}
                                                </Typography>
                                                <Typography level="body-xs" color="neutral">
                                                    Potongan Voucher: - {formatIDR(voucherPreview.estimated_discount || 0)}
                                                </Typography>
                                                <Typography level="body-xs" color="neutral">
                                                    Subtotal Setelah Voucher: {formatIDR(voucherPreview.estimated_final || 0)}
                                                </Typography>
                                                </>
                                        ) : null}
                                    </Box>
                                </Alert>
                            ) : null}
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <Button
                                    variant="solid"
                                    color="primary"
                                    onClick={handleFetch}
                                    disabled={loading || !url}
                                    sx={{ minWidth: 120, whiteSpace: 'nowrap' }}
                                >
                                    {loading ? 'Mengirim...' : 'Proses'}
                                </Button>
                            </Box>
                        </Box>
                    </Sheet>

                    <Sheet variant="outlined" sx={{ p: 2, borderRadius: 'md', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            <WarningAmberIcon color="primary" fontSize="small" />
                            <Typography level="title-sm" sx={{ fontWeight: 700 }}>
                                Catatan
                            </Typography>
                        </Box>

                        <Sheet variant="soft" color="neutral" sx={{ p: 1.5, borderRadius: 'sm' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
                                <CalculateOutlinedIcon fontSize="small" color="primary" />
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
                                    color="primary"
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

                        <Alert color="primary" variant="soft" icon={<InfoOutlinedIcon />}>
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
                                <Typography level="body-sm" color="danger">
                                    Saldo akan langsung terpotong saat klik <strong>Kirim</strong>, kecuali jika link tidak ada/tidak valid.
                                </Typography>
                            </Box>
                        </Alert>
                    </Sheet>
                </>
            )}

            <Modal open={showPremiumReceipt} onClose={() => setShowPremiumReceipt(false)}>
                <ModalDialog size="md" sx={{ width: 'min(560px, 92vw)' }}>
                    <DialogTitle>Konfirmasi Link</DialogTitle>
                    <DialogContent>
                        <Sheet variant="outlined" sx={{ p: 1.25, borderRadius: 'sm' }}>
                            <Box sx={{ display: 'grid', gridTemplateColumns: '96px 1fr', rowGap: 0.8, columnGap: 1 }}>
                                <Typography level="body-sm" sx={{ fontWeight: 700 }}>LINK</Typography>
                                <Typography level="body-sm" sx={{ overflowWrap: 'anywhere' }}>{url || '-'}</Typography>
                            </Box>
                            <Divider sx={{ my: 1 }} />
                            <Typography level="body-xs" color="primary">
                                Konfirmasi: lanjutkan proses link ini?
                            </Typography>
                        </Sheet>
                    </DialogContent>
                    <DialogActions>
                        <Button variant="plain" color="neutral" onClick={() => setShowPremiumReceipt(false)}>
                            Batal
                        </Button>
                        <Button variant="solid" color="primary" onClick={submitPremium} loading={loading}>
                            Kirim
                        </Button>
                    </DialogActions>
                </ModalDialog>
            </Modal>

            <Modal open={showTorrentConfirm} onClose={() => setShowTorrentConfirm(false)}>
                <ModalDialog size="md" sx={{ width: 'min(560px, 92vw)' }}>
                    <DialogTitle>Konfirmasi Link</DialogTitle>
                    <DialogContent>
                        <Sheet variant="outlined" sx={{ p: 1.25, borderRadius: 'sm' }}>
                            <Box sx={{ display: 'grid', gridTemplateColumns: '96px 1fr', rowGap: 0.8, columnGap: 1 }}>
                                <Typography level="body-sm" sx={{ fontWeight: 700 }}>LINK</Typography>
                                <Typography level="body-sm" sx={{ overflowWrap: 'anywhere' }}>{url || '-'}</Typography>
                            </Box>
                            <Divider sx={{ my: 1 }} />
                            <Typography level="body-xs" color="primary">
                                Konfirmasi: lanjutkan proses link ini?
                            </Typography>
                        </Sheet>
                    </DialogContent>
                    <DialogActions>
                        <Button variant="plain" color="neutral" onClick={() => setShowTorrentConfirm(false)}>
                            Batal
                        </Button>
                        <Button variant="solid" color="primary" onClick={submitTorrent} loading={loading}>
                            Kirim
                        </Button>
                    </DialogActions>
                </ModalDialog>
            </Modal>
        </Box>
    );
}
