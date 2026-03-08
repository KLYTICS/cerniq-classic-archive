'use client';

import { useState } from 'react';
import { usePortal } from '../layout';
import { Bell, Globe, Save, CheckCircle } from 'lucide-react';
import { analytics, EVENTS } from '@/lib/analytics';

export default function PortalSettings() {
  const { user } = usePortal();
  const [language, setLanguage] = useState('es');
  const [emailReports, setEmailReports] = useState(true);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    analytics.track(EVENTS.PORTAL_SETTINGS_SAVED, { language, emailReports, emailAlerts });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Settings</h1>
      <p className="text-sm text-gray-500 mb-8">Configure your portal preferences.</p>

      {/* Account Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Account</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
            <p className="text-sm text-gray-900">{user?.email || '—'}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
            <p className="text-sm text-gray-900">{user?.name || '—'}</p>
          </div>
        </div>
      </div>

      {/* Report Language */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="h-4 w-4 text-gray-400" />
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Report Language</h2>
        </div>
        <div className="flex gap-3">
          {[
            { value: 'es', label: 'Espanol (default)' },
            { value: 'en', label: 'English' },
            { value: 'both', label: 'Both (ES + EN)' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setLanguage(opt.value)}
              className={`px-4 py-2 rounded-lg border text-sm transition ${
                language === opt.value
                  ? 'border-[#1B3A6B] bg-blue-50 text-[#1B3A6B] font-medium'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notification Preferences */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="h-4 w-4 text-gray-400" />
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Notifications</h2>
        </div>
        <div className="space-y-4">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-sm text-gray-900">Report ready emails</p>
              <p className="text-xs text-gray-400">Get notified when your ALM report is ready</p>
            </div>
            <input
              type="checkbox"
              checked={emailReports}
              onChange={(e) => setEmailReports(e.target.checked)}
              className="w-4 h-4 text-[#1B3A6B] rounded focus:ring-[#1B3A6B]"
            />
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-sm text-gray-900">Threshold alerts</p>
              <p className="text-xs text-gray-400">Get notified when ratios approach regulatory thresholds</p>
            </div>
            <input
              type="checkbox"
              checked={emailAlerts}
              onChange={(e) => setEmailAlerts(e.target.checked)}
              className="w-4 h-4 text-[#1B3A6B] rounded focus:ring-[#1B3A6B]"
            />
          </label>
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          className="inline-flex items-center gap-2 bg-[#1B3A6B] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#15305a] transition"
        >
          <Save className="h-4 w-4" />
          Save Preferences
        </button>
        {saved && (
          <span className="inline-flex items-center gap-1 text-sm text-green-600">
            <CheckCircle className="h-4 w-4" /> Saved
          </span>
        )}
      </div>
    </div>
  );
}
