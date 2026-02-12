import React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';

export default function PreviewModal({ preview, onConfirm, onCancel }) {
    if (!preview) return null;

    return (
        <Dialog open={!!preview} onClose={onCancel} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="h6" fontWeight={600}>
                    Konfirmasi Unduhan
                </Typography>
                <IconButton size="small" onClick={onCancel}>
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent>
                <Paper
                    elevation={0}
                    sx={{
                        bgcolor: (theme) =>
                            theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'grey.50',
                        p: 2.5,
                        border: '1px solid',
                        borderColor: 'divider',
                        mb: 3,
                    }}
                >
                    <Typography variant="body2" fontWeight={500} noWrap sx={{ mb: 1 }}>
                        {preview.name}
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="text.secondary">
                            {preview.size} ({preview.size_gb})
                        </Typography>
                        <Typography
                            variant="caption"
                            fontWeight={500}
                            color={preview.cached ? 'success.main' : 'warning.main'}
                        >
                            {preview.cached ? 'Siap diunduh' : 'Sedang diproses...'}
                        </Typography>
                    </Box>
                </Paper>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 0.5 }}>
                    <Typography variant="body2" color="text.secondary" fontWeight={500}>
                        Total Harga
                    </Typography>
                    <Typography variant="h5" fontWeight={700} color="primary.main">
                        Rp {preview.price}
                    </Typography>
                </Box>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 3 }}>
                <Button onClick={onCancel} variant="outlined" fullWidth>
                    Batal
                </Button>
                <Button onClick={onConfirm} variant="contained" fullWidth>
                    Bayar & Unduh
                </Button>
            </DialogActions>
        </Dialog>
    );
}
