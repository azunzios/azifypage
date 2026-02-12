import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import CampaignIcon from '@mui/icons-material/Campaign';
import ForumIcon from '@mui/icons-material/Forum';

export default function SearchPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [officialPosts, setOfficialPosts] = useState([]);
  const [userPosts, setUserPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const query = useMemo(() => new URLSearchParams(location.search).get('q')?.trim().toLowerCase() || '', [location.search]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [officialRes, userRes] = await Promise.allSettled([
          fetch('/api/posts/official').then((r) => r.json()),
          fetch('/api/posts/user').then((r) => r.json()),
        ]);

        setOfficialPosts(officialRes.status === 'fulfilled' && Array.isArray(officialRes.value) ? officialRes.value : []);
        setUserPosts(userRes.status === 'fulfilled' && Array.isArray(userRes.value) ? userRes.value : []);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filteredOfficial = query
    ? officialPosts.filter((p) => `${p.title || ''} ${p.content || ''} ${p.type || ''} ${p.author || ''}`.toLowerCase().includes(query))
    : [];

  const filteredUser = query
    ? userPosts.filter((p) => `${p.content || ''} ${p.author_name || ''} ${p.author_email || ''}`.toLowerCase().includes(query))
    : [];

  return (
    <Box sx={{ maxWidth: 936, margin: 'auto' }}>
      <Paper variant="outlined" sx={{ p: 2.5, mb: 2 }}>
        <Typography variant="h6" fontWeight={700}>Hasil Pencarian</Typography>
        <Typography variant="body2" color="text.secondary">
          Kata kunci: <strong>{query || '-'}</strong>
        </Typography>
      </Paper>

      {!query ? (
        <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">Masukkan kata kunci dari kolom search lalu tekan Enter.</Typography>
        </Paper>
      ) : loading ? (
        <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">Mencari...</Typography>
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <CampaignIcon color="primary" />
              <Typography variant="subtitle1" fontWeight={700}>Informasi Resmi</Typography>
              <Chip size="small" label={filteredOfficial.length} />
            </Box>
            {filteredOfficial.length === 0 ? (
              <Typography variant="body2" color="text.secondary">Tidak ada hasil.</Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                {filteredOfficial.map((p, i) => (
                  <Box key={p.id}>
                    <Card variant="outlined" sx={{ cursor: 'pointer' }} onClick={() => navigate(`/informasi?q=${encodeURIComponent(query)}`)}>
                      <CardContent>
                        <Typography variant="subtitle2" fontWeight={700}>{p.title}</Typography>
                        <Typography variant="body2" color="text.secondary">{p.content}</Typography>
                      </CardContent>
                    </Card>
                    {i < filteredOfficial.length - 1 && <Divider sx={{ my: 1 }} />}
                  </Box>
                ))}
              </Box>
            )}
          </Paper>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <ForumIcon color="primary" />
              <Typography variant="subtitle1" fontWeight={700}>Unggahan Pengguna</Typography>
              <Chip size="small" label={filteredUser.length} />
            </Box>
            {filteredUser.length === 0 ? (
              <Typography variant="body2" color="text.secondary">Tidak ada hasil.</Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                {filteredUser.map((p, i) => (
                  <Box key={p.id}>
                    <Card variant="outlined" sx={{ cursor: 'pointer' }} onClick={() => navigate(`/unggahan?q=${encodeURIComponent(query)}`)}>
                      <CardContent>
                        <Typography variant="subtitle2" fontWeight={700}>{p.author_name || p.author_email || 'Pengguna'}</Typography>
                        <Typography variant="body2" color="text.secondary">{p.content}</Typography>
                      </CardContent>
                    </Card>
                    {i < filteredUser.length - 1 && <Divider sx={{ my: 1 }} />}
                  </Box>
                ))}
              </Box>
            )}
          </Paper>
        </Box>
      )}
    </Box>
  );
}
