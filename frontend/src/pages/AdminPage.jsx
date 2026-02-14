import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import InputAdornment from '@mui/material/InputAdornment';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Chip from '@mui/material/Chip';
import Badge from '@mui/material/Badge';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Pagination from '@mui/material/Pagination';
import RefreshIcon from '@mui/icons-material/Refresh';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import PeopleIcon from '@mui/icons-material/People';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PaymentIcon from '@mui/icons-material/Payments';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';

export default function AdminPage() {
    const [activeTab, setActiveTab] = useState(0);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    // Pricing state
    const [pricing, setPricing] = useState([]);
    const [editingPricing, setEditingPricing] = useState(null);

    // Voucher state
    const [vouchers, setVouchers] = useState([]);
    const [editingVoucher, setEditingVoucher] = useState(null);
    const [voucherCreateOpen, setVoucherCreateOpen] = useState(false);
    const [voucherDeleteTarget, setVoucherDeleteTarget] = useState(null);
    const [newVoucher, setNewVoucher] = useState({
        code: '',
        name: '',
        description: '',
        discount_type: 'percentage',
        discount_value: '10',
        min_order_amount: '0',
        min_discount_amount: '0',
        max_discount_amount: '0',
        applies_to: 'all',
        usage_scope: 'global',
        usage_limit: '0',
        is_active: true,
    });

    // Users state
    const [users, setUsers] = useState([]);
    const [adminIdentifier, setAdminIdentifier] = useState('');
    const [userEditOpen, setUserEditOpen] = useState(false);
    const [userEditTarget, setUserEditTarget] = useState(null);
    const [userEditBalance, setUserEditBalance] = useState('');
    const [userEditActive, setUserEditActive] = useState(true);

    // Hosts state
    const [hosts, setHosts] = useState([]);
    const [newHostName, setNewHostName] = useState('');
    const [editingHostId, setEditingHostId] = useState(null);
    const [editingHostName, setEditingHostName] = useState('');

    // Official posts state
    const [officialPosts, setOfficialPosts] = useState([]);
    const [newOfficialPost, setNewOfficialPost] = useState({ title: '', content: '', type: 'info' });
    const [guideHelpDraft, setGuideHelpDraft] = useState({ title: 'Panduan & Bantuan', content: '' });
    const [guideHelpSaving, setGuideHelpSaving] = useState(false);
    const [guideHelpEditing, setGuideHelpEditing] = useState(false);

    // Banner state
    const [banners, setBanners] = useState([]);
    const [newBanner, setNewBanner] = useState({ title: '', description: '', image: '', color: '', sort_order: 0 });
    const [uploadingBannerImage, setUploadingBannerImage] = useState(false);
    const [bannerImageInfo, setBannerImageInfo] = useState(null);

    // Stats
    const [stats, setStats] = useState({ users: 0, transactions: 0, revenue: 0 });

    // Manual topup requests
    const [topupRequests, setTopupRequests] = useState([]);
    const [topupPage, setTopupPage] = useState(1);
    const [topupPageSize] = useState(25);
    const [topupTotalPages, setTopupTotalPages] = useState(0);
    const [pendingTopupCount, setPendingTopupCount] = useState(0);

    const formatIDRNumber = (value) => {
        const n = typeof value === 'number' ? value : parseInt(String(value || '').replace(/[^0-9]/g, ''), 10);
        const safe = Number.isFinite(n) ? n : 0;
        return safe.toLocaleString('id-ID');
    };

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

    const adminUsers = users.filter((u) => String(u.role || '').toLowerCase() === 'admin');
    const clientUsers = users.filter((u) => String(u.role || '').toLowerCase() !== 'admin');
    const guideHelpPost = officialPosts.find((p) => String(p?.type || '').toLowerCase() === 'guide_help') || null;
    const regularOfficialPosts = officialPosts.filter((p) => String(p?.type || '').toLowerCase() !== 'guide_help');

    const voucherFieldSx = {
        '& .MuiInputBase-input': { py: 1.2 },
        '& .MuiInputLabel-root': { px: 0.5, backgroundColor: 'background.paper' },
    };

    const sanitizeNumericInput = (value) => String(value || '').replace(/[^0-9]/g, '');

    // Topup decision dialog
    const [topupDecisionOpen, setTopupDecisionOpen] = useState(false);
    const [topupDecisionId, setTopupDecisionId] = useState(null);
    const [topupDecisionStatus, setTopupDecisionStatus] = useState('approved');
    const [topupDecisionReason, setTopupDecisionReason] = useState('');

    useEffect(() => {
        fetchPricing();
        fetchVouchers();
        fetchUsers();
        fetchStats();
        fetchHosts();
        fetchBanners();
        fetchOfficialPosts();
        fetchTopupRequests();
    }, []);

    const fetchTopupRequests = async (page = 1) => {
        try {
            const res = await fetch(`/api/admin/topups?page=${page}&page_size=${topupPageSize}`);
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) {
                    setTopupRequests(data);
                    setPendingTopupCount(data.filter((t) => String(t?.status) === 'pending').length);
                    setTopupPage(page);
                    setTopupTotalPages(1);
                } else {
                    const items = Array.isArray(data?.items) ? data.items : [];
                    setTopupRequests(items);
                    setPendingTopupCount(Number(data?.pending_count || 0));
                    setTopupPage(Number(data?.page || page));
                    setTopupTotalPages(Number(data?.total_pages || 0));
                }
            }
        } catch (err) {
            console.error('Failed to fetch topup requests:', err);
        }
    };

    const openTopupDecision = (id, status) => {
        setTopupDecisionId(id);
        setTopupDecisionStatus(status);
        setTopupDecisionReason('');
        setTopupDecisionOpen(true);
    };

    const closeTopupDecision = () => {
        if (loading) return;
        setTopupDecisionOpen(false);
        setTopupDecisionId(null);
        setTopupDecisionReason('');
    };

    const decideTopup = async () => {
        const id = topupDecisionId;
        const status = topupDecisionStatus;
        const reason = (topupDecisionReason || '').trim();

        if (!id) {
            setMessage('Topup tidak valid.');
            return;
        }

        if (status === 'rejected' && !reason) {
            setMessage('Alasan penolakan wajib diisi.');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/admin/topups', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status, reason: reason || '' }),
            });
            if (!res.ok) {
                const t = await res.text();
                throw new Error(t || 'Gagal memproses topup');
            }
            setMessage(status === 'approved' ? 'Topup disetujui.' : 'Topup ditolak.');
            closeTopupDecision();
            fetchTopupRequests(topupPage);
            fetchUsers();
            fetchStats();
        } catch (err) {
            console.error(err);
            setMessage(err.message || 'Terjadi kesalahan');
        } finally {
            setLoading(false);
        }
    };

    const fetchPricing = async () => {
        try {
            const res = await fetch('/api/pricing');
            const data = await res.json();
            setPricing(data);
        } catch (err) {
            console.error('Failed to fetch pricing:', err);
        }
    };

    const fetchVouchers = async () => {
        try {
            const res = await fetch('/api/admin/vouchers');
            if (!res.ok) return;
            const data = await res.json();
            setVouchers(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Failed to fetch vouchers:', err);
        }
    };

    const createVoucher = async () => {
        if (!newVoucher.code.trim()) {
            setMessage('Kode voucher wajib diisi');
            return false;
        }
        try {
            const toInt = (v, fallback = 0) => {
                const n = parseInt(String(v ?? '').trim(), 10);
                return Number.isFinite(n) ? n : fallback;
            };

            const payload = {
                ...newVoucher,
                code: newVoucher.code.trim().toUpperCase(),
                name: newVoucher.name?.trim() || '',
                discount_value: toInt(newVoucher.discount_value, 0),
                min_order_amount: toInt(newVoucher.min_order_amount, 0),
                min_discount_amount: toInt(newVoucher.min_discount_amount, 0),
                max_discount_amount: toInt(newVoucher.max_discount_amount, 0),
                usage_limit: toInt(newVoucher.usage_limit, 0),
            };
            const res = await fetch('/api/admin/vouchers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const t = await res.text();
                setMessage(t || 'Gagal membuat voucher');
                return false;
            }
            setMessage('Voucher berhasil dibuat');
            setNewVoucher({
                code: '',
                name: '',
                description: '',
                discount_type: 'percentage',
                discount_value: '10',
                min_order_amount: '0',
                min_discount_amount: '0',
                max_discount_amount: '0',
                applies_to: 'all',
                usage_scope: 'global',
                usage_limit: '0',
                is_active: true,
            });
            fetchVouchers();
            return true;
        } catch (err) {
            setMessage('Error: ' + err.message);
            return false;
        }
    };

    const updateVoucher = async (voucher) => {
        try {
            const toInt = (v, fallback = 0) => {
                const n = parseInt(String(v ?? '').trim(), 10);
                return Number.isFinite(n) ? n : fallback;
            };

            const payload = {
                ...voucher,
                discount_value: toInt(voucher?.discount_value, 0),
                min_order_amount: toInt(voucher?.min_order_amount, 0),
                min_discount_amount: toInt(voucher?.min_discount_amount, 0),
                max_discount_amount: toInt(voucher?.max_discount_amount, 0),
                usage_limit: toInt(voucher?.usage_limit, 0),
            };

            const res = await fetch('/api/admin/vouchers', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const t = await res.text();
                setMessage(t || 'Gagal update voucher');
                return;
            }
            setMessage('Voucher berhasil diupdate');
            setEditingVoucher(null);
            fetchVouchers();
        } catch (err) {
            setMessage('Error: ' + err.message);
        }
    };

    const deleteVoucher = async (id) => {
        try {
            const res = await fetch(`/api/admin/vouchers?id=${id}`, { method: 'DELETE' });
            if (!res.ok) {
                const t = await res.text();
                setMessage(t || 'Gagal hapus voucher');
                return;
            }
            setMessage('Voucher berhasil dihapus');
            setVoucherDeleteTarget(null);
            fetchVouchers();
        } catch (err) {
            setMessage('Error: ' + err.message);
        }
    };

    const fetchUsers = async () => {
        try {
            const res = await fetch('/api/admin/users');
            if (res.ok) {
                const data = await res.json();
                const list = Array.isArray(data) ? data : [];
                setUsers(list);
            }
        } catch (err) {
            console.error('Failed to fetch users:', err);
        }
    };

    const fetchStats = async () => {
        try {
            const res = await fetch('/api/admin/stats');
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
        } catch (err) {
            console.error('Failed to fetch stats:', err);
        }
    };

    const fetchHosts = async () => {
        try {
            const res = await fetch('/api/admin/hosts');
            if (res.ok) {
                const data = await res.json();
                setHosts(Array.isArray(data) ? data : []);
            }
        } catch (err) {
            console.error('Failed to fetch hosts:', err);
        }
    };

    const fetchOfficialPosts = async () => {
        try {
            const res = await fetch('/api/admin/posts/official');
            if (res.ok) {
                const data = await res.json();
                setOfficialPosts(Array.isArray(data) ? data : []);
            }
        } catch (err) {
            console.error('Failed to fetch official posts:', err);
        }
    };

    useEffect(() => {
        const guidePost = officialPosts.find((p) => String(p?.type || '').toLowerCase() === 'guide_help');
        if (guidePost) {
            setGuideHelpDraft({
                title: String(guidePost.title || 'Panduan & Bantuan'),
                content: String(guidePost.content || ''),
            });
        }
    }, [officialPosts]);

    const fetchBanners = async () => {
        try {
            const res = await fetch('/api/admin/banners');
            if (res.ok) {
                const data = await res.json();
                setBanners(Array.isArray(data) ? data : []);
            }
        } catch (err) {
            console.error('Failed to fetch banners:', err);
        }
    };

    const updatePricing = async (p) => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/pricing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(p),
            });
            if (res.ok) {
                setMessage('Harga berhasil diupdate!');
                setEditingPricing(null);
                fetchPricing();
            } else {
                setMessage('Gagal update harga');
            }
        } catch (err) {
            setMessage('Error: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const updateUserBalance = async (userId, balanceValue) => {
        const parsed = parseInt(String(balanceValue || '').replace(/[^0-9-]/g, ''), 10);
        if (!Number.isFinite(parsed)) {
            setMessage('Saldo tidak valid');
            return false;
        }
        try {
            const res = await fetch('/api/admin/user/balance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, balance: parsed }),
            });
            if (res.ok) {
                setMessage('Saldo berhasil diupdate!');
                fetchUsers();
                fetchStats();
                return true;
            } else {
                const t = await res.text();
                setMessage(t || 'Gagal update saldo');
                return false;
            }
        } catch (err) {
            setMessage('Error: ' + err.message);
            return false;
        }
    };

    const getUserDisplayName = (userRow) => {
        const explicit = String(userRow?.name || '').trim();
        if (explicit) return explicit;
        const folder = String(userRow?.pikpak_folder_name || '').trim();
        if (folder) return folder;
        return String(userRow?.email || '').split('@')[0] || '-';
    };

    const openUserEditDialog = (userRow) => {
        setUserEditTarget(userRow);
        setUserEditBalance(String(userRow?.balance ?? 0));
        setUserEditActive(!!userRow?.is_active);
        setUserEditOpen(true);
    };

    const closeUserEditDialog = () => {
        if (loading) return;
        setUserEditOpen(false);
        setUserEditTarget(null);
        setUserEditBalance('');
        setUserEditActive(true);
    };

    const saveUserEdit = async () => {
        if (!userEditTarget?.id) return;

        setLoading(true);
        try {
            const oldBalance = Number(userEditTarget.balance ?? 0);
            const nextBalance = parseInt(String(userEditBalance || '').replace(/[^0-9-]/g, ''), 10);
            if (!Number.isFinite(nextBalance)) {
                setMessage('Saldo tidak valid');
                return;
            }

            let changed = false;

            if (nextBalance !== oldBalance) {
                const balanceOk = await updateUserBalance(userEditTarget.id, userEditBalance);
                if (!balanceOk) {
                    return;
                }
                changed = true;
            }

            if (userEditActive !== !!userEditTarget.is_active) {
                const res = await fetch('/api/admin/users', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: userEditTarget.id, is_active: userEditActive }),
                });
                if (!res.ok) {
                    const t = await res.text();
                    setMessage(t || 'Gagal update status user');
                    return;
                }
                changed = true;
            }

            if (!changed) {
                setMessage('Tidak ada perubahan.');
            } else {
                setMessage('Data user berhasil diupdate');
                fetchUsers();
            }

            closeUserEditDialog();
        } finally {
            setLoading(false);
        }
    };

    const promoteToAdmin = async () => {
        const identifier = adminIdentifier.trim();
        if (!identifier) {
            setMessage('Isi email atau username terlebih dahulu');
            return;
        }
        try {
            const res = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier }),
            });
            if (res.ok) {
                setMessage('User berhasil dijadikan admin');
                setAdminIdentifier('');
                fetchUsers();
            } else {
                const t = await res.text();
                setMessage(t || 'Gagal menjadikan admin');
            }
        } catch (err) {
            setMessage('Error: ' + err.message);
        }
    };

    const toggleHostAvailability = async (host) => {
        try {
            const res = await fetch('/api/admin/hosts', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: host.id, is_available: !host.is_available }),
            });
            if (res.ok) {
                setMessage(`Host ${host.name} berhasil diupdate`);
                fetchHosts();
            } else {
                setMessage('Gagal update host');
            }
        } catch (err) {
            setMessage('Error: ' + err.message);
        }
    };

    const createHost = async () => {
        const name = newHostName.trim();
        if (!name) {
            setMessage('Nama host wajib diisi');
            return;
        }

        try {
            const res = await fetch('/api/admin/hosts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, is_available: true }),
            });

            if (res.ok) {
                setMessage('Host berhasil ditambahkan');
                setNewHostName('');
                fetchHosts();
            } else {
                setMessage('Gagal menambahkan host (mungkin duplikat)');
            }
        } catch (err) {
            setMessage('Error: ' + err.message);
        }
    };

    const startEditHost = (host) => {
        setEditingHostId(host.id);
        setEditingHostName(host.name || '');
    };

    const saveEditHost = async () => {
        const name = editingHostName.trim();
        if (!editingHostId || !name) {
            setMessage('Nama host tidak valid');
            return;
        }

        try {
            const res = await fetch('/api/admin/hosts', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: editingHostId, name }),
            });
            if (res.ok) {
                setMessage('Host berhasil diupdate');
                setEditingHostId(null);
                setEditingHostName('');
                fetchHosts();
            } else {
                setMessage('Gagal update host');
            }
        } catch (err) {
            setMessage('Error: ' + err.message);
        }
    };

    const deleteHost = async (hostId) => {
        try {
            const res = await fetch(`/api/admin/hosts?id=${hostId}`, { method: 'DELETE' });
            if (res.ok) {
                setMessage('Host berhasil dihapus');
                fetchHosts();
            } else {
                setMessage('Gagal menghapus host');
            }
        } catch (err) {
            setMessage('Error: ' + err.message);
        }
    };

    const createBanner = async () => {
        if (!newBanner.title.trim()) {
            setMessage('Judul banner wajib diisi');
            return;
        }

        try {
            const res = await fetch('/api/admin/banners', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...newBanner,
                    title: newBanner.title.trim(),
                    description: newBanner.description.trim(),
                    image: newBanner.image.trim(),
                    color: newBanner.color.trim(),
                }),
            });

            if (res.ok) {
                setMessage('Banner berhasil ditambahkan');
                setNewBanner({ title: '', description: '', image: '', color: '', sort_order: 0 });
                setBannerImageInfo(null);
                fetchBanners();
            } else {
                setMessage('Gagal menambahkan banner');
            }
        } catch (err) {
            setMessage('Error: ' + err.message);
        }
    };

    const uploadBannerImage = async (file) => {
        if (!file) return;

        const maxSize = 1 * 1024 * 1024;
        if (file.size > maxSize) {
            setMessage('Ukuran gambar maksimal 1MB');
            return;
        }

        const formData = new FormData();
        formData.append('image', file);

        setUploadingBannerImage(true);
        try {
            const res = await fetch('/api/admin/banners/upload-image', {
                method: 'POST',
                body: formData,
            });

            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setNewBanner((prev) => ({ ...prev, image: data.url || '' }));
                setBannerImageInfo(data);
                setMessage('Upload gambar banner berhasil');
            } else {
                setMessage(data.error || 'Gagal upload gambar');
            }
        } catch (err) {
            setMessage('Error: ' + err.message);
        } finally {
            setUploadingBannerImage(false);
        }
    };

    const toggleBanner = async (banner) => {
        try {
            const res = await fetch('/api/admin/banners', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: banner.id, is_active: !banner.is_active }),
            });
            if (res.ok) {
                setMessage('Status banner berhasil diupdate');
                fetchBanners();
            } else {
                setMessage('Gagal update banner');
            }
        } catch (err) {
            setMessage('Error: ' + err.message);
        }
    };

    const deleteBanner = async (bannerId) => {
        try {
            const res = await fetch(`/api/admin/banners?id=${bannerId}`, { method: 'DELETE' });
            if (res.ok) {
                setMessage('Banner berhasil dihapus');
                fetchBanners();
            } else {
                setMessage('Gagal menghapus banner');
            }
        } catch (err) {
            setMessage('Error: ' + err.message);
        }
    };

    const createOfficialPost = async () => {
        if (!newOfficialPost.title.trim() || !newOfficialPost.content.trim()) {
            setMessage('Judul dan konten wajib diisi');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/admin/posts/official', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newOfficialPost),
            });

            if (res.ok) {
                setMessage('Informasi resmi berhasil dibuat');
                setNewOfficialPost({ title: '', content: '', type: 'info' });
                fetchOfficialPosts();
            } else {
                setMessage('Gagal membuat informasi resmi');
            }
        } catch (err) {
            setMessage('Error: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const toggleOfficialPost = async (post) => {
        try {
            const res = await fetch('/api/admin/posts/official', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: post.id, is_active: !post.is_active }),
            });
            if (res.ok) {
                setMessage('Status informasi berhasil diupdate');
                fetchOfficialPosts();
            } else {
                setMessage('Gagal update status informasi');
            }
        } catch (err) {
            setMessage('Error: ' + err.message);
        }
    };

    const deleteOfficialPost = async (postId) => {
        try {
            const res = await fetch(`/api/admin/posts/official?id=${postId}`, { method: 'DELETE' });
            if (res.ok) {
                setMessage('Informasi resmi berhasil dihapus');
                fetchOfficialPosts();
            } else {
                setMessage('Gagal menghapus informasi resmi');
            }
        } catch (err) {
            setMessage('Error: ' + err.message);
        }
    };

    const saveGuideHelpPost = async () => {
        const title = String(guideHelpDraft.title || '').trim();
        const content = String(guideHelpDraft.content || '').trim();
        if (!title || !content) {
            setMessage('Judul dan konten Panduan & Bantuan wajib diisi');
            return;
        }

        const existing = officialPosts.find((p) => String(p?.type || '').toLowerCase() === 'guide_help');
        setGuideHelpSaving(true);
        try {
            if (existing?.id) {
                const res = await fetch('/api/admin/posts/official', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: existing.id,
                        title,
                        content,
                        is_active: true,
                    }),
                });
                if (!res.ok) throw new Error('Gagal update Panduan & Bantuan');
            } else {
                const res = await fetch('/api/admin/posts/official', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title,
                        content,
                        type: 'guide_help',
                    }),
                });
                if (!res.ok) throw new Error('Gagal membuat Panduan & Bantuan');
            }

            setMessage('Panduan & Bantuan berhasil disimpan');
            setGuideHelpEditing(false);
            fetchOfficialPosts();
        } catch (err) {
            setMessage(err.message || 'Terjadi kesalahan saat menyimpan Panduan & Bantuan');
        } finally {
            setGuideHelpSaving(false);
        }
    };

    return (
        <Box sx={{ maxWidth: 936, margin: 'auto' }}>
            {/* Stats Cards */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2, mb: 3 }}>
                <Card variant="outlined">
                    <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <PeopleIcon color="primary" />
                        <Box>
                            <Typography variant="caption" color="text.secondary">Total Users</Typography>
                            <Typography variant="h6" fontWeight={700}>{stats.users || users.length}</Typography>
                        </Box>
                    </CardContent>
                </Card>
                <Card variant="outlined">
                    <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <ReceiptLongIcon color="primary" />
                        <Box>
                            <Typography variant="caption" color="text.secondary">Transaksi</Typography>
                            <Typography variant="h6" fontWeight={700}>{stats.transactions || 0}</Typography>
                        </Box>
                    </CardContent>
                </Card>
                <Card variant="outlined">
                    <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <AttachMoneyIcon color="success" />
                        <Box>
                            <Typography variant="caption" color="text.secondary">Revenue (IDR)</Typography>
                            <Typography variant="h6" fontWeight={700}>{formatIDRNumber(stats.revenue || 0)}</Typography>
                        </Box>
                    </CardContent>
                </Card>
            </Box>

            {/* Tabs Content */}
            <Paper variant="outlined">
                <Tabs
                    value={activeTab}
                    onChange={(e, v) => setActiveTab(v)}
                    variant="scrollable"
                    scrollButtons="auto"
                    sx={{ borderBottom: '1px solid', borderColor: 'divider', px: { xs: 1, sm: 2 } }}
                >
                    <Tab label="Harga" sx={{ textTransform: 'none', minWidth: 100 }} />
                    <Tab label="Users" sx={{ textTransform: 'none', minWidth: 100 }} />
                    <Tab label="Available Host" sx={{ textTransform: 'none', minWidth: 140 }} />
                    <Tab label="Banner" sx={{ textTransform: 'none', minWidth: 100 }} />
                    <Tab label="Informasi Resmi" sx={{ textTransform: 'none', minWidth: 130 }} />
                    <Tab label="Voucher" sx={{ textTransform: 'none', minWidth: 110 }} />
                    <Tab
                        label={
                            <Badge color="warning" badgeContent={pendingTopupCount} invisible={pendingTopupCount <= 0}>
                                <span>Top Up</span>
                            </Badge>
                        }
                        sx={{ textTransform: 'none', minWidth: 100 }}
                    />
                </Tabs>

                {/* Pricing Tab */}
                {activeTab === 0 && (
                    <Box sx={{ p: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                            <Typography variant="subtitle1" fontWeight={600}>Pengaturan Harga</Typography>
                            <IconButton size="small" onClick={fetchPricing}>
                                <RefreshIcon fontSize="small" />
                            </IconButton>
                        </Box>

                        <TableContainer>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 600 }}>Layanan</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>Tipe</TableCell>
                                        <TableCell sx={{ fontWeight: 600, width: 160 }}>Harga/Unit (Rp)</TableCell>
                                        <TableCell sx={{ fontWeight: 600, width: 130 }}>Unit (GB)</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>Deskripsi</TableCell>
                                        <TableCell sx={{ fontWeight: 600, width: 140 }}>Aksi</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {pricing.map((p) => {
                                        const isEdit = editingPricing?.service_type === p.service_type;
                                        return (
                                            <TableRow key={p.id || p.service_type} hover>
                                                <TableCell>{p.display_name}</TableCell>
                                                <TableCell><Chip label={p.service_type} size="small" /></TableCell>
                                                <TableCell>
                                                    {isEdit ? (
                                                        <TextField
                                                            type="number"
                                                            size="small"
                                                            value={editingPricing.price_per_unit}
                                                            onChange={(e) => setEditingPricing({ ...editingPricing, price_per_unit: parseInt(e.target.value || '0') })}
                                                        />
                                                    ) : (
                                                        <Typography variant="body2" color="primary.main" fontWeight={500}>
                                                            {formatIDRNumber(p.price_per_unit || 0)}
                                                        </Typography>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {isEdit ? (
                                                        <TextField
                                                            type="number"
                                                            size="small"
                                                            value={editingPricing.unit_size_gb}
                                                            onChange={(e) => setEditingPricing({ ...editingPricing, unit_size_gb: parseInt(e.target.value || '1') })}
                                                        />
                                                    ) : (
                                                        <Typography variant="body2">{p.unit_size_gb}</Typography>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {isEdit ? (
                                                        <TextField
                                                            size="small"
                                                            fullWidth
                                                            value={editingPricing.description || ''}
                                                            onChange={(e) => setEditingPricing({ ...editingPricing, description: e.target.value })}
                                                        />
                                                    ) : (
                                                        <Typography variant="caption" color="text.secondary">{p.description}</Typography>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {isEdit ? (
                                                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                                                            <IconButton size="small" color="success" onClick={() => updatePricing(editingPricing)} disabled={loading}>
                                                                <CheckIcon fontSize="small" />
                                                            </IconButton>
                                                            <IconButton size="small" onClick={() => setEditingPricing(null)}>
                                                                <CloseIcon fontSize="small" />
                                                            </IconButton>
                                                        </Box>
                                                    ) : (
                                                        <IconButton size="small" onClick={() => setEditingPricing({ ...p })}>
                                                            <EditIcon fontSize="small" />
                                                        </IconButton>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </TableContainer>

                        <Alert severity="info" sx={{ mt: 3 }}>
                            <strong>Info:</strong> Perubahan harga akan langsung berlaku untuk transaksi baru.
                            Torrent dibulatkan ke {pricing.find((p) => p.service_type === 'torrent')?.unit_size_gb || 1}GB atas,
                            Premium dibulatkan ke {pricing.find((p) => p.service_type === 'premium')?.unit_size_gb || 2}GB atas.
                        </Alert>
                    </Box>
                )}

                {/* Users Tab */}
                {activeTab === 1 && (
                    <Box sx={{ p: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                            <Typography variant="subtitle1" fontWeight={600}>Daftar Users</Typography>
                            <IconButton size="small" onClick={fetchUsers}>
                                <RefreshIcon fontSize="small" />
                            </IconButton>
                        </Box>

                        <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 0 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, mb: 1.5, flexWrap: 'wrap' }}>
                                <Typography variant="subtitle2" fontWeight={700}>
                                    Admin
                                </Typography>
                                <Chip size="small" color="primary" variant="outlined" label={`${adminUsers.length} admin`} />
                            </Box>
                            <Box sx={{ display: 'flex', gap: 1, mb: 1.75, maxWidth: 620 }}>
                                <TextField
                                    size="small"
                                    fullWidth
                                    placeholder="Tambah admin via email / username"
                                    value={adminIdentifier}
                                    onChange={(e) => setAdminIdentifier(e.target.value)}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <PersonAddAlt1Icon fontSize="small" />
                                            </InputAdornment>
                                        ),
                                    }}
                                />
                                <Tooltip title="Tambah admin">
                                    <span>
                                        <IconButton color="primary" onClick={promoteToAdmin}>
                                            <PersonAddAlt1Icon />
                                        </IconButton>
                                    </span>
                                </Tooltip>
                            </Box>

                            <TableContainer>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={{ fontWeight: 600 }}>ID</TableCell>
                                            <TableCell sx={{ fontWeight: 600 }}>Email</TableCell>
                                            <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                                            <TableCell sx={{ fontWeight: 600 }}>Saldo</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 600, width: 72 }}>Aksi</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {adminUsers.map((user) => (
                                            <TableRow key={`admin-${user.id}`} hover>
                                                <TableCell>{user.id}</TableCell>
                                                <TableCell>
                                                    <Typography variant="body2" fontWeight={600}>{user.email}</Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Chip size="small" label={user.is_active ? 'Aktif' : 'Nonaktif'} color={user.is_active ? 'success' : 'default'} variant={user.is_active ? 'filled' : 'outlined'} />
                                                </TableCell>
                                                <TableCell>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                                                        <Typography variant="body2" color="primary.main" fontWeight={600}>
                                                            {formatIDRNumber(user.balance || 0)}
                                                        </Typography>
                                                    </Box>
                                                </TableCell>
                                                <TableCell align="right" sx={{ width: 72 }}>
                                                    <Box sx={{ display: 'inline-flex', justifyContent: 'flex-end' }}>
                                                        <Tooltip title="Edit user">
                                                            <IconButton size="small" color="primary" onClick={() => openUserEditDialog(user)}>
                                                                <EditIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </Box>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {adminUsers.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={5} sx={{ textAlign: 'center', py: 3 }}>
                                                    <Typography variant="body2" color="text.disabled">Belum ada admin.</Typography>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Paper>

                        <Paper variant="outlined" sx={{ p: 2, borderRadius: 0 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, mb: 1.5, flexWrap: 'wrap' }}>
                                <Typography variant="subtitle2" fontWeight={700}>
                                    Client
                                </Typography>
                                <Chip size="small" color="default" variant="outlined" label={`${clientUsers.length} client`} />
                            </Box>

                            <TableContainer>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={{ fontWeight: 600 }}>ID</TableCell>
                                            <TableCell sx={{ fontWeight: 600 }}>Email</TableCell>
                                            <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                                            <TableCell sx={{ fontWeight: 600 }}>Saldo</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 600, width: 72 }}>Aksi</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {clientUsers.map((user) => (
                                            <TableRow key={`client-${user.id}`} hover>
                                                <TableCell>{user.id}</TableCell>
                                                <TableCell>
                                                    <Typography variant="body2" fontWeight={500}>{user.email}</Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Chip size="small" label={user.is_active ? 'Aktif' : 'Nonaktif'} color={user.is_active ? 'success' : 'default'} variant={user.is_active ? 'filled' : 'outlined'} />
                                                </TableCell>
                                                <TableCell>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                                                        <Typography variant="body2" color="success.main" fontWeight={500}>
                                                            {formatIDRNumber(user.balance || 0)}
                                                        </Typography>
                                                    </Box>
                                                </TableCell>
                                                <TableCell align="right" sx={{ width: 72 }}>
                                                    <Box sx={{ display: 'inline-flex', justifyContent: 'flex-end' }}>
                                                        <Tooltip title="Edit user">
                                                            <IconButton size="small" color="primary" onClick={() => openUserEditDialog(user)}>
                                                                <EditIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </Box>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {clientUsers.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={5} sx={{ textAlign: 'center', py: 3 }}>
                                                    <Typography variant="body2" color="text.disabled">Belum ada client.</Typography>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Paper>
                    </Box>
                )}

                {/* Hosts Tab */}
                {activeTab === 2 && (
                    <Box sx={{ p: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                            <Typography variant="subtitle1" fontWeight={600}>Kelola Available Host</Typography>
                            <IconButton size="small" onClick={fetchHosts}>
                                <RefreshIcon fontSize="small" />
                            </IconButton>
                        </Box>

                        <Box sx={{ display: 'flex', gap: 1, mb: 2, maxWidth: 500 }}>
                            <TextField
                                size="small"
                                fullWidth
                                placeholder="Tambah host (contoh: Rapidgator)"
                                value={newHostName}
                                onChange={(e) => setNewHostName(e.target.value)}
                            />
                            <Button variant="contained" size="small" onClick={createHost}>Tambah</Button>
                        </Box>

                        <TableContainer>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 600 }}>Host</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>Switch</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>Aksi</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {hosts.map((host) => (
                                        <TableRow key={host.id} hover>
                                            <TableCell>
                                                {editingHostId === host.id ? (
                                                    <TextField
                                                        size="small"
                                                        value={editingHostName}
                                                        onChange={(e) => setEditingHostName(e.target.value)}
                                                    />
                                                ) : (
                                                    host.name
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    size="small"
                                                    label={host.is_available ? 'online' : 'down'}
                                                    color={host.is_available ? 'success' : 'default'}
                                                    variant={host.is_available ? 'filled' : 'outlined'}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <FormControlLabel
                                                    sx={{ m: 0 }}
                                                    control={
                                                        <Switch
                                                            checked={!!host.is_available}
                                                            onChange={() => toggleHostAvailability(host)}
                                                            size="small"
                                                        />
                                                    }
                                                    label={host.is_available ? 'ON' : 'OFF'}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Box sx={{ display: 'flex', gap: 0.5 }}>
                                                    {editingHostId === host.id ? (
                                                        <>
                                                            <IconButton size="small" color="success" onClick={saveEditHost}>
                                                                <CheckIcon fontSize="small" />
                                                            </IconButton>
                                                            <IconButton size="small" onClick={() => { setEditingHostId(null); setEditingHostName(''); }}>
                                                                <CloseIcon fontSize="small" />
                                                            </IconButton>
                                                        </>
                                                    ) : (
                                                        <IconButton size="small" onClick={() => startEditHost(host)}>
                                                            <EditIcon fontSize="small" />
                                                        </IconButton>
                                                    )}
                                                    <IconButton size="small" color="error" onClick={() => deleteHost(host.id)}>
                                                        <DeleteOutlineIcon fontSize="small" />
                                                    </IconButton>
                                                </Box>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {hosts.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={4} sx={{ textAlign: 'center', py: 4 }}>
                                                <Typography variant="body2" color="text.secondary">Belum ada host. Tambahkan dari form di atas.</Typography>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>

                        <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ mt: 2 }}>
                            Status host mengikuti switch: ON = online, OFF = down.
                        </Alert>
                    </Box>
                )}

                {/* Banner Tab */}
                {activeTab === 3 && (
                    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Typography variant="subtitle1" fontWeight={600}>Kelola Banner</Typography>

                        <Card variant="outlined">
                            <CardContent sx={{ display: 'grid', gap: 1.25 }}>
                                <Typography variant="body2" fontWeight={600}>Tambah Banner Baru</Typography>
                                <TextField
                                    size="small"
                                    label="Judul"
                                    value={newBanner.title}
                                    onChange={(e) => setNewBanner((prev) => ({ ...prev, title: e.target.value }))}
                                />
                                <TextField
                                    size="small"
                                    label="Deskripsi"
                                    value={newBanner.description}
                                    onChange={(e) => setNewBanner((prev) => ({ ...prev, description: e.target.value }))}
                                />
                                <TextField
                                    size="small"
                                    label="Image URL (opsional)"
                                    value={newBanner.image}
                                    onChange={(e) => setNewBanner((prev) => ({ ...prev, image: e.target.value }))}
                                />
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                    <Button component="label" variant="outlined" size="small" disabled={uploadingBannerImage}>
                                        {uploadingBannerImage ? 'Uploading...' : 'Upload Gambar Banner'}
                                        <input
                                            type="file"
                                            hidden
                                            accept="image/png,image/jpeg,image/gif"
                                            onChange={(e) => uploadBannerImage(e.target.files?.[0])}
                                        />
                                    </Button>
                                    <Typography variant="caption" color="text.secondary">
                                        Maks 1MB • JPG/PNG/GIF • area banner ± 936x200 (rasio ~4.7:1)
                                    </Typography>
                                </Box>
                                {bannerImageInfo && (
                                    <Typography variant="caption" color="text.secondary">
                                        Ukuran terdeteksi: {bannerImageInfo.width}x{bannerImageInfo.height}px
                                    </Typography>
                                )}
                                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 160px' }, gap: 1 }}>
                                    <TextField
                                        size="small"
                                        label="Color / Gradient"
                                        placeholder="linear-gradient(...)"
                                        value={newBanner.color}
                                        onChange={(e) => setNewBanner((prev) => ({ ...prev, color: e.target.value }))}
                                    />
                                    <TextField
                                        size="small"
                                        type="number"
                                        label="Urutan"
                                        value={newBanner.sort_order}
                                        onChange={(e) => setNewBanner((prev) => ({ ...prev, sort_order: parseInt(e.target.value || '0') }))}
                                    />
                                </Box>
                                <Box>
                                    <Button variant="contained" size="small" onClick={createBanner}>Tambah Banner</Button>
                                </Box>
                            </CardContent>
                        </Card>

                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Typography variant="body2" fontWeight={600}>Daftar Banner</Typography>
                            <IconButton size="small" onClick={fetchBanners}>
                                <RefreshIcon fontSize="small" />
                            </IconButton>
                        </Box>

                        <TableContainer>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 600 }}>Judul</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>Color/Image</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>Urutan</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>Aksi</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {banners.map((banner) => (
                                        <TableRow key={banner.id} hover>
                                            <TableCell>
                                                <Typography variant="body2" fontWeight={600}>{banner.title}</Typography>
                                                <Typography variant="caption" color="text.secondary">{banner.description}</Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="caption" color="text.secondary">
                                                    {banner.image ? 'Image URL' : (banner.color || '-')}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>{banner.sort_order ?? 0}</TableCell>
                                            <TableCell>
                                                <Chip
                                                    size="small"
                                                    label={banner.is_active ? 'Aktif' : 'Nonaktif'}
                                                    color={banner.is_active ? 'success' : 'default'}
                                                    variant={banner.is_active ? 'filled' : 'outlined'}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Box sx={{ display: 'flex', gap: 0.5 }}>
                                                    <Button size="small" variant="outlined" onClick={() => toggleBanner(banner)}>
                                                        {banner.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                                                    </Button>
                                                    <IconButton size="small" color="error" onClick={() => deleteBanner(banner.id)}>
                                                        <DeleteOutlineIcon fontSize="small" />
                                                    </IconButton>
                                                </Box>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {banners.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={5} sx={{ textAlign: 'center', py: 4 }}>
                                                <Typography variant="body2" color="text.secondary">Belum ada banner.</Typography>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Box>
                )}

                {/* Official Info Tab */}
                {activeTab === 4 && (
                    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Typography variant="subtitle1" fontWeight={600}>Kelola Informasi Resmi</Typography>

                        <Card variant="outlined">
                            <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                <Typography variant="body2" fontWeight={700}>Panduan & Bantuan</Typography>
                                {!guideHelpEditing ? (
                                    <>
                                        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.75 }}>
                                            {guideHelpPost?.content || 'Belum ada konten panduan.'}
                                        </Typography>
                                        <Box>
                                            <Button
                                                variant="outlined"
                                                size="small"
                                                onClick={() => {
                                                    setGuideHelpDraft({
                                                        title: String(guideHelpPost?.title || 'Panduan & Bantuan'),
                                                        content: String(guideHelpPost?.content || ''),
                                                    });
                                                    setGuideHelpEditing(true);
                                                }}
                                            >
                                                Edit Panduan & Bantuan
                                            </Button>
                                        </Box>
                                    </>
                                ) : (
                                    <>
                                        <TextField
                                            size="small"
                                            label="Judul Panduan"
                                            value={guideHelpDraft.title}
                                            onChange={(e) => setGuideHelpDraft((prev) => ({ ...prev, title: e.target.value }))}
                                        />
                                        <TextField
                                            multiline
                                            minRows={4}
                                            size="small"
                                            label="Konten Panduan"
                                            value={guideHelpDraft.content}
                                            onChange={(e) => setGuideHelpDraft((prev) => ({ ...prev, content: e.target.value }))}
                                        />
                                        <Box sx={{ display: 'flex', gap: 1 }}>
                                            <Button variant="contained" size="small" onClick={saveGuideHelpPost} disabled={guideHelpSaving || loading}>
                                                {guideHelpSaving ? 'Menyimpan...' : 'Simpan Panduan & Bantuan'}
                                            </Button>
                                            <Button
                                                variant="outlined"
                                                size="small"
                                                onClick={() => {
                                                    setGuideHelpEditing(false);
                                                    setGuideHelpDraft({
                                                        title: String(guideHelpPost?.title || 'Panduan & Bantuan'),
                                                        content: String(guideHelpPost?.content || ''),
                                                    });
                                                }}
                                                disabled={guideHelpSaving}
                                            >
                                                Batal
                                            </Button>
                                        </Box>
                                    </>
                                )}
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, flexWrap: 'wrap' }}>
                                    <Typography variant="caption" color="text.secondary">
                                        Tidak bisa dihapus. Bisa diedit kapan saja.
                                        {' '}
                                        Updated at: {guideHelpPost ? formatDateTime(guideHelpPost.updated_at) : '-'}
                                    </Typography>
                                </Box>
                            </CardContent>
                        </Card>

                        <Card variant="outlined">
                            <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                <Typography variant="body2" fontWeight={600}>Buat Informasi Baru</Typography>
                                <TextField
                                    size="small"
                                    label="Judul"
                                    value={newOfficialPost.title}
                                    onChange={(e) => setNewOfficialPost((prev) => ({ ...prev, title: e.target.value }))}
                                />
                                <TextField
                                    select
                                    size="small"
                                    label="Tipe"
                                    value={newOfficialPost.type}
                                    onChange={(e) => setNewOfficialPost((prev) => ({ ...prev, type: e.target.value }))}
                                    sx={{ maxWidth: 240 }}
                                >
                                    <MenuItem value="info">Info</MenuItem>
                                    <MenuItem value="update">Update</MenuItem>
                                    <MenuItem value="tip">Tip</MenuItem>
                                    <MenuItem value="warning">Warning</MenuItem>
                                </TextField>
                                <TextField
                                    multiline
                                    minRows={3}
                                    size="small"
                                    label="Konten"
                                    value={newOfficialPost.content}
                                    onChange={(e) => setNewOfficialPost((prev) => ({ ...prev, content: e.target.value }))}
                                />
                                <Box>
                                    <Button variant="contained" size="small" onClick={createOfficialPost} disabled={loading}>
                                        Publish
                                    </Button>
                                </Box>
                            </CardContent>
                        </Card>

                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Typography variant="body2" fontWeight={600}>Daftar Informasi Resmi</Typography>
                            <IconButton size="small" onClick={fetchOfficialPosts}>
                                <RefreshIcon fontSize="small" />
                            </IconButton>
                        </Box>

                        <TableContainer>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 600 }}>Judul</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>Tipe</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>Updated At</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>Aksi</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {regularOfficialPosts.map((post) => (
                                        <TableRow key={post.id} hover>
                                            <TableCell>
                                                <Typography variant="body2" fontWeight={600}>{post.title}</Typography>
                                                <Typography variant="caption" color="text.secondary">{post.content}</Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Chip size="small" label={post.type || 'info'} />
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    size="small"
                                                    label={post.is_active ? 'Aktif' : 'Nonaktif'}
                                                    color={post.is_active ? 'success' : 'default'}
                                                    variant={post.is_active ? 'filled' : 'outlined'}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="caption" color="text.secondary">
                                                    {formatDateTime(post.updated_at)}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Box sx={{ display: 'flex', gap: 0.5 }}>
                                                    <Button
                                                        size="small"
                                                        variant="outlined"
                                                        onClick={() => toggleOfficialPost(post)}
                                                    >
                                                        {post.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                                                    </Button>
                                                    <IconButton size="small" color="error" onClick={() => deleteOfficialPost(post.id)}>
                                                        <DeleteOutlineIcon fontSize="small" />
                                                    </IconButton>
                                                </Box>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {regularOfficialPosts.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={5} sx={{ textAlign: 'center', py: 3 }}>
                                                <Typography variant="body2" color="text.secondary">Belum ada informasi resmi selain Panduan & Bantuan.</Typography>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Box>
                )}

                {/* Voucher Tab */}
                {activeTab === 5 && (
                    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Typography variant="subtitle1" fontWeight={600}>Manajemen Voucher</Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                <Button size="small" variant="contained" onClick={() => setVoucherCreateOpen(true)} sx={{ textTransform: 'none' }}>
                                    Buat Voucher
                                </Button>
                                <IconButton size="small" onClick={fetchVouchers}>
                                    <RefreshIcon fontSize="small" />
                                </IconButton>
                            </Box>
                        </Box>

                        <TableContainer>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 600 }}>Kode</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>Tipe</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>Nilai</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>Min Belanja</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>Min/Maks Diskon</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>Kuota</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>Berlaku</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>Aksi</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {vouchers.map((v) => {
                                        return (
                                            <TableRow key={v.id} hover>
                                                <TableCell>
                                                    <Typography variant="body2" fontWeight={700}>{v.code}</Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Chip size="small" label={v.discount_type} />
                                                </TableCell>
                                                <TableCell>
                                                    <Typography variant="body2">{v.discount_type === 'percentage' ? `${v.discount_value}%` : `Rp ${formatIDRNumber(v.discount_value || 0)}`}</Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Typography variant="body2">Rp {formatIDRNumber(v.min_order_amount || 0)}</Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Typography variant="caption" color="text.secondary">
                                                        Rp {formatIDRNumber(v.min_discount_amount || 0)} / {v.max_discount_amount > 0 ? `Rp ${formatIDRNumber(v.max_discount_amount)}` : 'tanpa batas'}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {v.usage_limit > 0 ? `${v.used_count}/${v.usage_limit}` : `${v.used_count} / unlimited`} • {String(v.usage_scope || 'global') === 'per_user' ? 'per user' : 'kumulatif'}
                                                        </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Chip size="small" label={v.applies_to || 'all'} variant="outlined" />
                                                </TableCell>
                                                <TableCell>
                                                    <Chip size="small" label={v.is_active ? 'Aktif' : 'Nonaktif'} color={v.is_active ? 'success' : 'default'} variant={v.is_active ? 'filled' : 'outlined'} />
                                                </TableCell>
                                                <TableCell>
                                                    <Box sx={{ display: 'flex', gap: 0.25 }}>
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => setEditingVoucher({
                                                                ...v,
                                                                discount_value: String(v.discount_value ?? 0),
                                                                min_order_amount: String(v.min_order_amount ?? 0),
                                                                min_discount_amount: String(v.min_discount_amount ?? 0),
                                                                max_discount_amount: String(v.max_discount_amount ?? 0),
                                                                usage_scope: String(v.usage_scope || 'global'),
                                                                usage_limit: String(v.usage_limit ?? 0),
                                                            })}
                                                        >
                                                            <EditIcon fontSize="small" />
                                                        </IconButton>
                                                        <IconButton size="small" color="error" onClick={() => setVoucherDeleteTarget(v)}>
                                                            <DeleteOutlineIcon fontSize="small" />
                                                        </IconButton>
                                                    </Box>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}

                                    {vouchers.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={9} sx={{ textAlign: 'center', py: 3 }}>
                                                <Typography variant="body2" color="text.secondary">Belum ada voucher.</Typography>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>

                    </Box>
                )}

                {/* Top Up Tab */}
                {activeTab === 6 && (
                    <Box sx={{ p: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="subtitle1" fontWeight={600}>
                                    Permintaan Top Up
                                </Typography>
                            </Box>
                            <IconButton size="small" onClick={() => fetchTopupRequests(topupPage)}>
                                <RefreshIcon fontSize="small" />
                            </IconButton>
                        </Box>

                        <Alert severity="info" sx={{ mb: 2 }}>
                            Pending = belum diputus. Semua keputusan akan mengirim notifikasi ke user.
                        </Alert>

                        <TableContainer>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 600 }}>ID</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>Serial</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>Tanggal</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>User</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>Nominal</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>Metode</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>Alasan</TableCell>
                                        <TableCell sx={{ fontWeight: 600, width: 180 }}>Aksi</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {topupRequests.map((t) => (
                                        <TableRow key={t.id} hover>
                                            <TableCell>{t.id}</TableCell>
                                            <TableCell>
                                                <Typography
                                                    variant="caption"
                                                    sx={{
                                                        fontFamily:
                                                            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                                                    }}
                                                >
                                                    {t.serial || '-'}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="caption" color="text.secondary">
                                                    {formatDateTime(t.created_at)}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2" fontWeight={600}>{t.username || `user_id=${t.user_id}`}</Typography>
                                                <Typography variant="caption" color="text.secondary">user_id={t.user_id}</Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2" fontWeight={500} color="primary.main">
                                                    {formatIDRNumber(Number(t.amount || 0))}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2">{t.payment_method || '-'}</Typography>
                                                <Typography variant="caption" color="text.secondary">{t.payment_account || ''}</Typography>
                                            </TableCell>
                                            <TableCell>
                                                {t.status === 'approved' ? (
                                                    <Chip size="small" label="approved" color="success" />
                                                ) : t.status === 'rejected' ? (
                                                    <Chip size="small" label="rejected" color="error" />
                                                ) : (
                                                    <Chip size="small" label="pending" color="warning" variant="outlined" />
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="caption" color="text.secondary">
                                                    {t.admin_reason || '-'}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                {t.status === 'pending' ? (
                                                    <Box sx={{ display: 'flex', gap: 1 }}>
                                                        <Button
                                                            size="small"
                                                            variant="contained"
                                                            color="success"
                                                            disabled={loading}
                                                            onClick={() => openTopupDecision(t.id, 'approved')}
                                                            sx={{ textTransform: 'none' }}
                                                        >
                                                            ACC
                                                        </Button>
                                                        <Button
                                                            size="small"
                                                            variant="outlined"
                                                            color="error"
                                                            disabled={loading}
                                                            onClick={() => openTopupDecision(t.id, 'rejected')}
                                                            sx={{ textTransform: 'none' }}
                                                        >
                                                            Reject
                                                        </Button>
                                                    </Box>
                                                ) : (
                                                    <Typography variant="caption" color="text.disabled">Selesai</Typography>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}

                                    {topupRequests.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={9} sx={{ textAlign: 'center', py: 4 }}>
                                                <Typography variant="body2" color="text.secondary">
                                                    Belum ada permintaan top up.
                                                </Typography>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>

                        <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                            <Typography variant="caption" color="text.secondary">
                                Menampilkan {topupRequests.length} data per halaman ({topupPageSize}/page). Pending selalu di urutan teratas.
                            </Typography>
                            <Pagination
                                size="small"
                                color="primary"
                                page={topupPage}
                                count={Math.max(1, topupTotalPages)}
                                onChange={(_, pageValue) => fetchTopupRequests(pageValue)}
                                disabled={loading || topupTotalPages <= 1}
                            />
                        </Box>
                    </Box>
                )}
            </Paper>

            <Dialog open={topupDecisionOpen} onClose={closeTopupDecision} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ fontWeight: 800 }}>
                    {topupDecisionStatus === 'approved' ? 'ACC Top Up' : 'Reject Top Up'}
                </DialogTitle>
                <DialogContent sx={{ pt: 1 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                        ID: <strong>{topupDecisionId || '-'}</strong>
                    </Typography>
                    <TextField
                        autoFocus
                        fullWidth
                        size="small"
                        label={topupDecisionStatus === 'approved' ? 'Alasan (opsional)' : 'Alasan penolakan (wajib)'}
                        value={topupDecisionReason}
                        onChange={(e) => setTopupDecisionReason(e.target.value)}
                        multiline
                        minRows={2}
                        placeholder={topupDecisionStatus === 'approved' ? 'Contoh: sudah masuk' : 'Contoh: bukti transfer tidak sesuai'}
                        disabled={loading}
                    />
                    <Alert severity={topupDecisionStatus === 'approved' ? 'info' : 'warning'} sx={{ mt: 2 }}>
                        Keputusan akan mengubah status top up dan mengirim notifikasi ke user.
                    </Alert>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2.5 }}>
                    <Button onClick={closeTopupDecision} variant="outlined" disabled={loading} sx={{ textTransform: 'none' }}>
                        Batal
                    </Button>
                    <Button
                        onClick={decideTopup}
                        variant="contained"
                        color={topupDecisionStatus === 'approved' ? 'success' : 'error'}
                        disabled={loading}
                        sx={{ textTransform: 'none', fontWeight: 800 }}
                    >
                        {topupDecisionStatus === 'approved' ? 'ACC' : 'Reject'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={userEditOpen} onClose={closeUserEditDialog} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ fontWeight: 800 }}>Edit user</DialogTitle>
                <DialogContent sx={{ pt: 1 }}>
                    <Box sx={{ display: 'grid', gap: 1.25 }}>
                        <TextField
                            fullWidth
                            size="small"
                            label="Email"
                            value={userEditTarget?.email || ''}
                            disabled
                        />
                        <TextField
                            fullWidth
                            size="small"
                            label="Nama"
                            value={getUserDisplayName(userEditTarget)}
                            disabled
                        />
                    </Box>

                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.25, mt: 1.5 }}>
                        <TextField
                            fullWidth
                            size="small"
                            type="number"
                            label="Saldo"
                            value={userEditBalance}
                            onChange={(e) => setUserEditBalance(e.target.value)}
                            InputProps={{
                                startAdornment: <InputAdornment position="start">IDR</InputAdornment>,
                            }}
                        />
                        <FormControlLabel
                            sx={{ m: 0, px: 1, border: '1px solid', borderColor: 'divider', minHeight: 40 }}
                            control={<Switch checked={userEditActive} onChange={(e) => setUserEditActive(e.target.checked)} size="small" />}
                            label={userEditActive ? 'Status: Aktif' : 'Status: Nonaktif'}
                        />
                    </Box>

                    <Paper variant="outlined" sx={{ mt: 1.75, p: 1.5, borderRadius: 0 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                            Info akun
                        </Typography>
                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 0.75 }}>
                            <Typography variant="caption">ID: <strong>{userEditTarget?.id || '-'}</strong></Typography>
                            <Typography variant="caption">Role: <strong>{userEditTarget?.role || '-'}</strong></Typography>
                            <Typography variant="caption">Dibuat: <strong>{formatDateTime(userEditTarget?.created_at)}</strong></Typography>
                            <Typography variant="caption">Folder: <strong>{userEditTarget?.pikpak_folder_name || '-'}</strong></Typography>
                            <Typography variant="caption">Total download: <strong>{formatIDRNumber(userEditTarget?.total_downloads || 0)}</strong></Typography>
                            <Typography variant="caption">Torrent: <strong>{formatIDRNumber(userEditTarget?.torrent_count || 0)}</strong></Typography>
                            <Typography variant="caption">URL Premium: <strong>{formatIDRNumber(userEditTarget?.premium_count || 0)}</strong></Typography>
                        </Box>
                    </Paper>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2.5 }}>
                    <Button onClick={closeUserEditDialog} variant="outlined" sx={{ textTransform: 'none' }}>
                        Batal
                    </Button>
                    <Button onClick={saveUserEdit} variant="contained" disabled={loading} sx={{ textTransform: 'none', fontWeight: 700 }}>
                        Simpan Perubahan
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={voucherCreateOpen} onClose={() => setVoucherCreateOpen(false)} maxWidth="md" fullWidth scroll="paper">
                <DialogTitle sx={{ fontWeight: 800 }}>Buat Voucher Baru</DialogTitle>
                <DialogContent sx={{ pt: 1, maxHeight: '72vh', overflowY: 'auto' }}>
                    <Box sx={{ display: 'grid', gap: 2}}>
                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 1, mb: 0.5, mt:2}}>
                            <TextField size="small" sx={voucherFieldSx} label="Kode" value={newVoucher.code} onChange={(e) => setNewVoucher((p) => ({ ...p, code: e.target.value.toUpperCase() }))} />
                            <TextField size="small" sx={voucherFieldSx} label="Nama" value={newVoucher.name} onChange={(e) => setNewVoucher((p) => ({ ...p, name: e.target.value }))} />
                            <TextField
                                select
                                size="small"
                                sx={voucherFieldSx}
                                label="Berlaku Untuk"
                                value={newVoucher.applies_to}
                                onChange={(e) => setNewVoucher((p) => ({ ...p, applies_to: e.target.value }))}
                            >
                                <MenuItem value="all">Semua</MenuItem>
                                <MenuItem value="torrent">Torrent</MenuItem>
                                <MenuItem value="premium">Premium</MenuItem>
                            </TextField>
                        </Box>

                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '180px 1fr 1fr' }, gap: 1, mb: 0.5 }}>
                            <TextField
                                select
                                size="small"
                                sx={voucherFieldSx}
                                label="Tipe Diskon"
                                value={newVoucher.discount_type}
                                onChange={(e) => setNewVoucher((p) => ({ ...p, discount_type: e.target.value }))}
                            >
                                <MenuItem value="percentage">Persentase (%)</MenuItem>
                                <MenuItem value="fixed">Nominal Tetap (Rp)</MenuItem>
                            </TextField>
                            <TextField size="small" type="text" sx={voucherFieldSx} label="Nilai Diskon" value={newVoucher.discount_value} onChange={(e) => setNewVoucher((p) => ({ ...p, discount_value: sanitizeNumericInput(e.target.value) }))} inputProps={{ inputMode: 'numeric' }} />
                            <TextField size="small" type="text" sx={voucherFieldSx} label="Minimal Belanja" value={newVoucher.min_order_amount} onChange={(e) => setNewVoucher((p) => ({ ...p, min_order_amount: sanitizeNumericInput(e.target.value) }))} inputProps={{ inputMode: 'numeric' }} />
                        </Box>

                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 1, mb: 0.5 }}>
                            <TextField size="small" type="text" sx={voucherFieldSx} label="Minimal Diskon" value={newVoucher.min_discount_amount} onChange={(e) => setNewVoucher((p) => ({ ...p, min_discount_amount: sanitizeNumericInput(e.target.value) }))} inputProps={{ inputMode: 'numeric' }} />
                            <TextField size="small" type="text" sx={voucherFieldSx} label="Maksimal Diskon (0=tanpa batas)" value={newVoucher.max_discount_amount} onChange={(e) => setNewVoucher((p) => ({ ...p, max_discount_amount: sanitizeNumericInput(e.target.value) }))} inputProps={{ inputMode: 'numeric' }} />
                            <TextField size="small" type="text" sx={voucherFieldSx} label="Kuota Pakai (0=unlimited)" value={newVoucher.usage_limit} onChange={(e) => setNewVoucher((p) => ({ ...p, usage_limit: sanitizeNumericInput(e.target.value) }))} inputProps={{ inputMode: 'numeric' }} />
                        </Box>

                        <FormControlLabel
                            sx={{ m: 0, mb: 0.5 }}
                            control={<Switch checked={newVoucher.usage_scope === 'per_user'} onChange={(e) => setNewVoucher((p) => ({ ...p, usage_scope: e.target.checked ? 'per_user' : 'global' }))} size="small" />}
                            label={newVoucher.usage_scope === 'per_user' ? 'Kuota dihitung per user' : 'Kuota dihitung kumulatif keseluruhan'}
                        />

                        <TextField
                            size="small"
                                sx={voucherFieldSx}
                            label="Deskripsi"
                            value={newVoucher.description}
                            onChange={(e) => setNewVoucher((p) => ({ ...p, description: e.target.value }))}
                        />
                    </Box>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2.5 }}>
                    <Button variant="outlined" onClick={() => setVoucherCreateOpen(false)} sx={{ textTransform: 'none' }}>
                        Batal
                    </Button>
                    <Button
                        variant="contained"
                        onClick={async () => {
                            const ok = await createVoucher();
                            if (ok) setVoucherCreateOpen(false);
                        }}
                        disabled={loading}
                        sx={{ textTransform: 'none', fontWeight: 700 }}
                    >
                        Simpan Voucher
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={!!editingVoucher} onClose={() => setEditingVoucher(null)} maxWidth="md" fullWidth>
                <DialogTitle sx={{ fontWeight: 800 }}>Edit Voucher</DialogTitle>
                <DialogContent sx={{ pt: 1, maxHeight: '72vh', overflowY: 'auto' }}>
                    <Box sx={{ display: 'grid', gap: 2 }}>
                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 1, mb: 0.5, mt:2     }}>
                            <TextField size="small" sx={voucherFieldSx} label="Kode" value={editingVoucher?.code || ''} onChange={(e) => setEditingVoucher((p) => ({ ...p, code: e.target.value.toUpperCase() }))} />
                            <TextField size="small" sx={voucherFieldSx} label="Nama" value={editingVoucher?.name || ''} onChange={(e) => setEditingVoucher((p) => ({ ...p, name: e.target.value }))} />
                            <TextField
                                select
                                size="small"
                                sx={voucherFieldSx}
                                label="Berlaku Untuk"
                                value={editingVoucher?.applies_to || 'all'}
                                onChange={(e) => setEditingVoucher((p) => ({ ...p, applies_to: e.target.value }))}
                            >
                                <MenuItem value="all">Semua</MenuItem>
                                <MenuItem value="torrent">Torrent</MenuItem>
                                <MenuItem value="premium">Premium</MenuItem>
                            </TextField>
                        </Box>

                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '180px 1fr 1fr' }, gap: 1, mb: 0.5 }}>
                            <TextField
                                select
                                size="small"
                                sx={voucherFieldSx}
                                label="Tipe Diskon"
                                value={editingVoucher?.discount_type || 'percentage'}
                                onChange={(e) => setEditingVoucher((p) => ({ ...p, discount_type: e.target.value }))}
                            >
                                <MenuItem value="percentage">Persentase (%)</MenuItem>
                                <MenuItem value="fixed">Nominal Tetap (Rp)</MenuItem>
                            </TextField>
                            <TextField size="small" type="text" sx={voucherFieldSx} label="Nilai Diskon" value={editingVoucher?.discount_value ?? ''} onChange={(e) => setEditingVoucher((p) => ({ ...p, discount_value: sanitizeNumericInput(e.target.value) }))} inputProps={{ inputMode: 'numeric' }} />
                            <TextField size="small" type="text" sx={voucherFieldSx} label="Minimal Belanja" value={editingVoucher?.min_order_amount ?? ''} onChange={(e) => setEditingVoucher((p) => ({ ...p, min_order_amount: sanitizeNumericInput(e.target.value) }))} inputProps={{ inputMode: 'numeric' }} />
                        </Box>

                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 1, mb: 0.5 }}>
                            <TextField size="small" type="text" sx={voucherFieldSx} label="Minimal Diskon" value={editingVoucher?.min_discount_amount ?? ''} onChange={(e) => setEditingVoucher((p) => ({ ...p, min_discount_amount: sanitizeNumericInput(e.target.value) }))} inputProps={{ inputMode: 'numeric' }} />
                            <TextField size="small" type="text" sx={voucherFieldSx} label="Maksimal Diskon (0=tanpa batas)" value={editingVoucher?.max_discount_amount ?? ''} onChange={(e) => setEditingVoucher((p) => ({ ...p, max_discount_amount: sanitizeNumericInput(e.target.value) }))} inputProps={{ inputMode: 'numeric' }} />
                            <TextField size="small" type="text" sx={voucherFieldSx} label="Kuota Pakai (0=unlimited)" value={editingVoucher?.usage_limit ?? ''} onChange={(e) => setEditingVoucher((p) => ({ ...p, usage_limit: sanitizeNumericInput(e.target.value) }))} inputProps={{ inputMode: 'numeric' }} />
                        </Box>

                        <FormControlLabel
                            sx={{ m: 0, mb: 0.5 }}
                            control={<Switch checked={String(editingVoucher?.usage_scope || 'global') === 'per_user'} onChange={(e) => setEditingVoucher((p) => ({ ...p, usage_scope: e.target.checked ? 'per_user' : 'global' }))} size="small" />}
                            label={String(editingVoucher?.usage_scope || 'global') === 'per_user' ? 'Kuota dihitung per user' : 'Kuota dihitung kumulatif keseluruhan'}
                        />

                        <FormControlLabel
                            sx={{ m: 0 }}
                            control={<Switch checked={!!editingVoucher?.is_active} onChange={(e) => setEditingVoucher((p) => ({ ...p, is_active: e.target.checked }))} size="small" />}
                            label={editingVoucher?.is_active ? 'Status: Aktif' : 'Status: Nonaktif'}
                        />

                        <TextField
                            size="small"
                            sx={voucherFieldSx}
                            label="Deskripsi"
                            value={editingVoucher?.description || ''}
                            onChange={(e) => setEditingVoucher((p) => ({ ...p, description: e.target.value }))}
                        />
                    </Box>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2.5 }}>
                    <Button variant="outlined" onClick={() => setEditingVoucher(null)} sx={{ textTransform: 'none' }}>
                        Batal
                    </Button>
                    <Button
                        variant="contained"
                        onClick={() => updateVoucher(editingVoucher)}
                        disabled={loading || !editingVoucher?.id}
                        sx={{ textTransform: 'none', fontWeight: 700 }}
                    >
                        Simpan Perubahan
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={!!voucherDeleteTarget} onClose={() => setVoucherDeleteTarget(null)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ fontWeight: 800 }}>Hapus Voucher</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary">
                        Yakin ingin menghapus voucher <strong>{voucherDeleteTarget?.code || '-'}</strong>?
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2.5 }}>
                    <Button variant="outlined" onClick={() => setVoucherDeleteTarget(null)} sx={{ textTransform: 'none' }}>
                        Batal
                    </Button>
                    <Button
                        variant="contained"
                        color="error"
                        onClick={() => voucherDeleteTarget?.id && deleteVoucher(voucherDeleteTarget.id)}
                        sx={{ textTransform: 'none', fontWeight: 700 }}
                    >
                        Hapus
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Snackbar for messages */}
            <Snackbar
                open={!!message}
                autoHideDuration={3000}
                onClose={() => setMessage('')}
                message={message}
                sx={{
                    '& .MuiSnackbarContent-root': {
                        maxWidth: { xs: 'calc(100vw - 32px)', sm: 'auto' },
                    },
                }}
            />
        </Box>
    );
}
