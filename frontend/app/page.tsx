'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function WaitlistPage() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [companySize, setCompanySize] = useState('');
  const [pain, setPain] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    setLoading(true);

    try {
      await apiClient.joinWaitlist({
        email,
        role,
        company_size: companySize,
        top_pain: pain || null,
      });
      setSubmitted(true);
    } catch (err: any) {
      setSubmitError(
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.response?.data?.detail ||
        'Failed to submit. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-purple-500/30">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 py-6 max-w-7xl mx-auto">
        <div className="text-xl font-bold tracking-tight">SpendCheck</div>
        <div className="flex gap-4">
          <button onClick={() => router.push('/login')} className="text-sm font-medium hover:text-purple-400 transition">
            Login
          </button>
          <button onClick={() => document.getElementById('waitlist')?.scrollIntoView({ behavior: 'smooth' })} className="bg-white text-slate-900 px-4 py-2 rounded-full text-sm font-semibold hover:bg-gray-100 transition">
            Get Early Access
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-20 pb-32 px-6 max-w-5xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300 text-xs font-medium mb-8">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
          </span>
          For CFOs & Finance Leaders
        </div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 bg-gradient-to-br from-white via-white to-gray-500 bg-clip-text text-transparent">
          Stop Losing 1-5% of Vendor Spend to Billing Errors
        </h1>

        <p className="text-xl text-gray-400 mb-12 max-w-2xl mx-auto leading-relaxed">
          Use SpendCheck to find duplicate payments, price drift, and zombie subscriptions in 14 days.
          Upload AP exports & contracts. Get a recovery plan. No integrations required.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button onClick={() => document.getElementById('waitlist')?.scrollIntoView({ behavior: 'smooth' })} className="w-full sm:w-auto bg-purple-600 hover:bg-purple-500 text-white px-8 py-4 rounded-full font-bold text-lg transition shadow-lg shadow-purple-500/20">
            Audit My Spend
          </button>
          <button className="w-full sm:w-auto px-8 py-4 rounded-full font-medium text-gray-300 hover:text-white transition border border-white/10 hover:border-white/20">
            View Sample Report
          </button>
        </div>
      </section>

      {/* Social Proof / Stats */}
      <section className="border-y border-white/5 bg-white/2 py-12">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <div className="text-3xl font-bold text-white mb-1">$50K+</div>
            <div className="text-sm text-gray-500">Avg. Found / Audit</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-white mb-1">14 Days</div>
            <div className="text-sm text-gray-500">Time to Value</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-white mb-1">ZERO</div>
            <div className="text-sm text-gray-500">Integrations Needed</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-white mb-1">100%</div>
            <div className="text-sm text-gray-500">Secure & Confidential</div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-32 px-6 max-w-7xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">How It Works</h2>
        <div className="grid md:grid-cols-3 gap-12">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
            <div className="relative bg-slate-900 border border-white/10 p-8 rounded-2xl h-full">
              <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center mb-6 text-2xl">📂</div>
              <h3 className="text-xl font-bold mb-3">1. Upload Exports</h3>
              <p className="text-gray-400">Drag & drop your AP export (CSV) and vendor contracts (PDF). We handle the parsing and normalization automatically.</p>
            </div>
          </div>
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
            <div className="relative bg-slate-900 border border-white/10 p-8 rounded-2xl h-full">
              <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center mb-6 text-2xl">🔍</div>
              <h3 className="text-xl font-bold mb-3">2. AI Analysis</h3>
              <p className="text-gray-400">Our engine detects duplicate payments, unit price drift, and risky auto-renewal clauses hidden in your data.</p>
            </div>
          </div>
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
            <div className="relative bg-slate-900 border border-white/10 p-8 rounded-2xl h-full">
              <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center mb-6 text-2xl">💰</div>
              <h3 className="text-xl font-bold mb-3">3. Recover Cash</h3>
              <p className="text-gray-400">Get a prioritized "Leak Report" with actionable steps to recover overpayments and stop future leakage.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Waitlist Form */}
      <section id="waitlist" className="py-24 px-6 max-w-3xl mx-auto text-center">
        <div className="bg-gradient-to-b from-white/10 to-white/5 p-px rounded-3xl">
          <div className="bg-slate-950 rounded-3xl p-8 md:p-12">
            <h2 className="text-3xl font-bold mb-4">Join the Waitlist</h2>
            <p className="text-gray-400 mb-8">We are currently onboarding mid-market finance teams. Secure your spot for early access.</p>

            {submitted ? (
              <div className="bg-green-500/10 border border-green-500/20 text-green-200 p-6 rounded-xl">
                <h3 className="font-bold text-lg mb-2">You're on the list! 🎉</h3>
                <p>We'll be in touch shortly to schedule your onboarding.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 text-left">
                {submitError && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {submitError}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Work Email</label>
                  <input
                    type="email"
                    required
                    placeholder="name@company.com"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Role</label>
                    <select
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      required
                    >
                      <option value="">Select Role</option>
                      <option value="CFO">CFO</option>
                      <option value="VP Finance">VP Finance</option>
                      <option value="Controller">Controller</option>
                      <option value="Procurement">Procurement</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Company Size</label>
                    <select
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      value={companySize}
                      onChange={(e) => setCompanySize(e.target.value)}
                      required
                    >
                      <option value="">Select Size</option>
                      <option value="1-200">1-200</option>
                      <option value="201-500">201-500</option>
                      <option value="501-1000">501-1000</option>
                      <option value="1000+">1000+</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Biggest Spend Pain?</label>
                  <input
                    type="text"
                    placeholder="e.g. Duplicate invoices, Surprise renewals..."
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    value={pain}
                    onChange={(e) => setPain(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 rounded-lg transition mt-4 disabled:opacity-50"
                >
                  {loading ? 'Joining...' : 'Request Access'}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      <footer className="py-12 text-center text-gray-500 text-sm">
        &copy; 2026 SpendCheck. All rights reserved.
      </footer>
    </div>
  );
}
