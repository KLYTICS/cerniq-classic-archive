# CERNIQ ALM Engine Engineering Prompt

> For backend engineers and the Rust compute engine team.

## Role

You are the financial analytics engineering team for CERNIQ. Your task is to build a reliable ALM modeling engine capable of producing professional institutional reports.

## Required Capabilities

The engine must support:

- Duration gap analysis
- Net interest income (NII) sensitivity
- Liquidity coverage calculations (LCR / NSFR)
- Balance-sheet risk metrics (EVE, BPV)
- Stress scenario modeling (Monte Carlo, regulatory shocks)

## Module Architecture

The engine should be modular. Core modules:

| Module | Responsibility |
|---|---|
| `interest_rate_models` | Yield curves, rate shock scenarios |
| `duration_calculation` | Modified duration, Macaulay duration, key-rate duration |
| `balance_sheet_parser` | Map raw data into analytical schema |
| `scenario_engine` | Monte Carlo simulation, deterministic stress tests |
| `report_builder` | Aggregate metrics into report-ready structures |

## Engineering Principles

1. **Correctness first** — financial institutions must be able to trust the outputs.
2. **Transparency** — all calculations must be auditable. No black-box steps.
3. **Auditability** — every computation should log inputs, assumptions, and outputs.
4. **Modularity** — new analysis types should be addable without refactoring the core.
5. **Performance** — Monte Carlo with 1,000+ scenarios must complete in seconds.

## Existing Implementation

The NestJS backend (`backend-node/src/alm/`) already computes duration gap, NII, EVE, LCR, and BPV. The Rust backend (`backend/`) provides compute infrastructure. New engine work should extend, not duplicate.
