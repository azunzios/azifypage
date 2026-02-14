import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
import Chip from '@mui/material/Chip';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import SendIcon from '@mui/icons-material/Send';
import ForumIcon from '@mui/icons-material/Forum';
import PublicIcon from '@mui/icons-material/Public';
import PersonIcon from '@mui/icons-material/Person';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import BuildIcon from '@mui/icons-material/Build';
import { useAuth } from '../App';

export default function UnggahanPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [publicPosts, setPublicPosts] = useState([]);
    const [myPosts, setMyPosts] = useState([]);
    const [loading, setLoading] = useState({ public: true, mine: true });
    const [loadingMore, setLoadingMore] = useState({ public: false, mine: false });
    const [hasMore, setHasMore] = useState({ public: true, mine: true });
    const [cursor, setCursor] = useState({ public: null, mine: null });
    const [newPost, setNewPost] = useState('');
    const [posting, setPosting] = useState(false);
    const [message, setMessage] = useState({ text: '', severity: 'success' });
    const [tab, setTab] = useState(0); // 0 = Publik, 1 = Unggahan Kamu
    const [replyOpen, setReplyOpen] = useState({});
    const [replyLoading, setReplyLoading] = useState({});
    const [replyPosting, setReplyPosting] = useState({});
    const [replyDraft, setReplyDraft] = useState({});
    const [repliesByPost, setRepliesByPost] = useState({});
    const [failedPictures, setFailedPictures] = useState({});

    const loadMoreRef = useRef(null);

    const currentKey = tab === 0 ? 'public' : 'mine';
    const currentPosts = tab === 0 ? publicPosts : myPosts;
    const PAGE_SIZE = 20;

    const computeNextCursor = (items) => {
        if (!Array.isArray(items) || items.length === 0) return null;
        const last = items[items.length - 1];
        if (!last?.created_at || !last?.id) return null;
        return { before: last.created_at, before_id: last.id };
    };

    const fetchPostsPage = async ({ key, reset }) => {
        const isMine = key === 'mine';
        if (reset) {
            setLoading((prev) => ({ ...prev, [key]: true }));
            setLoadingMore((prev) => ({ ...prev, [key]: false }));
            setHasMore((prev) => ({ ...prev, [key]: true }));
            setCursor((prev) => ({ ...prev, [key]: null }));
        } else {
            setLoadingMore((prev) => ({ ...prev, [key]: true }));
        }

        try {
            const params = new URLSearchParams();
            params.set('limit', String(PAGE_SIZE));
            if (isMine) params.set('mine', '1');
            const cur = reset ? null : cursor[key];
            if (cur?.before) params.set('before', String(cur.before));
            if (cur?.before_id) params.set('before_id', String(cur.before_id));

            const res = await fetch(`/api/posts/user?${params.toString()}`);
            const data = await res.json();
            const items = Array.isArray(data) ? data : [];

            if (reset) {
                if (isMine) setMyPosts(items);
                else setPublicPosts(items);
            } else {
                if (isMine) setMyPosts((prev) => [...prev, ...items]);
                else setPublicPosts((prev) => [...prev, ...items]);
            }

            const nextCur = computeNextCursor(items);
            setCursor((prev) => ({ ...prev, [key]: nextCur ? nextCur : prev[key] }));
            setHasMore((prev) => ({ ...prev, [key]: items.length === PAGE_SIZE }));
        } catch {
            if (reset) {
                if (isMine) setMyPosts([]);
                else setPublicPosts([]);
            }
            setHasMore((prev) => ({ ...prev, [key]: false }));
        } finally {
            if (reset) setLoading((prev) => ({ ...prev, [key]: false }));
            else setLoadingMore((prev) => ({ ...prev, [key]: false }));
        }
    };

    const refreshPublic = async () => {
        await fetchPostsPage({ key: 'public', reset: true });
    };

    useEffect(() => {
        // initial load (public)
        fetchPostsPage({ key: 'public', reset: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        // load mine when tab opened the first time
        if (tab !== 1) return;
        if (myPosts.length > 0) return;
        fetchPostsPage({ key: 'mine', reset: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab]);

    useEffect(() => {
        if (tab !== 0) return;
        if (!hasMore.public) return;
        if (loading.public || loadingMore.public) return;
        const el = loadMoreRef.current;
        if (!el) return;

        const io = new IntersectionObserver(
            (entries) => {
                if (!entries?.[0]?.isIntersecting) return;
                if (!hasMore.public) return;
                if (loadingMore.public) return;
                fetchPostsPage({ key: 'public', reset: false });
            },
            { root: null, rootMargin: '600px 0px', threshold: 0.01 },
        );
        io.observe(el);
        return () => io.disconnect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab, hasMore.public, loading.public, loadingMore.public, cursor.public]);

    const query = new URLSearchParams(location.search).get('q')?.trim().toLowerCase() || '';
    const filteredPosts = useMemo(() => {
        if (!query) return currentPosts;
        return currentPosts.filter((p) => `${p.content || ''} ${p.author_name || ''} ${p.author_email || ''}`.toLowerCase().includes(query));
    }, [query, currentPosts]);

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
                setPublicPosts((prev) => [data, ...prev]);
                setMyPosts((prev) => [data, ...prev]);
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
                setPublicPosts((prev) => prev.filter((p) => p.id !== postId));
                setMyPosts((prev) => prev.filter((p) => p.id !== postId));
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
                        onClick={() => {
                            // Refresh even when user clicks the same active tab
                            refreshPublic();
                        }}
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
                        {user?.picture && !failedPictures['user'] ? (
                            <Avatar 
                                src={user.picture} 
                                sx={{ width: 36, height: 36, flex: 'none' }}
                                onError={() => setFailedPictures((prev) => ({ ...prev, 'user': true }))}
                            />
                        ) : (
                            <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.main', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
                                {user?.email?.charAt(0).toUpperCase() || 'U'}
                            </Avatar>
                        )}
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
            {loading[currentKey] ? (
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
                            <Card
                                key={post.id}
                                variant="outlined"
                                onClick={() => navigate(`/unggahan/post/${encodeURIComponent(String(post.id))}`)}
                                sx={{
                                    borderRadius: 0,
                                    transition: 'box-shadow 0.2s',
                                    cursor: 'pointer',
                                    '&:hover': { boxShadow: 1 },
                                }}
                            >
                                <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                                    <Box sx={{ display: 'flex', gap: 2 }}>
                                        {post.picture && !failedPictures[post.id] ? (
                                            <Avatar 
                                                src={post.picture} 
                                                sx={{ width: 36, height: 36, flex: 'none', fontSize: 14, fontWeight: 700 }}
                                                onError={() => setFailedPictures((prev) => ({ ...prev, [post.id]: true }))}
                                            />
                                        ) : (
                                            <Avatar sx={{ width: 36, height: 36, bgcolor: isOwner ? 'primary.main' : 'secondary.main', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
                                                {(post.author_name || post.author_email || 'U').charAt(0).toUpperCase()}
                                            </Avatar>
                                        )}
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                            {/* Header: Name, Badge, Buttons, Time */}
                                            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'flex-start', sm: 'flex-start' }, justifyContent: 'space-between', gap: { xs: 1, sm: 1 }, mb: 1 }}>
                                                {/* Left: Name, Badge, and Actions */}
                                                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'flex-start', sm: 'center' }, gap: 1, flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                        <Typography variant="body2" fontWeight={600} sx={{ whiteSpace: 'nowrap' }}>
                                                            {post.author_name || post.author_email?.split('@')[0] || 'Pengguna'}
                                                        </Typography>
                                                        {isOwner && (
                                                            <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 500, whiteSpace: 'nowrap' }}>
                                                                (Kamu)
                                                            </Typography>
                                                        )}
                                                        {post.role === 'admin' && <BuildIcon sx={{ fontSize: 14, color: 'primary.main' }} />}
                                                    </Box>
                                                    {/* Actions Buttons */}
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                                                        {canDeletePost && (
                                                            <Tooltip title="Hapus">
                                                                <IconButton
                                                                    size="small"
                                                                    color="error"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleDelete(post.id);
                                                                    }}
                                                                    sx={{ mr: 0 }}
                                                                >
                                                                    <DeleteOutlineIcon sx={{ fontSize: 18 }} />
                                                                </IconButton>
                                                            </Tooltip>
                                                        )}
                                                    </Box>
                                                </Box>
                                                {/* Time */}
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                                                    <AccessTimeIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
                                                    <Typography variant="caption" color="text.disabled" sx={{ whiteSpace: 'nowrap' }}>
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
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleReplies(post.id);
                                                    }}
                                                    sx={{ textTransform: 'none' }}
                                                >
                                                    {isOpen ? 'Tutup' : 'Balas'}
                                                    {repliesByPost[post.id] ? ` (${replies.length})` : ''}
                                                </Button>
                                            </Box>

                                            <Collapse in={isOpen} timeout="auto" unmountOnExit>
                                                <Divider sx={{ my: 1.5 }} />
                                                <Box sx={{ pl: 0.5 }} onClick={(e) => e.stopPropagation()}>
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
                                                                                        <IconButton
                                                                                            size="small"
                                                                                            color="error"
                                                                                            onClick={(e) => {
                                                                                                e.stopPropagation();
                                                                                                handleDeleteReply(post.id, reply.id);
                                                                                            }}
                                                                                        >
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
                                                                onClick={(e) => e.stopPropagation()}
                                                            />
                                                            <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
                                                                <Button
                                                                    variant="contained"
                                                                    size="small"
                                                                    endIcon={<SendIcon />}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleSendReply(post.id);
                                                                    }}
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

                    {/* Infinite load sentinel (Publik only) */}
                    {tab === 0 ? (
                        <Box ref={loadMoreRef} sx={{ py: 1.5 }}>
                            {loadingMore.public ? (
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center' }}>
                                    Memuat postingan terbaru...
                                </Typography>
                            ) : !hasMore.public ? (
                                <Typography variant="caption" color="text.disabled" sx={{ display: 'block', textAlign: 'center' }}>
                                    Sudah paling bawah.
                                </Typography>
                            ) : null}
                        </Box>
                    ) : null}
                </Box>
            )}

            <Snackbar open={!!message.text} autoHideDuration={3000} onClose={() => setMessage({ text: '', severity: 'success' })}>
                <Alert onClose={() => setMessage({ text: '', severity: 'success' })} severity={message.severity} variant="filled">{message.text}</Alert>
            </Snackbar>
        </Box>
    );
}
