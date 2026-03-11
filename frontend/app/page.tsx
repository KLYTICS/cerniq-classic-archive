'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { Landmark, Shield, TrendingUp, Zap, BarChart3, ArrowRight, CheckCircle2, Check } from 'lucide-react';

const NODE_API_URL = (process.env.NEXT_PUBLIC_NODE_API_URL || '').trim().replace(/\/+$/, '');

export default function LandingPage() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [institutionName, setInstitutionName] = useState('');
  const [institutionType, setInstitutionType] = useState('');
  const [totalAssets, setTotalAssets] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const router = useRouter();

  async function handleCheckout(tier: string) {
    setLoadingTier(tier);
    try {
      const res = await fetch(`${NODE_API_URL}/api/billing/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier,
          successUrl: '/portal?welcome=1',
          cancelUrl: '/#pricing',
        }),
      });
      if (!res.ok) throw new Error('Checkout failed');
      const { checkoutUrl } = await res.json();
      window.location.href = checkoutUrl;
    } catch {
      alert('Unable to start checkout. Please try again.');
    } finally {
      setLoadingTier(null);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    setLoading(true);

    try {
      await apiClient.submitDemoRequest({
        email,
        name,
        institutionName,
        institutionType,
        totalAssets,
      });
      setSubmitted(true);
    } catch (err: any) {
      setSubmitError(
        err?.response?.data?.message || 'Failed to submit. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-amber-500/30">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center">
            <span className="text-slate-900 font-bold text-sm">C</span>
          </div>
          <span className="text-xl font-bold tracking-tight">CERNIQ</span>
        </div>
        <div className="flex gap-4 items-center">
          <button
            onClick={() =>
              document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })
            }
            className="text-sm font-medium hover:text-amber-400 transition hidden sm:block"
          >
            Pricing
          </button>
          <button
            onClick={() => router.push('/login')}
            className="text-sm font-medium hover:text-amber-400 transition"
          >
            Login
          </button>
          <button
            onClick={() =>
              document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })
            }
            className="bg-amber-500 hover:bg-amber-400 text-slate-900 px-4 py-2 rounded-full text-sm font-semibold transition"
          >
            Request Demo
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-20 pb-32 px-6 max-w-5xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs font-medium mb-8">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
          For Banks, Credit Unions, Cooperativas & Family Offices
        </div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 bg-gradient-to-br from-white via-white to-gray-500 bg-clip-text text-transparent">
          Enterprise Risk Intelligence
          <br />
          <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
            in Minutes, Not Months
          </span>
        </h1>

        <p className="text-xl text-gray-400 mb-12 max-w-2xl mx-auto leading-relaxed">
          CERNIQ gives mid-market financial institutions the ALM analytics, stress testing,
          and regulatory compliance tools that used to require a $500K consulting engagement.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={() =>
              document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })
            }
            className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-slate-900 px-8 py-4 rounded-full font-bold text-lg transition shadow-lg shadow-amber-500/20"
          >
            See It Live
          </button>
          <button
            onClick={() => router.push('/login?mode=signup')}
            className="w-full sm:w-auto px-8 py-4 rounded-full font-medium text-gray-300 hover:text-white transition border border-white/10 hover:border-white/20"
          >
            Start Free Trial
          </button>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-white/5 py-12">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <div className="text-3xl font-bold text-white mb-1">Basel III</div>
            <div className="text-sm text-gray-500">LCR & NSFR Compliant</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-white mb-1">1,000</div>
            <div className="text-sm text-gray-500">Monte Carlo Paths</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-white mb-1">&lt; 2 sec</div>
            <div className="text-sm text-gray-500">Stress Test Runtime</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-white mb-1">PDF</div>
            <div className="text-sm text-gray-500">Board-Ready Reports</div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-32 px-6 max-w-7xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
          Everything Your Risk Team Needs
        </h2>
        <p className="text-gray-400 text-center mb-16 max-w-2xl mx-auto">
          From balance sheet ingestion to board-ready reports — one platform.
        </p>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[
            {
              icon: TrendingUp,
              title: 'Interest Rate Risk',
              desc: 'NII and MVE sensitivity across parallel and twist scenarios. Duration gap analysis with asset/liability breakdown.',
              color: 'text-blue-400',
              bg: 'from-blue-500/20 to-blue-600/10',
            },
            {
              icon: Shield,
              title: 'Liquidity & LCR',
              desc: 'Basel III LCR/NSFR with HQLA decomposition, cash flow waterfall, and regulatory buffer tracking.',
              color: 'text-emerald-400',
              bg: 'from-emerald-500/20 to-emerald-600/10',
            },
            {
              icon: Zap,
              title: 'Monte Carlo Stress Tests',
              desc: 'Vasicek interest rate model with 1,000 paths. Regulatory scenarios (rapid rise, inversion, shock down).',
              color: 'text-orange-400',
              bg: 'from-orange-500/20 to-orange-600/10',
            },
            {
              icon: BarChart3,
              title: 'Balance Sheet Analytics',
              desc: 'Inline editing, CSV upload, duration heatmap. Real-time repricing gap and maturity distribution.',
              color: 'text-indigo-400',
              bg: 'from-indigo-500/20 to-indigo-600/10',
            },
            {
              icon: Landmark,
              title: 'Multi-Institution',
              desc: 'Manage multiple institutions from a single workspace. Compare risk metrics across your portfolio.',
              color: 'text-amber-400',
              bg: 'from-amber-500/20 to-amber-600/10',
            },
            {
              icon: ArrowRight,
              title: 'Board-Ready PDF Reports',
              desc: 'One-click PDF export with executive summary, risk metrics, stress results, and recommendations.',
              color: 'text-cyan-400',
              bg: 'from-cyan-500/20 to-cyan-600/10',
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className={`bg-gradient-to-br ${feature.bg} border border-white/10 p-8 rounded-2xl hover:border-white/20 transition`}
            >
              <feature.icon className={`h-8 w-8 ${feature.color} mb-4`} />
              <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
              <p className="text-gray-400 leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Who It's For */}
      <section className="py-24 px-6 border-y border-white/5">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">Built For</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                title: 'Community Banks',
                desc: 'Full IRRBB compliance without the Big 4 price tag. Duration gap, NII sensitivity, and stress testing.',
                stat: '$500M - $5B assets',
              },
              {
                title: 'Credit Unions',
                desc: 'Meet NCUA requirements with automated ALM reporting. NEV analysis, concentration risk, and LCR.',
                stat: '$100M - $1B assets',
              },
              {
                title: 'Cooperativas PR',
                desc: 'Cumplimiento COSSEC con reportes bilingues. Ratio de capital, liquidez, y pruebas de estres automatizadas.',
                stat: '$50M - $500M activos',
              },
              {
                title: 'Family Offices',
                desc: 'Portfolio-level interest rate and liquidity risk. Monte Carlo stress testing across multi-asset allocations.',
                stat: '$25M - $500M AUM',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="bg-slate-900/60 border border-white/10 rounded-2xl p-8"
              >
                <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                <p className="text-gray-400 mb-4 leading-relaxed">{item.desc}</p>
                <span className="text-xs text-amber-400 font-medium">{item.stat}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-32 px-6 max-w-5xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
          Up and Running in 3 Steps
        </h2>
        <div className="grid md:grid-cols-3 gap-12">
          {[
            {
              step: '1',
              title: 'Import Balance Sheet',
              desc: 'Upload a CSV or enter positions manually. We auto-calculate durations, repricing schedules, and rate sensitivity.',
            },
            {
              step: '2',
              title: 'Run Risk Analysis',
              desc: 'Instant duration gap, NII sensitivity (8 scenarios), LCR compliance, and Monte Carlo stress tests.',
            },
            {
              step: '3',
              title: 'Download Reports',
              desc: 'Generate branded PDF reports for your board, auditors, or regulators. One click.',
            },
          ].map((item) => (
            <div key={item.step} className="text-center">
              <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-6 text-amber-400 font-bold text-xl">
                {item.step}
              </div>
              <h3 className="text-xl font-bold mb-3">{item.title}</h3>
              <p className="text-gray-400 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-32 px-6 border-y border-white/5">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-gray-400 text-center mb-16 max-w-2xl mx-auto">
            From a single report to full-service risk management. Pick what fits.
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            {/* One-Time Report */}
            <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-8 flex flex-col">
              <h3 className="text-lg font-bold text-white mb-1">ALM Report</h3>
              <p className="text-gray-500 text-sm mb-6">One-time engagement</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-white">$750</span>
                <span className="text-gray-500 ml-1">/ report</span>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {[
                  'Full balance sheet analysis',
                  'NII & EVE sensitivity',
                  'Monte Carlo stress test',
                  'COSSEC / NCUA compliance',
                  'Bilingual PDF (EN/ES)',
                  'Board-ready formatting',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-gray-300">
                    <Check className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleCheckout('one_time')}
                disabled={loadingTier === 'one_time'}
                className="w-full py-3 rounded-lg font-semibold border border-amber-500/50 text-amber-400 hover:bg-amber-500/10 transition disabled:opacity-60"
              >
                {loadingTier === 'one_time' ? 'Loading...' : 'Get Started — $750'}
              </button>
            </div>

            {/* SaaS */}
            <div className="bg-gradient-to-b from-amber-500/10 to-slate-900/60 border-2 border-amber-500/40 rounded-2xl p-8 flex flex-col relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-slate-900 text-xs font-bold px-3 py-1 rounded-full">
                MOST POPULAR
              </div>
              <h3 className="text-lg font-bold text-white mb-1">Platform</h3>
              <p className="text-gray-500 text-sm mb-6">Self-serve SaaS access</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-white">$299</span>
                <span className="text-gray-500 ml-1">/ month</span>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {[
                  'Everything in ALM Report',
                  'Unlimited reports',
                  'Real-time dashboard',
                  'CSV & API data ingestion',
                  'Multi-institution support',
                  'Monthly compliance snapshots',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-gray-300">
                    <Check className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleCheckout('monthly')}
                disabled={loadingTier === 'monthly'}
                className="w-full py-3 rounded-lg font-semibold bg-amber-500 hover:bg-amber-400 text-slate-900 transition disabled:opacity-60"
              >
                {loadingTier === 'monthly' ? 'Loading...' : 'Start — $299/mo'}
              </button>
            </div>

            {/* Partner */}
            <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-8 flex flex-col">
              <h3 className="text-lg font-bold text-white mb-1">Partner</h3>
              <p className="text-gray-500 text-sm mb-6">White-label for consultants</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-white">$499</span>
                <span className="text-gray-500 ml-1">/ month</span>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {[
                  'Everything in Platform',
                  'White-label PDF branding',
                  'Client workspace management',
                  'Bulk CSV pipeline',
                  'API access & webhooks',
                  'Priority support',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-gray-300">
                    <Check className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleCheckout('partner')}
                disabled={loadingTier === 'partner'}
                className="w-full py-3 rounded-lg font-semibold border border-white/20 text-white hover:bg-white/5 transition disabled:opacity-60"
              >
                {loadingTier === 'partner' ? 'Loading...' : 'Start — $499/mo'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Demo Request Form */}
      <section id="demo" className="py-24 px-6 max-w-3xl mx-auto text-center">
        <div className="bg-gradient-to-b from-white/10 to-white/5 p-px rounded-3xl">
          <div className="bg-slate-950 rounded-3xl p-8 md:p-12">
            <h2 className="text-3xl font-bold mb-4">Request a Demo</h2>
            <p className="text-gray-400 mb-8">
              See how CERNIQ can streamline your institution&apos;s risk management.
            </p>

            {submitted ? (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 p-6 rounded-xl">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-3 text-emerald-400" />
                <h3 className="font-bold text-lg mb-2">Request Received</h3>
                <p>We&apos;ll reach out within 24 hours to schedule your live demo.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 text-left">
                {submitError && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {submitError}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Name
                    </label>
                    <input
                      type="text"
                      placeholder="Jane Smith"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Work Email *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="jane@institution.com"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Institution Name
                  </label>
                  <input
                    type="text"
                    placeholder="First National Bank"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    value={institutionName}
                    onChange={(e) => setInstitutionName(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Institution Type
                    </label>
                    <select
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      value={institutionType}
                      onChange={(e) => setInstitutionType(e.target.value)}
                    >
                      <option value="">Select Type</option>
                      <option value="community_bank">Community Bank</option>
                      <option value="credit_union">Credit Union</option>
                      <option value="cooperativa">Cooperativa (PR)</option>
                      <option value="cpa_consultant">CPA Consultant</option>
                      <option value="other">Family Office</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Total Assets
                    </label>
                    <select
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      value={totalAssets}
                      onChange={(e) => setTotalAssets(e.target.value)}
                    >
                      <option value="">Select Range</option>
                      <option value="< $100M">&lt; $100M</option>
                      <option value="$100M - $500M">$100M - $500M</option>
                      <option value="$500M - $1B">$500M - $1B</option>
                      <option value="$1B - $5B">$1B - $5B</option>
                      <option value="$5B+">$5B+</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold py-4 rounded-lg transition mt-4 disabled:opacity-50"
                >
                  {loading ? 'Submitting...' : 'Request Demo'}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-br from-amber-400 to-orange-500 rounded flex items-center justify-center">
              <span className="text-slate-900 font-bold text-xs">C</span>
            </div>
            <span className="text-sm font-semibold text-gray-400">CERNIQ</span>
            <span className="text-gray-600 text-sm ml-2">by KLYTICS</span>
          </div>
          <div className="text-gray-500 text-sm">
            &copy; 2026 KLYTICS. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
