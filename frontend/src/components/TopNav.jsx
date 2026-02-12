import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Wallet, Settings, LogOut, X } from 'lucide-react';
import { useAuth } from '../App';

export default function TopNav() {
    const [showProfile, setShowProfile] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const navigate = useNavigate();
    const { user, logout } = useAuth();

    useEffect(() => {
        // Fetch notifications
        fetch('/api/notifications')
            .then(res => res.json())
            .then(data => setNotifications(data || []))
            .catch(console.error);
    }, []);

    const handleProfileClick = () => {
        setShowProfile(!showProfile);
        setShowNotifications(false);
    };

    const handleNotificationClick = () => {
        setShowNotifications(!showNotifications);
        setShowProfile(false);
    };

    const handleTopUpClick = () => {
        setShowProfile(false);
        navigate('/balance');
    };

    const markAsRead = async (id) => {
        await fetch('/api/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
    };

    const unreadCount = notifications.filter(n => !n.is_read).length;

    return (
        <header className="border-b border-solid border-slate-200 bg-white sticky top-0 z-50 w-full shadow-sm">
            <div className="flex items-center justify-between whitespace-nowrap max-w-[960px] mx-auto px-4 md:px-8 py-3">
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
                    <img src="/logo.svg" alt="AzifyPage" className="h-6 md:h-7" />
                </div>

                <div className="flex flex-1 justify-end gap-3 lg:gap-4 relative">
                    <div className="flex items-center gap-2">
                        {/* Saldo */}
                        <button
                            onClick={handleTopUpClick}
                            className="flex min-w-[90px] md:min-w-[110px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-9 px-3 bg-accent/10 text-accent text-sm font-semibold border border-accent/20 hover:bg-accent/20 transition-all"
                        >
                            <span className="truncate">{user?.balance_formatted || 'Rp 0'}</span>
                        </button>

                        {/* Notifikasi */}
                        <button
                            onClick={handleNotificationClick}
                            className="relative flex size-9 cursor-pointer items-center justify-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                        >
                            <Bell size={20} />
                            {unreadCount > 0 && (
                                <span className="absolute top-1 right-1 size-4 bg-orange-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center">
                                    {unreadCount}
                                </span>
                            )}
                        </button>
                    </div>

                    {/* Avatar Profil */}
                    {user?.picture ? (
                        <img
                            src={user.picture}
                            alt={user.name}
                            onClick={handleProfileClick}
                            className="rounded-full size-9 border-2 border-accent cursor-pointer hover:shadow-md transition-all object-cover"
                        />
                    ) : (
                        <div
                            onClick={handleProfileClick}
                            className="bg-accent/20 rounded-full size-9 border-2 border-accent cursor-pointer hover:shadow-md transition-all flex items-center justify-center text-accent font-semibold text-sm"
                        >
                            {user?.email?.charAt(0).toUpperCase() || 'U'}
                        </div>
                    )}

                    {/* Popup Notifikasi */}
                    {showNotifications && (
                        <div className="absolute top-12 right-0 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-96 overflow-hidden">
                            <div className="flex items-center justify-between p-3 border-b border-slate-100">
                                <h3 className="font-semibold text-sm text-forest">Notifikasi</h3>
                                <button onClick={() => setShowNotifications(false)} className="text-slate-400 hover:text-slate-600">
                                    <X size={18} />
                                </button>
                            </div>
                            <div className="max-h-72 overflow-y-auto">
                                {notifications.length === 0 ? (
                                    <p className="text-center text-slate-400 py-8 text-sm">Belum ada notifikasi</p>
                                ) : (
                                    notifications.map(notif => (
                                        <div
                                            key={notif.id}
                                            onClick={() => markAsRead(notif.id)}
                                            className={`p-3 border-b border-slate-50 cursor-pointer hover:bg-slate-50 ${!notif.is_read ? 'bg-blue-50' : ''}`}
                                        >
                                            <p className="font-medium text-sm text-forest">{notif.title}</p>
                                            <p className="text-xs text-slate-500 mt-1">{notif.message}</p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* Popup Profil */}
                    {showProfile && (
                        <div className="absolute top-12 right-0 w-64 bg-white border border-slate-200 rounded-xl shadow-xl p-4 z-50 flex flex-col gap-2">
                            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                                {user?.picture ? (
                                    <img src={user.picture} alt={user.name} className="size-10 rounded-full object-cover" />
                                ) : (
                                    <div className="size-10 bg-accent/20 rounded-full flex items-center justify-center text-accent font-bold">
                                        {user?.email?.charAt(0).toUpperCase() || 'U'}
                                    </div>
                                )}
                                <div>
                                    <p className="font-semibold text-sm text-forest">{user?.name || 'User'}</p>
                                    <p className="text-xs text-slate-500">{user?.email || 'Loading...'}</p>
                                </div>
                            </div>
                            <button onClick={handleTopUpClick} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg text-sm font-medium text-left text-forest">
                                <Wallet size={18} className="text-accent" />
                                <span>Saldo & Top Up</span>
                            </button>
                            {user?.role === 'admin' && (
                                <button
                                    onClick={() => { setShowProfile(false); navigate('/admin'); }}
                                    className="flex items-center gap-2 p-2 hover:bg-orange-50 rounded-lg text-sm font-medium text-left text-orange-600"
                                >
                                    <Settings size={18} />
                                    <span>Admin Panel</span>
                                </button>
                            )}
                            <button
                                onClick={logout}
                                className="flex items-center gap-2 p-2 hover:bg-red-50 text-red-500 rounded-lg text-sm font-medium mt-1 text-left"
                            >
                                <LogOut size={18} />
                                <span>Keluar</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
