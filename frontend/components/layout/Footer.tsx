'use client';

interface FooterProps {
  t: (en: string, es: string) => string;
  compact?: boolean;
}

export default function Footer({ t, compact }: FooterProps) {
  if (compact) {
    return (
      <footer className="border-t border-slate-200 bg-slate-50 py-4 px-6">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-3 text-[10px] text-slate-400">
          <span>&copy; {new Date().getFullYear()} KLYTICS LLC. CERNIQ&trade;</span>
          <div className="flex items-center gap-4">
            <a href="/terms" className="hover:text-slate-600">{t('Terms', 'Terminos')}</a>
            <a href="/privacy" className="hover:text-slate-600">{t('Privacy', 'Privacidad')}</a>
            <a href="/security" className="hover:text-slate-600">{t('Security', 'Seguridad')}</a>
            <a href="mailto:erwin@cerniq.io" className="hover:text-slate-600">erwin@cerniq.io</a>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="border-t border-slate-200 bg-slate-50 py-8 px-6">
      <div className="mx-auto max-w-6xl grid grid-cols-2 sm:grid-cols-4 gap-6 text-xs">
        <div>
          <p className="font-bold text-slate-800 mb-3 uppercase tracking-wider text-[10px]">{t('Product', 'Producto')}</p>
          <div className="space-y-2">
            <a href="/demo" className="block text-slate-500 hover:text-slate-800">{t('Interactive Demo', 'Demo Interactivo')}</a>
            <a href="/pricing" className="block text-slate-500 hover:text-slate-800">{t('Pricing', 'Precios')}</a>
            <a href="/roi" className="block text-slate-500 hover:text-slate-800">{t('ROI Calculator', 'Calculadora ROI')}</a>
            <a href="/developers" className="block text-slate-500 hover:text-slate-800">{t('API Docs', 'Documentacion API')}</a>
            <a href="/changelog" className="block text-slate-500 hover:text-slate-800">{t("What's New", 'Novedades')}</a>
          </div>
        </div>
        <div>
          <p className="font-bold text-slate-800 mb-3 uppercase tracking-wider text-[10px]">{t('Platform', 'Plataforma')}</p>
          <div className="space-y-2">
            <a href="/why-cerniq" className="block text-slate-500 hover:text-slate-800">{t('Why CERNIQ', 'Por que CERNIQ')}</a>
            <a href="/compliance" className="block text-slate-500 hover:text-slate-800">{t('Compliance Matrix', 'Matriz Cumplimiento')}</a>
            <a href="/case-studies" className="block text-slate-500 hover:text-slate-800">{t('Case Studies', 'Casos de Estudio')}</a>
            <a href="/alm/modules" className="block text-slate-500 hover:text-slate-800">{t('62 ALM Modules', '62 Modulos ALM')}</a>
          </div>
        </div>
        <div>
          <p className="font-bold text-slate-800 mb-3 uppercase tracking-wider text-[10px]">{t('Compliance', 'Cumplimiento')}</p>
          <div className="space-y-2">
            <span className="block text-slate-500">COSSEC (PR)</span>
            <span className="block text-slate-500">NCUA (US)</span>
            <span className="block text-slate-500">Basel III / IRRBB</span>
            <span className="block text-slate-500">FASB 326 (CECL)</span>
          </div>
        </div>
        <div>
          <p className="font-bold text-slate-800 mb-3 uppercase tracking-wider text-[10px]">{t('Company', 'Empresa')}</p>
          <div className="space-y-2">
            <span className="block text-slate-500">KLYTICS LLC</span>
            <span className="block text-slate-500">San Juan, PR</span>
            <a href="/contact" className="block text-cyan-600 hover:text-cyan-800">{t('Book a Demo', 'Agendar Demo')}</a>
            <a href="mailto:erwin@cerniq.io" className="block text-slate-500 hover:text-slate-800">erwin@cerniq.io</a>
            <a href="/status" className="block text-slate-500 hover:text-slate-800">{t('System Status', 'Estado del Sistema')}</a>
          </div>
        </div>
      </div>
      {/* Legal + Social */}
      <div className="mx-auto max-w-6xl mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-200 pt-6">
        <div className="flex flex-wrap items-center gap-4 text-[10px] text-slate-400">
          <span>&copy; {new Date().getFullYear()} KLYTICS LLC. CERNIQ&trade;</span>
          <a href="/terms" className="hover:text-slate-600">{t('Terms of Service', 'Terminos de Servicio')}</a>
          <a href="/privacy" className="hover:text-slate-600">{t('Privacy Policy', 'Politica de Privacidad')}</a>
          <a href="/security" className="hover:text-slate-600">{t('Security', 'Seguridad')}</a>
        </div>
        <div className="flex items-center gap-3">
          <a href="https://linkedin.com/company/klytics" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-slate-600" aria-label="LinkedIn">
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
          </a>
          <a href="https://github.com/monykiss/cerniq" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-slate-600" aria-label="GitHub">
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
          </a>
        </div>
      </div>
    </footer>
  );
}
