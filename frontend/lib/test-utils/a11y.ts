/**
 * Component-level a11y assertions for vitest (jsdom).
 *
 * Complements the route-level Playwright sweep at `e2e/a11y-sweep/`:
 *   • The sweep runs axe-core against fully-rendered routes in a real
 *     browser. It catches layout/contrast/keyboard issues that depend on
 *     real CSS computation, but requires `next dev` and Playwright workers
 *     and so runs only in the dedicated a11y CI job.
 *   • This helper runs axe-core inside jsdom against React Testing Library
 *     output. It catches structural/ARIA/role/label issues at the unit
 *     level — fast (sub-second), part of `vitest run`, and gives terminal
 *     components their own ratchet independent of which routes happen to
 *     mount them.
 *
 * Disabled rules: anything that needs real layout (color-contrast,
 * target-size, scrollable-region-focusable) is silenced here. The Playwright
 * sweep is the source of truth for those.
 *
 * Usage:
 *
 *   import { axeRender } from '@/lib/test-utils/a11y';
 *   import MyWidget from './my-widget';
 *
 *   it('has no a11y violations', async () => {
 *     await axeRender(<MyWidget score={50} />);
 *   });
 */

import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import axe, { type Result, type AxeResults, type RunOptions } from 'axe-core';

// Rules that require real layout — checked by the Playwright route sweep,
// not by jsdom-based unit tests.
const LAYOUT_RULES_DISABLED = [
  'color-contrast',
  'color-contrast-enhanced',
  'target-size',
  'scrollable-region-focusable',
] as const;

const DEFAULT_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] as const;

const DEFAULT_RUN_OPTIONS: RunOptions = {
  runOnly: { type: 'tag', values: [...DEFAULT_TAGS] },
  rules: Object.fromEntries(
    LAYOUT_RULES_DISABLED.map((id) => [id, { enabled: false }]),
  ),
};

export interface AxeRenderResult extends RenderResult {
  violations: Result[];
  axeResults: AxeResults;
}

/**
 * Render a React element and run axe-core against its DOM.
 *
 * Throws (failing the test) on any non-empty violation list. The thrown
 * message lists each violation with its rule id, impact, count of nodes,
 * and the first three offending selectors — enough to fix the issue
 * without re-running with a debugger.
 */
export async function axeRender(
  ui: ReactElement,
  options: RenderOptions & { axeOptions?: RunOptions } = {},
): Promise<AxeRenderResult> {
  const { axeOptions, ...renderOptions } = options;
  const result = render(ui, renderOptions);

  const merged: RunOptions = axeOptions
    ? { ...DEFAULT_RUN_OPTIONS, ...axeOptions }
    : DEFAULT_RUN_OPTIONS;

  const axeResults = await axe.run(result.container, merged);

  if (axeResults.violations.length > 0) {
    const lines = axeResults.violations.map((v) => {
      const targets = v.nodes
        .slice(0, 3)
        .map((n) => (Array.isArray(n.target) ? n.target.join(' ') : String(n.target)))
        .join(' | ');
      return `  · [${(v.impact ?? 'unknown').toUpperCase()}] ${v.id} (${v.nodes.length} node${
        v.nodes.length === 1 ? '' : 's'
      }): ${v.help}\n    → ${v.helpUrl}\n    targets: ${targets}`;
    });
    throw new Error(
      `axe-core found ${axeResults.violations.length} violation(s):\n${lines.join('\n')}`,
    );
  }

  return { ...result, violations: axeResults.violations, axeResults };
}

/**
 * Run axe-core against an arbitrary DOM Element (or the document body if
 * omitted). Use when the component-under-test is rendered via a custom
 * harness rather than `render()` directly.
 */
export async function axeCheck(
  target: Element | Document = document.body,
  options?: RunOptions,
): Promise<AxeResults> {
  const merged: RunOptions = options
    ? { ...DEFAULT_RUN_OPTIONS, ...options }
    : DEFAULT_RUN_OPTIONS;
  return axe.run(target, merged);
}
