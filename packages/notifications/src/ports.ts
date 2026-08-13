import {
  createNoopIdentityAccountDirectory,
  type IdentityAccountDirectoryPort,
} from '@lingcootech/frame-identity';
import type { AuditCommandPort } from '@lingcootech/frame-audit';
import type { JobsCommandPort } from '@lingcootech/frame-jobs';

export type NotificationsAuditPort = AuditCommandPort;

export interface NotificationsMailTransport {
  id: string;
  label?: string;
}

export interface NotificationsMailPort {
  resolveTransport(requestedId?: string): Promise<NotificationsMailTransport | null>;
  send(input: {
    transportId: string;
    destination: string;
    title: string;
    body: string;
    content?: unknown;
  }): Promise<{ messageId?: string }>;
}

export interface NotificationsPorts {
  accounts: IdentityAccountDirectoryPort;
  audit: NotificationsAuditPort;
  jobs: JobsCommandPort;
  mail: NotificationsMailPort;
}

export function createNoopNotificationsPorts(): NotificationsPorts {
  return {
    accounts: createNoopIdentityAccountDirectory(),
    audit: { async record() {} },
    jobs: {
      async enqueue() {
        throw Object.assign(new Error('Notification jobs are not configured'), {
          name: 'ConfigurationError',
          statusCode: 503,
        });
      },
      async publish() {
        throw Object.assign(new Error('Notification jobs are not configured'), {
          name: 'ConfigurationError',
          statusCode: 503,
        });
      },
    },
    mail: {
      async resolveTransport() {
        return null;
      },
      async send() {
        throw Object.assign(new Error('Notification mail delivery is not configured'), {
          name: 'ConfigurationError',
          statusCode: 503,
        });
      },
    },
  };
}
