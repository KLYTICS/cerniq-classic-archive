'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { analytics, EVENTS } from '@/lib/analytics';

const NODE_API_URL = (process.env.NEXT_PUBLIC_NODE_API_URL || '').trim().replace(/\/+$/, '');

export default function PortalLogin() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setSending(true);
    setError(null);

    try {
      const res = await fetch(`${NODE_API_URL}/auth/magic/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (res.ok) {
        setSent(true);
        analytics.track(EVENTS.PORTAL_LOGIN_REQUESTED, { email: email.trim() });
      } else {
        setError('Unable to send login link. Please try again.');
      }
    } catch {
      setError('Network error. Please check your connection.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-[#1B3A6B] rounded-xl flex items-center justify-center mx-auto mb-3">
            <span className="text-white font-bold text-lg">C</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">CERNIQ Portal</h1>
          <p className="text-sm text-gray-500 mt-1">Asset Liability Management</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          {sent ? (
            <div className="text-center py-4">
              <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-3" />
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Check your email</h2>
              <p className="text-sm text-gray-500 mb-4">
                If <strong>{email}</strong> has an account, we sent a login link. It expires in 24 hours.
              </p>
              <button
                onClick={() => { setSent(false); setEmail(''); }}
                className="text-sm text-[#1B3A6B] hover:underline"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Sign in</h2>
              <p className="text-sm text-gray-500 mb-6">
                Enter your email to receive a secure login link.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="cfo@institution.com"
                      required
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]/20 focus:border-[#1B3A6B]"
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-red-600">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={sending || !email.trim()}
                  className="w-full bg-[#1B3A6B] text-white py-2.5 rounded-lg text-sm font-medium hover:bg-[#15305a] transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? 'Sending...' : 'Send Login Link'}
                </button>
              </form>
            </>
          )}
        </div>

        <div className="text-center mt-6">
          <Link href="/" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft className="h-3 w-3" /> Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
