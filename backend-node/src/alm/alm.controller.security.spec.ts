/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck — Direct-construction with proxy mocks; matches alm.controller.spec.ts pattern.
/**
 * AlmController — Security Spec (body-IDOR closures)
 *
 * Locks the structural invariants closed in the R3 v3 closure commit:
 *
 *   - createInstitution    → institutionScope.verifyWorkspaceOwnership(dto.workspaceId, …) BEFORE almEnterprise.createInstitution
 *   - saveScenario         → institutionScope.verifyOwnership(dto.institutionId, …)          BEFORE scenarioPersistence.saveScenario
 *   - saveCustomYieldCurve → institutionScope.verifyOwnership(dto.institutionId, …)          BEFORE yieldCurve.saveCustomCurve
 *
 * Mirrors ncua.controller.security.spec.ts (58651c54). The class-level
 * @UseGuards(AuthTenantGuard, InstitutionScopeGuard) authenticates and
 * scopes routes with :institutionId path params; these three routes
 * receive the tenancy field in the @Body() DTO and were silently
 * cross-tenant before R3 v3 surfaced them.
 *
 * Why direct construction + proxy mocks: AlmController has 88 ctor
 * dependencies; Nest's Test.createTestingModule() compile times out
 * under that fan-in. Same scaffolding as alm.controller.spec.ts.
 */

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AlmController } from './alm.controller';

function mockSvc(): any {
  return new Proxy(
    {},
    {
      get: (_t: any, p: any) =>
        typeof p === 'symbol' ? undefined : jest.fn().mockResolvedValue(null),
    },
  );
}

describe('AlmController — Body-IDOR Closure (R3 v3)', () => {
  let enterprise: { createInstitution: jest.Mock };
  let scenarioPersistence: {
    saveScenario: jest.Mock;
    listScenarios: jest.Mock;
  };
  let yieldCurve: { saveCustomCurve: jest.Mock };
  let scope: {
    verifyOwnership: jest.Mock;
    verifyWorkspaceOwnership: jest.Mock;
  };
  let controller: AlmController;

  const WORKSPACE_ID = 'ws-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
  const INSTITUTION_ID = 'inst-11111111-2222-4333-8444-555555555555';

  const buildReq = (
    overrides: {
      userId?: string;
      isMasterCeo?: boolean;
      legacyId?: boolean;
    } = {},
  ) => {
    const idKey = overrides.legacyId === true ? 'id' : 'userId';
    return {
      user: {
        [idKey]: overrides.userId ?? 'user-1',
        access: { isMasterCeo: overrides.isMasterCeo === true },
      },
    };
  };

  beforeEach(() => {
    enterprise = {
      createInstitution: jest
        .fn()
        .mockResolvedValue({ id: INSTITUTION_ID, workspaceId: WORKSPACE_ID }),
    };
    scenarioPersistence = {
      saveScenario: jest.fn().mockResolvedValue({ id: 'scen-1' }),
      listScenarios: jest.fn().mockResolvedValue([]),
    };
    yieldCurve = {
      saveCustomCurve: jest.fn().mockResolvedValue({ id: 'curve-1' }),
    };
    scope = {
      verifyOwnership: jest.fn().mockResolvedValue(undefined),
      verifyWorkspaceOwnership: jest.fn().mockResolvedValue(undefined),
    };

    const paramCount = (AlmController as any).length || 88;
    const args: any[] = Array.from({ length: paramCount }, () => mockSvc());
    args[1] = enterprise; // AlmEnterpriseService
    args[11] = scenarioPersistence; // ScenarioPersistenceService
    args[12] = yieldCurve; // YieldCurveService
    args[paramCount - 1] = scope; // InstitutionScopeGuard (last)
    controller = new (AlmController as any)(...args);
  });

  // ───────────────────────────────────────────────────────────────────
  //  POST /api/alm/institutions  (createInstitution)
  //  → verifyWorkspaceOwnership(dto.workspaceId, userId, isMasterCeo)
  // ───────────────────────────────────────────────────────────────────

  describe('createInstitution', () => {
    const dto = {
      name: 'CoopAhorro',
      type: 'cooperativa',
      workspaceId: WORKSPACE_ID,
    };

    it('calls verifyWorkspaceOwnership BEFORE almEnterprise.createInstitution (call-order lock)', async () => {
      await controller.createInstitution(buildReq() as any, dto as any);

      const verifyOrder =
        scope.verifyWorkspaceOwnership.mock.invocationCallOrder[0];
      const createOrder =
        enterprise.createInstitution.mock.invocationCallOrder[0];
      expect(verifyOrder).toBeLessThan(createOrder);

      expect(scope.verifyWorkspaceOwnership).toHaveBeenCalledWith(
        WORKSPACE_ID,
        'user-1',
        false,
      );
    });

    it('propagates Forbidden when ownership denies; never calls almEnterprise.createInstitution', async () => {
      scope.verifyWorkspaceOwnership.mockRejectedValueOnce(
        new ForbiddenException('not authorized for this workspace'),
      );

      await expect(
        controller.createInstitution(buildReq() as any, dto as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(enterprise.createInstitution).not.toHaveBeenCalled();
    });

    it('forwards isMasterCeo=true to verifyWorkspaceOwnership for master-CEO callers', async () => {
      await controller.createInstitution(
        buildReq({ isMasterCeo: true }) as any,
        dto as any,
      );
      expect(scope.verifyWorkspaceOwnership).toHaveBeenCalledWith(
        WORKSPACE_ID,
        'user-1',
        true,
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────
  //  POST /api/alm/scenarios/save  (saveScenario)
  //  → verifyOwnership(dto.institutionId, userId, isMasterCeo)
  // ───────────────────────────────────────────────────────────────────

  describe('saveScenario', () => {
    const dto = {
      name: 'Q1-stress',
      institutionId: INSTITUTION_ID,
      shock: 100,
    };

    it('calls verifyOwnership BEFORE scenarioPersistence.saveScenario (call-order lock)', async () => {
      await controller.saveScenario(buildReq() as any, dto as any);

      const verifyOrder = scope.verifyOwnership.mock.invocationCallOrder[0];
      const saveOrder =
        scenarioPersistence.saveScenario.mock.invocationCallOrder[0];
      expect(verifyOrder).toBeLessThan(saveOrder);

      expect(scope.verifyOwnership).toHaveBeenCalledWith(
        INSTITUTION_ID,
        'user-1',
        false,
      );
    });

    it('propagates NotFound when the institution does not exist; never calls scenarioPersistence.saveScenario', async () => {
      scope.verifyOwnership.mockRejectedValueOnce(
        new NotFoundException('institution not found'),
      );

      await expect(
        controller.saveScenario(buildReq() as any, dto as any),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(scenarioPersistence.saveScenario).not.toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────────────
  //  POST /api/alm/yield-curve/custom  (saveCustomYieldCurve)
  //  → verifyOwnership(dto.institutionId, userId, isMasterCeo)
  // ───────────────────────────────────────────────────────────────────

  describe('saveCustomYieldCurve', () => {
    const dto = {
      name: 'custom-1',
      institutionId: INSTITUTION_ID,
      tenors: [{ months: 12, rate: 0.045 }],
    };

    it('calls verifyOwnership BEFORE yieldCurve.saveCustomCurve (call-order lock)', async () => {
      await controller.saveCustomYieldCurve(buildReq() as any, dto as any);

      const verifyOrder = scope.verifyOwnership.mock.invocationCallOrder[0];
      const saveOrder = yieldCurve.saveCustomCurve.mock.invocationCallOrder[0];
      expect(verifyOrder).toBeLessThan(saveOrder);

      expect(scope.verifyOwnership).toHaveBeenCalledWith(
        INSTITUTION_ID,
        'user-1',
        false,
      );
    });

    it('propagates Forbidden when ownership denies; never calls yieldCurve.saveCustomCurve', async () => {
      scope.verifyOwnership.mockRejectedValueOnce(
        new ForbiddenException('not authorized for this institution'),
      );

      await expect(
        controller.saveCustomYieldCurve(buildReq() as any, dto as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(yieldCurve.saveCustomCurve).not.toHaveBeenCalled();
    });

    it('reads userId from legacy `req.user.id` shape when canonical `userId` is absent', async () => {
      await controller.saveCustomYieldCurve(
        buildReq({ userId: 'legacy-user', legacyId: true }) as any,
        dto as any,
      );
      expect(scope.verifyOwnership).toHaveBeenCalledWith(
        INSTITUTION_ID,
        'legacy-user',
        false,
      );
    });
  });
});
