'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { CheckCircle, Circle, ExternalLink, ArrowLeft } from 'lucide-react';

interface CheckItem {
  id: string;
  label: string;
  link?: string;
  linkLabel?: string;
}

interface CheckSection {
  title: string;
  items: CheckItem[];
}

const SECTIONS: CheckSection[] = [
  {
    title: 'Environment',
    items: [
      { id: 'health', label: 'API health returns database: up', link: 'https://capexcycleos-api.fly.dev/health', linkLabel: 'Check' },
      { id: 'frontend', label: 'Frontend loads without redirect', link: 'https://capexcycle.vercel.app', linkLabel: 'Open' },
      { id: 'demo-link', label: 'Demo link works: /demo?type=bank', link: 'https://capexcycle.vercel.app/demo?type=bank', linkLabel: 'Test' },
    ],
  },
  {
    title: 'Data',
    items: [
      { id: 'register', label: 'Register new account with fresh email' },
      { id: 'seeded', label: 'Banco Comunidad PR seeded after onboarding' },
      { id: 'risk-score', label: 'ALM overview shows Risk Score 87/100', link: '/alm', linkLabel: 'Check' },
      { id: 'lcr', label: 'LCR shows 118.1% Compliant', link: '/alm/liquidity', linkLabel: 'Check' },
    ],
  },
  {
    title: 'Features',
    items: [
      { id: 'sensitivity', label: 'Rate Sensitivity chart loads (NII at +100bps positive)', link: '/alm/sensitivity', linkLabel: 'Check' },
      { id: 'stress-test', label: 'Stress Test runs in < 3 seconds', link: '/alm/stress-test', linkLabel: 'Check' },
      { id: 'pdf', label: 'PDF report downloads (check file size > 50KB)' },
      { id: 'balance-sheet', label: 'Balance sheet shows tabbed assets/liabilities', link: '/alm/balance-sheet', linkLabel: 'Check' },
    ],
  },
  {
    title: 'Presentation',
    items: [
      { id: 'laptop', label: 'Laptop charged + charger packed' },
      { id: 'chrome', label: 'Demo on Chrome, NOT Safari (cookie behavior)' },
      { id: 'tabs', label: 'Close all other browser tabs' },
      { id: 'notifications', label: 'Kill Slack/notification sounds' },
      { id: 'admin-tab', label: 'Admin page open in separate tab', link: '/admin', linkLabel: 'Open' },
    ],
  },
];

const STORAGE_KEY = 'capex_demo_checklist';

export default function ChecklistPage() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { setChecked(JSON.parse(saved)); } catch { /* ignore */ }
    }
  }, []);

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const totalItems = SECTIONS.reduce((s, sec) => s + sec.items.length, 0);
  const checkedCount = Object.values(checked).filter(Boolean).length;
  const pct = totalItems > 0 ? Math.round((checkedCount / totalItems) * 100) : 0;
  const allDone = checkedCount === totalItems;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/admin" className="text-slate-500 hover:text-white transition">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-lg font-bold">Pre-Demo Checklist</h1>
            <p className="text-xs text-slate-500">Run through before any prospect meeting</p>
          </div>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-slate-500">{checkedCount} of {totalItems} complete</span>
            <span className={`font-medium ${allDone ? 'text-emerald-400' : 'text-slate-400'}`}>
              {allDone ? 'All clear' : `${pct}%`}
            </span>
          </div>
          <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${allDone ? 'bg-emerald-500' : 'bg-amber-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-6">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                {section.title}
              </h2>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const isChecked = !!checked[item.id];
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition cursor-pointer group ${
                        isChecked ? 'bg-emerald-500/5' : 'hover:bg-white/[0.02]'
                      }`}
                      onClick={() => toggle(item.id)}
                    >
                      {isChecked ? (
                        <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                      ) : (
                        <Circle className="h-4 w-4 text-slate-600 group-hover:text-slate-400 shrink-0" />
                      )}
                      <span className={`text-sm flex-1 ${isChecked ? 'text-slate-500 line-through' : 'text-slate-300'}`}>
                        {item.label}
                      </span>
                      {item.link && (
                        <a
                          href={item.link}
                          target={item.link.startsWith('http') ? '_blank' : undefined}
                          rel={item.link.startsWith('http') ? 'noopener noreferrer' : undefined}
                          onClick={(e) => e.stopPropagation()}
                          className="text-[10px] text-slate-600 hover:text-amber-400 flex items-center gap-1 transition"
                        >
                          {item.linkLabel || 'Open'} <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Reset */}
        <div className="mt-8 pt-6 border-t border-white/[0.06] flex justify-center">
          <button
            onClick={() => {
              setChecked({});
              sessionStorage.removeItem(STORAGE_KEY);
            }}
            className="text-xs text-slate-600 hover:text-slate-400 transition"
          >
            Reset checklist
          </button>
        </div>
      </div>
    </div>
  );
}
