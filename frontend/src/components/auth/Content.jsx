import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import CloudDownloadRoundedIcon from '@mui/icons-material/CloudDownloadRounded';
import SpeedRoundedIcon from '@mui/icons-material/SpeedRounded';
import SecurityRoundedIcon from '@mui/icons-material/SecurityRounded';
import StorageRoundedIcon from '@mui/icons-material/StorageRounded';
import { useColorScheme } from '@mui/joy/styles';
import { keyframes } from '@mui/system';
import { AppIcon } from './CustomIcons';

const items = [
    {
        icon: <CloudDownloadRoundedIcon sx={{ color: 'text.secondary' }} />,
        title: 'Download Mudah',
        description:
            'Cukup tempel link premium, kami yang urus downloadnya untuk kamu.',
    },
    {
        icon: <SpeedRoundedIcon sx={{ color: 'text.secondary' }} />,
        title: 'Kecepatan Tinggi',
        description:
            'Download file dari server premium dengan kecepatan maksimal tanpa batas.',
    },
    {
        icon: <SecurityRoundedIcon sx={{ color: 'text.secondary' }} />,
        title: 'Aman & Terpercaya',
        description:
            'File kamu tersimpan aman di cloud storage pribadi milikmu.',
    },
    {
        icon: <StorageRoundedIcon sx={{ color: 'text.secondary' }} />,
        title: 'Cloud Storage',
        description:
            'Kelola file hasil download langsung dari browser dengan file explorer bawaan.',
    },
];

// Top 10 premium hosters supported by Real-Debrid
// Place logo files (SVG/PNG, black & white) in /public/brands/
const brands = [
    { name: 'uTorrent', logo: '/brands/utorrent.png' },
    { name: 'Rapidgator', logo: '/brands/rapidgator.png' },
    { name: 'Mega', logo: '/brands/mega.png' },
    { name: '1Fichier', logo: '/brands/1fichier.jpg' },
    { name: 'Turbobit', logo: '/brands/turbobit.png' },
    { name: 'Nitroflare', logo: '/brands/nitroflare.png' },
    { name: 'Ddownload', logo: '/brands/ddownload.webp' },
];

const marquee = keyframes`
    0% { transform: translateX(0); }
    100% { transform: translateX(-50%); }
`;

export default function Content() {
    const { mode } = useColorScheme();
    const isDark = (mode || 'light') === 'dark';
    const brandFont = '"Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif';

    return (
        <Stack
            sx={{ 
                flexDirection: 'column', 
                alignSelf: { xs: 'center', md: 'center' },
                gap: { xs: 2.5, md: 4 },
                maxWidth: { xs: '100%', sm: 450 },
                width: '100%',
                mb: { xs: 4, md: 0 },
                display: 'flex',
                minHeight: '100dvh'
            }}
        >
            <Box sx={{ display: { xs: 'none', md: 'flex' } }}>
                <AppIcon />
            </Box>
            <Typography
                variant="h4"
                sx={{
                    fontWeight: 500,
                    fontFamily: brandFont,
                    color: isDark ? 'rgba(255, 255, 255, 0.88)' : undefined,
                }}
            >
                Download file dari link premium kini lebih mudah dan cepat!
            </Typography>

            {/* Premium brand logos */}
            <Box
            >
                <Typography
                    variant="body2"
                    sx={{ color: 'text.secondary', mb: 1.5, fontWeight: 500, fontFamily: brandFont }}
                >
                    Mendukung 80+ premium hosters
                </Typography>
                <Box
                    sx={{
                        position: 'relative',
                        borderRadius: { xs: 0, sm: 2 },
                        borderStyle: 'solid',
                        borderWidth: '1px 0',
                        borderColor: 'divider',
                        p: { xs: 1.5, sm: 2 },
                        width: { xs: '100vw', sm: '100%' },
                        maxWidth: { xs: '100vw', sm: 'none' },
                        mx: { xs: 'calc(50% - 50vw)', sm: 0 },
                        boxShadow: isDark
                            ? 'inset 0 2px 8px rgba(0,0,0,0.3), inset 0 -2px 8px rgba(0,0,0,0.3)'
                            : 'inset 0 2px 8px rgba(0,0,0,0.06), inset 0 -2px 8px rgba(0,0,0,0.06)',
                        overflow: 'hidden',
                        '&::before': {
                            content: '""',
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: 80,
                            height: '100%',
                            background: isDark
                                ? 'radial-gradient(ellipse at left center, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.55) 35%, rgba(0,0,0,0) 70%)'
                                : 'radial-gradient(ellipse at left center, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.6) 35%, rgba(255,255,255,0) 70%)',
                            zIndex: 2,
                            pointerEvents: 'none',
                            WebkitMaskImage:
                                'linear-gradient(to bottom, transparent 0%, #000 20%, #000 80%, transparent 100%)',
                            maskImage:
                                'linear-gradient(to bottom, transparent 0%, #000 20%, #000 80%, transparent 100%)',
                        },
                        '&::after': {
                            content: '""',
                            position: 'absolute',
                            top: 0,
                            right: 0,
                            width: 80,
                            height: '100%',
                            background: isDark
                                ? 'radial-gradient(ellipse at right center, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.55) 35%, rgba(0,0,0,0) 70%)'
                                : 'radial-gradient(ellipse at right center, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.6) 35%, rgba(255,255,255,0) 70%)',
                            zIndex: 2,
                            pointerEvents: 'none',
                            WebkitMaskImage:
                                'linear-gradient(to bottom, transparent 0%, #000 20%, #000 80%, transparent 100%)',
                            maskImage:
                                'linear-gradient(to bottom, transparent 0%, #000 20%, #000 80%, transparent 100%)',
                        },
                    }}
                >
                    <Box
                        sx={{
                            overflow: 'hidden',
                            // keep enough height so the fade overlays don't clip content
                            py: 0.5,
                        }}
                    >
                        <Box
                            sx={{
                                display: 'flex',
                                width: 'max-content',
                                alignItems: 'center',
                                gap: 1.5,
                                pr: 1.5,
                                animation: `${marquee} 45s linear infinite`,
                                willChange: 'transform',
                                '@media (prefers-reduced-motion: reduce)': {
                                    animation: 'none',
                                    transform: 'none',
                                },
                            }}
                        >
                            {[...brands, { name: 'dan lainnya', logo: null }].concat(
                                [...brands, { name: 'dan lainnya', logo: null }]
                            ).map((brand, idx) => {
                                if (!brand.logo) {
                                    return (
                                        <Chip
                                            key={`${brand.name}-${idx}`}
                                            label={brand.name}
                                            variant="outlined"
                                            size="small"
                                            sx={{
                                                fontWeight: 600,
                                                fontSize: '0.75rem',
                                                borderStyle: 'dashed',
                                                opacity: 0.6,
                                                whiteSpace: 'nowrap',
                                                flex: '0 0 auto',
                                            }}
                                        />
                                    );
                                }

                                return (
                                    <Box
                                        key={`${brand.name}-${idx}`}
                                        component="img"
                                        src={brand.logo}
                                        alt={brand.name}
                                        title={brand.name}
                                        sx={{
                                            height: 28,
                                            width: 'auto',
                                            objectFit: 'contain',
                                            flex: '0 0 auto',
                                            // Jangan di-invert di dark mode: biarkan logo host tetap normal.
                                            filter: 'grayscale(100%)',
                                            opacity: isDark ? 0.45 : 0.5,
                                            transition: 'all 0.2s',
                                            '&:hover': {
                                                opacity: isDark ? 0.85 : 0.9,
                                                filter: 'grayscale(0%)',
                                            },
                                        }}
                                    />
                                );
                            })}
                        </Box>
                    </Box>
                </Box>
            </Box>
            <Box>
            {items.map((item, index) => (
                <Stack key={index} direction="row" sx={{ gap: 2, mb: { xs: 1, md: 2 } }}>
                    {item.icon}
                    <div>
                        <Typography
                            gutterBottom
                            sx={{
                                fontWeight: 'medium',
                                fontFamily: brandFont,
                                color: isDark ? '#fff' : 'text.primary',
                            }}
                        >
                            {item.title}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            {item.description}
                        </Typography>
                    </div>
                </Stack>
            ))}
            </Box>
        </Stack>
    );
}
