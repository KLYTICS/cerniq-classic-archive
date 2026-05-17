"use client";

// Apex DemoUI components — Phase 1.1 port (2026-05-17).
//
// Verbatim port of `/Users/money/Desktop/apex/components/apex-demo-ui.tsx`
// per the directive "this must fully swallow all apex functionalities
// and take on and preserve original form". Only adjustment: the
// hardcoded routeLinks array is rewritten to use `/apex/*` prefixes so
// these components route within cerniq's namespaced sub-app surface
// rather than Apex's root paths. The original /platform, /, /hub,
// /research, /war-room, /journal, /community, /cockpit targets become
// /apex/platform, /apex, /apex/hub, etc. — preserving the link
// structure while embedding inside cerniq.
//
// All 12 component exports preserved 1:1: ApexRouteNav, ApexPageShell,
// ApexStatusPill, ApexAction, ApexActionGroup, ApexMetricStrip,
// ApexStatePanel, ApexJourneyRail, ApexHero, ApexSection,
// ApexEmptyState, ApexRouteGrid. Same prop signatures, same CSS class
// names (which match the rules in `frontend/styles/apex-theme.css`).
// The `createElement as h` pattern is preserved verbatim — Apex's
// author chose hyperscript over JSX for this file, and we keep it.

import { createElement as h } from "react";
import type { ComponentType, CSSProperties, ReactNode } from "react";
import Link from "next/link";

type Tone = "default" | "success" | "warn" | "critical";
const LinkComponent = Link as unknown as ComponentType<Record<string, unknown>>;

// Cerniq-namespaced version of Apex's top-nav route list. Originally
// pointed to Apex root paths (/platform, /, /hub, ...). Now points to
// /apex/* sub-app paths so internal nav stays inside the absorbed
// surface. Phase 2+ will add real pages at each of these routes; for
// Phase 1.1 only /apex (Start) renders content.
const routeLinks = [
  { href: "/apex/platform", label: "Platform" },
  { href: "/apex", label: "Start" },
  { href: "/apex/hub", label: "Hub" },
  { href: "/apex/research", label: "Research" },
  { href: "/apex/war-room", label: "War Room" },
  { href: "/apex/journal", label: "Journal" },
  { href: "/apex/community", label: "Community" },
  { href: "/apex/cockpit", label: "Cockpit" },
];

export function ApexRouteNav({
  active,
  links = routeLinks,
}: {
  active?: string;
  links?: Array<{ href: string; label: string }>;
}) {
  return h(
    "nav",
    { className: "apex-top-nav", "aria-label": "APEX product surfaces" },
    h(
      LinkComponent,
      { className: "apex-brand", href: "/apex" },
      h("span", { className: "apex-brand-mark" }, "APEX"),
      h("span", { className: "apex-brand-subtitle" }, "Autonomous Trading OS"),
    ),
    h(
      "div",
      { className: "apex-nav-links" },
      ...links.map((link) =>
        h(
          LinkComponent,
          {
            key: link.href,
            className: "apex-nav-link",
            href: link.href,
            "aria-current": active === link.href ? "page" : undefined,
            style:
              active === link.href
                ? { borderColor: "rgba(0,255,178,0.34)", color: "#00FFB2" }
                : undefined,
          },
          link.label,
        ),
      ),
    ),
  );
}

export function ApexPageShell({
  active,
  children,
  maxWidth,
}: {
  active?: string;
  children?: ReactNode;
  maxWidth?: number;
}) {
  return h(
    "div",
    { className: "apex-page" },
    h(
      "div",
      {
        className: "apex-shell-inner",
        style: maxWidth ? { maxWidth } : undefined,
      },
      h(ApexRouteNav, { active }),
      children,
    ),
  );
}

export function ApexStatusPill({
  children,
  tone = "default",
}: {
  children?: ReactNode;
  tone?: Tone;
}) {
  return h(
    "span",
    {
      className: "apex-status-pill",
      "data-tone": tone === "default" ? undefined : tone,
    },
    children,
  );
}

export function ApexAction({
  children,
  href,
  onClick,
  tone = "default",
  disabled,
  testId,
  type = "button",
  style,
}: {
  children?: ReactNode;
  href?: string;
  onClick?: () => void;
  tone?: Tone;
  disabled?: boolean;
  testId?: string;
  type?: "button" | "submit";
  style?: CSSProperties;
}) {
  const className = [
    "apex-button",
    tone === "success" ? "apex-button-primary" : "",
    tone === "warn" ? "apex-button-warn" : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (href && !disabled) {
    return h(
      LinkComponent,
      { className, href, style, "data-testid": testId },
      children,
    );
  }

  return h(
    "button",
    {
      type,
      className,
      onClick,
      disabled,
      "data-testid": testId,
      style,
    },
    children,
  );
}

export function ApexActionGroup({ children }: { children?: ReactNode }) {
  return h("div", { className: "apex-action-group" }, children);
}

export function ApexMetricStrip({
  metrics,
}: {
  metrics: Array<{ label: string; value: ReactNode; detail?: ReactNode }>;
}) {
  return h(
    "div",
    { className: "apex-metric-grid" },
    ...metrics.map((metric) =>
      h(
        "div",
        { className: "apex-metric", key: metric.label },
        h("div", { className: "apex-metric-label" }, metric.label),
        h("div", { className: "apex-metric-value" }, metric.value),
        metric.detail
          ? h("div", { className: "apex-metric-detail" }, metric.detail)
          : null,
      ),
    ),
  );
}

export function ApexStatePanel({
  eyebrow,
  title,
  copy,
  tone = "default",
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  copy?: ReactNode;
  tone?: Tone;
  children?: ReactNode;
}) {
  return h(
    "section",
    {
      className: "apex-state-panel",
      "data-tone": tone === "default" ? undefined : tone,
    },
    h("div", { className: "apex-eyebrow" }, eyebrow),
    h("div", { className: "apex-state-panel__title" }, title),
    copy ? h("div", { className: "apex-state-panel__copy" }, copy) : null,
    children
      ? h("div", { className: "apex-state-panel__body" }, children)
      : null,
  );
}

export function ApexJourneyRail({
  steps,
}: {
  steps: Array<{
    label: string;
    title: ReactNode;
    detail: ReactNode;
    tone?: Tone;
    href?: string;
  }>;
}) {
  return h(
    "div",
    {
      className: "apex-journey-rail",
      "aria-label": "APEX guided product journey",
    },
    ...steps.map((step, index) => {
      const content = [
        h(
          "div",
          { className: "apex-journey-index", key: "index" },
          String(index + 1).padStart(2, "0"),
        ),
        h(
          "div",
          { key: "content" },
          h("div", { className: "apex-journey-title" }, step.title),
          h("div", { className: "apex-journey-detail" }, step.detail),
        ),
      ];
      const props = {
        key: step.label,
        className: "apex-journey-step",
        "data-tone": step.tone === "default" ? undefined : step.tone,
      };

      return step.href
        ? h(LinkComponent, { ...props, href: step.href }, ...content)
        : h("div", props, ...content);
    }),
  );
}

export function ApexHero({
  eyebrow,
  title,
  copy,
  actions,
  aside,
}: {
  eyebrow: string;
  title: ReactNode;
  copy: ReactNode;
  actions?: ReactNode;
  aside?: ReactNode;
}) {
  return h(
    "section",
    { className: "apex-hero" },
    h(
      "div",
      { className: "apex-hero-grid" },
      h(
        "div",
        null,
        h("div", { className: "apex-eyebrow" }, eyebrow),
        h("h1", { className: "apex-hero-title" }, title),
        h("div", { className: "apex-hero-copy" }, copy),
        actions ? h("div", { className: "apex-hero-actions" }, actions) : null,
      ),
      aside ? h("div", { className: "apex-proof-panel" }, aside) : null,
    ),
  );
}

export function ApexSection({
  eyebrow,
  title,
  copy,
  children,
}: {
  eyebrow?: string;
  title?: ReactNode;
  copy?: ReactNode;
  children?: ReactNode;
}) {
  return h(
    "section",
    { className: "apex-section-band" },
    eyebrow ? h("div", { className: "apex-eyebrow" }, eyebrow) : null,
    title ? h("h2", { className: "apex-section-title" }, title) : null,
    copy ? h("div", { className: "apex-section-copy" }, copy) : null,
    children,
  );
}

export function ApexEmptyState({ children }: { children: ReactNode }) {
  return h("div", { className: "apex-empty-state" }, children);
}

export function ApexRouteGrid({
  routes,
}: {
  routes: Array<{
    href: string;
    title: ReactNode;
    summary: ReactNode;
    action: ReactNode;
    tone?: Tone;
    eyebrow?: ReactNode;
    status?: ReactNode;
  }>;
}) {
  return h(
    "div",
    { className: "apex-route-grid" },
    ...routes.map((route) =>
      h(
        LinkComponent,
        {
          key: route.href,
          className: "apex-route-card",
          href: route.href,
          "data-tone": route.tone === "default" ? undefined : route.tone,
        },
        route.eyebrow || route.status
          ? h(
              "div",
              { className: "apex-route-card__meta" },
              route.eyebrow ? h("span", null, route.eyebrow) : null,
              route.status ? h("span", null, route.status) : null,
            )
          : null,
        h("div", { className: "apex-route-card__title" }, route.title),
        h("div", { className: "apex-route-card__summary" }, route.summary),
        h("div", { className: "apex-route-card__action" }, route.action),
      ),
    ),
  );
}
