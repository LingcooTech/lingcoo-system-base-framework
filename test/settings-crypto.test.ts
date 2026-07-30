import assert from 'node:assert/strict';
import test from 'node:test';

import {
  decryptSetting,
  decryptSettingWithKeyring,
  encryptSetting,
  isEncryptedSetting,
  SettingsCryptoError,
} from '../src/lib/settings-crypto.js';

const currentKey = 'frame-current-settings-key-with-32-characters';
const previousKey = 'frame-previous-settings-key-with-32-characters';

test('encrypted settings round-trip structured provider credentials', () => {
  const value = {
    host: 'smtp.example.com',
    user: 'mailer',
    password: 'not-logged-or-stored-as-plaintext',
  };
  const encrypted = encryptSetting(value, currentKey);

  assert.equal(isEncryptedSetting(encrypted), true);
  assert.notEqual(encrypted.data, JSON.stringify(value));
  assert.deepEqual(decryptSetting(encrypted, currentKey), value);
});

test('encrypted settings reject the wrong key and unsupported plaintext', () => {
  const encrypted = encryptSetting({ token: 'secret' }, currentKey);
  assert.throws(() => decryptSetting(encrypted, previousKey), SettingsCryptoError);
  assert.throws(() => decryptSetting({ token: 'plaintext' }, currentKey), SettingsCryptoError);
});

test('keyring decryption supports safe settings-key rotation', () => {
  const encrypted = encryptSetting({ provider: 'qiniu' }, previousKey);
  assert.deepEqual(decryptSettingWithKeyring(encrypted, [currentKey, previousKey]), {
    provider: 'qiniu',
  });
});
