import { Link } from 'react-router-dom';
import { Download, Zap, Shield, Server, ArrowRight, Check } from 'lucide-react';

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            {/* Navigation */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-lg border-b border-slate-700/50">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
                            <Download className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-xl font-bold text-white">AzifyPage</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link
                            to="/login"
                            className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
                        >
                            Masuk
                        </Link>
                        <Link
                            to="/login"
                            className="px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 rounded-lg hover:from-blue-500 hover:to-cyan-400 transition-all shadow-lg shadow-blue-500/25"
                        >
                            Daftar
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative pt-32 pb-20 px-6 overflow-hidden">
                {/* Background decorations */}
                <div className="absolute top-20 left-1/4 w-72 h-72 bg-blue-500/20 rounded-full blur-[100px]"></div>
                <div className="absolute top-40 right-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-[120px]"></div>

                <div className="max-w-4xl mx-auto text-center relative">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/80 border border-slate-700 mb-8">
                        <Zap className="w-4 h-4 text-yellow-400" />
                        <span className="text-sm text-slate-300">Download Instan & Aman</span>
                    </div>

                    <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
                        Bantu kamu mengunduh file{' '}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
                            premium
                        </span>{' '}
                        dengan instant!
                    </h1>

                    <p className="text-lg md:text-xl text-slate-400 mb-10 max-w-2xl mx-auto">
                        Download dari berbagai hosting premium seperti Rapidgator, Uploaded, Nitroflare,
                        dan torrent dengan kecepatan super tinggi tanpa batas.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link
                            to="/login"
                            className="inline-flex items-center justify-center gap-2 px-8 py-4 text-lg font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 rounded-xl hover:from-blue-500 hover:to-cyan-400 transition-all shadow-xl shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-105"
                        >
                            Mulai Sekarang
                            <ArrowRight className="w-5 h-5" />
                        </Link>
                        <a
                            href="#features"
                            className="inline-flex items-center justify-center gap-2 px-8 py-4 text-lg font-semibold text-slate-300 bg-slate-800/80 border border-slate-700 rounded-xl hover:bg-slate-700/80 transition-all"
                        >
                            Pelajari Lebih
                        </a>
                    </div>
                </div>

                {/* Stats */}
                <div className="max-w-4xl mx-auto mt-20 grid grid-cols-2 md:grid-cols-4 gap-6">
                    {[
                        { value: '50+', label: 'Premium Hosts' },
                        { value: '99.9%', label: 'Uptime' },
                        { value: '1Gbps+', label: 'Kecepatan' },
                        { value: '24/7', label: 'Support' },
                    ].map((stat, i) => (
                        <div key={i} className="text-center p-4 rounded-2xl bg-slate-800/50 border border-slate-700/50">
                            <div className="text-3xl md:text-4xl font-bold text-white mb-1">{stat.value}</div>
                            <div className="text-sm text-slate-400">{stat.label}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="py-20 px-6">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                            Kenapa Pilih AzifyPage?
                        </h2>
                        <p className="text-slate-400 max-w-xl mx-auto">
                            Layanan download premium terbaik dengan fitur lengkap untuk kebutuhan Anda
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            {
                                icon: <Zap className="w-6 h-6" />,
                                title: 'Download Instan',
                                description: 'File yang sudah tersedia di server kami bisa langsung diunduh tanpa menunggu.',
                                gradient: 'from-yellow-500 to-orange-500'
                            },
                            {
                                icon: <Server className="w-6 h-6" />,
                                title: '50+ Premium Hosts',
                                description: 'Mendukung Rapidgator, Uploaded, Nitroflare, Mega, Mediafire, dan banyak lagi.',
                                gradient: 'from-blue-500 to-cyan-500'
                            },
                            {
                                icon: <Shield className="w-6 h-6" />,
                                title: 'Aman & Terpercaya',
                                description: 'Data Anda terenkripsi dan kami tidak menyimpan file lebih dari yang diperlukan.',
                                gradient: 'from-green-500 to-emerald-500'
                            }
                        ].map((feature, i) => (
                            <div
                                key={i}
                                className="group p-8 rounded-2xl bg-slate-800/50 border border-slate-700/50 hover:border-slate-600 transition-all hover:transform hover:scale-105"
                            >
                                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center text-white mb-6 group-hover:scale-110 transition-transform`}>
                                    {feature.icon}
                                </div>
                                <h3 className="text-xl font-semibold text-white mb-3">{feature.title}</h3>
                                <p className="text-slate-400">{feature.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Pricing Preview */}
            <section className="py-20 px-6 bg-slate-800/30">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                            Harga Terjangkau
                        </h2>
                        <p className="text-slate-400">
                            Bayar sesuai pemakaian, tanpa langganan bulanan
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="p-8 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-800/50 border border-slate-700">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                    <Download className="w-5 h-5 text-blue-400" />
                                </div>
                                <h3 className="text-xl font-semibold text-white">Torrent / Magnet</h3>
                            </div>
                            <div className="text-4xl font-bold text-white mb-2">
                                Rp 650<span className="text-lg font-normal text-slate-400">/GB</span>
                            </div>
                            <ul className="space-y-3 mt-6">
                                {['Download instan jika cached', 'Kecepatan server 1Gbps', 'Mendukung magnet link'].map((item, i) => (
                                    <li key={i} className="flex items-center gap-2 text-slate-300">
                                        <Check className="w-4 h-4 text-green-400" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="p-8 rounded-2xl bg-gradient-to-br from-blue-600/20 to-cyan-600/20 border border-blue-500/30">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                                    <Zap className="w-5 h-5 text-cyan-400" />
                                </div>
                                <h3 className="text-xl font-semibold text-white">Premium Host</h3>
                            </div>
                            <div className="text-4xl font-bold text-white mb-2">
                                Rp 2.000<span className="text-lg font-normal text-slate-400">/2GB</span>
                            </div>
                            <ul className="space-y-3 mt-6">
                                {['50+ premium file hosts', 'Rapidgator, Uploaded, dll', 'Prioritas download'].map((item, i) => (
                                    <li key={i} className="flex items-center gap-2 text-slate-300">
                                        <Check className="w-4 h-4 text-green-400" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20 px-6">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                        Siap untuk mulai download?
                    </h2>
                    <p className="text-slate-400 mb-10 max-w-xl mx-auto">
                        Daftar gratis sekarang dan dapatkan akses ke semua fitur premium kami.
                    </p>
                    <Link
                        to="/login"
                        className="inline-flex items-center justify-center gap-2 px-10 py-4 text-lg font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 rounded-xl hover:from-blue-500 hover:to-cyan-400 transition-all shadow-xl shadow-blue-500/30 hover:shadow-blue-500/50"
                    >
                        Daftar Sekarang — Gratis
                        <ArrowRight className="w-5 h-5" />
                    </Link>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-10 px-6 border-t border-slate-800">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
                            <Download className="w-3 h-3 text-white" />
                        </div>
                        <span className="font-semibold text-white">AzifyPage</span>
                    </div>
                    <p className="text-sm text-slate-500">
                        © 2026 AzifyPage. All rights reserved.
                    </p>
                </div>
            </footer>
        </div>
    );
}
