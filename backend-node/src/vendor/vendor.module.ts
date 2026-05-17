import { Module } from '@nestjs/common';
import { SECEdgarProvider } from './filings/sec-edgar.provider';
import {
  BloombergBPipeScaffold,
  CossecScaffold,
  IceBofaScaffold,
  Ncua5300Scaffold,
  RefinitivEikonScaffold,
  SymitarScaffold,
} from './scaffolds';
import { VendorController } from './vendor.controller';

/**
 * VendorModule — the DI home for non-market-data vendor connectors.
 *
 * Market-data vendors (Yahoo Finance, CoinGecko, FRED, Treasury Fiscal
 * Data) live in MarketDataModule because they're consumed by the
 * MarketDataService orchestrator. Everything else — filings, regulators,
 * core banking, AML — lives here.
 *
 * Scaffold providers are DI-wired so future consumer code can declare a
 * dependency today and pick up the real implementation tomorrow when
 * credentials arrive. The class identity is the stable contract.
 *
 * All providers are exported so any module can import VendorModule and
 * inject them directly.
 */
@Module({
  controllers: [VendorController],
  providers: [
    // Working free-API providers
    SECEdgarProvider,
    // Contract-bound scaffolds — wired today, stubbed until creds land
    BloombergBPipeScaffold,
    RefinitivEikonScaffold,
    IceBofaScaffold,
    SymitarScaffold,
    CossecScaffold,
    Ncua5300Scaffold,
  ],
  exports: [
    SECEdgarProvider,
    BloombergBPipeScaffold,
    RefinitivEikonScaffold,
    IceBofaScaffold,
    SymitarScaffold,
    CossecScaffold,
    Ncua5300Scaffold,
  ],
})
export class VendorModule {}
