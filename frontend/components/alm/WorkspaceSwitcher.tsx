'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { useALM } from './ALMProvider';
import { Building2, ChevronDown, Plus, Check } from 'lucide-react';

export default function WorkspaceSwitcher() {
  const { institutions, selectedId, selectInstitution } = useALM();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const current = institutions.find((institution) => institution.id === selectedId);
  if (!institutions.length) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:border-slate-300 transition"
      >
        <Building2 className="h-3.5 w-3.5 text-slate-400" />
        <span className="max-w-[140px] truncate font-medium">
          {current?.name || 'Select institution'}
        </span>
        <ChevronDown className={`h-3 w-3 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-64 rounded-xl border border-slate-200 bg-white shadow-lg z-50 py-1">
          <div className="px-3 py-2 border-b border-slate-100">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Institutions</p>
          </div>
          {institutions.map((inst) => (
            <button
              key={inst.id}
              onClick={() => { selectInstitution(inst.id); setOpen(false); }}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-xs hover:bg-slate-50 transition text-left"
            >
              <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-800 truncate">{inst.name}</p>
                <p className="text-[10px] text-slate-400">${inst.totalAssets?.toLocaleString()}M · {inst.type?.replace(/_/g, ' ')}</p>
              </div>
              {inst.id === selectedId && <Check className="h-3.5 w-3.5 text-cyan-600 shrink-0" />}
            </button>
          ))}
          <div className="border-t border-slate-100 mt-1 pt-1">
            <Link href="/alm/balance-sheet" className="flex items-center gap-2 px-3 py-2 text-xs text-cyan-600 hover:bg-cyan-50 transition">
              <Plus className="h-3.5 w-3.5" /> Add Institution
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
