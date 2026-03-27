import { Injectable, Logger } from '@nestjs/common';
import { RegulatoryScraperService } from './regulatory-scraper.service';
import { ImpactExtractorService } from './impact-extractor.service';
import { AlertDeliveryService } from './alert-delivery.service';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class RegulatoryAlertService {
  private readonly logger = new Logger(RegulatoryAlertService.name);

  constructor(
    private readonly scraper: RegulatoryScraperService,
    private readonly extractor: ImpactExtractorService,
    private readonly delivery: AlertDeliveryService,
    private readonly prisma: PrismaService,
  ) {}

  async runFullPipeline(): Promise<{
    scanned: number;
    newPublications: number;
    alertsDelivered: number;
  }> {
    this.logger.log('Starting regulatory alert pipeline...');
    const { scanned, newFound } = await this.scraper.runDailyScan();

    let totalAlerts = 0;
    if (newFound > 0) {
      const unprocessed = await this.prisma.regulatoryPublication.findMany({
        where: { processedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      for (const pub of unprocessed) {
        const impact = await this.extractor.extract(pub.id);
        const delivered = await this.delivery.mapAndDeliverToAllInstitutions(
          pub.id,
          impact,
        );
        totalAlerts += delivered;
      }
    }

    this.logger.log(
      `Pipeline complete: ${scanned} sources scanned, ${newFound} new, ${totalAlerts} alerts`,
    );
    return { scanned, newPublications: newFound, alertsDelivered: totalAlerts };
  }

  async getRecentPublications(limit: number = 20) {
    return this.prisma.regulatoryPublication.findMany({
      orderBy: { publishedAt: 'desc' },
      take: limit,
    });
  }
}
