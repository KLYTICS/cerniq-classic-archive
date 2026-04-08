'use client';

/**
 * ShortcutHelpModal — "?" cheat-sheet for keyboard shortcuts.
 *
 * Customer journey moment: a new controller lands in the cockpit for
 * the first time and notices the `g c` hint next to the Calendar tab.
 * She hits "?" to see the full list and learns vim-style chords in
 * 10 seconds. Next close, she's keyboard-native.
 *
 * Standard FAANG pattern: Linear, GitHub, Gmail, Superhuman all use
 * exactly this shape. Users recognize it and don't need onboarding.
 */

import { Modal } from '@/components/ui/Modal';

type Lang = 'en' | 'es';

interface ShortcutHelpModalProps {
  open: boolean;
  lang: Lang;
  onClose: () => void;
}

interface ShortcutGroup {
  titleEn: string;
  titleEs: string;
  rows: Array<{ keys: string[]; en: string; es: string }>;
}

const GROUPS: ShortcutGroup[] = [
  {
    titleEn: 'Navigation',
    titleEs: 'Navegación',
    rows: [
      { keys: ['g', 'c'], en: 'Jump to Calendar', es: 'Ir a Calendario' },
      { keys: ['g', 't'], en: 'Jump to Tie-out', es: 'Ir a Conciliación' },
      { keys: ['g', 'j'], en: 'Jump to Journal entries', es: 'Ir a Asientos' },
      { keys: ['g', 'f'], en: 'Jump to Flux', es: 'Ir a Flujo' },
      { keys: ['g', 's'], en: 'Jump to GL Snapshot', es: 'Ir a Snapshot GL' },
      { keys: ['g', 'b'], en: 'Jump to Audit binder', es: 'Ir a Carpeta' },
    ],
  },
  {
    titleEn: 'Workspace',
    titleEs: 'Área de trabajo',
    rows: [
      { keys: ['g', 'r'], en: 'Refresh now', es: 'Actualizar ahora' },
      { keys: ['g', 'l'], en: 'Toggle language EN · ES', es: 'Alternar idioma EN · ES' },
      { keys: ['?'], en: 'Show this help', es: 'Mostrar esta ayuda' },
      { keys: ['Esc'], en: 'Close drawer / modal', es: 'Cerrar panel / modal' },
    ],
  },
];

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[1.5rem] items-center justify-center rounded-md border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-700 shadow-[inset_0_-1px_0_rgba(0,0,0,0.08)]">
      {children}
    </kbd>
  );
}

export function ShortcutHelpModal({ open, lang, onClose }: ShortcutHelpModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={lang === 'en' ? 'Keyboard shortcuts' : 'Atajos de teclado'}
      maxWidth="max-w-md"
    >
      <div className="space-y-5">
        {GROUPS.map((group) => (
          <section key={group.titleEn}>
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {lang === 'en' ? group.titleEn : group.titleEs}
            </h3>
            <ul className="space-y-1.5">
              {group.rows.map((row) => (
                <li
                  key={row.keys.join('-')}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="text-slate-600">{lang === 'en' ? row.en : row.es}</span>
                  <span className="flex items-center gap-1">
                    {row.keys.map((k, i) => (
                      <span key={`${row.keys.join('-')}-${i}`} className="flex items-center gap-1">
                        <Kbd>{k}</Kbd>
                        {i < row.keys.length - 1 ? (
                          <span className="text-xs text-slate-400">then</span>
                        ) : null}
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <p className="pt-2 text-[11px] leading-relaxed text-slate-400">
          {lang === 'en'
            ? 'Two-key chords are vim-style: press the first key, then the second within 1.2 seconds. Shortcuts are ignored while typing in a text field.'
            : 'Los combos de dos teclas son estilo vim: presione la primera tecla y la segunda dentro de 1.2 segundos. Los atajos se ignoran mientras escribe en un campo de texto.'}
        </p>
      </div>
    </Modal>
  );
}
