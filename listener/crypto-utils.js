const crypto = require('crypto');

const ALGORITHM = 'aes-256-ctr';
const IV_LENGTH = 16;
const KEY_LENGTH = 32;
const SALT = 'encrypted-timeseries-v1';

function deriveKey(passphrase) {
  return crypto.scryptSync(passphrase, SALT, KEY_LENGTH);
}

function createSecretKey(obj) {
  const payload = { name: obj.name, origin: obj.origin, destination: obj.destination };
  const str = JSON.stringify(payload);
  return crypto.createHash('sha256').update(str).digest('hex');
}

function encrypt(plaintext, passphrase) {
  const key = deriveKey(passphrase);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const combined = Buffer.concat([iv, encrypted]);
  return combined.toString('hex');
}

function decrypt(hexCipher, passphrase) {
  const key = deriveKey(passphrase);
  const combined = Buffer.from(hexCipher, 'hex');
  const iv = combined.subarray(0, IV_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

module.exports = {
  createSecretKey,
  encrypt,
  decrypt,
};
