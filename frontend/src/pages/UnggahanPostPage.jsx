import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SendIcon from '@mui/icons-material/Send';

import { useAuth } from '../App';

export default function UnggahanPostPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const params = useParams();

    const id = useMemo(() => {
        const raw = String(params?.id || '').trim();
        const n = parseInt(raw, 10);
        return Number.isFinite(n) ? n : 0;
    }, [params?.id]);

    const [loading, setLoading] = useState(true);
    const [post, setPost] = useState(null);
    const [replies, setReplies] = useState([]);
    const [loadingReplies, setLoadingReplies] = useState(true);
    const [postingReply, setPostingReply] = useState(false);
    const [replyDraft, setReplyDraft] = useState('');
    const [errorText, setErrorText] = useState('');

    const refresh = async () => {
        if (!id) {
            setPost(null);
            setReplies([]);
            setLoading(false);
            setLoadingReplies(false);
            return;
        }

        setErrorText('');
        setLoading(true);
        setLoadingReplies(true);

        try {
            const [postRes, replyRes] = await Promise.all([
                fetch(`/api/posts/user?id=${encodeURIComponent(String(id))}`),
                fetch(`/api/posts/user/replies?post_id=${encodeURIComponent(String(id))}`),
            ]);

            if (!postRes.ok) throw new Error(await postRes.text());
            const postData = await postRes.json();
            setPost(postData || null);

            if (replyRes.ok) {
                const replyData = await replyRes.json();
                setReplies(Array.isArray(replyData) ? replyData : []);
            } else {
                setReplies([]);
            }
        } catch (e) {
            setErrorText(e?.message || 'Gagal memuat post');
            setPost(null);
            setReplies([]);
        } finally {
            setLoading(false);
            setLoadingReplies(false);
        }
    };

    useEffect(() => {
        refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        if (Number.isNaN(date.getTime())) return '';
        return date.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const canDeletePost = post && (post.user_id === user?.id || user?.role === 'admin');

    const handleDeletePost = async () => {
        if (!post?.id) return;
        try {
            const res = await fetch(`/api/posts/user?id=${encodeURIComponent(String(post.id))}`, { method: 'DELETE' });
            if (!res.ok) throw new Error(await res.text());
            navigate('/unggahan');
        } catch (e) {
            setErrorText(e?.message || 'Gagal menghapus post');
        }
    };

    const handleSendReply = async () => {
        const content = replyDraft.trim();
        if (!content || !post?.id) return;

        setPostingReply(true);
        setErrorText('');

        try {
            const res = await fetch('/api/posts/user/replies', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ post_id: post.id, content }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error || 'Gagal mengirim balasan');
            }

            const created = await res.json();
            setReplies((prev) => [...prev, created]);
            setReplyDraft('');
        } catch (e) {
            setErrorText(e?.message || 'Terjadi kesalahan');
        } finally {
            setPostingReply(false);
        }
    };

    const handleDeleteReply = async (replyId) => {
        if (!replyId) return;
        setErrorText('');
        try {
            const res = await fetch(`/api/posts/user/replies?id=${encodeURIComponent(String(replyId))}`, { method: 'DELETE' });
            if (!res.ok) throw new Error(await res.text());
            setReplies((prev) => prev.filter((r) => r.id !== replyId));
        } catch (e) {
            setErrorText(e?.message || 'Gagal menghapus balasan');
        }
    };

    return (
        <Box sx={{ maxWidth: 936, margin: 'auto' }}>
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                    <Typography variant="subtitle1" fontWeight={800}>
                        Post
                    </Typography>
                    <Button variant="outlined" onClick={() => navigate('/unggahan')} sx={{ textTransform: 'none' }}>
                        Kembali
                    </Button>
                </Box>

                <Divider sx={{ my: 2 }} />

                {errorText ? (
                    <Alert severity="error" sx={{ borderRadius: 0, mb: 2 }}>
                        {errorText}
                    </Alert>
                ) : null}

                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                        <CircularProgress />
                    </Box>
                ) : !post ? (
                    <Alert severity="warning" sx={{ borderRadius: 0 }}>
                        Post tidak ditemukan.
                    </Alert>
                ) : (
                    <Box>
                        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                            <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.main', fontSize: 14, fontWeight: 800, flexShrink: 0 }}>
                                {(post.author_name || post.author_email || 'U').charAt(0).toUpperCase()}
                            </Avatar>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                                    <Box sx={{ minWidth: 0 }}>
                                        <Typography variant="body2" fontWeight={700} noWrap>
                                            {post.author_name || post.author_email?.split('@')[0] || 'Pengguna'}
                                        </Typography>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                                            <AccessTimeIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
                                            <Typography variant="caption" color="text.disabled">
                                                {formatDate(post.created_at)}
                                            </Typography>
                                        </Box>
                                    </Box>

                                    {canDeletePost ? (
                                        <Tooltip title="Hapus">
                                            <IconButton size="small" color="error" onClick={handleDeletePost}>
                                                <DeleteOutlineIcon sx={{ fontSize: 18 }} />
                                            </IconButton>
                                        </Tooltip>
                                    ) : null}
                                </Box>

                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{ mt: 1.25, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}
                                >
                                    {post.content}
                                </Typography>
                            </Box>
                        </Box>

                        <Divider sx={{ my: 2 }} />

                        <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>
                            Balasan ({replies.length})
                        </Typography>

                        {loadingReplies ? (
                            <Typography variant="body2" color="text.secondary">
                                Memuat balasan...
                            </Typography>
                        ) : replies.length === 0 ? (
                            <Typography variant="body2" color="text.secondary">
                                Belum ada balasan.
                            </Typography>
                        ) : (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                                {replies.map((r) => {
                                    const isReplyOwner = r.user_id === user?.id;
                                    return (
                                        <Box key={r.id} sx={{ display: 'flex', gap: 1.5 }}>
                                            <Avatar sx={{ width: 28, height: 28, bgcolor: isReplyOwner ? 'primary.main' : 'grey.700', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
                                                {(r.author_name || r.author_email || 'U').charAt(0).toUpperCase()}
                                            </Avatar>
                                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                                                    <Typography variant="caption" fontWeight={800}>
                                                        {r.author_name || r.author_email?.split('@')[0] || 'Pengguna'}
                                                    </Typography>
                                                    {isReplyOwner ? (
                                                        <Tooltip title="Hapus balasan">
                                                            <IconButton size="small" color="error" onClick={() => handleDeleteReply(r.id)}>
                                                                <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                                                            </IconButton>
                                                        </Tooltip>
                                                    ) : null}
                                                </Box>
                                                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                                                    {r.content}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    );
                                })}
                            </Box>
                        )}

                        <Divider sx={{ my: 2 }} />

                        <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start' }}>
                            <Avatar sx={{ width: 28, height: 28, bgcolor: 'primary.main', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
                                {user?.email?.charAt(0).toUpperCase() || 'U'}
                            </Avatar>
                            <Box sx={{ flex: 1 }}>
                                <TextField
                                    fullWidth
                                    multiline
                                    minRows={2}
                                    maxRows={5}
                                    size="small"
                                    placeholder="Tulis balasan..."
                                    value={replyDraft}
                                    onChange={(e) => setReplyDraft(e.target.value)}
                                />
                                <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
                                    <Button
                                        variant="contained"
                                        size="small"
                                        endIcon={<SendIcon />}
                                        onClick={handleSendReply}
                                        disabled={postingReply || !replyDraft.trim() || replyDraft.length > 500}
                                        sx={{ textTransform: 'none' }}
                                    >
                                        {postingReply ? 'Mengirim...' : 'Kirim Balasan'}
                                    </Button>
                                </Box>
                            </Box>
                        </Box>
                    </Box>
                )}
            </Paper>
        </Box>
    );
}
