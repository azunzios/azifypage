import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';

export default function AvailableHostsPage() {
  const [hosts, setHosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/hosts')
      .then((res) => res.json())
      .then((data) => setHosts(Array.isArray(data) ? data : []))
      .catch(() => setHosts([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Box sx={{ maxWidth: 936, margin: 'auto' }}>
      <Paper variant="outlined" sx={{ p: 2.5, mb: 2 }}>
        <Typography variant="h6" fontWeight={700}>Available Hosts</Typography>
        <Typography variant="body2" color="text.secondary">Daftar host yang diinput admin.</Typography>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2.5 }}>
        {loading ? (
          <Typography variant="body2" color="text.secondary">Memuat host...</Typography>
        ) : hosts.length === 0 ? (
          <Typography variant="body2" color="text.secondary">Belum ada host.</Typography>
        ) : (
          <Grid container spacing={1}>
            {hosts.map((host) => (
              <Grid item key={host.name}>
                <Chip
                  label={`${host.name} • ${host.status}`}
                  color={host.status === 'online' ? 'success' : 'default'}
                  variant={host.status === 'online' ? 'filled' : 'outlined'}
                  sx={{ ...(host.status !== 'online' && { textDecoration: 'line-through', opacity: 0.7 }) }}
                />
              </Grid>
            ))}
          </Grid>
        )}
      </Paper>
    </Box>
  );
}
