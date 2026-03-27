import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

// Runs all 8 core quant models simultaneously via Promise.allSettled
// Never crashes if 1 model fails — returns partial results with fallbacks

export interface QuantSwarmResult {
  institutionId: string;
  healthScore: number;
  completedModels: string[];
  failedModels: string[];
  computeTimeMs: number;
  rateShock: any;
  liquidity: any;
  cecl: any;
  concentration: any;
  ftp: any;
  peers: any;
  camel: any;
  climate: any;
}

@Injectable()
export class QuantSwarmService {
  private readonly logger = new Logger(QuantSwarmService.name);

  constructor(private readonly prisma: PrismaService) {}

  async runFullSwarm(
    institutionId: string,
    services: {
      yieldCurve: any;
      liquidity: any;
      cecl: any;
      concentration: any;
      ftp: any;
      peers: any;
      camel: any;
      climate: any;
      advisor: any;
    },
  ): Promise<QuantSwarmResult> {
    const start = Date.now();

    const [
      rateShock,
      liquidity,
      cecl,
      concentration,
      ftp,
      peers,
      camel,
      climate,
    ] = await Promise.allSettled([
      services.yieldCurve.getYieldCurveAnalysis(institutionId),
      services.liquidity.getAdvancedLiquidity(institutionId),
      services.cecl.getCECLAnalysis(institutionId),
      services.concentration.getConcentrationAnalysis(institutionId),
      services.ftp.getFTPAnalysis(institutionId),
      services.peers.getPeerAnalytics(institutionId),
      services.camel.scoreInstitution(institutionId),
      services.climate.computeClimateRisk(institutionId),
    ]);

    const extract = (r: PromiseSettledResult<any>) =>
      r.status === 'fulfilled' ? r.value : null;
    const modelNames = [
      'rateShock',
      'liquidity',
      'cecl',
      'concentration',
      'ftp',
      'peers',
      'camel',
      'climate',
    ];
    const allResults = [
      rateShock,
      liquidity,
      cecl,
      concentration,
      ftp,
      peers,
      camel,
      climate,
    ];

    const completed = modelNames.filter(
      (_, i) => allResults[i].status === 'fulfilled',
    );
    const failed = modelNames.filter(
      (_, i) => allResults[i].status === 'rejected',
    );

    if (failed.length > 0) {
      this.logger.warn(
        `Swarm: ${failed.length} models failed: ${failed.join(', ')}`,
      );
    }

    const healthScore = await services.advisor
      .computeHealthScore(institutionId)
      .catch(() => ({ overall: 50 }));

    return {
      institutionId,
      healthScore: healthScore.overall ?? 50,
      completedModels: completed,
      failedModels: failed,
      computeTimeMs: Date.now() - start,
      rateShock: extract(rateShock),
      liquidity: extract(liquidity),
      cecl: extract(cecl),
      concentration: extract(concentration),
      ftp: extract(ftp),
      peers: extract(peers),
      camel: extract(camel),
      climate: extract(climate),
    };
  }
}
