import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend | null = null;

  private frontendUrl(): string {
    return (process.env.FRONTEND_URL || 'https://cerniq.io').trim().replace(/\/+$/, '');
  }

  constructor() {
    if (process.env.RESEND_API_KEY) {
      this.resend = new Resend(process.env.RESEND_API_KEY);
      this.logger.log('Resend email client initialized');
    } else {
      this.logger.warn('RESEND_API_KEY not set — email notifications disabled');
    }
  }

  async sendDemoRequestNotification(data: {
    name?: string;
    email: string;
    institutionName?: string;
    institutionType?: string;
    totalAssets?: string;
  }): Promise<void> {
    if (!this.resend) return;

    try {
      await this.resend.emails.send({
        from: 'CERNIQ <onboarding@resend.dev>',
        to: 'erwin@klytics.io',
        subject: `New Demo Request — ${data.institutionName || data.email}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #f59e0b;">New Demo Request — CERNIQ</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px; font-weight: bold;">Name</td><td>${data.name || '—'}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold;">Email</td><td>${data.email}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold;">Institution</td><td>${data.institutionName || '—'}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold;">Type</td><td>${data.institutionType || '—'}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold;">Assets</td><td>${data.totalAssets || '—'}</td></tr>
            </table>
            <div style="margin-top: 24px;">
              <a href="${this.frontendUrl()}/admin"
                 style="background: #f59e0b; color: #000; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                View in Admin Dashboard
              </a>
            </div>
            <p style="color: #666; margin-top: 16px; font-size: 12px;">
              Send demo: ${this.frontendUrl()}/demo?type=${data.institutionType || 'bank'}
            </p>
          </div>
        `,
      });
      this.logger.log(`Demo request notification sent for ${data.email}`);
    } catch (err) {
      this.logger.error(`Failed to send demo request notification: ${err}`);
    }
  }

  async sendLeadNotification(data: {
    leadId: string;
    name: string;
    email: string;
    phone?: string;
    role: string;
    institutionName: string;
    institutionType: string;
    message?: string;
    priority: string;
    nextFollowUp: Date;
  }): Promise<void> {
    if (!this.resend) {
      this.logger.log(`[DRY RUN] Lead notification: ${data.institutionName} (${data.priority})`);
      return;
    }

    const priorityEmoji = data.priority === 'HIGH' ? '\uD83D\uDD34' : data.priority === 'MEDIUM' ? '\uD83D\uDFE1' : '\u26AA';
    const followUpStr = data.nextFollowUp.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
      timeZone: 'America/Puerto_Rico',
    });

    try {
      await this.resend.emails.send({
        from: 'CERNIQ <onboarding@resend.dev>',
        to: 'erwin@klytics.io',
        subject: `${priorityEmoji} New Lead: ${data.institutionName} \u2014 ${data.institutionType} \u2014 ${data.priority}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #f59e0b;">New Lead \u2014 CERNIQ</h2>
            <p><strong>${data.name}</strong> from <strong>${data.institutionName}</strong> just requested a sample ALM report.</p>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
              <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Role</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${data.role}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Institution</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${data.institutionName} (${data.institutionType})</td></tr>
              <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Email</td><td style="padding: 8px; border-bottom: 1px solid #eee;"><a href="mailto:${data.email}">${data.email}</a></td></tr>
              ${data.phone ? `<tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Phone</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${data.phone}</td></tr>` : ''}
              ${data.message ? `<tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Message</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${data.message}</td></tr>` : ''}
            </table>
            <p><strong>Next follow-up:</strong> ${followUpStr}</p>
            <p><strong>Priority:</strong> ${data.priority}</p>
            <div style="margin-top: 20px;">
              <a href="${this.frontendUrl()}/admin/leads/${data.leadId}"
                 style="background: #f59e0b; color: #000; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-right: 8px;">
                View in Admin
              </a>
              <a href="mailto:${data.email}"
                 style="background: #334155; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                Reply to Lead
              </a>
            </div>
            <p style="color: #666; margin-top: 24px; font-size: 12px;">CERNIQ | KLYTICS LLC Revenue Operations</p>
          </div>
        `,
      });
      this.logger.log(`Lead notification sent for ${data.email}`);
    } catch (err) {
      this.logger.error(`Failed to send lead notification: ${err}`);
    }
  }

  async sendLeadConfirmation(data: {
    name: string;
    email: string;
    institutionName: string;
    bilingual: boolean;
  }): Promise<void> {
    if (!this.resend) {
      this.logger.log(`[DRY RUN] Lead confirmation to: ${data.email}`);
      return;
    }

    const spanishSection = data.bilingual ? `
      <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #eee;">
        <p style="color: #666; font-size: 12px; font-style: italic;">Versi\u00f3n en espa\u00f1ol:</p>
        <p>Hola ${data.name},</p>
        <p>Gracias por comunicarse. Hemos recibido su solicitud de an\u00e1lisis ALM complimentario para <strong>${data.institutionName}</strong>.</p>
        <p>Pr\u00f3ximos pasos:</p>
        <ol>
          <li>Procesaremos los datos financieros p\u00fablicos de su instituci\u00f3n</li>
          <li>Recibir\u00e1 un informe ALM de marca dentro de 48 horas</li>
          <li>Incluiremos un resumen de hallazgos clave y alertas regulatorias</li>
        </ol>
        <p>\u00bfPreguntas? Responda directamente a este correo.</p>
      </div>
    ` : '';

    try {
      await this.resend.emails.send({
        from: 'Erwin Kiess <onboarding@resend.dev>',
        to: data.email,
        subject: `Your ALM Report Request \u2014 CERNIQ`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #f59e0b;">Hi ${data.name},</h2>
            <p>Thank you for reaching out. We've received your request for a complimentary ALM analysis for <strong>${data.institutionName}</strong>.</p>
            <p>Here's what happens next:</p>
            <ol>
              <li>We'll run your institution's public financial data through our system</li>
              <li>You'll receive a branded ALM report within 48 hours</li>
              <li>We'll include a brief summary of key findings and any regulatory flags</li>
            </ol>
            <p>Questions? Reply to this email directly.</p>
            ${spanishSection}
            <p style="color: #666; margin-top: 24px;">\u2014 Erwin Kiess-Alfonso<br>Founder, CERNIQ | KLYTICS LLC<br>San Juan, Puerto Rico</p>
          </div>
        `,
      });
      this.logger.log(`Lead confirmation sent to ${data.email}`);
    } catch (err) {
      this.logger.error(`Failed to send lead confirmation: ${err}`);
    }
  }

  // ── Micro-SaaS Lifecycle Emails ─────────────────────

  private wrap(heading: string, bodyHtml: string, ctaUrl?: string, ctaText?: string): string {
    const cta = ctaUrl && ctaText ? `
      <div style="margin: 28px 0 8px;">
        <a href="${ctaUrl}" style="background: #1B3A6B; color: #FFFFFF; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block;">${ctaText}</a>
      </div>` : '';
    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
      <body style="margin:0;padding:0;background:#F8FAFC;font-family:Georgia,serif;">
      <div style="max-width: 560px; margin: 0 auto;">
        <div style="background: #1B3A6B; padding: 24px 32px; border-radius: 8px 8px 0 0;">
          <span style="color: #FFFFFF; font-size: 22px; font-weight: bold; letter-spacing: -0.5px;">CERNIQ</span>
          <span style="color: #93C5FD; font-size: 11px; margin-left: 8px;">by KLYTICS LLC</span>
        </div>
        <div style="background: #FFFFFF; padding: 32px; border: 1px solid #E2E8F0; border-top: none;">
          <h1 style="color: #1B3A6B; font-size: 20px; margin: 0 0 16px;">${heading}</h1>
          ${bodyHtml}
          ${cta}
        </div>
        <div style="background: #F1F5F9; padding: 16px 32px; border-radius: 0 0 8px 8px; border: 1px solid #E2E8F0; border-top: none;">
          <p style="margin: 0; font-size: 11px; color: #64748B;">
            CERNIQ &middot; KLYTICS LLC &middot; San Juan, Puerto Rico<br>
            <a href="https://cerniq.io/privacy" style="color: #64748B;">Privacidad</a> &middot;
            <a href="https://cerniq.io/terms" style="color: #64748B;">T&eacute;rminos</a>
          </p>
        </div>
      </div>
      </body>
      </html>`;
  }

  async sendClientWelcome(data: { email: string; name: string; tier: string; magicUrl: string; institutionName: string }): Promise<void> {
    if (!this.resend) { this.logger.log(`[DRY RUN] Client welcome: ${data.email}`); return; }
    try {
      await this.resend.emails.send({
        from: 'CERNIQ <onboarding@resend.dev>',
        to: data.email,
        subject: `Payment confirmed — welcome to CERNIQ`,
        html: this.wrap(
          `Bienvenido a CERNIQ`,
          `<p>Hola ${data.name || ''},</p>
           <p>Su pago ha sido confirmado. Su portal está listo.</p>
           <p><strong>Plan:</strong> ${data.tier}<br>
           <strong>Institución:</strong> ${data.institutionName}</p>
           <p>Haga clic abajo para acceder a su portal (enlace válido por 24 horas):</p>`,
          data.magicUrl,
          'Acceder al Portal →',
        ),
      });
    } catch (err) { this.logger.error(`Failed to send welcome: ${err}`); }
  }

  async sendRevenueAlert(data: { amount: number; tier: string; customerEmail: string; institutionName: string }): Promise<void> {
    if (!this.resend) { this.logger.log(`[DRY RUN] Revenue alert: $${data.amount}`); return; }
    try {
      await this.resend.emails.send({
        from: 'CERNIQ <onboarding@resend.dev>',
        to: 'erwin@klytics.io',
        subject: `💰 $${data.amount} — ${data.institutionName} — ${data.tier}`,
        html: this.wrap(
          `Revenue Alert: $${data.amount}`,
          `<p><strong>Amount:</strong> $${data.amount}<br>
           <strong>Tier:</strong> ${data.tier}<br>
           <strong>Client:</strong> ${data.customerEmail}<br>
           <strong>Institution:</strong> ${data.institutionName}</p>`,
          `${this.frontendUrl()}/admin/leads`,
          'View in Admin →',
        ),
      });
    } catch (err) { this.logger.error(`Failed to send revenue alert: ${err}`); }
  }

  async sendMagicLinkEmail(data: { email: string; magicUrl: string; name: string }): Promise<void> {
    if (!this.resend) { this.logger.log(`[DRY RUN] Magic link: ${data.email}`); return; }
    try {
      await this.resend.emails.send({
        from: 'CERNIQ <onboarding@resend.dev>',
        to: data.email,
        subject: 'Su enlace de acceso — CERNIQ',
        html: this.wrap(
          'Acceso a su portal',
          `<p>Hola ${data.name || ''},</p><p>Haga clic abajo para acceder a su portal CERNIQ. Este enlace es válido por 24 horas.</p>`,
          data.magicUrl,
          'Acceder al Portal →',
        ),
      });
    } catch (err) { this.logger.error(`Failed to send magic link: ${err}`); }
  }

  async sendReportReady(data: { email: string; name: string; institutionName: string; portalUrl: string }): Promise<void> {
    if (!this.resend) { this.logger.log(`[DRY RUN] Report ready: ${data.email}`); return; }
    try {
      await this.resend.emails.send({
        from: 'CERNIQ <onboarding@resend.dev>',
        to: data.email,
        subject: `Su informe ALM está listo — ${data.institutionName}`,
        html: this.wrap(
          'Su informe ALM está listo',
          `<p>Hola ${data.name || ''},</p>
           <p>El informe ALM de <strong>${data.institutionName}</strong> ha sido generado y está disponible en su portal.</p>
           <p>El informe incluye análisis de sensibilidad de tasa, brecha de duración, cumplimiento COSSEC y recomendaciones.</p>`,
          data.portalUrl,
          'Ver Informe →',
        ),
      });
    } catch (err) { this.logger.error(`Failed to send report ready: ${err}`); }
  }

  async sendPaymentFailed(data: { email: string; name: string }): Promise<void> {
    if (!this.resend) { this.logger.log(`[DRY RUN] Payment failed: ${data.email}`); return; }
    try {
      await this.resend.emails.send({
        from: 'CERNIQ <onboarding@resend.dev>',
        to: data.email,
        subject: 'Problema con su pago — CERNIQ',
        html: this.wrap(
          'Problema con su pago',
          `<p>Hola ${data.name || ''},</p>
           <p>No pudimos procesar su último pago. Por favor actualice su método de pago para evitar interrupción del servicio.</p>`,
          `${this.frontendUrl()}/portal/billing`,
          'Actualizar Pago →',
        ),
      });
    } catch (err) { this.logger.error(`Failed to send payment failed: ${err}`); }
  }

  async sendCancellationEmail(data: { email: string; name: string }): Promise<void> {
    if (!this.resend) { this.logger.log(`[DRY RUN] Cancellation: ${data.email}`); return; }
    try {
      await this.resend.emails.send({
        from: 'Erwin Kiess <onboarding@resend.dev>',
        to: data.email,
        subject: 'Lamentamos verle ir — una nota de Erwin',
        html: this.wrap(
          'Lamentamos verle ir',
          `<p>Hola ${data.name || ''},</p>
           <p>Su suscripción a CERNIQ ha sido cancelada. Sus informes históricos permanecerán disponibles.</p>
           <p>Si hay algo que podamos mejorar, por favor responda a este correo. Su opinión es valiosa.</p>
           <p>— Erwin Kiess-Alfonso<br>Founder, KLYTICS LLC</p>`,
        ),
      });
    } catch (err) { this.logger.error(`Failed to send cancellation: ${err}`); }
  }

  async sendMonthlyReportCycle(data: { email: string; name: string }): Promise<void> {
    if (!this.resend) { this.logger.log(`[DRY RUN] Monthly cycle: ${data.email}`); return; }
    try {
      await this.resend.emails.send({
        from: 'CERNIQ <onboarding@resend.dev>',
        to: data.email,
        subject: 'Nuevo ciclo de reporte — envíe sus datos actualizados',
        html: this.wrap(
          'Nuevo ciclo de reporte iniciado',
          `<p>Hola ${data.name || ''},</p>
           <p>Su renovación mensual ha sido procesada. Un nuevo ciclo de reporte ha comenzado.</p>
           <p>Envíe su balance actualizado para generar el informe de este período.</p>`,
          `${this.frontendUrl()}/portal/submit`,
          'Enviar Datos →',
        ),
      });
    } catch (err) { this.logger.error(`Failed to send monthly cycle: ${err}`); }
  }

  async sendDisputeAlert(data: { chargeId: string; amount: number; reason: string }): Promise<void> {
    if (!this.resend) { this.logger.log(`[DRY RUN] Dispute alert: ${data.chargeId}`); return; }
    try {
      await this.resend.emails.send({
        from: 'CERNIQ <onboarding@resend.dev>',
        to: 'erwin@klytics.io',
        subject: `⚠️ DISPUTE: $${data.amount} — ${data.reason}`,
        html: this.wrap(
          'Dispute Alert — Immediate Action Required',
          `<p><strong>Charge:</strong> ${data.chargeId}<br>
           <strong>Amount:</strong> $${data.amount}<br>
           <strong>Reason:</strong> ${data.reason}</p>
           <p>Log in to Stripe Dashboard to respond immediately.</p>`,
        ),
      });
    } catch (err) { this.logger.error(`Failed to send dispute alert: ${err}`); }
  }

  async sendDataSubmissionAck(data: { email: string; name: string; institutionName: string }): Promise<void> {
    if (!this.resend) { this.logger.log(`[DRY RUN] Data ack: ${data.email}`); return; }
    try {
      await this.resend.emails.send({
        from: 'CERNIQ <onboarding@resend.dev>',
        to: data.email,
        subject: `Datos recibidos — informe en proceso para ${data.institutionName}`,
        html: this.wrap(
          'Hemos recibido sus datos',
          `<p>Hola ${data.name || ''},</p>
           <p>Los datos de <strong>${data.institutionName}</strong> han sido recibidos. Su informe ALM será generado en los próximos 5 días hábiles.</p>
           <p>Puede seguir el progreso en su portal.</p>`,
          `${this.frontendUrl()}/portal`,
          'Ver Progreso →',
        ),
      });
    } catch (err) { this.logger.error(`Failed to send data ack: ${err}`); }
  }

  async sendJobFailedAlert(data: { jobId: string; institutionName: string; error: string; clientEmail: string }): Promise<void> {
    if (!this.resend) { this.logger.log(`[DRY RUN] Job failed alert: ${data.jobId}`); return; }
    try {
      await this.resend.emails.send({
        from: 'CERNIQ <onboarding@resend.dev>',
        to: 'erwin@klytics.io',
        subject: `⚠️ Report failed — ${data.institutionName}`,
        html: this.wrap(
          'Report Generation Failed',
          `<p><strong>Job:</strong> ${data.jobId}<br>
           <strong>Institution:</strong> ${data.institutionName}<br>
           <strong>Client:</strong> ${data.clientEmail}<br>
           <strong>Error:</strong> ${data.error}</p>`,
          `${this.frontendUrl()}/admin/pipeline`,
          'View Pipeline →',
        ),
      });
    } catch (err) { this.logger.error(`Failed to send job failed alert: ${err}`); }
  }

  async sendDailyOperationsReport(data: { pendingJobs: number; failedJobs: number; newLeads: number; pendingFollowUps: number }): Promise<void> {
    if (!this.resend) { this.logger.log(`[DRY RUN] Daily ops report`); return; }
    try {
      await this.resend.emails.send({
        from: 'CERNIQ <onboarding@resend.dev>',
        to: 'erwin@klytics.io',
        subject: `Pipeline: ${data.newLeads} new leads, ${data.pendingJobs} pending jobs`,
        html: this.wrap(
          'Daily Operations Report',
          `<table style="width: 100%; border-collapse: collapse;">
             <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">New Leads (24h)</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${data.newLeads}</td></tr>
             <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Overdue Follow-ups</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${data.pendingFollowUps}</td></tr>
             <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Report Jobs Pending</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${data.pendingJobs}</td></tr>
             <tr><td style="padding: 8px; font-weight: bold;">Failed Jobs (7d)</td><td style="padding: 8px;">${data.failedJobs}</td></tr>
           </table>`,
          `${this.frontendUrl()}/admin`,
          'Open Admin →',
        ),
      });
    } catch (err) { this.logger.error(`Failed to send daily ops report: ${err}`); }
  }

  // ── Sequence Emails (fired by EmailSequenceProcessor) ──

  async sendDataSubmissionReminder(data: { email: string; name: string }): Promise<void> {
    if (!this.resend) { this.logger.log(`[DRY RUN] B2 data reminder: ${data.email}`); return; }
    try {
      await this.resend.emails.send({
        from: 'CERNIQ <onboarding@resend.dev>',
        to: data.email,
        subject: 'Siguiente paso: enviar sus datos de balance',
        html: this.wrap(
          'Su portal está listo',
          `<p>Hola ${data.name || ''},</p>
           <p>Su portal CERNIQ está configurado. El siguiente paso es enviar los datos de su balance general para que podamos generar su informe ALM personalizado.</p>
           <p>El proceso toma menos de 5 minutos — solo necesita subir un archivo CSV con sus posiciones de activos y pasivos.</p>`,
          `${this.frontendUrl()}/portal/submit`,
          'Enviar Datos Ahora →',
        ),
      });
    } catch (err) { this.logger.error(`Failed to send B2: ${err}`); }
  }

  async sendOnboardingCheckIn(data: { email: string; name: string }): Promise<void> {
    if (!this.resend) { this.logger.log(`[DRY RUN] B3 check-in: ${data.email}`); return; }
    try {
      await this.resend.emails.send({
        from: 'Erwin Kiess <onboarding@resend.dev>',
        to: data.email,
        subject: 'Necesita ayuda con sus datos? — CERNIQ',
        html: this.wrap(
          'Estamos aqui para ayudar',
          `<p>Hola ${data.name || ''},</p>
           <p>Queria verificar si necesita ayuda para preparar sus datos de balance. Puedo asistirle personalmente con:</p>
           <ul style="color: #475569;">
             <li>Formato del archivo CSV</li>
             <li>Clasificacion de posiciones de activos y pasivos</li>
             <li>Dudas sobre los datos requeridos</li>
           </ul>
           <p>Responda a este correo directamente y le ayudo.</p>
           <p>— Erwin Kiess-Alfonso<br>Founder, KLYTICS LLC</p>`,
        ),
      });
    } catch (err) { this.logger.error(`Failed to send B3: ${err}`); }
  }

  async sendReportFollowUp(data: { email: string; name: string; institutionName: string }): Promise<void> {
    if (!this.resend) { this.logger.log(`[DRY RUN] C2 report follow-up: ${data.email}`); return; }
    try {
      await this.resend.emails.send({
        from: 'Erwin Kiess <onboarding@resend.dev>',
        to: data.email,
        subject: `Guia rapida: como usar su informe ALM — ${data.institutionName}`,
        html: this.wrap(
          'Como aprovechar su informe',
          `<p>Hola ${data.name || ''},</p>
           <p>Ahora que tiene su informe ALM de <strong>${data.institutionName}</strong>, aqui le explico como aprovecharlo:</p>
           <ol style="color: #475569;">
             <li><strong>Resumen Ejecutivo</strong> — comparta con su junta directiva</li>
             <li><strong>Sensibilidad NII</strong> — identifique su exposicion a cambios de tasa</li>
             <li><strong>Cumplimiento COSSEC</strong> — use como documentacion para examenes</li>
             <li><strong>Recomendaciones</strong> — actionable steps para mitigar riesgos</li>
           </ol>
           <p>Quiere una sesion de 15 minutos para revisar los resultados? Responda a este correo.</p>
           <p>— Erwin Kiess-Alfonso<br>Founder, KLYTICS LLC</p>`,
        ),
      });
    } catch (err) { this.logger.error(`Failed to send C2: ${err}`); }
  }

  async sendWinBackEmail(data: { email: string; name: string }): Promise<void> {
    if (!this.resend) { this.logger.log(`[DRY RUN] D5 win-back: ${data.email}`); return; }
    try {
      await this.resend.emails.send({
        from: 'Erwin Kiess <onboarding@resend.dev>',
        to: data.email,
        subject: 'Le extrañamos — oferta especial para regresar',
        html: this.wrap(
          'Ha pasado un tiempo',
          `<p>Hola ${data.name || ''},</p>
           <p>Han pasado unos meses desde que cancelo su suscripcion CERNIQ. Hemos añadido varias mejoras:</p>
           <ul style="color: #475569;">
             <li>Informes bilingues mejorados (ES + EN)</li>
             <li>Nuevos escenarios de estres regulatorio</li>
             <li>Portal de cliente mejorado</li>
           </ul>
           <p>Si desea regresar, responda a este correo y le ofrezco un descuento especial.</p>
           <p>— Erwin Kiess-Alfonso<br>Founder, KLYTICS LLC</p>`,
        ),
      });
    } catch (err) { this.logger.error(`Failed to send D5: ${err}`); }
  }

  async sendLeadNurtureTeaser(data: { email: string; name: string; institutionName: string }): Promise<void> {
    if (!this.resend) { this.logger.log(`[DRY RUN] A1 lead teaser: ${data.email}`); return; }
    try {
      await this.resend.emails.send({
        from: 'CERNIQ <onboarding@resend.dev>',
        to: data.email,
        subject: `Vista previa: analisis ALM de ${data.institutionName}`,
        html: this.wrap(
          'Su analisis ALM gratuito',
          `<p>Hola ${data.name || ''},</p>
           <p>Estamos preparando su analisis ALM gratuito para <strong>${data.institutionName}</strong>. Pronto recibira un informe que incluye:</p>
           <ul style="color: #475569;">
             <li>Brecha de duracion y perfil de riesgo</li>
             <li>Sensibilidad de ingreso neto por interes (NII)</li>
             <li>Evaluacion de cumplimiento COSSEC</li>
           </ul>
           <p>Mientras tanto, puede explorar nuestro demo interactivo:</p>`,
          `${this.frontendUrl()}/demo`,
          'Ver Demo →',
        ),
      });
    } catch (err) { this.logger.error(`Failed to send A1: ${err}`); }
  }

  async sendLeadNurturePricing(data: { email: string; name: string }): Promise<void> {
    if (!this.resend) { this.logger.log(`[DRY RUN] A2 pricing: ${data.email}`); return; }
    try {
      await this.resend.emails.send({
        from: 'Erwin Kiess <onboarding@resend.dev>',
        to: data.email,
        subject: 'Planes y precios — CERNIQ ALM',
        html: this.wrap(
          'Planes diseñados para su institucion',
          `<p>Hola ${data.name || ''},</p>
           <p>CERNIQ ofrece informes ALM profesionales a una fraccion del costo de consultores tradicionales:</p>
           <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
             <tr style="border-bottom: 1px solid #E5E7EB;">
               <td style="padding: 10px; font-weight: bold;">Informe Individual</td>
               <td style="padding: 10px;">$499</td>
               <td style="padding: 10px; color: #6B7280;">Un informe completo (ES + EN)</td>
             </tr>
             <tr style="border-bottom: 1px solid #E5E7EB;">
               <td style="padding: 10px; font-weight: bold;">Monitoreo Mensual</td>
               <td style="padding: 10px;">$299/mes</td>
               <td style="padding: 10px; color: #6B7280;">Informes ilimitados + alertas</td>
             </tr>
             <tr>
               <td style="padding: 10px; font-weight: bold;">Paquete Anual</td>
               <td style="padding: 10px;">$2,400/año</td>
               <td style="padding: 10px; color: #6B7280;">Todo incluido + 2 meses gratis</td>
             </tr>
           </table>
           <p>Responda a este correo si desea discutir cual plan es mejor para su institucion.</p>
           <p>— Erwin Kiess-Alfonso<br>Founder, KLYTICS LLC</p>`,
        ),
      });
    } catch (err) { this.logger.error(`Failed to send A2: ${err}`); }
  }

  // ── Existing Methods ──────────────────────────────────

  async sendDemoConfirmation(data: { name?: string; email: string }): Promise<void> {
    if (!this.resend) return;

    try {
      await this.resend.emails.send({
        from: 'Erwin Kiess <onboarding@resend.dev>',
        to: data.email,
        subject: 'Your CERNIQ demo is ready',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #f59e0b;">Hi ${data.name || 'there'},</h2>
            <p>Thanks for your interest in CERNIQ. I've set up a personalized demo environment for you.</p>
            <p>Here's your demo link — takes 2 minutes to set up, everything's pre-loaded with a $1.2B Puerto Rico community bank profile:</p>
            <div style="margin: 24px 0; text-align: center;">
              <a href="${this.frontendUrl()}/demo?type=bank"
                 style="background: #f59e0b; color: #000; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
                Open Your Demo
              </a>
            </div>
            <p>I'll reach out within 24 hours to schedule a 20-minute walkthrough where I'll show you:</p>
            <ul>
              <li>Duration gap analysis for your institution's balance sheet</li>
              <li>NII sensitivity across +/-300bps rate scenarios</li>
              <li>Monte Carlo stress test (1,000 paths, 4 regulatory scenarios)</li>
              <li>One-click PDF report for your board/examiners</li>
            </ul>
            <p>Questions? Reply to this email or reach me at erwin@klytics.io</p>
            <p style="color: #666;">— Erwin Kiess<br>Founder, CERNIQ | KLYTICS<br>San Juan, Puerto Rico</p>
          </div>
        `,
      });
      this.logger.log(`Demo confirmation sent to ${data.email}`);
    } catch (err) {
      this.logger.error(`Failed to send demo confirmation: ${err}`);
    }
  }
}
