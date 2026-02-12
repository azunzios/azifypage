import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Skeleton from '@mui/material/Skeleton';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import SendIcon from '@mui/icons-material/Send';
import ForumIcon from '@mui/icons-material/Forum';
import PublicIcon from '@mui/icons-material/Public';
import PersonIcon from '@mui/icons-material/Person';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import { useAuth } from '../App';

export default function UnggahanPage() {
    const location = useLocation();
    const { user } = useAuth();
    const [allPosts, setAllPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newPost, setNewPost] = useState('');
    const [posting, setPosting] = useState(false);
    const [message, setMessage] = useState({ text: '', severity: 'success' });
    const [tab, setTab] = useState(0); // 0 = Publik, 1 = Unggahan Kamu
    const [replyOpen, setReplyOpen] = useState({});
    const [replyLoading, setReplyLoading] = useState({});
    const [replyPosting, setReplyPosting] = useState({});
    const [replyDraft, setReplyDraft] = useState({});
    const [repliesByPost, setRepliesByPost] = useState({});

    useEffect(() => {
        fetch('/api/posts/user')
            .then((r) => r.json())
            .then((data) => setAllPosts(Array.isArray(data) ? data : []))
            .catch(() => setAllPosts([]))
            .finally(() => setLoading(false));
    }, []);

    const displayedPosts = tab === 0
        ? allPosts
        : allPosts.filter((p) => p.user_id === user?.id);

    const query = new URLSearchParams(location.search).get('q')?.trim().toLowerCase() || '';
    const filteredPosts = query
        ? displayedPosts.filter((p) => `${p.content || ''} ${p.author_name || ''} ${p.author_email || ''}`.toLowerCase().includes(query))
        : displayedPosts;

    const handlePost = async () => {
        if (!newPost.trim()) return;
        setPosting(true);
        try {
            const res = await fetch('/api/posts/user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: newPost.trim() }),
            });
            if (res.ok) {
                const data = await res.json();
                setAllPosts([data, ...allPosts]);
                setNewPost('');
                setMessage({ text: 'Postingan berhasil dikirim!', severity: 'success' });
            } else {
                const err = await res.json();
                setMessage({ text: err.error || 'Gagal mengirim postingan', severity: 'error' });
            }
        } catch (err) {
            setMessage({ text: 'Error: ' + err.message, severity: 'error' });
        } finally {
            setPosting(false);
        }
    };

    const handleDelete = async (postId) => {
        try {
            const res = await fetch(`/api/posts/user?id=${postId}`, { method: 'DELETE' });
            if (res.ok) {
                setAllPosts(allPosts.filter((p) => p.id !== postId));
                setMessage({ text: 'Postingan berhasil dihapus', severity: 'success' });
            } else {
                setMessage({ text: 'Gagal menghapus postingan', severity: 'error' });
            }
        } catch {
            setMessage({ text: 'Gagal menghapus postingan', severity: 'error' });
        }
    };

    const ensureRepliesLoaded = async (postId) => {
        if (repliesByPost[postId]) return;
        setReplyLoading((prev) => ({ ...prev, [postId]: true }));
        try {
            const res = await fetch(`/api/posts/user/replies?post_id=${postId}`);
            const data = await res.json();
            setRepliesByPost((prev) => ({ ...prev, [postId]: Array.isArray(data) ? data : [] }));
        } catch {
            setRepliesByPost((prev) => ({ ...prev, [postId]: [] }));
        } finally {
            setReplyLoading((prev) => ({ ...prev, [postId]: false }));
        }
    };

    const toggleReplies = async (postId) => {
        const nextOpen = !replyOpen[postId];
        setReplyOpen((prev) => ({ ...prev, [postId]: nextOpen }));
        if (nextOpen) {
            await ensureRepliesLoaded(postId);
        }
    };

    const handleSendReply = async (postId) => {
        const content = (replyDraft[postId] || '').trim();
        if (!content) return;

        setReplyPosting((prev) => ({ ...prev, [postId]: true }));
        try {
            const res = await fetch('/api/posts/user/replies', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ post_id: postId, content }),
            });

            if (res.ok) {
                const data = await res.json();
                setRepliesByPost((prev) => ({
                    ...prev,
                    [postId]: [...(prev[postId] || []), data],
                }));
                setReplyDraft((prev) => ({ ...prev, [postId]: '' }));
            } else {
                const err = await res.json().catch(() => ({}));
                setMessage({ text: err.error || 'Gagal mengirim balasan', severity: 'error' });
            }
        } catch (err) {
            setMessage({ text: 'Error: ' + err.message, severity: 'error' });
        } finally {
            setReplyPosting((prev) => ({ ...prev, [postId]: false }));
        }
    };

    const handleDeleteReply = async (postId, replyId) => {
        try {
            const res = await fetch(`/api/posts/user/replies?id=${replyId}`, { method: 'DELETE' });
            if (res.ok) {
                setRepliesByPost((prev) => ({
                    ...prev,
                    [postId]: (prev[postId] || []).filter((item) => item.id !== replyId),
                }));
            } else {
                setMessage({ text: 'Gagal menghapus balasan', severity: 'error' });
            }
        } catch {
            setMessage({ text: 'Gagal menghapus balasan', severity: 'error' });
        }
    };

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        if (diffMins < 1) return 'Baru saja';
        if (diffMins < 60) return `${diffMins} menit lalu`;
        if (diffHours < 24) return `${diffHours} jam lalu`;
        if (diffDays < 7) return `${diffDays} hari lalu`;
        return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    return (
        <Box sx={{ maxWidth: 936, margin: 'auto' }}>
            {/* Tabs */}
            <Paper variant="outlined" sx={{ borderRadius: 0, mb: 3 }}>
                <Tabs
                    value={tab}
                    onChange={(_, v) => setTab(v)}
                    variant="fullWidth"
                    sx={{ minHeight: 44 }}
                >
                    <Tab
                        icon={<PublicIcon sx={{ fontSize: 18 }} />}
                        iconPosition="start"
                        label="Publik"
                        sx={{ textTransform: 'none', minHeight: 44, fontSize: 13, fontWeight: 600 }}
                    />
                    <Tab
                        icon={<PersonIcon sx={{ fontSize: 18 }} />}
                        iconPosition="start"
                        label="Unggahan Kamu"
                        sx={{ textTransform: 'none', minHeight: 44, fontSize: 13, fontWeight: 600 }}
                    />
                </Tabs>
            </Paper>

            {/* New post input */}
            <Card variant="outlined" sx={{ mb: 3, borderRadius: 0 }}>
                <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.main', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
                            {user?.email?.charAt(0).toUpperCase() || 'U'}
                        </Avatar>
                        <Box sx={{ flex: 1 }}>
                            <TextField
                                fullWidth
                                multiline
                                minRows={2}
                                maxRows={5}
                                placeholder="Tulis sesuatu... Berbagi tips, tanya jawab, atau diskusi."
                                value={newPost}
                                onChange={(e) => setNewPost(e.target.value)}
                                variant="outlined"
                                size="small"
                                sx={{ mb: 1.5 }}
                            />
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="caption" color="text.disabled">
                                    {newPost.length}/500
                                </Typography>
                                <Button
                                    variant="contained"
                                    size="small"
                                    endIcon={<SendIcon />}
                                    onClick={handlePost}
                                    disabled={posting || !newPost.trim() || newPost.length > 500}
                                    sx={{ textTransform: 'none' }}
                                >
                                    {posting ? 'Mengirim...' : 'Kirim'}
                                </Button>
                            </Box>
                        </Box>
                    </Box>
                </CardContent>
            </Card>

            {/* Posts */}
            {loading ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {[1, 2, 3].map((i) => <Skeleton key={i} variant="rectangular" height={80} />)}
                </Box>
            ) : filteredPosts.length === 0 ? (
                <Paper variant="outlined" sx={{ textAlign: 'center', py: 5, borderRadius: 0 }}>
                    <ForumIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                    <Typography variant="body2" color="text.secondary">
                        {query
                            ? 'Tidak ada hasil pencarian.'
                            : (tab === 0 ? 'Belum ada unggahan. Jadilah yang pertama!' : 'Kamu belum punya unggahan.')}
                    </Typography>
                </Paper>
            ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {filteredPosts.map((post) => {
                        const isOwner = post.user_id === user?.id;
                        const canDeletePost = isOwner || user?.role === 'admin';
                        const isOpen = !!replyOpen[post.id];
                        const replies = repliesByPost[post.id] || [];
                        const isLoadingReplies = !!replyLoading[post.id];
                        const isPostingReply = !!replyPosting[post.id];
                        return (
                            <Card key={post.id} variant="outlined" sx={{ borderRadius: 0, transition: 'box-shadow 0.2s', '&:hover': { boxShadow: 1 } }}>
                                <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                                    <Box sx={{ display: 'flex', gap: 2 }}>
                                        <Avatar sx={{ width: 36, height: 36, bgcolor: isOwner ? 'primary.main' : 'secondary.main', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
                                            {(post.author_name || post.author_email || 'U').charAt(0).toUpperCase()}
                                        </Avatar>
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <Typography variant="body2" fontWeight={600}>
                                                        {post.author_name || post.author_email?.split('@')[0] || 'Pengguna'}
                                                    </Typography>
                                                    {isOwner && (
                                                        <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 500 }}>
                                                            (Kamu)
                                                        </Typography>
                                                    )}
                                                </Box>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                    {canDeletePost && (
                                                        <Tooltip title="Hapus">
                                                            <IconButton size="small" color="error" onClick={() => handleDelete(post.id)} sx={{ mr: 0.5 }}>
                                                                <DeleteOutlineIcon sx={{ fontSize: 18 }} />
                                                            </IconButton>
                                                        </Tooltip>
                                                    )}
                                                    <AccessTimeIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
                                                    <Typography variant="caption" color="text.disabled">
                                                        {formatDate(post.created_at)}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                                                {post.content}
                                            </Typography>

                                            <Box sx={{ mt: 1.25, display: 'flex', gap: 1, alignItems: 'center' }}>
                                                <Button
                                                    size="small"
                                                    startIcon={<ChatBubbleOutlineIcon sx={{ fontSize: 18 }} />}
                                                    onClick={() => toggleReplies(post.id)}
                                                    sx={{ textTransform: 'none' }}
                                                >
                                                    {isOpen ? 'Tutup' : 'Balas'}
                                                    {repliesByPost[post.id] ? ` (${replies.length})` : ''}
                                                </Button>
                                            </Box>

                                            <Collapse in={isOpen} timeout="auto" unmountOnExit>
                                                <Divider sx={{ my: 1.5 }} />
                                                <Box sx={{ pl: 0.5 }}>
                                                    {isLoadingReplies ? (
                                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                                            {[1, 2].map((i) => <Skeleton key={i} variant="rectangular" height={44} />)}
                                                        </Box>
                                                    ) : replies.length === 0 ? (
                                                        <Typography variant="caption" color="text.secondary">
                                                            Belum ada balasan.
                                                        </Typography>
                                                    ) : (
                                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                                                            {replies.map((reply) => {
                                                                const isReplyOwner = reply.user_id === user?.id;
                                                                return (
                                                                    <Box key={reply.id} sx={{ display: 'flex', gap: 1.5 }}>
                                                                        <Avatar sx={{ width: 28, height: 28, bgcolor: isReplyOwner ? 'primary.main' : 'grey.700', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                                                                            {(reply.author_name || reply.author_email || 'U').charAt(0).toUpperCase()}
                                                                        </Avatar>
                                                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                                    <Typography variant="caption" fontWeight={700}>
                                                                                        {reply.author_name || reply.author_email?.split('@')[0] || 'Pengguna'}
                                                                                    </Typography>
                                                                                    <Typography variant="caption" color="text.disabled">
                                                                                        • {formatDate(reply.created_at)}
                                                                                    </Typography>
                                                                                </Box>
                                                                                {isReplyOwner && (
                                                                                    <Tooltip title="Hapus balasan">
                                                                                        <IconButton size="small" color="error" onClick={() => handleDeleteReply(post.id, reply.id)}>
                                                                                            <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                                                                                        </IconButton>
                                                                                    </Tooltip>
                                                                                )}
                                                                            </Box>
                                                                            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                                                                                {reply.content}
                                                                            </Typography>
                                                                        </Box>
                                                                    </Box>
                                                                );
                                                            })}
                                                        </Box>
                                                    )}

                                                    <Box sx={{ mt: 1.75, display: 'flex', gap: 1.25, alignItems: 'flex-start' }}>
                                                        <Avatar sx={{ width: 28, height: 28, bgcolor: 'primary.main', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                                                            {user?.email?.charAt(0).toUpperCase() || 'U'}
                                                        </Avatar>
                                                        <Box sx={{ flex: 1 }}>
                                                            <TextField
                                                                fullWidth
                                                                multiline
                                                                minRows={2}
                                                                maxRows={4}
                                                                size="small"
                                                                placeholder="Tulis balasan..."
                                                                value={replyDraft[post.id] || ''}
                                                                onChange={(e) => setReplyDraft((prev) => ({ ...prev, [post.id]: e.target.value }))}
                                                            />
                                                            <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
                                                                <Button
                                                                    variant="contained"
                                                                    size="small"
                                                                    endIcon={<SendIcon />}
                                                                    onClick={() => handleSendReply(post.id)}
                                                                    disabled={isPostingReply || !(replyDraft[post.id] || '').trim() || (replyDraft[post.id] || '').length > 500}
                                                                    sx={{ textTransform: 'none' }}
                                                                >
                                                                    {isPostingReply ? 'Mengirim...' : 'Kirim Balasan'}
                                                                </Button>
                                                            </Box>
                                                        </Box>
                                                    </Box>
                                                </Box>
                                            </Collapse>
                                        </Box>
                                    </Box>
                                </CardContent>
                            </Card>
                        );
                    })}
                </Box>
            )}

            <Snackbar open={!!message.text} autoHideDuration={3000} onClose={() => setMessage({ text: '', severity: 'success' })}>
                <Alert onClose={() => setMessage({ text: '', severity: 'success' })} severity={message.severity} variant="filled">{message.text}</Alert>
            </Snackbar>
        </Box>
    );
}
