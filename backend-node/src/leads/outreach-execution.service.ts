import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { EmailService } from '../email/email.service';
import { LeadsService } from './leads.service';

@Injectable()
export class OutreachExecutionService {
  private readonly logger = new Logger(OutreachExecutionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly leads: LeadsService,
  ) {}

  async executeOutreach(
    prospectId: string,
    lang: 'en' | 'es' = 'es',
  ): Promise<{ sent: boolean; error?: string }> {
    // 1. Fetch the prospect to get contactEmail
    const prospect = await this.prisma.prospectInstitution.findUnique({
      where: { id: prospectId },
    });

    if (!prospect) {
      return { sent: false, error: 'Prospect not found' };
    }

    if (!prospect.contactEmail) {
      return { sent: false, error: 'No contact email for prospect' };
    }

    // 2. Generate the outreach email
    const outreach = await this.leads.generateOutreach(prospectId, lang);

    // 3. Send via Resend
    try {
      await this.email.sendRawEmail({
        to: prospect.contactEmail,
        subject: outreach.subject,
        html: outreach.body.replace(/\n/g, '<br>'),
      });
    } catch (err: any) {
      this.logger.error(
        `Outreach failed for ${prospectId}: ${err.message}`,
      );
      return { sent: false, error: err.message };
    }

    // 4. Update prospect outreach status
    await this.prisma.prospectInstitution.update({
      where: { id: prospectId },
      data: {
        outreachStatus: 'sent',
      },
    });

    this.logger.log(
      `Outreach sent to ${prospect.contactEmail} for ${prospect.name}`,
    );
    return { sent: true };
  }

  async executeBulkOutreach(
    lang: 'en' | 'es' = 'es',
    limit: number = 10,
  ): Promise<{ total: number; sent: number; failed: number }> {
    // Find prospects that haven't been contacted yet
    const prospects = await this.prisma.prospectInstitution.findMany({
      where: { outreachStatus: 'not_started' },
      take: limit,
      orderBy: { estimatedAssets: 'desc' }, // Largest first
    });

    let sent = 0;
    let failed = 0;
    for (const prospect of prospects) {
      const result = await this.executeOutreach(prospect.id, lang);
      if (result.sent) sent++;
      else failed++;
      // Throttle: 1 email per 2 seconds to avoid rate limits
      await new Promise((r) => setTimeout(r, 2000));
    }

    return { total: prospects.length, sent, failed };
  }
}
