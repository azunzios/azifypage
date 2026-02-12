import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import FormLabel from '@mui/material/FormLabel';
import FormControl from '@mui/material/FormControl';
import Link from '@mui/material/Link';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import MuiCard from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import { useColorScheme } from '@mui/joy/styles';
import { GoogleIcon, AppIcon } from '../components/auth/CustomIcons';
import { TelegramIcon } from '../components/auth/TelegramIcon';
import Content from '../components/auth/Content';

export default function SignUpPage() {
    const navigate = useNavigate();
    const { mode, setMode } = useColorScheme();
    const resolvedMode = mode || 'light';
    const isDark = resolvedMode === 'dark';
    const [emailError, setEmailError] = React.useState(false);
    const [emailErrorMessage, setEmailErrorMessage] = React.useState('');
    const [passwordError, setPasswordError] = React.useState(false);
    const [passwordErrorMessage, setPasswordErrorMessage] = React.useState('');
    const [confirmPasswordError, setConfirmPasswordError] = React.useState(false);
    const [confirmPasswordErrorMessage, setConfirmPasswordErrorMessage] = React.useState('');
    const [loading, setLoading] = React.useState(false);
    const [serverError, setServerError] = React.useState('');

    const handleGoogleLogin = () => {
        window.location.href = '/api/auth/google';
    };

    const handleTelegram = () => {
        window.open('https://t.me/+6285778135021', '_blank');
    };

    const validateInputs = () => {
        const email = document.getElementById('email');
        const password = document.getElementById('password');
        const confirmPassword = document.getElementById('confirmPassword');
        let isValid = true;

        if (!email.value || !/\S+@\S+\.\S+/.test(email.value)) {
            setEmailError(true);
            setEmailErrorMessage('Please enter a valid email address.');
            isValid = false;
        } else {
            setEmailError(false);
            setEmailErrorMessage('');
        }

        if (!password.value || password.value.length < 6) {
            setPasswordError(true);
            setPasswordErrorMessage('Password must be at least 6 characters long.');
            isValid = false;
        } else {
            setPasswordError(false);
            setPasswordErrorMessage('');
        }

        if (!confirmPassword.value || confirmPassword.value !== password.value) {
            setConfirmPasswordError(true);
            setConfirmPasswordErrorMessage('Passwords do not match.');
            isValid = false;
        } else {
            setConfirmPasswordError(false);
            setConfirmPasswordErrorMessage('');
        }

        return isValid;
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!validateInputs()) return;

        setLoading(true);
        setServerError('');

        const data = new FormData(event.currentTarget);
        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: data.get('email'),
                    password: data.get('password'),
                }),
            });
            const result = await res.json();
            if (res.ok && result.success) {
                window.location.href = '/';
            } else {
                setServerError(result.error || 'Registration failed. Please try again.');
            }
        } catch {
            setServerError('Unable to connect to server.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <React.Fragment>
            <Box sx={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 1300 }}>
                <Tooltip title="Ganti tema">
                    <IconButton
                        size="small"
                        onClick={() => setMode(isDark ? 'light' : 'dark')}
                        aria-label="toggle-color-scheme"
                    >
                        {isDark ? (
                            <LightModeRoundedIcon fontSize="small" />
                        ) : (
                            <DarkModeRoundedIcon fontSize="small" />
                        )}
                    </IconButton>
                </Tooltip>
            </Box>

            <Stack
                direction="column"
                component="main"
                sx={[
                    {
                        justifyContent: 'center',
                        height: 'calc((1 - var(--template-frame-height, 0)) * 100%)',
                        marginTop: 'max(40px - var(--template-frame-height, 0px), 0px)',
                        minHeight: '100%',
                    },
                    {
                        '&::before': {
                            content: '""',
                            display: 'block',
                            position: 'fixed',
                            zIndex: -1,
                            inset: 0,
                            backgroundColor: isDark ? '#000' : undefined,
                            backgroundImage: isDark
                                ? 'none'
                                : 'radial-gradient(ellipse at 50% 50%, hsl(210, 100%, 97%), hsl(0, 0%, 100%))',
                            backgroundRepeat: 'no-repeat',
                        },
                    },
                ]}
            >
                <Stack
                    direction={{ xs: 'column-reverse', md: 'row' }}
                    sx={{
                        justifyContent: 'center',
                        gap: { xs: 6, sm: 12 },
                        p: { xs: 2, sm: 4 },
                        m: 'auto',
                    }}
                >
                    <Content />
                    <MuiCard
                        variant="outlined"
                        sx={(theme) => ({
                            display: 'flex',
                            flexDirection: 'column',
                            alignSelf: 'center',
                            width: '100%',
                            padding: theme.spacing(4),
                            gap: theme.spacing(2),
                            boxShadow: isDark
                                ? 'hsla(220, 30%, 5%, 0.5) 0px 5px 15px 0px, hsla(220, 25%, 10%, 0.08) 0px 15px 35px -5px'
                                : 'hsla(220, 30%, 5%, 0.05) 0px 5px 15px 0px, hsla(220, 25%, 10%, 0.05) 0px 15px 35px -5px',
                            [theme.breakpoints.up('sm')]: {
                                width: '450px',
                            },
                        })}
                    >
                        <Box sx={{ display: { xs: 'flex', md: 'none' } }}>
                            <AppIcon />
                        </Box>
                        <Typography
                            component="h1"
                            variant="h4"
                            sx={{ width: '100%', fontSize: 'clamp(2rem, 10vw, 2.15rem)' }}
                        >
                            Sign up
                        </Typography>
                        {serverError && (
                            <Alert severity="error" sx={{ width: '100%' }}>
                                {serverError}
                            </Alert>
                        )}
                        <Box
                            component="form"
                            onSubmit={handleSubmit}
                            noValidate
                            sx={{ display: 'flex', flexDirection: 'column', width: '100%', gap: 2 }}
                        >
                            <FormControl>
                                <FormLabel htmlFor="email">Email</FormLabel>
                                <TextField
                                    error={emailError}
                                    helperText={emailErrorMessage}
                                    id="email"
                                    type="email"
                                    name="email"
                                    placeholder="your@email.com"
                                    autoComplete="email"
                                    autoFocus
                                    required
                                    fullWidth
                                    variant="outlined"
                                    color={emailError ? 'error' : 'primary'}
                                />
                            </FormControl>
                            <FormControl>
                                <FormLabel htmlFor="password">Password</FormLabel>
                                <TextField
                                    error={passwordError}
                                    helperText={passwordErrorMessage}
                                    name="password"
                                    placeholder="••••••"
                                    type="password"
                                    id="password"
                                    autoComplete="new-password"
                                    required
                                    fullWidth
                                    variant="outlined"
                                    color={passwordError ? 'error' : 'primary'}
                                />
                            </FormControl>
                            <FormControl>
                                <FormLabel htmlFor="confirmPassword">Confirm password</FormLabel>
                                <TextField
                                    error={confirmPasswordError}
                                    helperText={confirmPasswordErrorMessage}
                                    name="confirmPassword"
                                    placeholder="••••••"
                                    type="password"
                                    id="confirmPassword"
                                    autoComplete="new-password"
                                    required
                                    fullWidth
                                    variant="outlined"
                                    color={confirmPasswordError ? 'error' : 'primary'}
                                />
                            </FormControl>
                            <Button
                                type="submit"
                                fullWidth
                                variant="contained"
                                disabled={loading}
                            >
                                {loading ? <CircularProgress size={24} color="inherit" /> : 'Sign up'}
                            </Button>
                            <Typography sx={{ textAlign: 'center' }}>
                                Already have an account?{' '}
                                <Link
                                    component="button"
                                    type="button"
                                    onClick={() => navigate('/login')}
                                    variant="body2"
                                    sx={{ alignSelf: 'center' }}
                                >
                                    Sign in
                                </Link>
                            </Typography>
                        </Box>
                        <Divider>or</Divider>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <Button
                                fullWidth
                                variant="outlined"
                                onClick={handleGoogleLogin}
                                startIcon={<GoogleIcon />}
                            >
                                Sign up with Google
                            </Button>
                            <Button
                                fullWidth
                                variant="outlined"
                                onClick={handleTelegram}
                                startIcon={<TelegramIcon />}
                                sx={{
                                    color: 'white',
                                    border: 'none',
                                    backgroundImage: 'linear-gradient(to right, #0088cc, #0099e6, #00aaff)',
                                    '&:hover': {
                                        backgroundImage: 'linear-gradient(to right, #006da3, #0088cc, #0099e6)',
                                        border: 'none',
                                    },
                                }}
                            >
                                Chat Admin via Telegram
                            </Button>
                        </Box>
                    </MuiCard>
                </Stack>
            </Stack>
        </React.Fragment>
    );
}
