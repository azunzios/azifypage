import * as React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Box from '@mui/joy/Box';
import List from '@mui/joy/List';
import ListSubheader from '@mui/joy/ListSubheader';
import ListItem from '@mui/joy/ListItem';
import ListItemButton from '@mui/joy/ListItemButton';
import ListItemDecorator from '@mui/joy/ListItemDecorator';
import ListItemContent from '@mui/joy/ListItemContent';
import Divider from '@mui/joy/Divider';
import FolderIcon from '@mui/icons-material/Folder';
import DownloadingIcon from '@mui/icons-material/Downloading';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import NewspaperIcon from '@mui/icons-material/Newspaper';
import ForumIcon from '@mui/icons-material/Forum';
import InsightsIcon from '@mui/icons-material/Insights';
import { useAuth } from '../../App';

const item = {
    py: 0.75,
    px: 1,
    borderRadius: 2,
    color: 'text.secondary',
    '&:hover, &:focus': {
        bgcolor: 'action.hover',
    },
};

export default function Navigator(props) {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();

    const isSelected = (path) => {
        if (location.pathname === path) return true;
        if (path === '/informasi' && (location.pathname === '/available-hosts' || location.pathname === '/search')) return true;
        if (path === '/balance' && (location.pathname === '/topup' || location.pathname === '/topup/new')) return true;
        if (path === '/admin' && location.pathname.startsWith('/admin') && location.pathname !== '/admin/monitoring') return true;
        return false;
    };

    const categories = [
        {
            id: 'Konten',
            children: [
                {
                    id: 'Informasi Resmi',
                    icon: <NewspaperIcon />,
                    path: '/informasi',
                },
                {
                    id: 'Unggahan Pengguna',
                    icon: <ForumIcon />,
                    path: '/unggahan',
                },
            ],
        },
        {
            id: 'Menu',
            children: [
                {
                    id: 'Unduhan Kamu',
                    icon: <FolderIcon />,
                    path: '/download',
                },
                {
                    id: 'Tambah Unduhan',
                    icon: <DownloadingIcon />,
                    path: '/input',
                },
                {
                    id: 'Saldo & Top Up',
                    icon: <AccountBalanceWalletIcon />,
                    path: '/balance',
                },
            ],
        },
        ...(user?.role === 'admin'
            ? [
                {
                    id: 'Admin',
                    children: [
                        {
                            id: 'Admin Panel',
                            icon: <AdminPanelSettingsIcon />,
                            path: '/admin',
                        },
                        {
                            id: 'Monitoring Pengguna',
                            icon: <InsightsIcon />,
                            path: '/admin/monitoring',
                        },
                    ],
                },
            ]
            : []),
    ];

    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <List size="sm" sx={{ '--ListItem-radius': '8px', '--List-gap': '4px', p: 0 }}>
                {categories.map(({ id, children }) => (
                    <ListItem key={id} nested sx={{ mt: id === categories[0].id ? 0 : 1.5 }}>
                        <ListSubheader sx={{ letterSpacing: '2px', fontWeight: '800' }}>
                            {id}
                        </ListSubheader>
                        <List sx={{ '& .JoyListItemButton-root': { p: '8px' } }}>
                            {children.map(({ id: childId, icon, path }) => (
                                <ListItem key={childId}>
                                    <ListItemButton selected={isSelected(path)} onClick={() => navigate(path)}>
                                        <ListItemDecorator>{icon}</ListItemDecorator>
                                        <ListItemContent>{childId}</ListItemContent>
                                    </ListItemButton>
                                </ListItem>
                            ))}
                        </List>
                    </ListItem>
                ))}
            </List>
        </Box>
    );
}
