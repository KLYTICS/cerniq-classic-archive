import { Controller, Get } from '@nestjs/common';
import {
  VENDOR_REGISTRY,
  groupVendorsByCategory,
  vendorStatusCounts,
  type VendorEntry,
  type VendorStatus,
} from './registry';

/**
 * VendorController — exposes the KLYTICS vendor registry as a read-only
 * JSON surface for the admin /vendor-status page + any future
 * observability tools.
 *
 * The registry is declarative metadata, not runtime secret material — no
 * auth guard. Every field is information an engineering reviewer or
 * operator would want to see (status, compliance posture, integration
 * cost), nothing that leaks credentials or live operational state.
 */
@Controller('api/vendors')
export class VendorController {
  /**
   * Full registry as an array, in registry-declaration order. Frontend
   * groups + filters as needed.
   * GET /api/vendors
   */
  // verify:auth-skip — public vendor metadata; no credentials in payload
  @Get()
  list(): {
    count: number;
    statusCounts: Record<VendorStatus, number>;
    vendors: ReadonlyArray<VendorEntry>;
  } {
    return {
      count: VENDOR_REGISTRY.length,
      statusCounts: vendorStatusCounts(),
      vendors: VENDOR_REGISTRY,
    };
  }

  /**
   * Same registry grouped by category — saves the frontend from doing
   * the group-by client-side when it only wants to render category cards.
   * GET /api/vendors/by-category
   */
  // verify:auth-skip — public vendor metadata
  @Get('by-category')
  byCategory() {
    return {
      count: VENDOR_REGISTRY.length,
      statusCounts: vendorStatusCounts(),
      byCategory: groupVendorsByCategory(),
    };
  }
}
