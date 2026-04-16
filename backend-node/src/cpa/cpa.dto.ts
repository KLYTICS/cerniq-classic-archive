import { z } from 'zod';

// ─── Tier enum ──────────────────────────────────────────────────
export const CpaTierSchema = z.enum(['CPA_STANDARD', 'CPA_PRO']);
export type CpaTier = z.infer<typeof CpaTierSchema>;

/** Max clients per tier. CPA_STANDARD: 5, CPA_PRO: 15. */
export const CPA_TIER_LIMITS: Record<CpaTier, number> = {
  CPA_STANDARD: 5,
  CPA_PRO: 15,
};

// ─── Firm ───────────────────────────────────────────────────────

export const CreateCpaFirmSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'slug must be lowercase alphanumeric with hyphens'),
  contactName: z.string().min(1).max(200),
  contactEmail: z.string().email(),
  contactPhone: z.string().max(30).optional(),
  logoUrl: z.string().url().optional(),
  brandPrimaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'must be a hex color, e.g. #0066CC')
    .optional(),
  brandSecondaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'must be a hex color, e.g. #003366')
    .optional(),
  website: z.string().url().optional(),
  tier: CpaTierSchema,
});
export type CreateCpaFirmDto = z.infer<typeof CreateCpaFirmSchema>;

export const UpdateCpaFirmSchema = CreateCpaFirmSchema.partial();
export type UpdateCpaFirmDto = z.infer<typeof UpdateCpaFirmSchema>;

export const ListFirmsQuerySchema = z.object({
  tier: CpaTierSchema.optional(),
  isActive: z
    .preprocess((v) => v === 'true' || v === true, z.boolean())
    .optional(),
});
export type ListFirmsQueryDto = z.infer<typeof ListFirmsQuerySchema>;

// ─── Branding ───────────────────────────────────────────────────

export const UpdateBrandingSchema = z.object({
  logoUrl: z.string().url().optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  secondaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  firmName: z.string().min(1).max(200).optional(),
  website: z.string().url().optional(),
  reportFooterText: z.string().max(500).optional(),
  reportHeaderTemplate: z.string().max(2000).optional(),
});
export type UpdateBrandingDto = z.infer<typeof UpdateBrandingSchema>;

// ─── Client ─────────────────────────────────────────────────────

export const AddClientSchema = z.object({
  institutionId: z.string().min(1),
  brandingOverride: z.record(z.string(), z.unknown()).optional(),
});
export type AddClientDto = z.infer<typeof AddClientSchema>;

export const BulkAddClientsSchema = z.object({
  institutionIds: z.array(z.string().min(1)).min(1).max(50),
});
export type BulkAddClientsDto = z.infer<typeof BulkAddClientsSchema>;

// ─── CSV upload ─────────────────────────────────────────────────

export const CsvUploadResponseSchema = z.object({
  processed: z.number(),
  created: z.number(),
  updated: z.number(),
  errors: z.array(z.string()),
});
export type CsvUploadResponseDto = z.infer<typeof CsvUploadResponseSchema>;
