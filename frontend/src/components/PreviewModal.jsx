import React from 'react';
import Modal from '@mui/joy/Modal';
import ModalDialog from '@mui/joy/ModalDialog';
import DialogTitle from '@mui/joy/DialogTitle';
import DialogContent from '@mui/joy/DialogContent';
import DialogActions from '@mui/joy/DialogActions';
import Button from '@mui/joy/Button';
import Box from '@mui/joy/Box';
import Typography from '@mui/joy/Typography';
import Sheet from '@mui/joy/Sheet';
import IconButton from '@mui/joy/IconButton';
import CloseIcon from '@mui/icons-material/Close';

export default function PreviewModal({ preview, onConfirm, onCancel }) {
    if (!preview) return null;

    return (
        <Modal open={!!preview} onClose={onCancel}>
            <ModalDialog size="md" layout="center" sx={{ width: 'min(560px, 92vw)' }}>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography level="title-lg" sx={{ fontWeight: 700 }}>
                        Konfirmasi Unduhan
                    </Typography>
                    <IconButton size="sm" variant="plain" onClick={onCancel}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent>
                    <Sheet
                        variant="soft"
                        sx={{
                            p: 2,
                            borderRadius: 'md',
                            border: '1px solid',
                            borderColor: 'neutral.outlinedBorder',
                            mb: 2,
                        }}
                    >
                        <Typography level="title-sm" sx={{ fontWeight: 600 }} noWrap>
                            {preview.name}
                        </Typography>
                        <Box sx={{ mt: 1, display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                            <Typography level="body-xs" color="neutral">
                                {preview.size} ({preview.size_gb})
                            </Typography>
                            <Typography
                                level="body-xs"
                                sx={{ fontWeight: 600 }}
                                color={preview.cached ? 'success' : 'warning'}
                            >
                                {preview.cached ? 'Siap diunduh' : 'Sedang diproses...'}
                            </Typography>
                        </Box>
                    </Sheet>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 0.25 }}>
                        <Typography level="body-sm" color="neutral" sx={{ fontWeight: 500 }}>
                            Total Harga
                        </Typography>
                        <Typography level="h3" color="primary" sx={{ fontWeight: 800 }}>
                            Rp {preview.price}
                        </Typography>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ pt: 1 }}>
                    <Button onClick={onCancel} variant="outlined" fullWidth>
                        Batal
                    </Button>
                    <Button onClick={onConfirm} variant="solid" fullWidth>
                        Bayar & Unduh
                    </Button>
                </DialogActions>
            </ModalDialog>
        </Modal>
    );
}
