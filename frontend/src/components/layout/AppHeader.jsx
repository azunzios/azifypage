import * as React from 'react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/joy/Box';
import Typography from '@mui/joy/Typography';
import IconButton from '@mui/joy/IconButton';
import Stack from '@mui/joy/Stack';
import Avatar from '@mui/joy/Avatar';
import Input from '@mui/joy/Input';
import Tooltip from '@mui/joy/Tooltip';
import Sheet from '@mui/joy/Sheet';
import Button from '@mui/joy/Button';
import { useColorScheme } from '@mui/joy/styles';
import Dropdown from '@mui/joy/Dropdown';
import Menu from '@mui/joy/Menu';
import MenuButton from '@mui/joy/MenuButton';
import MenuItem from '@mui/joy/MenuItem';
import ListDivider from '@mui/joy/ListDivider';
import Badge from '@mui/joy/Badge';
import List from '@mui/joy/List';
import ListItem from '@mui/joy/ListItem';

import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import NotificationsIcon from '@mui/icons-material/Notifications';
import PersonIcon from '@mui/icons-material/Person';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';

import { useAuth } from '../../App';

function ColorSchemeToggle() {
    const { mode, setMode } = useColorScheme();
    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => setMounted(true), []);

    if (!mounted) {
        return <IconButton size="sm" variant="plain" color="neutral" />;
    }

    const isLight = mode === 'light';
    return (
        <Tooltip title="Ganti tema" variant="outlined">
            <IconButton
                size="sm"
                variant="plain"
                color="neutral"
                onClick={() => setMode(isLight ? 'dark' : 'light')}
            >
                {isLight ? <DarkModeRoundedIcon fontSize="small" /> : <LightModeRoundedIcon fontSize="small" />}
            </IconButton>
        </Tooltip>
    );
}

function formatIDRNumber(value) {
    const n = typeof value === 'number' ? value : parseInt(String(value || '').replace(/[^0-9]/g, ''), 10);
    const safe = Number.isFinite(n) ? n : 0;
    return safe.toLocaleString('id-ID');
}

export default function AppHeader({ onDrawerToggle }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [searchText, setSearchText] = useState('');

    useEffect(() => {
        fetch('/api/notifications')
            .then((res) => res.json())
            .then((data) => setNotifications(data || []))
            .catch(console.error);
    }, []);

    const unreadCount = notifications.filter((n) => !n.is_read).length;

    const markAsRead = async (id) => {
        await fetch('/api/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
        });
        setNotifications(notifications.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    };

    const markAllAsRead = async () => {
        await fetch('/api/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mark_all: true }),
        });
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    };

    const handleSearchEnter = async (e) => {
        if (e.key !== 'Enter') return;

        const query = searchText.trim();
        if (!query) return;
        navigate(`/search?q=${encodeURIComponent(query)}`);
    };

    return (
        <Box sx={{ display: 'flex', flexGrow: 1, justifyContent: 'space-between' }}>
            <Stack
                direction="row"
                spacing={1}
                sx={{
                    justifyContent: 'center',
                    alignItems: 'center',
                    display: { xs: 'none', sm: 'flex' },
                }}
            >
                <Box sx={{ cursor: 'pointer', display: { xs: 'none', sm: 'inline-flex' }, alignItems: 'center' }} onClick={() => navigate('/download')}>
                    <img src="/logo.svg" alt="AzifyPage" style={{ height: 28 }} />
                </Box>
                <Tooltip title="Browser / Tambah Unduhan">
                    <IconButton
                        size="md"
                        variant="outlined"
                        color="neutral"
                        sx={{ display: { xs: 'none', sm: 'inline-flex' }, borderRadius: '50%' }}
                        onClick={() => navigate('/input')}
                    >
                        <LanguageRoundedIcon />
                    </IconButton>
                </Tooltip>
            </Stack>

            <Box sx={{ display: { xs: 'inline-flex', sm: 'none' } }}>
                <IconButton variant="plain" color="neutral" onClick={onDrawerToggle}>
                    <MenuRoundedIcon />
                </IconButton>
            </Box>

            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'row',
                    gap: 1.5,
                    alignItems: 'center',
                }}
            >
                <Input
                    size="sm"
                    variant="outlined"
                    placeholder="Search anything…"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    onKeyDown={handleSearchEnter}
                    startDecorator={<SearchRoundedIcon color="primary" />}
                    sx={{
                        alignSelf: 'center',
                        display: {
                            xs: 'none',
                            sm: 'flex',
                        },
                    }}
                />

                <ColorSchemeToggle />

                <Sheet
                    variant="outlined"
                    color="neutral"
                    onClick={() => navigate('/balance')}
                    sx={{
                        cursor: 'pointer',
                        display: { xs: 'none', sm: 'inline-flex' },
                        alignItems: 'center',
                        gap: 0.75,
                        px: 1.35,
                        py: 0.55,
                        borderRadius: 999,
                        boxShadow: 'none',
                        borderColor: 'primary.400',
                        color: 'primary.600',
                        backgroundColor: 'transparent',
                        transition: 'none',
                    }}
                >
                    <AccountBalanceWalletIcon fontSize="small" />
                    <Typography level="body-sm" sx={{ fontWeight: 700, lineHeight: 1 }}>
                        {formatIDRNumber(user?.balance ?? user?.balance_formatted)}
                    </Typography>
                </Sheet>

                <Tooltip title="Saldo">
                    <IconButton
                        variant="plain"
                        color="neutral"
                        onClick={() => navigate('/balance')}
                        sx={{ display: { xs: 'inline-flex', sm: 'none' } }}
                    >
                        <AccountBalanceWalletIcon fontSize="small" />
                    </IconButton>
                </Tooltip>

                <Dropdown>
                    <MenuButton variant="plain" size="sm">
                        <Badge badgeContent={unreadCount} color="danger" size="sm">
                            <NotificationsIcon fontSize="small" />
                        </Badge>
                    </MenuButton>
                    <Menu
                        placement="bottom-end"
                        size="sm"
                        sx={{
                            zIndex: '99999',
                            p: 1,
                            width: 520,
                            maxWidth: 'calc(100vw - 24px)',
                            maxHeight: 360,
                            overflow: 'auto',
                        }}
                    >
                        <Box sx={{ px: 1, pb: 0.75, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Typography level="title-sm">Notifikasi</Typography>
                            {unreadCount > 0 ? (
                                <Button
                                    size="sm"
                                    variant="plain"
                                    color="primary"
                                    onClick={markAllAsRead}
                                    sx={{ px: 0.5, minHeight: 28 }}
                                >
                                    Baca semua
                                </Button>
                            ) : null}
                        </Box>
                        <ListDivider />
                        {notifications.length === 0 ? (
                            <MenuItem disabled>Belum ada notifikasi</MenuItem>
                        ) : (
                            notifications.map((notif) => (
                                <ListItem key={notif.id} sx={{ p: 0 }}>
                                    <MenuItem
                                        onClick={() => markAsRead(notif.id)}
                                        sx={{
                                            width: '100%',
                                            alignItems: 'flex-start',
                                            bgcolor: !notif.is_read ? 'primary.softBg' : undefined,
                                        }}
                                    >
                                        <Box sx={{ width: '100%', minWidth: 0 }}>
                                            <Typography level="title-sm">{notif.title}</Typography>
                                            <Typography
                                                level="body-xs"
                                                sx={{
                                                    mt: 0.25,
                                                    width: '100%',
                                                    maxWidth: '100%',
                                                    overflowX: 'auto',
                                                    overflowY: 'hidden',
                                                    whiteSpace: 'nowrap',
                                                    display: 'block',
                                                    pr: 1,
                                                }}
                                            >
                                                {notif.message}
                                            </Typography>
                                        </Box>
                                    </MenuItem>
                                </ListItem>
                            ))
                        )}
                    </Menu>
                </Dropdown>

                <Dropdown>
                    <MenuButton variant="plain" size="sm" sx={{ maxWidth: '32px', maxHeight: '32px', borderRadius: '9999999px' }}>
                        <Avatar src={user?.picture || ''} sx={{ maxWidth: '32px', maxHeight: '32px' }}>
                            {user?.email?.charAt(0).toUpperCase() || 'U'}
                        </Avatar>
                    </MenuButton>
                    <Menu placement="bottom-end" size="sm" sx={{ zIndex: '99999', p: 1, gap: 1, '--ListItem-radius': 'var(--joy-radius-sm)' }}>
                        <MenuItem>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <Avatar src={user?.picture || ''} sx={{ borderRadius: '50%' }}>
                                    {user?.email?.charAt(0).toUpperCase() || 'U'}
                                </Avatar>
                                <Box sx={{ ml: 1.5 }}>
                                    <Typography level="title-sm" textColor="text.primary">
                                        {user?.name || 'User'}
                                    </Typography>
                                    <Typography level="body-xs" textColor="text.tertiary">
                                        {user?.email || ''}
                                    </Typography>
                                </Box>
                            </Box>
                        </MenuItem>
                        <ListDivider />
                        <MenuItem onClick={() => navigate('/profile')}>
                            <PersonIcon fontSize="small" />
                            Atur Profil
                        </MenuItem>
                        <ListDivider />
                        <MenuItem onClick={logout}>
                            <LogoutRoundedIcon fontSize="small" />
                            Keluar
                        </MenuItem>
                    </Menu>
                </Dropdown>
            </Box>
        </Box>
    );
}
