import type { AuditCommandPort, AuditEvent } from '@lingcootech/frame-audit';

export type IdentityAuditEvent = AuditEvent;

export interface IdentitySecurityEvent {
  id: string;
  action: string;
  metadata: unknown;
  createdAt: Date;
}

export interface IdentityAuditPort extends AuditCommandPort {
  listSecurityEvents(accountId: string, limit: number): Promise<IdentitySecurityEvent[]>;
}

export interface IdentityAvatarPort {
  resolvePublicImage(assetId: string): Promise<{ publicUrl: string | null } | null>;
  replaceAccountAvatar(accountId: string, assetId: string | null): Promise<void>;
}

export type IdentityChallengePurpose =
  'password_reset' | 'email_verification' | 'account_invitation';

export interface IdentityChallengeDelivery {
  accountId: string;
  purpose: IdentityChallengePurpose;
  token: string;
  path: string;
  subject: string;
  title: string;
  body: string;
  required: boolean;
}

export interface IdentityChallengeDeliveryPort {
  assertReady(): Promise<void>;
  deliver(challenge: IdentityChallengeDelivery): Promise<boolean>;
}

export interface IdentityEventPort {
  publish(event: {
    topic: string;
    aggregateType: string;
    aggregateId: string;
    payload: Record<string, unknown>;
  }): Promise<void>;
}

export interface IdentityPorts {
  audit: IdentityAuditPort;
  avatars: IdentityAvatarPort;
  challengeDelivery: IdentityChallengeDeliveryPort;
  events: IdentityEventPort;
}

export function createNoopIdentityPorts(): IdentityPorts {
  return {
    audit: {
      async record() {},
      async listSecurityEvents() {
        return [];
      },
    },
    avatars: {
      async resolvePublicImage() {
        return null;
      },
      async replaceAccountAvatar() {},
    },
    challengeDelivery: {
      async assertReady() {
        throw Object.assign(new Error('Identity challenge delivery is not configured'), {
          name: 'ConfigurationError',
          statusCode: 503,
        });
      },
      async deliver(challenge) {
        if (challenge.required) await this.assertReady();
        return false;
      },
    },
    events: {
      async publish() {},
    },
  };
}
