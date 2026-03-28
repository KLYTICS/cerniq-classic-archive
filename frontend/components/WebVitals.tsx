'use client';

import { useEffect } from 'react';

export function WebVitals() {
  useEffect(() => {
    // Dynamic import to avoid blocking initial render
    import('web-vitals').then(({ onCLS, onFCP, onLCP, onTTFB, onINP }) => {
      const { reportWebVital } = require('@/lib/web-vitals');
      onCLS(reportWebVital);
      onFCP(reportWebVital);
      onLCP(reportWebVital);
      onTTFB(reportWebVital);
      onINP(reportWebVital);
    }).catch(() => {});
  }, []);

  return null;
}
