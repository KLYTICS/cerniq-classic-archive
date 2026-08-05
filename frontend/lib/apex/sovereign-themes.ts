// Apex absorption — Phase 5c sovereign themes catalog (2026-05-17).
//
// Verbatim port of `apex/lib/server/sovereign/themes.ts`. Curated
// 5-theme universe spanning AI supply chain, broad tech, Vanguard
// core, quantum, and nuclear. Each theme has an anchor ETF + tiered
// constituents tagged with US revenue share for the US-bias overlay.
//
// "Preserve original form" — symbols, names, weights, narratives,
// tiers, flags all preserved byte-for-byte from the apex source.

import type { ThemeDefinition, ThemeId } from "@/lib/apex/sovereign-contracts";

const AI_SUPPLY_CHAIN: ThemeDefinition = {
  id: "ai_supply_chain",
  label: "AI Supply Chain",
  narrative:
    "Vertical integration from semiconductor IP and lithography through fabs, " +
    "accelerator vendors, and the hyperscalers consuming the wafers.",
  anchorSymbol: "SMH",
  usBiasWeight: 0.7,
  constituents: [
    {
      symbol: "SMH",
      name: "VanEck Semiconductors ETF",
      tier: "anchor",
      isEtf: true,
      usRevenueShare: 0.55,
    },
    {
      symbol: "SOXX",
      name: "iShares Semiconductor ETF",
      tier: "anchor",
      isEtf: true,
      usRevenueShare: 0.55,
    },
    {
      symbol: "AIQ",
      name: "Global X Artificial Intelligence ETF",
      tier: "core",
      isEtf: true,
      usRevenueShare: 0.7,
    },
    {
      symbol: "BOTZ",
      name: "Global X Robotics & AI ETF",
      tier: "core",
      isEtf: true,
      usRevenueShare: 0.55,
    },
    {
      symbol: "ROBO",
      name: "ROBO Global Robotics ETF",
      tier: "satellite",
      isEtf: true,
      usRevenueShare: 0.5,
    },
    {
      symbol: "NVDA",
      name: "NVIDIA Corp",
      tier: "anchor",
      isEtf: false,
      usRevenueShare: 0.5,
    },
    {
      symbol: "AVGO",
      name: "Broadcom Inc",
      tier: "core",
      isEtf: false,
      usRevenueShare: 0.4,
    },
    {
      symbol: "AMD",
      name: "Advanced Micro Devices",
      tier: "core",
      isEtf: false,
      usRevenueShare: 0.5,
    },
    {
      symbol: "TSM",
      name: "Taiwan Semiconductor",
      tier: "core",
      isEtf: false,
      usRevenueShare: 0.65,
      flags: ["concentration_risk"],
    },
    {
      symbol: "ASML",
      name: "ASML Holding",
      tier: "core",
      isEtf: false,
      usRevenueShare: 0.15,
    },
    {
      symbol: "ARM",
      name: "Arm Holdings",
      tier: "satellite",
      isEtf: false,
      usRevenueShare: 0.45,
    },
    {
      symbol: "MU",
      name: "Micron Technology",
      tier: "satellite",
      isEtf: false,
      usRevenueShare: 0.5,
    },
    {
      symbol: "LRCX",
      name: "Lam Research",
      tier: "satellite",
      isEtf: false,
      usRevenueShare: 0.25,
    },
    {
      symbol: "AMAT",
      name: "Applied Materials",
      tier: "satellite",
      isEtf: false,
      usRevenueShare: 0.2,
    },
    {
      symbol: "KLAC",
      name: "KLA Corp",
      tier: "satellite",
      isEtf: false,
      usRevenueShare: 0.2,
    },
  ],
} as const;

const TECH_BROAD: ThemeDefinition = {
  id: "tech_broad",
  label: "Tech Broad",
  narrative:
    "Mega-cap technology + software exposure: the operating systems, search, " +
    "cloud, and platforms the AI workloads run on.",
  anchorSymbol: "XLK",
  usBiasWeight: 0.85,
  constituents: [
    {
      symbol: "XLK",
      name: "Technology Select Sector SPDR",
      tier: "anchor",
      isEtf: true,
      usRevenueShare: 0.6,
    },
    {
      symbol: "VGT",
      name: "Vanguard Information Technology ETF",
      tier: "anchor",
      isEtf: true,
      usRevenueShare: 0.6,
    },
    {
      symbol: "QQQ",
      name: "Invesco QQQ Trust",
      tier: "anchor",
      isEtf: true,
      usRevenueShare: 0.65,
    },
    {
      symbol: "QQQM",
      name: "Invesco NASDAQ 100 ETF",
      tier: "core",
      isEtf: true,
      usRevenueShare: 0.65,
    },
    {
      symbol: "IGV",
      name: "iShares Software ETF",
      tier: "core",
      isEtf: true,
      usRevenueShare: 0.7,
    },
    {
      symbol: "AAPL",
      name: "Apple Inc",
      tier: "anchor",
      isEtf: false,
      usRevenueShare: 0.45,
    },
    {
      symbol: "MSFT",
      name: "Microsoft Corp",
      tier: "anchor",
      isEtf: false,
      usRevenueShare: 0.5,
    },
    {
      symbol: "GOOGL",
      name: "Alphabet Inc",
      tier: "core",
      isEtf: false,
      usRevenueShare: 0.5,
    },
    {
      symbol: "META",
      name: "Meta Platforms",
      tier: "core",
      isEtf: false,
      usRevenueShare: 0.45,
    },
    {
      symbol: "AMZN",
      name: "Amazon.com",
      tier: "core",
      isEtf: false,
      usRevenueShare: 0.7,
    },
    {
      symbol: "ORCL",
      name: "Oracle Corp",
      tier: "satellite",
      isEtf: false,
      usRevenueShare: 0.55,
    },
    {
      symbol: "CRM",
      name: "Salesforce Inc",
      tier: "satellite",
      isEtf: false,
      usRevenueShare: 0.7,
    },
    {
      symbol: "NOW",
      name: "ServiceNow Inc",
      tier: "satellite",
      isEtf: false,
      usRevenueShare: 0.65,
    },
  ],
} as const;

const VANGUARD_CORE: ThemeDefinition = {
  id: "vanguard_core",
  label: "Vanguard Core",
  narrative:
    "Beta + factor reference rails. VOO/VTI as the equity hub; VXUS, VTV, VUG, " +
    "BND for cross-style and duration calibration.",
  anchorSymbol: "VOO",
  usBiasWeight: 1.0,
  constituents: [
    {
      symbol: "VOO",
      name: "Vanguard S&P 500 ETF",
      tier: "anchor",
      isEtf: true,
      usRevenueShare: 0.6,
    },
    {
      symbol: "VTI",
      name: "Vanguard Total Stock Market ETF",
      tier: "anchor",
      isEtf: true,
      usRevenueShare: 0.65,
    },
    {
      symbol: "VTV",
      name: "Vanguard Value ETF",
      tier: "core",
      isEtf: true,
      usRevenueShare: 0.7,
    },
    {
      symbol: "VUG",
      name: "Vanguard Growth ETF",
      tier: "core",
      isEtf: true,
      usRevenueShare: 0.55,
    },
    {
      symbol: "VXUS",
      name: "Vanguard Total International Stock",
      tier: "satellite",
      isEtf: true,
      usRevenueShare: 0.0,
    },
    {
      symbol: "BND",
      name: "Vanguard Total Bond Market ETF",
      tier: "satellite",
      isEtf: true,
      usRevenueShare: 1.0,
    },
    {
      symbol: "VYM",
      name: "Vanguard High Dividend Yield ETF",
      tier: "satellite",
      isEtf: true,
      usRevenueShare: 0.7,
    },
    {
      symbol: "VOOG",
      name: "Vanguard S&P 500 Growth ETF",
      tier: "satellite",
      isEtf: true,
      usRevenueShare: 0.55,
    },
  ],
} as const;

const QUANTUM: ThemeDefinition = {
  id: "quantum",
  label: "Quantum Computing",
  narrative:
    "Pure-play quantum and pubcos with funded quantum programs. Higher beta, " +
    "broad return dispersion. US-bias weights tilt against ITAR-touching " +
    "names when tension elevates.",
  anchorSymbol: "QTUM",
  usBiasWeight: 0.55,
  constituents: [
    {
      symbol: "QTUM",
      name: "Defiance Quantum ETF",
      tier: "anchor",
      isEtf: true,
      usRevenueShare: 0.55,
    },
    {
      symbol: "IONQ",
      name: "IonQ Inc",
      tier: "core",
      isEtf: false,
      usRevenueShare: 0.85,
    },
    {
      symbol: "RGTI",
      name: "Rigetti Computing",
      tier: "core",
      isEtf: false,
      usRevenueShare: 0.85,
    },
    {
      symbol: "QBTS",
      name: "D-Wave Quantum",
      tier: "core",
      isEtf: false,
      usRevenueShare: 0.6,
    },
    {
      symbol: "QUBT",
      name: "Quantum Computing Inc",
      tier: "satellite",
      isEtf: false,
      usRevenueShare: 0.85,
    },
    {
      symbol: "IBM",
      name: "International Business Machines",
      tier: "core",
      isEtf: false,
      usRevenueShare: 0.45,
    },
    {
      symbol: "HON",
      name: "Honeywell International",
      tier: "satellite",
      isEtf: false,
      usRevenueShare: 0.6,
      flags: ["itar"],
    },
    {
      symbol: "GOOGL",
      name: "Alphabet Inc",
      tier: "satellite",
      isEtf: false,
      usRevenueShare: 0.5,
    },
    {
      symbol: "MSFT",
      name: "Microsoft Corp",
      tier: "satellite",
      isEtf: false,
      usRevenueShare: 0.5,
    },
  ],
} as const;

const NUCLEAR: ThemeDefinition = {
  id: "nuclear",
  label: "Nuclear & Uranium",
  narrative:
    "Uranium miners → utilities → small modular reactor (SMR) builders. The " +
    "AI workload power-demand thesis converges with energy security under " +
    "elevated geopolitical tension; nuclear becomes a risk-on/risk-off hybrid.",
  anchorSymbol: "URA",
  usBiasWeight: 0.6,
  constituents: [
    {
      symbol: "URA",
      name: "Global X Uranium ETF",
      tier: "anchor",
      isEtf: true,
      usRevenueShare: 0.4,
    },
    {
      symbol: "URNM",
      name: "Sprott Uranium Miners ETF",
      tier: "anchor",
      isEtf: true,
      usRevenueShare: 0.35,
    },
    {
      symbol: "NLR",
      name: "VanEck Uranium+Nuclear Energy ETF",
      tier: "core",
      isEtf: true,
      usRevenueShare: 0.55,
    },
    {
      symbol: "CCJ",
      name: "Cameco Corp",
      tier: "core",
      isEtf: false,
      usRevenueShare: 0.4,
    },
    {
      symbol: "BWXT",
      name: "BWX Technologies",
      tier: "core",
      isEtf: false,
      usRevenueShare: 0.95,
      flags: ["itar"],
    },
    {
      symbol: "SMR",
      name: "NuScale Power",
      tier: "core",
      isEtf: false,
      usRevenueShare: 0.85,
    },
    {
      symbol: "OKLO",
      name: "Oklo Inc",
      tier: "satellite",
      isEtf: false,
      usRevenueShare: 1.0,
    },
    {
      symbol: "CEG",
      name: "Constellation Energy",
      tier: "core",
      isEtf: false,
      usRevenueShare: 1.0,
    },
    {
      symbol: "VST",
      name: "Vistra Corp",
      tier: "satellite",
      isEtf: false,
      usRevenueShare: 1.0,
    },
    {
      symbol: "PWR",
      name: "Quanta Services",
      tier: "satellite",
      isEtf: false,
      usRevenueShare: 0.9,
    },
    {
      symbol: "NRG",
      name: "NRG Energy",
      tier: "satellite",
      isEtf: false,
      usRevenueShare: 1.0,
    },
  ],
} as const;

export const SOVEREIGN_THEMES: Readonly<Record<ThemeId, ThemeDefinition>> = {
  ai_supply_chain: AI_SUPPLY_CHAIN,
  tech_broad: TECH_BROAD,
  vanguard_core: VANGUARD_CORE,
  quantum: QUANTUM,
  nuclear: NUCLEAR,
} as const;

export const SOVEREIGN_THEME_IDS: ReadonlyArray<ThemeId> = [
  "ai_supply_chain",
  "tech_broad",
  "vanguard_core",
  "quantum",
  "nuclear",
] as const;

const TIER_WEIGHT: Record<"anchor" | "core" | "satellite", number> = {
  anchor: 3,
  core: 2,
  satellite: 1,
};

export function getThemeUsRevenueShare(theme: ThemeDefinition): number {
  let weightedSum = 0;
  let totalWeight = 0;
  for (const c of theme.constituents) {
    const w = TIER_WEIGHT[c.tier];
    weightedSum += c.usRevenueShare * w;
    totalWeight += w;
  }
  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}
