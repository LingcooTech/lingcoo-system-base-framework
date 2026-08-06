import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;
const PREFIX = 'scrypt';

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `${PREFIX}$${salt}$${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  const [prefix, salt, storedHex] = encodedHash.split('$');
  if (prefix !== PREFIX || !salt || !storedHex || !/^[a-f0-9]+$/i.test(storedHex)) {
    return false;
  }

  try {
    const stored = Buffer.from(storedHex, 'hex');
    const derived = (await scryptAsync(password, salt, stored.length)) as Buffer;
    return stored.length === derived.length && timingSafeEqual(stored, derived);
  } catch {
    return false;
  }
}
