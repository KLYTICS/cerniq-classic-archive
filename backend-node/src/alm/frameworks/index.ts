/**
 * Regulatory Framework Registry
 *
 * Maps institution.primaryRegulator to the corresponding framework
 * definition. Defaults to COSSEC when no match is found.
 */

export type { IRegulatoryFramework, RegulatoryRatio } from './regulatory-framework.interface';
export { COSSEC_PR_FRAMEWORK } from './cossec-pr.framework';
export { NCUA_US_FRAMEWORK } from './ncua-us.framework';

import { IRegulatoryFramework } from './regulatory-framework.interface';
import { COSSEC_PR_FRAMEWORK } from './cossec-pr.framework';
import { NCUA_US_FRAMEWORK } from './ncua-us.framework';

/**
 * Resolve the regulatory framework for a given regulator identifier.
 *
 * @param regulatorId  Value from Institution.primaryRegulator, e.g. "NCUA", "COSSEC"
 * @returns The matching IRegulatoryFramework (defaults to COSSEC)
 */
export function getFramework(regulatorId: string): IRegulatoryFramework {
  switch (regulatorId?.toUpperCase()) {
    case 'NCUA':
      return NCUA_US_FRAMEWORK;
    case 'COSSEC':
    default:
      return COSSEC_PR_FRAMEWORK;
  }
}
