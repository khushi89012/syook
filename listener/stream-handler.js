const { decrypt, createSecretKey } = require('./crypto-utils');
const { insertReadings } = require('./db');
const { getMinuteBucket } = require('./db');

const PASSPHRASE = process.env.ENCRYPTION_PASSPHRASE || 'encrypted-timeseries-secret-key';

/**
 * Validates that stored secret_key matches SHA-256 of name, origin, destination
 * @param {{ name: string, origin: string, destination: string, secret_key: string }} obj
 * @returns {boolean}
 */
function validateSecretKey(obj) {
  const expected = createSecretKey(obj);
  return expected === obj.secret_key;
}

/**
 * Process encrypted stream string (pipe-separated), decrypt, validate, return valid readings with timestamp
 * @param {string} stream
 * @param {Date} receivedAt
 * @returns {{ valid: { name, origin, destination, timestamp }[], total: number, validCount: number }}
 */
function processStream(stream, receivedAt = new Date()) {
  const parts = stream.split('|').map((s) => s.trim()).filter(Boolean);
  const valid = [];
  let total = parts.length;
  for (const hex of parts) {
    try {
      const plain = decrypt(hex, PASSPHRASE);
      const obj = JSON.parse(plain);
      if (typeof obj.name !== 'string' || typeof obj.origin !== 'string' || typeof obj.destination !== 'string' || typeof obj.secret_key !== 'string') {
        continue;
      }
      if (!validateSecretKey(obj)) {
        continue;
      }
      valid.push({
        name: obj.name,
        origin: obj.origin,
        destination: obj.destination,
        timestamp: new Date(receivedAt),
      });
    } catch (err) {
      // discard and move on
    }
  }
  return { valid, total, validCount: valid.length };
}

/**
 * Process stream, persist to DB, return stats and saved readings for broadcasting
 * @param {string} stream
 * @param {object} io - Socket.IO server
 * @returns {Promise<{ total: number, validCount: number, saved: number }>}
 */
async function processAndPersist(stream, io) {
  const receivedAt = new Date();
  const { valid, total, validCount } = processStream(stream, receivedAt);
  let saved = 0;
  if (valid.length > 0) {
    try {
      const result = await insertReadings(valid);
      saved = result.insertedCount ?? valid.length;
    } catch (err) {
      console.warn('[Listener] Could not save to MongoDB (not connected?):', err.message);
    }
    if (io) {
      io.emit('data', {
        readings: valid,
        minute: getMinuteBucket(receivedAt),
      });
    }
  }
  return { total, validCount, saved };
}

module.exports = {
  processStream,
  processAndPersist,
  validateSecretKey,
};
