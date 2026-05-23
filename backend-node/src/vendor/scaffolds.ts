import { Injectable, Logger } from '@nestjs/common';

/**
 * Contract-bound vendor scaffolds.
 *
 * Each class below is the canonical method signature that the future real
 * provider should implement once the contract / sandbox / credentials are
 * in place. Today every method returns a structured `VendorScaffoldGap`
 * marker that callers surface as a UI DataGap (Rule 1 — never silent-
 * zero a credential miss).
 *
 * Why scaffold and not "wait until ready":
 *   - The vendor registry (registry.ts) is the discovery surface. Listing
 *     a vendor as "scaffold" instead of "planned" means there's actual code
 *     a future engineer can grep, and the typed method signatures are the
 *     contract specification.
 *   - When a contract lands and credentials become available, the work is
 *     "replace the stub body" not "design the API from scratch."
 *   - The admin /vendor-status page can render real-time status for every
 *     vendor (planned vs scaffold vs production) without special-casing.
 *
 * Why all six in one file:
 *   - They share NO state and NO logic. The "credentials required" gap
 *     pattern is the only thing they have in common, and it's a one-line
 *     helper. Spreading 6 trivial files would obscure the registry-pattern
 *     intent. When any one of these grows past ~80 LOC (because the
 *     contract was signed and real auth + endpoints landed), split it out
 *     to its own file.
 *
 * Why TypeScript scaffolds at all (not a doc):
 *   - The DI graph wires these as real providers. A NestJS @Injectable()
 *     class is the artifact other services can depend on. When credentials
 *     arrive, the consumer code is already in place — only the provider
 *     internals change.
 */

export interface VendorScaffoldGap {
  __dataGap: true;
  scaffold: true;
  vendor: string;
  vendorId: string;
  reason: 'CREDENTIALS_REQUIRED' | 'CONTRACT_PENDING' | 'SANDBOX_PENDING';
  action: string;
  envVarsRequired: string[];
}

function scaffoldGap(
  vendorId: string,
  vendor: string,
  envVars: string[],
  action: string,
): VendorScaffoldGap {
  return {
    __dataGap: true,
    scaffold: true,
    vendorId,
    vendor,
    reason: 'CREDENTIALS_REQUIRED',
    envVarsRequired: envVars,
    action,
  };
}

// NOTE: Bloomberg BPIPE + Refinitiv Eikon were promoted from stub scaffold
// to real REST providers in commit (tier-2 expansion). See:
//   - vendor/market-data/bloomberg-hapi.provider.ts
//   - vendor/market-data/refinitiv-eikon.provider.ts
// Both return null when creds missing (Rule 1) — same posture as scaffolds,
// but with full OAuth2 + REST call paths wired so they go live the moment
// credentials land. The remaining four classes below stay as pure scaffolds
// until their respective contracts / portal credentials / XSDs become
// available.

// ─── ICE Bank of America Bond Indices ───────────────────────────────
@Injectable()
export class IceBofaScaffold {
  private readonly logger = new Logger(IceBofaScaffold.name);
  private readonly vendorId = 'ice-bofa';

  /** Latest index level for an ICE BofA bond index (e.g. 'C0A0' for IG corporates). */
  async getIndexLevel(_indexName: string): Promise<null> {
    this.logger.warn('IceBofaScaffold.getIndexLevel — scaffold mode');
    return null;
  }
  /** Latest sector spread (e.g. 'Financials senior'). */
  async getSectorSpread(_sector: string): Promise<null> {
    this.logger.warn('IceBofaScaffold.getSectorSpread — scaffold mode');
    return null;
  }
  scaffoldStatus(): VendorScaffoldGap {
    return scaffoldGap(
      this.vendorId,
      'ICE Bank of America Bond Indices',
      ['ICE_BOFA_LICENSE_KEY'],
      'ICE Data Services license + endpoint provisioning required.',
    );
  }
}

// ─── Symitar (Jack Henry core banking) ──────────────────────────────
@Injectable()
export class SymitarScaffold {
  private readonly logger = new Logger(SymitarScaffold.name);
  private readonly vendorId = 'symitar-jack-henry';

  /** Member share/loan balances. */
  async getMemberBalances(_memberId: string): Promise<null> {
    this.logger.warn('SymitarScaffold.getMemberBalances — scaffold mode');
    return null;
  }
  /** Loan book snapshot for ALM consumption. */
  async getLoanBook(): Promise<null> {
    this.logger.warn('SymitarScaffold.getLoanBook — scaffold mode');
    return null;
  }
  scaffoldStatus(): VendorScaffoldGap {
    return scaffoldGap(
      this.vendorId,
      'Symitar (Jack Henry)',
      [
        'SYMITAR_HOST',
        'SYMITAR_USER',
        'SYMITAR_PASSWORD',
        'SYMITAR_CHARTER_ID',
      ],
      'Per-cooperativa contract via Jack Henry account; PowerOn API access; sandbox provisioning. ETA depends on the specific cooperativa.',
    );
  }
}

// ─── COSSEC e-filing (PR regulator) ─────────────────────────────────
@Injectable()
export class CossecScaffold {
  private readonly logger = new Logger(CossecScaffold.name);
  private readonly vendorId = 'cossec-efiling';

  /** Submit a regulatory filing to COSSEC. */
  async submitFiling(_form: string, _payload: unknown): Promise<null> {
    this.logger.warn('CossecScaffold.submitFiling — scaffold mode');
    return null;
  }
  /** Recent filing history for a cooperativa. */
  async getFilingHistory(_institutionId: string): Promise<null> {
    this.logger.warn('CossecScaffold.getFilingHistory — scaffold mode');
    return null;
  }
  scaffoldStatus(): VendorScaffoldGap {
    return scaffoldGap(
      this.vendorId,
      'COSSEC e-filing',
      ['COSSEC_PORTAL_USER', 'COSSEC_PORTAL_PASSWORD', 'COSSEC_INSTITUTION_ID'],
      'COSSEC API documentation + per-institution portal credentials + sandbox availability required. Highest-leverage scaffold once unblocked — eliminates the most error-prone step in the cooperativa compliance workflow.',
    );
  }
}

// ─── NCUA 5300 (federal call reports) ───────────────────────────────
@Injectable()
export class Ncua5300Scaffold {
  private readonly logger = new Logger(Ncua5300Scaffold.name);
  private readonly vendorId = 'ncua-5300';

  /** Submit a quarterly 5300 call report. */
  async submitCallReport(_quarter: string, _payload: unknown): Promise<null> {
    this.logger.warn('Ncua5300Scaffold.submitCallReport — scaffold mode');
    return null;
  }
  /** Past call-report history for a federal charter. */
  async getCallReportHistory(_charter: string): Promise<null> {
    this.logger.warn('Ncua5300Scaffold.getCallReportHistory — scaffold mode');
    return null;
  }
  scaffoldStatus(): VendorScaffoldGap {
    return scaffoldGap(
      this.vendorId,
      'NCUA 5300 call reports',
      ['NCUA_CUONLINE_USER', 'NCUA_CUONLINE_PASSWORD', 'NCUA_CHARTER_ID'],
      'CUOnline portal credentials + XSD schema for the current 5300 form revision required.',
    );
  }
}
