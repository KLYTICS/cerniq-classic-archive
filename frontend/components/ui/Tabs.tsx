'use client';

import React, { useState, useRef, useCallback } from 'react';

export interface Tab {
  /** Unique key */
  value: string;
  /** Displayed label */
  label: string;
  /** Tab panel content */
  content: React.ReactNode;
  /** Disable this tab */
  disabled?: boolean;
}

export interface TabsProps {
  tabs: Tab[];
  /** Controlled active value */
  activeTab?: string;
  /** Called when the active tab changes */
  onChange?: (value: string) => void;
  className?: string;
}

/**
 * Accessible tab component with keyboard navigation (arrow keys).
 */
export function Tabs({ tabs, activeTab: controlledActive, onChange, className = '' }: TabsProps) {
  const [internalActive, setInternalActive] = useState(tabs[0]?.value ?? '');
  const active = controlledActive ?? internalActive;
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const setActive = useCallback(
    (value: string) => {
      if (!controlledActive) setInternalActive(value);
      onChange?.(value);
    },
    [controlledActive, onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      const enabledTabs = tabs.filter((t) => !t.disabled);
      const currentEnabledIdx = enabledTabs.findIndex((t) => t.value === tabs[index].value);

      let nextIdx = -1;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        nextIdx = (currentEnabledIdx + 1) % enabledTabs.length;
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        nextIdx = (currentEnabledIdx - 1 + enabledTabs.length) % enabledTabs.length;
      } else if (e.key === 'Home') {
        e.preventDefault();
        nextIdx = 0;
      } else if (e.key === 'End') {
        e.preventDefault();
        nextIdx = enabledTabs.length - 1;
      }

      if (nextIdx >= 0) {
        const nextTab = enabledTabs[nextIdx];
        const refIdx = tabs.findIndex((t) => t.value === nextTab.value);
        tabRefs.current[refIdx]?.focus();
        setActive(nextTab.value);
      }
    },
    [tabs, setActive],
  );

  const activePanel = tabs.find((t) => t.value === active);

  return (
    <div className={className}>
      {/* Tab list */}
      <div role="tablist" className="flex border-b border-slate-200">
        {tabs.map((tab, i) => {
          const isActive = tab.value === active;
          return (
            <button
              key={tab.value}
              ref={(el) => { tabRefs.current[i] = el; }}
              role="tab"
              id={`tab-${tab.value}`}
              aria-selected={isActive}
              aria-controls={`panel-${tab.value}`}
              tabIndex={isActive ? 0 : -1}
              disabled={tab.disabled}
              onClick={() => setActive(tab.value)}
              onKeyDown={(e) => handleKeyDown(e, i)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-b-2 border-[#1B3A6B] text-[#1B3A6B]'
                  : 'text-slate-500 hover:text-slate-700'
              } ${tab.disabled ? 'cursor-not-allowed opacity-40' : ''}`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab panel */}
      {activePanel && (
        <div
          role="tabpanel"
          id={`panel-${activePanel.value}`}
          aria-labelledby={`tab-${activePanel.value}`}
          className="py-4"
        >
          {activePanel.content}
        </div>
      )}
    </div>
  );
}
