'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { listAlerts, ackAlert } from '@/lib/agents-api';
import type { AgentAlertRecord } from '@/types/agents';
import { relativeTime, severityStyles, categoryToAgentLabel } from './alert-feed';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface NotificationCenterProps {
  institutionId: string;
  locale?: 'en' | 'es';
}

// ─── i18n ───────────────────────────────────────────────────────────────────

const i18n = {
  en: {
    notifications: 'Notifications',
    newAlerts: 'New',
    earlierAlerts: 'Earlier',
    markAllRead: 'Mark all as read',
    noNotifications: 'No notifications',
    viewAll: 'View all alerts',
    criticalAlert: 'Critical alert detected',
  },
  es: {
    notifications: 'Notificaciones',
    newAlerts: 'Nuevas',
    earlierAlerts: 'Anteriores',
    markAllRead: 'Marcar todas como leidas',
    noNotifications: 'Sin notificaciones',
    viewAll: 'Ver todas las alertas',
    criticalAlert: 'Alerta critica detectada',
  },
} as const;

// ─── Bell icon SVG ──────────────────────────────────────────────────────────

function BellIcon({ hasUnread }: { hasUnread: boolean }) {
  return (
    <svg
      className={`h-5 w-5 ${hasUnread ? 'text-slate-800' : 'text-slate-500'}`}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
      />
    </svg>
  );
}

// ─── Notification row ───────────────────────────────────────────────────────

function NotificationRow({
  alert,
  locale,
}: {
  alert: AgentAlertRecord;
  locale: 'en' | 'es';
}) {
  const finding = locale === 'es' ? alert.findingEs : alert.finding;
  const agentName = categoryToAgentLabel(alert.category);
  const isNew = alert.status === 'OPEN';

  return (
    <a
      href={`/agents/alerts/${alert.id}`}
      className={`block px-4 py-3 transition-colors hover:bg-slate-50 ${
        isNew ? 'bg-sky-50/40' : ''
      }`}
      data-testid="notification-row"
    >
      <div className="flex items-start gap-2.5">
        {/* Unread dot */}
        <div className="mt-1.5 flex-shrink-0">
          {isNew ? (
            <span className="inline-block h-2 w-2 rounded-full bg-sky-500" />
          ) : (
            <span className="inline-block h-2 w-2" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          {/* Agent + severity */}
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase ${severityStyles[alert.severity]}`}
            >
              {alert.severity}
            </span>
            <span className="text-xs font-medium text-slate-600 truncate">
              {agentName}
            </span>
            <span className="ml-auto flex-shrink-0 text-[10px] text-slate-400">
              {relativeTime(alert.createdAt, locale)}
            </span>
          </div>

          {/* Finding text (truncated) */}
          <p className="mt-1 text-xs text-slate-600 line-clamp-2 leading-relaxed">
            {finding}
          </p>
        </div>
      </div>
    </a>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function NotificationCenter({
  institutionId,
  locale = 'en',
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [alerts, setAlerts] = useState<AgentAlertRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const prevCriticalCountRef = useRef(0);

  const t = i18n[locale];

  // ─── Fetch alerts ───────────────────────────────────────────────────────

  const fetchAlerts = useCallback(async () => {
    try {
      const data = await listAlerts(institutionId, { limit: 30 });
      setAlerts(data);

      // Sound notification for new CRITICAL alerts
      const criticalCount = data.filter(
        (a) => a.severity === 'CRITICAL' && a.status === 'OPEN',
      ).length;
      if (
        criticalCount > prevCriticalCountRef.current &&
        prevCriticalCountRef.current >= 0
      ) {
        playCriticalSound();
      }
      prevCriticalCountRef.current = criticalCount;
    } catch {
      // Silently fail — notification center is non-blocking
    } finally {
      setLoading(false);
    }
  }, [institutionId]);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30_000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  // ─── Click outside to close ─────────────────────────────────────────────

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // ─── Keyboard escape ───────────────────────────────────────────────────

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  // ─── Grouped alerts ─────────────────────────────────────────────────────

  const { newAlerts, earlierAlerts, unreadCount } = useMemo(() => {
    const sorted = [...alerts].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const open = sorted.filter((a) => a.status === 'OPEN');
    const rest = sorted.filter((a) => a.status !== 'OPEN');

    return {
      newAlerts: open,
      earlierAlerts: rest,
      unreadCount: open.length,
    };
  }, [alerts]);

  // ─── Mark all as read ───────────────────────────────────────────────────

  const handleMarkAllRead = useCallback(async () => {
    const openAlerts = alerts.filter((a) => a.status === 'OPEN');
    const updates = openAlerts.map((a) =>
      ackAlert(institutionId, a.id, { status: 'ACKNOWLEDGED' }).catch(() => a),
    );
    const results = await Promise.allSettled(updates);

    setAlerts((prev) =>
      prev.map((a) => {
        if (a.status === 'OPEN') {
          return { ...a, status: 'ACKNOWLEDGED' as const };
        }
        return a;
      }),
    );
  }, [alerts, institutionId]);

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="relative" data-testid="notification-center">
      {/* Bell button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="relative rounded-lg p-1.5 transition-colors hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-1"
        aria-label={`${t.notifications}${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <BellIcon hasUnread={unreadCount > 0} />

        {/* Unread count badge */}
        {unreadCount > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white"
            data-testid="notification-badge"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full z-50 mt-2 w-96 rounded-xl border border-slate-200 bg-white shadow-lg"
          role="dialog"
          aria-label={t.notifications}
          data-testid="notification-panel"
        >
          {/* Panel header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-800">
              {t.notifications}
            </h3>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[11px] font-medium text-sky-600 hover:text-sky-700 hover:underline"
                data-testid="mark-all-read"
              >
                {t.markAllRead}
              </button>
            )}
          </div>

          {/* Content */}
          <div className="max-h-[480px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8" role="status">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-sky-500" />
              </div>
            ) : alerts.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center py-10 text-center"
                data-testid="notification-empty"
              >
                <svg
                  className="h-8 w-8 text-slate-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                  />
                </svg>
                <p className="mt-2 text-xs text-slate-500">{t.noNotifications}</p>
              </div>
            ) : (
              <>
                {/* New (unread / OPEN) section */}
                {newAlerts.length > 0 && (
                  <div>
                    <div className="sticky top-0 z-10 bg-white px-4 py-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        {t.newAlerts}
                      </span>
                    </div>
                    {newAlerts.map((alert) => (
                      <NotificationRow
                        key={alert.id}
                        alert={alert}
                        locale={locale}
                      />
                    ))}
                  </div>
                )}

                {/* Earlier (acknowledged / resolved) section */}
                {earlierAlerts.length > 0 && (
                  <div>
                    <div className="sticky top-0 z-10 bg-white px-4 py-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        {t.earlierAlerts}
                      </span>
                    </div>
                    {earlierAlerts.slice(0, 15).map((alert) => (
                      <NotificationRow
                        key={alert.id}
                        alert={alert}
                        locale={locale}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          {alerts.length > 0 && (
            <div className="border-t border-slate-100 px-4 py-2.5 text-center">
              <a
                href="/agents/alerts"
                className="text-xs font-medium text-sky-600 hover:text-sky-700 hover:underline"
              >
                {t.viewAll}
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Audio feedback for CRITICAL alerts ─────────────────────────────────────

function playCriticalSound() {
  if (typeof window === 'undefined') return;
  try {
    // Use the Web Audio API to generate a brief notification tone
    const ctx = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.value = 0.15;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // Audio not available — silently skip
  }

  // Vibration API for mobile
  try {
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }
  } catch {
    // Vibration not available — silently skip
  }
}
