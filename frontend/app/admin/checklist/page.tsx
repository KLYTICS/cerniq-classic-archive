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

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://cerniq.io').trim().replace(/\/+$/, '');
const API_URL = (process.env.NEXT_PUBLIC_NODE_API_URL || 'https://api.cerniq.io').trim().replace(/\/+$/, '');

const SECTIONS: CheckSection[] = [
  {
    title: 'Day Before (Tuesday)',
    items: [
      { id: 'pablo-url', label: 'Open cerniq.io/pablo — verify redirect + load', link: `${APP_URL}/pablo`, linkLabel: 'Test' },
      { id: 'full-flow', label: 'Run full demo: register → seed → ALM overview → stress test → PDF', link: `${APP_URL}/demo?preset=banco-comunidad`, linkLabel: 'Run' },
      { id: 'pdf-check', label: 'Download PDF, verify it opens and looks board-ready' },
      { id: 'laptop-charge', label: 'Charge laptop to 100%' },
      { id: 'wifi-test', label: 'Test on hotel/coffee shop WiFi (not just home connection)' },
      { id: 'health-check', label: 'API health: database up, API up', link: `${API_URL}/health`, linkLabel: 'Check' },
    ],
  },
  {
    title: 'Day Of (Wednesday)',
    items: [
      { id: 'close-tabs', label: 'Close all browser tabs except the demo' },
      { id: 'chrome-pablo', label: 'Open cerniq.io/pablo in Chrome (NOT Safari)', link: `${APP_URL}/pablo`, linkLabel: 'Open' },
      { id: 'pricing-tab', label: 'Have /pricing page open in second tab', link: `${APP_URL}/pricing`, linkLabel: 'Open' },
      { id: 'phone-url', label: 'Phone: have URL ready to text Pablo — cerniq.io/pablo' },
      { id: 'kill-notifs', label: 'Kill Slack, email, and notification sounds' },
      { id: 'admin-tab', label: 'Admin page open in background tab', link: '/admin', linkLabel: 'Open' },
    ],
  },
  {
    title: 'During Demo',
    items: [
      { id: 'let-pablo-type', label: 'Let Pablo type his institution name in Step 1 — makes it feel personal' },
      { id: 'narrate-mc', label: 'When stress test runs, narrate: "1,000 Monte Carlo simulations..."' },
      { id: 'hand-pdf', label: 'Download PDF and hand him the laptop to scroll through it' },
      { id: 'ask-question', label: 'Ask: "Is this the kind of report your team currently produces manually?"' },
      { id: 'show-pricing', label: 'When he asks cost: switch to /pricing tab' },
    ],
  },
  {
    title: 'After',
    items: [
      { id: 'text-link', label: 'Text Pablo the demo link before he walks out' },
      { id: 'follow-up-24h', label: 'Follow up email within 24 hours' },
      { id: 'update-crm', label: 'Update prospect stage in admin → Prospect Pipeline', link: '/admin/prospects', linkLabel: 'Open' },
    ],
  },
];

const STORAGE_KEY = 'cerniq_wednesday_checklist';

function loadSavedChecklist() {
  if (typeof window === 'undefined') {
    return {};
  }

  const saved = sessionStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return {};
  }

  try {
    const parsed = JSON.parse(saved);
    return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, boolean> : {};
  } catch {
    return {};
  }
}

export default function ChecklistPage() {
  const [checked, setChecked] = useState<Record<string, boolean>>(() => loadSavedChecklist());

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
            <h1 className="text-lg font-bold">Wednesday Demo Checklist</h1>
            <p className="text-xs text-slate-500">Pablo meeting — February 25, 2026</p>
          </div>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-slate-500">{checkedCount} of {totalItems} complete</span>
            <span className={`font-medium ${allDone ? 'text-emerald-400' : 'text-slate-400'}`}>
              {allDone ? 'All clear — go get him' : `${pct}%`}
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
