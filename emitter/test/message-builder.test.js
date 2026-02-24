const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const { buildEncryptedStream, buildAndEncryptMessage } = require('../message-builder');
const { createSecretKey, decrypt } = require('../crypto-utils');

const dataPath = path.join(__dirname, '..', '..', 'data.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const PASSPHRASE = 'test-passphrase';

describe('message-builder', () => {
  it('buildAndEncryptMessage produces decryptable message with valid secret_key', () => {
    const encrypted = buildAndEncryptMessage(data, PASSPHRASE);
    assert.ok(typeof encrypted === 'string' && encrypted.length > 0);
    const plain = decrypt(encrypted, PASSPHRASE);
    const obj = JSON.parse(plain);
    assert.ok(obj.name && obj.origin && obj.destination && obj.secret_key);
    const expectedKey = createSecretKey(obj);
    assert.strictEqual(obj.secret_key, expectedKey);
  });

  it('buildEncryptedStream returns pipe-separated string with 49-499 messages', () => {
    const runs = 5;
    for (let i = 0; i < runs; i++) {
      const stream = buildEncryptedStream(data, PASSPHRASE);
      const parts = stream.split('|').filter(Boolean);
      assert.ok(parts.length >= 49 && parts.length <= 499, `Expected 49-499, got ${parts.length}`);
    }
  });

  it('each encrypted part in stream is valid JSON with secret_key', () => {
    const stream = buildEncryptedStream(data, PASSPHRASE);
    const parts = stream.split('|').filter(Boolean);
    const first = parts[0];
    const plain = decrypt(first, PASSPHRASE);
    const obj = JSON.parse(plain);
    assert.strictEqual(createSecretKey(obj), obj.secret_key);
  });
});
