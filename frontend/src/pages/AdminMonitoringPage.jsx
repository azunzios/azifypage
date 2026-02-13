import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import RefreshIcon from '@mui/icons-material/Refresh';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Chip from '@mui/material/Chip';
import * as XLSX from 'xlsx';

export default function AdminMonitoringPage() {
    const [monitoring, setMonitoring] = useState({
        aggregate: {
            total_users: 0,
            active_users: 0,
            users_with_usage: 0,
            total_downloads: 0,
            torrent_count: 0,
            premium_url_count: 0,
        },
        top_users_by_usage: [],
        top_users_by_balance: [],
        usage_last_7_days: [],
    });
    const [users, setUsers] = useState([]);

    const formatIDRNumber = (value) => {
        const n = typeof value === 'number' ? value : parseInt(String(value || '').replace(/[^0-9]/g, ''), 10);
        const safe = Number.isFinite(n) ? n : 0;
        return safe.toLocaleString('id-ID');
    };

    const fetchMonitoring = async () => {
        try {
            const res = await fetch('/api/admin/monitoring');
            if (!res.ok) return;
            const data = await res.json();
            setMonitoring({
                aggregate: {
                    total_users: Number(data?.aggregate?.total_users || 0),
                    active_users: Number(data?.aggregate?.active_users || 0),
                    users_with_usage: Number(data?.aggregate?.users_with_usage || 0),
                    total_downloads: Number(data?.aggregate?.total_downloads || 0),
                    torrent_count: Number(data?.aggregate?.torrent_count || 0),
                    premium_url_count: Number(data?.aggregate?.premium_url_count || 0),
                },
                top_users_by_usage: Array.isArray(data?.top_users_by_usage) ? data.top_users_by_usage : [],
                top_users_by_balance: Array.isArray(data?.top_users_by_balance) ? data.top_users_by_balance : [],
                usage_last_7_days: Array.isArray(data?.usage_last_7_days) ? data.usage_last_7_days : [],
            });
        } catch (err) {
            console.error('Failed to fetch monitoring:', err);
        }
    };

    const fetchUsers = async () => {
        try {
            const res = await fetch('/api/admin/users');
            if (!res.ok) return;
            const data = await res.json();
            setUsers(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Failed to fetch users:', err);
        }
    };

    const exportToExcel = () => {
        const wb = XLSX.utils.book_new();

        const summaryRows = [
            { Metric: 'Total User', Value: monitoring.aggregate.total_users },
            { Metric: 'User Aktif', Value: monitoring.aggregate.active_users },
            { Metric: 'User Pernah Pakai', Value: monitoring.aggregate.users_with_usage },
            { Metric: 'Total Download', Value: monitoring.aggregate.total_downloads },
            { Metric: 'Pakai Torrent', Value: monitoring.aggregate.torrent_count },
            { Metric: 'Pakai URL Premium', Value: monitoring.aggregate.premium_url_count },
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Ringkasan');

        const userRows = users.map((u) => ({
            ID: u.id,
            Email: u.email,
            Role: u.role,
            Status: u.is_active ? 'Aktif' : 'Nonaktif',
            Saldo: Number(u.balance || 0),
            TotalDownload: Number(u.total_downloads || 0),
            Torrent: Number(u.torrent_count || 0),
            PremiumURL: Number(u.premium_count || 0),
            Dibuat: u.created_at || '',
            Folder: u.pikpak_folder_name || '',
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(userRows), 'Info User');

        const topUsageRows = monitoring.top_users_by_usage.map((u) => ({
            UserID: u.user_id,
            Email: u.email,
            Total: Number(u.total_usage || 0),
            Torrent: Number(u.torrent_count || 0),
            Premium: Number(u.premium_count || 0),
            Saldo: Number(u.balance || 0),
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(topUsageRows), 'Top Pemakaian');

        const topSaldoRows = monitoring.top_users_by_balance.map((u) => ({
            UserID: u.id,
            Email: u.email,
            Role: u.role,
            Status: u.is_active ? 'Aktif' : 'Nonaktif',
            Saldo: Number(u.balance || 0),
            Dibuat: u.created_at || '',
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(topSaldoRows), 'Top Saldo');

        const dailyRows = monitoring.usage_last_7_days.map((d) => ({
            Tanggal: d.date,
            Total: Number(d.total_usage || 0),
            Torrent: Number(d.torrent_count || 0),
            PremiumURL: Number(d.premium_count || 0),
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dailyRows), 'Harian7');

        const datePart = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(wb, `monitoring-pengguna-${datePart}.xlsx`);
    };

    useEffect(() => {
        fetchMonitoring();
        fetchUsers();
    }, []);

    return (
        <Box sx={{ maxWidth: 936, margin: 'auto' }}>
            <Paper variant="outlined" sx={{ p: 2.25, borderRadius: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                    <Typography variant="subtitle1" fontWeight={800}>Monitoring Pengguna</Typography>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <Button
                            size="small"
                            variant="outlined"
                            startIcon={<FileDownloadIcon fontSize="small" />}
                            onClick={exportToExcel}
                            sx={{ textTransform: 'none' }}
                        >
                            Export Excel
                        </Button>
                        <IconButton size="small" onClick={() => { fetchMonitoring(); fetchUsers(); }}>
                            <RefreshIcon fontSize="small" />
                        </IconButton>
                    </Box>
                </Box>

                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(6, 1fr)' }, gap: 1, mb: 2 }}>
                    <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 0 }}>
                        <Typography variant="caption" color="text.secondary">Total Download</Typography>
                        <Typography variant="subtitle2" fontWeight={800}>{formatIDRNumber(monitoring.aggregate.total_downloads)}</Typography>
                    </Paper>
                    <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 0 }}>
                        <Typography variant="caption" color="text.secondary">Pakai Torrent</Typography>
                        <Typography variant="subtitle2" fontWeight={800}>{formatIDRNumber(monitoring.aggregate.torrent_count)}</Typography>
                    </Paper>
                    <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 0 }}>
                        <Typography variant="caption" color="text.secondary">Pakai URL Premium</Typography>
                        <Typography variant="subtitle2" fontWeight={800}>{formatIDRNumber(monitoring.aggregate.premium_url_count)}</Typography>
                    </Paper>
                    <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 0 }}>
                        <Typography variant="caption" color="text.secondary">User Aktif</Typography>
                        <Typography variant="subtitle2" fontWeight={800}>{formatIDRNumber(monitoring.aggregate.active_users)}</Typography>
                    </Paper>
                    <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 0 }}>
                        <Typography variant="caption" color="text.secondary">User Pernah Pakai</Typography>
                        <Typography variant="subtitle2" fontWeight={800}>{formatIDRNumber(monitoring.aggregate.users_with_usage)}</Typography>
                    </Paper>
                    <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 0 }}>
                        <Typography variant="caption" color="text.secondary">Total User</Typography>
                        <Typography variant="subtitle2" fontWeight={800}>{formatIDRNumber(monitoring.aggregate.total_users)}</Typography>
                    </Paper>
                </Box>

                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
                    <Paper variant="outlined" sx={{ borderRadius: 0 }}>
                        <Box sx={{ px: 1.5, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                            <Typography variant="caption" fontWeight={700}>Top User (Pemakaian)</Typography>
                        </Box>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 600 }}>User</TableCell>
                                    <TableCell sx={{ fontWeight: 600 }}>Total</TableCell>
                                    <TableCell sx={{ fontWeight: 600 }}>Torrent</TableCell>
                                    <TableCell sx={{ fontWeight: 600 }}>Premium</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {monitoring.top_users_by_usage.map((u) => (
                                    <TableRow key={`usage-${u.user_id}`}>
                                        <TableCell>
                                            <Typography variant="caption" fontWeight={700}>{u.email}</Typography>
                                        </TableCell>
                                        <TableCell>{formatIDRNumber(u.total_usage || 0)}</TableCell>
                                        <TableCell>{formatIDRNumber(u.torrent_count || 0)}</TableCell>
                                        <TableCell>{formatIDRNumber(u.premium_count || 0)}</TableCell>
                                    </TableRow>
                                ))}
                                {monitoring.top_users_by_usage.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={4} sx={{ textAlign: 'center', py: 2 }}>
                                            <Typography variant="caption" color="text.secondary">Belum ada data pemakaian.</Typography>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </Paper>

                    <Paper variant="outlined" sx={{ borderRadius: 0 }}>
                        <Box sx={{ px: 1.5, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                            <Typography variant="caption" fontWeight={700}>Top User (Saldo)</Typography>
                        </Box>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 600 }}>User</TableCell>
                                    <TableCell sx={{ fontWeight: 600 }}>Role</TableCell>
                                    <TableCell sx={{ fontWeight: 600 }}>Saldo</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {monitoring.top_users_by_balance.map((u) => (
                                    <TableRow key={`saldo-${u.id}`}>
                                        <TableCell>
                                            <Typography variant="caption" fontWeight={700}>{u.email}</Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Chip size="small" label={u.role || '-'} variant="outlined" />
                                        </TableCell>
                                        <TableCell>{formatIDRNumber(u.balance || 0)}</TableCell>
                                    </TableRow>
                                ))}
                                {monitoring.top_users_by_balance.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={3} sx={{ textAlign: 'center', py: 2 }}>
                                            <Typography variant="caption" color="text.secondary">Belum ada data saldo.</Typography>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </Paper>
                </Box>

                <Paper variant="outlined" sx={{ borderRadius: 0, mt: 2 }}>
                    <Box sx={{ px: 1.5, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="caption" fontWeight={700}>Statistik Agregat (7 Hari Terakhir)</Typography>
                    </Box>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 600 }}>Tanggal</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>Total</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>Torrent</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>Premium URL</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {monitoring.usage_last_7_days.map((d) => (
                                <TableRow key={`daily-${d.date}`}>
                                    <TableCell>{d.date}</TableCell>
                                    <TableCell>{formatIDRNumber(d.total_usage || 0)}</TableCell>
                                    <TableCell>{formatIDRNumber(d.torrent_count || 0)}</TableCell>
                                    <TableCell>{formatIDRNumber(d.premium_count || 0)}</TableCell>
                                </TableRow>
                            ))}
                            {monitoring.usage_last_7_days.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} sx={{ textAlign: 'center', py: 2 }}>
                                        <Typography variant="caption" color="text.secondary">Belum ada data 7 hari terakhir.</Typography>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </Paper>
            </Paper>
        </Box>
    );
}
