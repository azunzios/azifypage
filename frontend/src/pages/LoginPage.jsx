import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
    const [mode, setMode] = useState('login'); // 'login' or 'register'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleGoogleLogin = () => {
        window.location.href = '/api/auth/google';
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';

        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                window.location.href = '/';
            } else {
                setError(data.error || 'Terjadi kesalahan');
            }
        } catch (err) {
            setError('Gagal terhubung ke server');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-4">
            <div className="w-full max-w-md">
                <div className="bg-white rounded-2xl shadow-xl p-8">
                    {/* Logo */}
                    <div className="text-center mb-6">
                        <img src="/logo.svg" alt="AzifyPage" className="h-8 mx-auto" />
                        <p className="text-slate-500 text-sm mt-2">Download Manager Premium</p>
                    </div>

                    {/* Mode Toggle */}
                    <div className="flex gap-2 p-1 bg-slate-100 rounded-lg mb-6">
                        <button
                            onClick={() => { setMode('login'); setError(''); }}
                            className={`flex-1 py-2 rounded-md text-sm font-medium ${mode === 'login' ? 'bg-white text-forest shadow-sm' : 'text-slate-500'}`}
                        >
                            Masuk
                        </button>
                        <button
                            onClick={() => { setMode('register'); setError(''); }}
                            className={`flex-1 py-2 rounded-md text-sm font-medium ${mode === 'register' ? 'bg-white text-forest shadow-sm' : 'text-slate-500'}`}
                        >
                            Daftar
                        </button>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg mb-4">
                            {error}
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-forest placeholder:text-slate-400 focus:ring-2 focus:ring-accent focus:border-accent text-sm"
                                placeholder="email@example.com"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full h-11 px-4 pr-10 rounded-lg border border-slate-300 bg-white text-forest placeholder:text-slate-400 focus:ring-2 focus:ring-accent focus:border-accent text-sm"
                                    placeholder={mode === 'register' ? 'Minimal 6 karakter' : '••••••••'}
                                    required
                                    minLength={mode === 'register' ? 6 : undefined}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full h-11 rounded-lg bg-accent text-white font-semibold hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Memproses...' : (mode === 'login' ? 'Masuk' : 'Daftar')}
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="flex items-center gap-4 my-6">
                        <div className="flex-1 h-px bg-slate-200"></div>
                        <span className="text-xs text-slate-400">atau</span>
                        <div className="flex-1 h-px bg-slate-200"></div>
                    </div>

                    {/* Google Login Button */}
                    <button
                        onClick={handleGoogleLogin}
                        className="w-full flex items-center justify-center gap-3 h-11 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors font-medium text-forest"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path
                                fill="#4285F4"
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            />
                            <path
                                fill="#34A853"
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            />
                            <path
                                fill="#FBBC05"
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                            />
                            <path
                                fill="#EA4335"
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            />
                        </svg>
                        <span>Masuk dengan Google</span>
                    </button>

                    {/* Info */}
                    <p className="text-center text-xs text-slate-400 mt-6">
                        Dengan masuk, Anda menyetujui{' '}
                        <a href="#" className="text-accent hover:underline">Syarat & Ketentuan</a>
                        {' '}dan{' '}
                        <a href="#" className="text-accent hover:underline">Kebijakan Privasi</a>
                    </p>
                </div>

                <p className="text-center text-xs text-slate-400 mt-6">
                    © 2026 AzifyPage. All rights reserved.
                </p>
            </div>
        </div>
    );
}
