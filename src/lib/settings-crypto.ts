import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export interface EncryptedSetting {
  version: 1;
  algorithm: 'aes-256-gcm';
  iv: string;
  tag: string;
  data: string;
}

export class SettingsCryptoError extends Error {
  constructor(message = 'Unable to process encrypted system setting') {
    super(message);
    this.name = 'SettingsCryptoError';
  }
}

function deriveKey(secret: string): Buffer {
  if (secret.length < 32) {
    throw new SettingsCryptoError('Settings encryption key must be at least 32 characters');
  }
  return createHash('sha256').update(secret).digest();
}

export function isEncryptedSetting(value: unknown): value is EncryptedSetting {
  if (!value || typeof value !== 'object') return false;
  const envelope = value as Partial<EncryptedSetting>;
  return (
    envelope.version === 1 &&
    envelope.algorithm === 'aes-256-gcm' &&
    typeof envelope.iv === 'string' &&
    typeof envelope.tag === 'string' &&
    typeof envelope.data === 'string'
  );
}

export function encryptSetting<T>(value: T, secret: string): EncryptedSetting {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', deriveKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);

  return {
    version: 1,
    algorithm: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: encrypted.toString('base64'),
  };
}

export function decryptSetting<T>(value: unknown, secret: string): T {
  if (!isEncryptedSetting(value)) {
    throw new SettingsCryptoError('System setting is not a supported encrypted envelope');
  }

  try {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      deriveKey(secret),
      Buffer.from(value.iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(value.tag, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(value.data, 'base64')),
      decipher.final(),
    ]).toString('utf8');
    return JSON.parse(decrypted) as T;
  } catch (error) {
    if (error instanceof SettingsCryptoError) throw error;
    throw new SettingsCryptoError();
  }
}

export function decryptSettingWithKeyring<T>(
  value: unknown,
  secrets: Array<string | undefined>,
): T {
  const candidates = [
    ...new Set(
      secrets.map((secret) => secret?.trim()).filter((secret): secret is string => Boolean(secret)),
    ),
  ];

  for (const secret of candidates) {
    try {
      return decryptSetting<T>(value, secret);
    } catch {
      // Previous keys remain read-only until their settings are rewritten.
    }
  }
  throw new SettingsCryptoError();
}
