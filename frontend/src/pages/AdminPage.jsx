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
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import RefreshIcon from '@mui/icons-material/Refresh';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import PeopleIcon from '@mui/icons-material/People';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

export default function AdminPage() {
    const [activeTab, setActiveTab] = useState(0);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    // Pricing state
    const [pricing, setPricing] = useState([]);
    const [editingPricing, setEditingPricing] = useState(null);

    // Users state
    const [users, setUsers] = useState([]);

    // Hosts state
    const [hosts, setHosts] = useState([]);
    const [newHostName, setNewHostName] = useState('');
    const [editingHostId, setEditingHostId] = useState(null);
    const [editingHostName, setEditingHostName] = useState('');

    // Official posts state
    const [officialPosts, setOfficialPosts] = useState([]);
    const [newOfficialPost, setNewOfficialPost] = useState({ title: '', content: '', type: 'info' });

    // Banner state
    const [banners, setBanners] = useState([]);
    const [newBanner, setNewBanner] = useState({ title: '', description: '', image: '', color: '', sort_order: 0 });
    const [uploadingBannerImage, setUploadingBannerImage] = useState(false);
    const [bannerImageInfo, setBannerImageInfo] = useState(null);

    // Stats
    const [stats, setStats] = useState({ users: 0, transactions: 0, revenue: 0 });

    useEffect(() => {
        fetchPricing();
        fetchUsers();
        fetchStats();
        fetchHosts();
        fetchBanners();
        fetchOfficialPosts();
    }, []);

    const fetchPricing = async () => {
        try {
            const res = await fetch('/api/pricing');
            const data = await res.json();
            setPricing(data);
        } catch (err) {
            console.error('Failed to fetch pricing:', err);
        }
    };

    const fetchUsers = async () => {
        try {
            const res = await fetch('/api/admin/users');
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
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

    const updateUserBalance = async (userId, amount) => {
        try {
            const res = await fetch('/api/admin/user/balance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, amount: parseInt(amount) }),
            });
            if (res.ok) {
                setMessage('Saldo berhasil diupdate!');
                fetchUsers();
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

    return (
        <Box sx={{ maxWidth: 936, margin: 'auto' }}>
            {/* Stats Cards */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2, mb: 3 }}>
                <Card variant="outlined">
                    <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <PeopleIcon color="primary" />
                        <Box>
                            <Typography variant="caption" color="text.secondary">Total Users</Typography>
                            <Typography variant="h5" fontWeight={700}>{stats.users || users.length}</Typography>
                        </Box>
                    </CardContent>
                </Card>
                <Card variant="outlined">
                    <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <ReceiptLongIcon color="primary" />
                        <Box>
                            <Typography variant="caption" color="text.secondary">Transaksi</Typography>
                            <Typography variant="h5" fontWeight={700}>{stats.transactions || 0}</Typography>
                        </Box>
                    </CardContent>
                </Card>
                <Card variant="outlined">
                    <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <AttachMoneyIcon color="success" />
                        <Box>
                            <Typography variant="caption" color="text.secondary">Revenue</Typography>
                            <Typography variant="h5" fontWeight={700} color="success.main">
                                Rp {(stats.revenue || 0).toLocaleString()}
                            </Typography>
                        </Box>
                    </CardContent>
                </Card>
            </Box>

            {/* Tabs Content */}
            <Paper variant="outlined">
                <Tabs
                    value={activeTab}
                    onChange={(e, v) => setActiveTab(v)}
                    sx={{ borderBottom: '1px solid', borderColor: 'divider', px: 2 }}
                >
                    <Tab label="Harga" sx={{ textTransform: 'none' }} />
                    <Tab label="Users" sx={{ textTransform: 'none' }} />
                    <Tab label="Available Host" sx={{ textTransform: 'none' }} />
                    <Tab label="Banner" sx={{ textTransform: 'none' }} />
                    <Tab label="Informasi Resmi" sx={{ textTransform: 'none' }} />
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
                                                        <Typography variant="body2" color="primary.main" fontWeight={600}>
                                                            Rp {p.price_per_unit?.toLocaleString()}
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

                        <TableContainer>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 600 }}>ID</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>Email</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>Saldo</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>Folder</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>Aksi</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {users.map((user) => (
                                        <TableRow key={user.id} hover>
                                            <TableCell>{user.id}</TableCell>
                                            <TableCell>
                                                <Typography variant="body2" fontWeight={500}>{user.email}</Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2" color="success.main" fontWeight={500}>
                                                    Rp {user.balance?.toLocaleString()}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                                                    {user.pikpak_folder_name || '-'}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                    <TextField
                                                        type="number"
                                                        placeholder="Amount"
                                                        size="small"
                                                        id={`balance-${user.id}`}
                                                        sx={{ width: 100 }}
                                                        inputProps={{ style: { fontSize: 12, padding: '6px 8px' } }}
                                                    />
                                                    <Button
                                                        variant="contained"
                                                        size="small"
                                                        sx={{ minWidth: 'auto', fontSize: 12 }}
                                                        onClick={() => {
                                                            const input = document.getElementById(`balance-${user.id}`);
                                                            if (input.value) updateUserBalance(user.id, input.value);
                                                        }}
                                                    >
                                                        +/-
                                                    </Button>
                                                </Box>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {users.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={5} sx={{ textAlign: 'center', py: 5 }}>
                                                <Typography variant="body2" color="text.disabled">
                                                    Belum ada user terdaftar
                                                </Typography>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
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
                                        <TableCell sx={{ fontWeight: 600 }}>Aksi</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {officialPosts.map((post) => (
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
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Box>
                )}
            </Paper>

            {/* Snackbar for messages */}
            <Snackbar
                open={!!message}
                autoHideDuration={3000}
                onClose={() => setMessage('')}
                message={message}
            />
        </Box>
    );
}
