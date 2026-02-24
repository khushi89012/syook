const { createSecretKey, encrypt } = require('./crypto-utils');

/**
 * Picks a random element from an array
 * @param {any[]} arr
 * @returns {any}
 */
function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Builds a single message object with secret_key and returns encrypted string
 * @param {{ names: string[], origins: string[], destinations: string[] }} data
 * @param {string} passphrase
 * @returns {string} encrypted hex string
 */
function buildAndEncryptMessage(data, passphrase) {
  const name = pickRandom(data.names);
  const origin = pickRandom(data.origins);
  const destination = pickRandom(data.destinations);
  const originalMessage = { name, origin, destination };
  const secret_key = createSecretKey(originalMessage);
  const sumCheckMessage = { ...originalMessage, secret_key };
  const plaintext = JSON.stringify(sumCheckMessage);
  return encrypt(plaintext, passphrase);
}

/**
 * Generates a stream of 49-499 encrypted messages, pipe-separated
 * @param {object} data - data.json content
 * @param {string} passphrase
 * @returns {string}
 */
function buildEncryptedStream(data, passphrase) {
  const count = Math.floor(Math.random() * (499 - 49 + 1)) + 49;
  const messages = [];
  for (let i = 0; i < count; i++) {
    messages.push(buildAndEncryptMessage(data, passphrase));
  }
  return messages.join('|');
}

module.exports = {
  buildEncryptedStream,
  buildAndEncryptMessage,
  pickRandom,
};
