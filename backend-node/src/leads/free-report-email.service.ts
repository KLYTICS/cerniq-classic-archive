import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { FreeReportResult } from './free-report.service';

// ─── Constants ──────────────────────────────────────────────

const FROM_ADDRESS = 'Erwin Kiess <onboarding@resend.dev>';
const REPLY_TO = 'eskiessalfonso@gmail.com';

const NAVY = '#1B3A6B';
const GOLD = '#E8A020';

// ─── Service ────────────────────────────────────────────────

@Injectable()
export class FreeReportEmailService {
  private readonly logger = new Logger(FreeReportEmailService.name);
  private resend: Resend | null = null;

  constructor() {
    if (process.env.RESEND_API_KEY) {
      this.resend = new Resend(process.env.RESEND_API_KEY);
    } else {
      this.logger.warn('RESEND_API_KEY not set — free report emails disabled');
    }
  }

  /**
   * Send the free ALM health-check PDF to the prospect.
   * Includes personalised greeting, NII hook insight, CTA, tracking pixel, and PDF attachment.
   */
  async sendFreeReportEmail(
    result: FreeReportResult,
    pdfBuffer: Buffer,
    recipientEmail?: string,
  ): Promise<void> {
    const email = recipientEmail || result.leadId; // fallback — caller should always pass email
    const apiBaseUrl = (
      process.env.API_BASE_URL || 'https://api.cerniq.io'
    ).replace(/\/+$/, '');

    if (!this.resend) {
      this.logger.log({
        event: 'free_report_email.dry_run',
        leadId: result.leadId,
        institution: result.institutionName,
        pdfSizeBytes: pdfBuffer.length,
      });
      return;
    }

    const subject = `Su análisis ALM — ${result.institutionName}`;

    const htmlBody = this.buildHtmlBody(result, apiBaseUrl);

    try {
      await this.resend.emails.send({
        from: FROM_ADDRESS,
        replyTo: process.env.ERWIN_EMAIL || REPLY_TO,
        to: email,
        subject,
        html: htmlBody,
        attachments: [
          {
            filename: `cerniq-health-check-${(result.slug || 'report').replace(/[^a-z0-9-]/g, '')}.pdf`,
            content: pdfBuffer.toString('base64'),
          },
        ],
      });

      this.logger.log({
        event: 'free_report_email.sent',
        leadId: result.leadId,
        institution: result.institutionName,
        email,
      });
    } catch (err) {
      this.logger.error({
        event: 'free_report_email.failed',
        leadId: result.leadId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ─── HTML Builder ──────────────────────────────────────────

  private buildHtmlBody(r: FreeReportResult, apiBaseUrl: string): string {
    const gradeEmoji =
      r.healthGrade === 'A'
        ? '&#9733;'
        : r.healthGrade === 'B'
          ? '&#9733;'
          : r.healthGrade === 'C'
            ? '&#9888;'
            : '&#9888;';

    const trackingPixel = `<img src="${apiBaseUrl}/api/leads/track/${r.leadId}" width="1" height="1" alt="" style="display:block;" />`;

    return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:Georgia,serif;">
<div style="max-width:580px;margin:0 auto;">

  <!-- Header -->
  <div style="background:${NAVY};padding:24px 32px;border-radius:8px 8px 0 0;">
    <span style="color:#FFFFFF;font-size:22px;font-weight:bold;letter-spacing:-0.5px;">CERNIQ</span>
    <span style="color:#93C5FD;font-size:11px;margin-left:8px;">by KLYTICS LLC</span>
  </div>

  <!-- Body -->
  <div style="background:#FFFFFF;padding:32px;border:1px solid #E2E8F0;border-top:none;line-height:1.7;color:#1E293B;font-size:15px;">

    <p>Hola,</p>

    <p>Gracias por solicitar su análisis ALM preliminar para <strong>${r.institutionName}</strong>. Adjunto encontrará su informe de salud financiera.</p>

    <!-- NII Hook highlight -->
    <div style="background:${NAVY};padding:20px 24px;border-radius:8px;margin:20px 0;">
      <p style="color:${GOLD};font-size:13px;margin:0 0 4px;">Su dato clave:</p>
      <p style="color:#FFFFFF;font-size:24px;font-weight:bold;margin:0;">1 punto base = ${r.niiHookFormatted}</p>
      <p style="color:#93C5FD;font-size:12px;margin:4px 0 0;">en ingreso neto por intereses anual</p>
    </div>

    <p>Su puntaje de salud CERNIQ: <strong style="color:${r.healthGrade === 'A' || r.healthGrade === 'B' ? '#16A34A' : '#D97706'}">${r.healthScore}/100 (${r.healthGrade})</strong> ${gradeEmoji}</p>

    <p>Este informe preliminar fue generado con datos públicos de COSSEC. Para obtener un análisis <strong>preciso y completo</strong> con sus datos internos — incluyendo simulación Monte Carlo, análisis de duración de brechas, y cumplimiento regulatorio — agende una demo:</p>

    <!-- CTA Button -->
    <div style="margin:28px 0 8px;text-align:center;">
      <a href="https://cerniq.io/demo" style="background:${GOLD};color:#FFFFFF;padding:16px 36px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;display:inline-block;">Agendar demo de 15 minutos</a>
    </div>

    <p style="margin-top:28px;color:#475569;font-size:14px;">Cordialmente,<br><strong>Erwin Kiess</strong><br>Fundador, CERNIQ &middot; KLYTICS LLC<br>San Juan, Puerto Rico</p>

    <hr style="border:none;border-top:2px solid #E2E8F0;margin:32px 0;">

    <p>Hi,</p>

    <p>Thank you for requesting your preliminary ALM analysis for <strong>${r.institutionName}</strong>. Your financial health report is attached.</p>

    <p>Your key insight: <strong>A 1 basis point shift in rates = ${r.niiHookFormatted} in annual NII.</strong></p>

    <p>Your CERNIQ Health Score: <strong>${r.healthScore}/100 (${r.healthGrade})</strong></p>

    <p>This preliminary report was built from COSSEC public filings. For a <strong>precise, full analysis</strong> with your internal data — including Monte Carlo simulation, duration gap analysis, and regulatory compliance — schedule a demo:</p>

    <div style="margin:28px 0 8px;text-align:center;">
      <a href="https://cerniq.io/demo" style="background:${GOLD};color:#FFFFFF;padding:16px 36px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;display:inline-block;">Schedule a 15-minute demo</a>
    </div>

    <p style="margin-top:16px;color:#475569;font-size:14px;">Best,<br><strong>Erwin Kiess</strong><br>Founder, CERNIQ &middot; KLYTICS LLC<br>San Juan, Puerto Rico</p>

  </div>

  <!-- Footer -->
  <div style="background:#F1F5F9;padding:16px 32px;border-radius:0 0 8px 8px;border:1px solid #E2E8F0;border-top:none;">
    <p style="margin:0;font-size:11px;color:#64748B;line-height:1.6;">
      CERNIQ &middot; KLYTICS LLC &middot; San Juan, Puerto Rico &middot; hello@cerniq.io<br>
      <a href="https://cerniq.io/privacy" style="color:#64748B;">Privacidad</a> &middot;
      <a href="https://cerniq.io/terms" style="color:#64748B;">T&eacute;rminos</a>
    </p>
  </div>

  ${trackingPixel}
</div>
</body>
</html>`;
  }
}
