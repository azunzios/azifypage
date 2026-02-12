import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemText from '@mui/material/ListItemText';
import Avatar from '@mui/material/Avatar';
import Paper from '@mui/material/Paper';
import Divider from '@mui/material/Divider';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import HistoryIcon from '@mui/icons-material/History';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';

export default function TopUpPage() {
    const [user, setUser] = useState(null);
    const [transactions, setTransactions] = useState([]);

    useEffect(() => {
        fetch('/api/user')
            .then((res) => res.json())
            .then((data) => setUser(data))
            .catch(console.error);

        fetch('/api/transactions')
            .then((res) => res.json())
            .then((data) => setTransactions(data || []))
            .catch(console.error);
    }, []);

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <Box sx={{ maxWidth: 936, margin: 'auto' }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2.5, mb: 4 }}>
                {/* Balance Card */}
                <Card variant="outlined" sx={{ position: 'relative', overflow: 'hidden', bgcolor: 'background.paper' }}>
                    <CardContent sx={{ p: 3 }}>
                        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                            Saldo Saat Ini
                        </Typography>
                        <Typography variant="h4" fontWeight={700} sx={{ mb: 3, color: 'primary.main' }}>
                            {user?.balance_formatted || 'Rp 0'}
                        </Typography>
                        <Button
                            variant="outlined"
                            color="primary"
                            sx={{ fontWeight: 600 }}
                        >
                            + Isi Saldo
                        </Button>
                    </CardContent>
                </Card>

                {/* Stats Cards */}
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                    <Card variant="outlined">
                        <CardContent>
                            <CloudDownloadIcon color="primary" sx={{ fontSize: 28, mb: 1 }} />
                            <Typography variant="h5" fontWeight={700}>
                                -
                            </Typography>
                            <Typography variant="caption" color="text.secondary" fontWeight={500}>
                                Total Diunduh
                            </Typography>
                        </CardContent>
                    </Card>
                    <Card variant="outlined">
                        <CardContent>
                            <HistoryIcon color="warning" sx={{ fontSize: 28, mb: 1 }} />
                            <Typography variant="h5" fontWeight={700}>
                                {transactions.length}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" fontWeight={500}>
                                Transaksi
                            </Typography>
                        </CardContent>
                    </Card>
                </Box>
            </Box>

            {/* Transaction History */}
            <Paper variant="outlined" sx={{ p: 1.5 }}>
                <Typography variant="subtitle2" fontWeight={700} sx={{ px: 1, pb: 1.25 }}>
                    Riwayat Transaksi
                </Typography>
                {transactions.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 5 }}>
                        Belum ada transaksi
                    </Typography>
                ) : (
                    <List disablePadding>
                        {transactions.map((tx, idx) => (
                            <React.Fragment key={tx.id}>
                                <ListItem
                                    secondaryAction={
                                        <Typography
                                            variant="body2"
                                            fontWeight={600}
                                            color={tx.amount > 0 ? 'success.main' : 'error.main'}
                                        >
                                            {tx.amount > 0 ? '+' : ''} Rp {Math.abs(tx.amount).toLocaleString('id-ID')}
                                        </Typography>
                                    }
                                >
                                    <ListItemAvatar>
                                        <Avatar
                                            sx={{
                                                bgcolor: tx.amount > 0 ? 'success.50' : 'error.50',
                                                color: tx.amount > 0 ? 'success.main' : 'error.main',
                                                width: 36,
                                                height: 36,
                                            }}
                                        >
                                            {tx.amount > 0 ? <AddIcon fontSize="small" /> : <RemoveIcon fontSize="small" />}
                                        </Avatar>
                                    </ListItemAvatar>
                                    <ListItemText
                                        primary={tx.description}
                                        secondary={formatDate(tx.created_at)}
                                        primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                                        secondaryTypographyProps={{ variant: 'caption' }}
                                    />
                                </ListItem>
                                {idx < transactions.length - 1 && <Divider component="li" />}
                            </React.Fragment>
                        ))}
                    </List>
                )}
            </Paper>
        </Box>
    );
}
