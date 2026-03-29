'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { useALM } from '@/components/alm/ALMProvider';
import { useTranslation } from '@/lib/i18n';
import { Bell, AlertTriangle, Check, X } from 'lucide-react';

interface Alert {
  id: string; severity: string; alertTextEs: string; alertTextEn: string;
  affectedItems: string[]; recommendedAction: string; readAt: string | null;
  dismissedAt: string | null; createdAt: string;
}

const SEV = {
  HIGH: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500' },
  MEDIUM: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  LOW: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', dot: 'bg-sky-500' },
};

export default function AlertsPage() {
  const { selectedId } = useALM();
  const { locale } = useTranslation();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('unread');

  useEffect(() => {
    if (!selectedId) return;
    (async () => {
      setLoading(true);
      try { setAlerts(await apiClient.getAlerts(selectedId, filter === 'unread')); }
      catch { setAlerts(getDemoAlerts()); }
      finally { setLoading(false); }
    })();
  }, [selectedId, filter]);

  if (!selectedId) return <div className="flex-1 flex items-center justify-center p-6"><AlertTriangle className="h-12 w-12 text-amber-500" /></div>;
  if (loading) return <div className="flex-1 flex items-center justify-center p-6"><div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-200 border-t-cyan-600" /></div>;

  const unreadCount = alerts.filter(a => !a.readAt && !a.dismissedAt).length;

  return (
    <div className="p-6 space-y-5 max-w-[1000px] mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 bg-rose-50">
            <Bell className="h-4 w-4 text-rose-700" />
            {unreadCount > 0 && <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white">{unreadCount}</span>}
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-950">{locale === 'es' ? 'Alertas Regulatorias' : 'Regulatory Alerts'}</h1>
            <p className="text-xs text-slate-500">{locale === 'es' ? 'COSSEC · OCIF · NCUA — monitoreo diario' : 'COSSEC · OCIF · NCUA — daily monitoring'}</p>
          </div>
        </div>
        <div className="flex gap-1">
          {(['unread', 'all'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${filter === f ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
              {f === 'unread' ? (locale === 'es' ? 'No Leídas' : 'Unread') : (locale === 'es' ? 'Todas' : 'All')}
            </button>
          ))}
        </div>
      </div>

      {alerts.length === 0 ? (
        <div className="py-16 text-center">
          <Check className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
          <p className="text-sm text-slate-500">{locale === 'es' ? 'No hay alertas pendientes.' : 'No pending alerts.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map(alert => {
            const sev = SEV[alert.severity as keyof typeof SEV] ?? SEV.MEDIUM;
            return (
              <div key={alert.id} className={`rounded-xl border p-4 ${sev.bg} ${sev.border} ${alert.readAt ? 'opacity-60' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className={`mt-1 h-2.5 w-2.5 rounded-full shrink-0 ${sev.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold uppercase ${sev.text}`}>{alert.severity}</span>
                      <span className="text-[10px] text-slate-400">{new Date(alert.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm text-slate-800 leading-relaxed">{locale === 'es' ? alert.alertTextEs : (alert.alertTextEn || alert.alertTextEs)}</p>
                    {alert.affectedItems.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {alert.affectedItems.map(item => (
                          <span key={item} className="rounded-full bg-white/60 border border-slate-200 px-2 py-0.5 text-[10px] text-slate-600">{item}</span>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-slate-600 mt-2 italic">{locale === 'es' ? '→ ' : '→ '}{alert.recommendedAction}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {!alert.readAt && <button className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:text-emerald-600"><Check className="h-3.5 w-3.5" /></button>}
                    {!alert.dismissedAt && <button className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:text-rose-600"><X className="h-3.5 w-3.5" /></button>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function getDemoAlerts(): Alert[] {
  return [
    { id: '1', severity: 'HIGH', alertTextEs: 'COSSEC publica nueva circular sobre requisitos de liquidez para cooperativas con activos > $200M. Requiere LCR mínimo de 110% efectivo enero 2027.', alertTextEn: 'COSSEC publishes new circular on liquidity requirements for cooperativas > $200M assets.', affectedItems: ['liquidity', 'capital'], recommendedAction: 'Review current LCR position and model impact of 110% threshold.', readAt: null, dismissedAt: null, createdAt: new Date(Date.now() - 86400000).toISOString() },
    { id: '2', severity: 'MEDIUM', alertTextEs: 'OCIF actualiza guía de riesgo de tasa de interés (CC-2026-02). Nuevos requisitos para reportes de brecha de repricing trimestrales.', alertTextEn: 'OCIF updates interest rate risk guidance (CC-2026-02).', affectedItems: ['interest_rate', 'repricing_gap'], recommendedAction: 'Ensure quarterly repricing gap report meets updated format.', readAt: null, dismissedAt: null, createdAt: new Date(Date.now() - 172800000).toISOString() },
    { id: '3', severity: 'LOW', alertTextEs: 'NCUA publica Letter to Credit Unions 26-CU-04 sobre mejores prácticas en gestión de riesgo de concentración.', alertTextEn: 'NCUA publishes LCU 26-CU-04 on concentration risk best practices.', affectedItems: ['concentration'], recommendedAction: 'Review concentration limits against NCUA guidance.', readAt: new Date().toISOString(), dismissedAt: null, createdAt: new Date(Date.now() - 604800000).toISOString() },
  ];
}
