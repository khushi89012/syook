const { describe, it } = require('node:test');
const assert = require('node:assert');
const { processStream, validateSecretKey } = require('../stream-handler');
const { createSecretKey, encrypt } = require('../crypto-utils');

const PASSPHRASE = process.env.ENCRYPTION_PASSPHRASE || 'encrypted-timeseries-secret-key';

function makeEncryptedMessage(obj, passphrase) {
  const secret_key = createSecretKey(obj);
  const sumCheck = { ...obj, secret_key };
  return encrypt(JSON.stringify(sumCheck), passphrase);
}

describe('stream-handler', () => {
  it('validateSecretKey returns true for valid object', () => {
    const obj = { name: 'A', origin: 'B', destination: 'C', secret_key: createSecretKey({ name: 'A', origin: 'B', destination: 'C' }) };
    assert.strictEqual(validateSecretKey(obj), true);
  });

  it('validateSecretKey returns false when secret_key is tampered', () => {
    const obj = { name: 'A', origin: 'B', destination: 'C', secret_key: 'wrong' };
    assert.strictEqual(validateSecretKey(obj), false);
  });

  it('processStream decrypts and validates; returns only valid readings', () => {
    const valid = { name: 'Jack', origin: 'Bengaluru', destination: 'Mumbai' };
    const enc1 = makeEncryptedMessage(valid, PASSPHRASE);
    const invalidPayload = { name: 'X', origin: 'Y', destination: 'Z', secret_key: 'tampered' };
    const enc2 = encrypt(JSON.stringify(invalidPayload), PASSPHRASE);
    const stream = [enc1, enc2].join('|');
    const receivedAt = new Date('2025-02-24T14:30:00.000Z');
    const result = processStream(stream, receivedAt);
    assert.strictEqual(result.total, 2);
    assert.strictEqual(result.validCount, 1);
    assert.strictEqual(result.valid[0].name, 'Jack');
    assert.strictEqual(result.valid[0].origin, 'Bengaluru');
    assert.strictEqual(result.valid[0].destination, 'Mumbai');
    assert.deepStrictEqual(result.valid[0].timestamp, receivedAt);
  });

  it('processStream discards invalid hex without throwing', () => {
    const stream = 'not-valid-hex|' + makeEncryptedMessage({ name: 'A', origin: 'B', destination: 'C' }, PASSPHRASE);
    const result = processStream(stream, new Date());
    assert.strictEqual(result.total, 2);
    assert.strictEqual(result.validCount, 1);
  });
});
