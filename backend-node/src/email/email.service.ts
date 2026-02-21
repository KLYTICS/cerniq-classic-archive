import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend | null = null;

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
        from: 'CapexCycleOS <onboarding@resend.dev>',
        to: 'erwin@klytics.io',
        subject: `New Demo Request — ${data.institutionName || data.email}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #f59e0b;">New Demo Request — CapexCycleOS</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px; font-weight: bold;">Name</td><td>${data.name || '—'}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold;">Email</td><td>${data.email}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold;">Institution</td><td>${data.institutionName || '—'}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold;">Type</td><td>${data.institutionType || '—'}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold;">Assets</td><td>${data.totalAssets || '—'}</td></tr>
            </table>
            <div style="margin-top: 24px;">
              <a href="https://capexcycle.vercel.app/admin"
                 style="background: #f59e0b; color: #000; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                View in Admin Dashboard
              </a>
            </div>
            <p style="color: #666; margin-top: 16px; font-size: 12px;">
              Send demo: https://capexcycle.vercel.app/demo?type=${data.institutionType || 'bank'}
            </p>
          </div>
        `,
      });
      this.logger.log(`Demo request notification sent for ${data.email}`);
    } catch (err) {
      this.logger.error(`Failed to send demo request notification: ${err}`);
    }
  }

  async sendDemoConfirmation(data: { name?: string; email: string }): Promise<void> {
    if (!this.resend) return;

    try {
      await this.resend.emails.send({
        from: 'Erwin Kiess <onboarding@resend.dev>',
        to: data.email,
        subject: 'Your CapexCycleOS demo is ready',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #f59e0b;">Hi ${data.name || 'there'},</h2>
            <p>Thanks for your interest in CapexCycleOS. I've set up a personalized demo environment for you.</p>
            <p>Here's your demo link — takes 2 minutes to set up, everything's pre-loaded with a $1.2B Puerto Rico community bank profile:</p>
            <div style="margin: 24px 0; text-align: center;">
              <a href="https://capexcycle.vercel.app/demo?type=bank"
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
            <p style="color: #666;">— Erwin Kiess<br>Founder, CapexCycleOS | KLYTICS<br>San Juan, Puerto Rico</p>
          </div>
        `,
      });
      this.logger.log(`Demo confirmation sent to ${data.email}`);
    } catch (err) {
      this.logger.error(`Failed to send demo confirmation: ${err}`);
    }
  }
}
