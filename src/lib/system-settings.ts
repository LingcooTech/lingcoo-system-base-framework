import { eq } from 'drizzle-orm';

import type { Database } from '../db/client.js';
import { systemSettings } from '../db/schema.js';
import { decryptSetting, encryptSetting } from './settings-crypto.js';

export async function getSystemSetting<T>(db: Database, key: string): Promise<T | null> {
  const rows = await db
    .select({ value: systemSettings.value })
    .from(systemSettings)
    .where(eq(systemSettings.key, key))
    .limit(1);
  return (rows[0]?.value as T | undefined) ?? null;
}

export async function setSystemSetting<T>(db: Database, key: string, value: T): Promise<void> {
  await db
    .insert(systemSettings)
    .values({ key, value })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: { value, updatedAt: new Date() },
    });
}

export async function deleteSystemSetting(db: Database, key: string): Promise<void> {
  await db.delete(systemSettings).where(eq(systemSettings.key, key));
}

export async function getEncryptedSystemSetting<T>(
  db: Database,
  key: string,
  secret: string,
): Promise<T | null> {
  const value = await getSystemSetting<unknown>(db, key);
  return value === null ? null : decryptSetting<T>(value, secret);
}

export async function setEncryptedSystemSetting<T>(
  db: Database,
  key: string,
  value: T,
  secret: string,
): Promise<void> {
  await setSystemSetting(db, key, encryptSetting(value, secret));
}
