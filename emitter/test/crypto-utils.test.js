const { describe, it } = require('node:test');
const assert = require('node:assert');
const { createSecretKey, encrypt, decrypt } = require('../crypto-utils');

describe('crypto-utils', () => {
  it('createSecretKey is deterministic for same object', () => {
    const obj = { name: 'Jack', origin: 'Bengaluru', destination: 'Mumbai' };
    const a = createSecretKey(obj);
    const b = createSecretKey(obj);
    assert.strictEqual(a, b);
    assert.ok(/^[a-f0-9]{64}$/.test(a));
  });

  it('encrypt/decrypt round-trip', () => {
    const plain = JSON.stringify({ name: 'A', origin: 'B', destination: 'C', secret_key: 'abc' });
    const enc = encrypt(plain, 'pass');
    assert.ok(typeof enc === 'string' && enc.length > 0);
    const dec = decrypt(enc, 'pass');
    assert.strictEqual(dec, plain);
  });

  it('different iv produces different ciphertext', () => {
    const plain = 'hello';
    const enc1 = encrypt(plain, 'pass');
    const enc2 = encrypt(plain, 'pass');
    assert.notStrictEqual(enc1, enc2);
    assert.strictEqual(decrypt(enc1, 'pass'), plain);
    assert.strictEqual(decrypt(enc2, 'pass'), plain);
  });
});
