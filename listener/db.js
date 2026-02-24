const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGO_DB_NAME || 'timeseries_db';
const COLLECTION_NAME = 'readings';

let client;
let db;

function getMinuteBucket(date) {
  const d = new Date(date);
  d.setSeconds(0, 0);
  return d;
}

async function connect() {
  if (db) return db;
  client = new MongoClient(MONGO_URI);
  await client.connect();
  db = client.db(DB_NAME);
  const coll = db.collection(COLLECTION_NAME);
  try {
    await coll.createIndex({ minute: 1 }, { unique: true });
  } catch (err) {
    if (err.code !== 85 && err.code !== 86) throw err; // index exists
  }
  try {
    await coll.createIndex({ 'readings.timestamp': 1 });
  } catch (err) {
    if (err.code !== 85 && err.code !== 86) throw err;
  }
  return db;
}

function getCollection() {
  if (!db) throw new Error('DB not connected');
  return db.collection(COLLECTION_NAME);
}

/**
 * Insert validated readings. Each reading is added to the document for its minute bucket.
 * @param {{ name: string, origin: string, destination: string, timestamp: Date }[]} readings
 */
async function insertReadings(readings) {
  if (readings.length === 0) return { insertedCount: 0 };
  const coll = getCollection();
  const byMinute = new Map();
  for (const r of readings) {
    const minute = getMinuteBucket(r.timestamp);
    const key = minute.getTime();
    if (!byMinute.has(key)) {
      byMinute.set(key, { minute, records: [] });
    }
    byMinute.get(key).records.push({
      name: r.name,
      origin: r.origin,
      destination: r.destination,
      timestamp: r.timestamp,
    });
  }
  let inserted = 0;
  for (const { minute, records } of byMinute.values()) {
    const result = await coll.updateOne(
      { minute },
      { $push: { readings: { $each: records } } },
      { upsert: true }
    );
    if (result.upsertedCount) inserted += 1;
    inserted += result.modifiedCount;
  }
  return { insertedCount: readings.length, bucketsUpdated: byMinute.size };
}

async function close() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

module.exports = {
  connect,
  getCollection,
  insertReadings,
  close,
  getMinuteBucket,
  COLLECTION_NAME,
};
