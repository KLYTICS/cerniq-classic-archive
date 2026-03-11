'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API_URL = (
    process.env.NEXT_PUBLIC_NODE_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    ''
).trim().replace(/\/+$/, '');
const AUTH_TOKEN_STORAGE = 'auth_token';
const REFRESH_TOKEN_STORAGE = 'refresh_token';

export default function LoginPage() {
    const router = useRouter();
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
            const body: any = { email, password };
            if (mode === 'register' && name) body.name = name;

            const res = await fetch(`${API_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Authentication failed');
            }

            const data = await res.json();

            // Keep bearer tokens session-scoped to reduce XSS persistence risk.
            sessionStorage.setItem(AUTH_TOKEN_STORAGE, data.accessToken);
            sessionStorage.setItem(REFRESH_TOKEN_STORAGE, data.refreshToken);
            localStorage.removeItem(AUTH_TOKEN_STORAGE);
            localStorage.removeItem(REFRESH_TOKEN_STORAGE);
            localStorage.setItem('userId', data.user.id);
            localStorage.setItem('userEmail', data.user.email);
            if (data.user.name) localStorage.setItem('userName', data.user.name);

            router.push('/spendcheck');
        } catch (err: any) {
            setError(err.message || 'Something went wrong');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
            {/* Background gradient */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
            </div>

            <div className="relative z-10 w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent mb-2">
                        SpendCheck
                    </h1>
                    <p className="text-gray-400">AI-Powered Expense Management</p>
                </div>

                {/* Card */}
                <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-800 rounded-2xl p-8 shadow-2xl">
                    {/* Toggle */}
                    <div className="flex bg-gray-800 rounded-lg p-1 mb-6">
                        <button
                            onClick={() => setMode('login')}
                            className={`flex-1 py-2 text-sm font-medium rounded-md transition ${mode === 'login' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            Sign In
                        </button>
                        <button
                            onClick={() => setMode('register')}
                            className={`flex-1 py-2 text-sm font-medium rounded-md transition ${mode === 'register' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            Sign Up
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {mode === 'register' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1.5">Full Name</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="John Doe"
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent focus:outline-none transition"
                                />
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1.5">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="you@company.com"
                                required
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent focus:outline-none transition"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1.5">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                minLength={8}
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent focus:outline-none transition"
                            />
                        </div>

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 disabled:from-gray-700 disabled:to-gray-700 text-white py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white" />
                            ) : mode === 'login' ? (
                                'Sign In'
                            ) : (
                                'Create Account'
                            )}
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="flex items-center gap-3 my-6">
                        <div className="flex-1 h-px bg-gray-700" />
                        <span className="text-xs text-gray-500">OR</span>
                        <div className="flex-1 h-px bg-gray-700" />
                    </div>

                    {/* Social Auth (future) */}
                    <div className="space-y-3">
                        <button className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 py-3 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 text-gray-300">
                            <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
                            Continue with Google
                        </button>
                        <button className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 py-3 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 text-gray-300">
                            <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M11.4 24H1V11h3.2V7.6C4.2 3.4 7.2 0 12.2 0c2 0 4 .3 4 .3l-.4 3.8s-1.1-.1-2.2-.1c-1.3 0-1.5.6-1.5 1.5V11h4l-.6 4h-3.4v9h-.6z" /></svg>
                            Continue with Microsoft
                        </button>
                    </div>
                </div>

                <p className="text-center text-xs text-gray-600 mt-6">
                    By signing in, you agree to SpendCheck&apos;s Terms and Privacy Policy
                </p>
            </div>
        </div>
    );
}
