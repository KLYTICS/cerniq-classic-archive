import { Module } from '@nestjs/common';
import { SECEdgarProvider } from './filings/sec-edgar.provider';
import { BloombergHapiProvider } from './market-data/bloomberg-hapi.provider';
import { RefinitivEikonProvider } from './market-data/refinitiv-eikon.provider';
import {
  CossecScaffold,
  IceBofaScaffold,
  Ncua5300Scaffold,
  SymitarScaffold,
} from './scaffolds';
import { VendorController } from './vendor.controller';
import { VendorHealthService } from './vendor-health.service';

/**
 * VendorModule — the DI home for non-market-data vendor connectors.
 *
 * Market-data vendors (Yahoo Finance, CoinGecko, FRED, Treasury Fiscal
 * Data, ECB SDW, Alpha Vantage) live in MarketDataModule because they're
 * consumed by the MarketDataService orchestrator. Filings + enterprise
 * tier-2 vendors (Bloomberg HAPI, Refinitiv RDP) + regulators + core
 * banking + AML live here.
 *
 * Tier-2 providers (BloombergHapiProvider, RefinitivEikonProvider) ship
 * with real REST call paths — OAuth2 token flow, request submission, DTO
 * parsing — but return null when credentials are absent (Rule 1). The
 * moment env vars land, these are production-ready without a code change.
 *
 * Scaffold providers (IceBofa, Symitar, COSSEC, NCUA 5300) are DI-wired
 * but stubbed pending contract / API documentation / sandbox provisioning.
 * The class identity is the stable contract.
 *
 * All providers are exported so any module can import VendorModule and
 * inject them directly.
 */
@Module({
  controllers: [VendorController],
  providers: [
    // Working free-API providers
    SECEdgarProvider,
    // Tier-2: real REST call paths, null when creds missing
    BloombergHapiProvider,
    RefinitivEikonProvider,
    // Contract-bound scaffolds — wired today, stubbed until creds land
    IceBofaScaffold,
    SymitarScaffold,
    CossecScaffold,
    Ncua5300Scaffold,
    // Runtime health observability
    VendorHealthService,
  ],
  exports: [
    SECEdgarProvider,
    BloombergHapiProvider,
    RefinitivEikonProvider,
    IceBofaScaffold,
    SymitarScaffold,
    CossecScaffold,
    Ncua5300Scaffold,
    VendorHealthService,
  ],
})
export class VendorModule {}
