import type { Database } from '@lingcootech/frame-database';
import { PostgresIdentityAccountDirectory } from '@lingcootech/frame-identity/postgres';
import type { NotificationsPorts } from '@lingcootech/frame-notifications';

import { createLegacyAuditPort } from '../audit/ports.js';
import { SmtpService } from '@lingcootech/frame-mail-nodemailer';
import { createIntegrationProviderRegistry } from '../../core/modules/integrations/registry.js';
import { IntegrationService } from '../../core/modules/integrations/service.js';
import { createLegacyIntegrationsPorts } from '../integrations/ports.js';
import { createLegacyJobsPortsForDatabase } from '../jobs/ports.js';
import { decryptSetting } from '../../core/security/settings-crypto.js';
import type { AppEnv } from '../../host/env.js';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function createLegacyNotificationsPorts(
  database: Database,
  env: Pick<AppEnv, 'NODE_ENV' | 'SETTINGS_ENCRYPTION_KEY'>,
): NotificationsPorts {
  const integrationPorts = createLegacyIntegrationsPorts(database);
  const integrations = new IntegrationService(
    database,
    createIntegrationProviderRegistry(env.NODE_ENV),
    env.SETTINGS_ENCRYPTION_KEY,
    integrationPorts,
  );
  const smtp = new SmtpService(integrations);

  return {
    accounts: new PostgresIdentityAccountDirectory(database),
    audit: createLegacyAuditPort(database),
    jobs: createLegacyJobsPortsForDatabase(database).commands,
    mail: {
      async resolveTransport(requestedId) {
        const connection = await integrationPorts.connections.resolveEnabled('smtp', requestedId);
        return connection ? { id: connection.id, label: connection.name } : null;
      },
      async send(input) {
        const content = input.content
          ? decryptSetting<{ subject: string; text: string; html?: string }>(
              input.content as Parameters<typeof decryptSetting>[0],
              env.SETTINGS_ENCRYPTION_KEY ?? '',
            )
          : null;
        const result = await smtp.send(
          input.transportId,
          {
            to: input.destination,
            subject: content?.subject ?? input.title,
            text: content?.text ?? input.body,
            html:
              content?.html ??
              `<div style="font-family:Arial,sans-serif;line-height:1.7;white-space:pre-wrap;">${escapeHtml(input.body)}</div>`,
          },
          { operation: 'notification.email.deliver' },
        );
        return result.messageId ? { messageId: result.messageId } : {};
      },
    },
  };
}
