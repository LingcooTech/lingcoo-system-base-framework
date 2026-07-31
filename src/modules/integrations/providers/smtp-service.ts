import { httpError } from '../../../lib/http-error.js';
import type { IntegrationService } from '../service.js';
import { SmtpProvider, type SmtpMessage } from './smtp.js';

export interface SmtpTestEmailInput {
  to: string;
  subject: string;
  text: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export class SmtpService {
  constructor(private readonly integrations: IntegrationService) {}

  async send(
    connectionId: string,
    message: SmtpMessage,
    options: { actorId?: string; operation?: string } = {},
  ) {
    return this.integrations.executeConnection({
      connectionId,
      providerCode: 'smtp',
      operation: options.operation ?? 'smtp.send',
      actorId: options.actorId,
      execute: async ({ provider, config, credentials, signal }) => {
        if (!(provider instanceof SmtpProvider)) {
          throw httpError(500, 'SMTP Provider 注册无效', 'ConfigurationError');
        }
        const delivery = await provider.sendMail(config, credentials, message, signal);
        return {
          value: {
            sent: true,
            to: message.to,
            from: String(config.from),
            subject: message.subject,
            ...delivery,
          },
          message: `SMTP 邮件已提交给 ${message.to}`,
          metadata: {
            to: message.to,
            messageId: delivery.messageId,
            accepted: delivery.accepted,
            rejected: delivery.rejected,
          },
        };
      },
    });
  }

  async sendTestEmail(connectionId: string, input: SmtpTestEmailInput, actorId: string) {
    return this.send(
      connectionId,
      {
        ...input,
        html: `<div style="font-family:Arial,sans-serif;line-height:1.7;white-space:pre-wrap;">${escapeHtml(input.text)}</div>`,
      },
      { actorId, operation: 'smtp.test_email' },
    );
  }
}
