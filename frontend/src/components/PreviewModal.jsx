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
import Divider from '@mui/joy/Divider';
import IconButton from '@mui/joy/IconButton';
import CloseIcon from '@mui/icons-material/Close';

export default function PreviewModal({ preview, onConfirm, onCancel }) {
    if (!preview) return null;

    const formatIDR = (n) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`;
    const originalPrice = Number(preview.original_price || preview.price || 0);
    const discountAmount = Number(preview.discount_amount || 0);
    const finalPrice = Number(preview.price || 0);

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
                        <Typography level="title-sm" sx={{ fontWeight: 700 }}>
                            Konfirmasi Link
                        </Typography>
                        <Divider sx={{ my: 0.75 }} />
                        <Typography level="body-sm" sx={{ overflowWrap: 'anywhere' }}>
                            {preview.source_url || '-'}
                        </Typography>
                    </Sheet>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 0.25 }}>
                        <Typography level="body-sm" color="neutral" sx={{ fontWeight: 500 }}>
                            Total Harga
                        </Typography>
                        <Typography level="h3" color="primary" sx={{ fontWeight: 800 }}>
                            {formatIDR(finalPrice)}
                        </Typography>
                    </Box>

                    <Sheet
                        variant="outlined"
                        sx={{ mt: 1.5, p: 1.25, borderRadius: 'sm' }}
                    >
                        <Typography level="body-sm" sx={{ fontWeight: 700 }}>
                            STRUK PENGURANGAN VOUCHER
                        </Typography>
                        <Divider sx={{ my: 0.75 }} />
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 0.5, columnGap: 1 }}>
                            <Typography level="body-xs" color="neutral">Harga Item</Typography>
                            <Typography level="body-xs" sx={{ fontWeight: 600 }}>{formatIDR(originalPrice)}</Typography>

                            <Typography level="body-xs" color="neutral">Potongan Voucher</Typography>
                            <Typography level="body-xs" sx={{ fontWeight: 600 }}>
                                - {formatIDR(discountAmount)}
                            </Typography>

                            <Typography level="body-xs" color="neutral">Subtotal Setelah Voucher</Typography>
                            <Typography level="body-xs" sx={{ fontWeight: 700 }}>
                                {formatIDR(finalPrice)}
                            </Typography>
                        </Box>
                        {preview.voucher_code ? (
                            <Typography level="body-xs" color="neutral" sx={{ mt: 0.75 }}>
                                Voucher: {preview.voucher_code}
                            </Typography>
                        ) : null}
                    </Sheet>
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
