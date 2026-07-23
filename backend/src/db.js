import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_DIR = path.join(__dirname, '../data');
const INTERVIEWS_FILE = path.join(DB_DIR, 'interviews.json');
const BATCHES_FILE = path.join(DB_DIR, 'batches.json');

// Ensure db directory and files exist
function initializeDb() {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    if (!fs.existsSync(INTERVIEWS_FILE)) {
      fs.writeFileSync(INTERVIEWS_FILE, JSON.stringify({}));
    }
    if (!fs.existsSync(BATCHES_FILE)) {
      fs.writeFileSync(BATCHES_FILE, JSON.stringify({}));
    }
  } catch (err) {
    console.error('Failed to initialize local JSON DB:', err);
  }
}

// Helper to read JSON file safely
function readFileSafely(filePath) {
  try {
    initializeDb();
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data || '{}');
    }
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
  }
  return {};
}

// Helper to write JSON file safely
function writeFileSafely(filePath, data) {
  try {
    initializeDb();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (err) {
    console.error(`Error writing to ${filePath}:`, err);
    return false;
  }
}

// --- INTERVIEWS / CANDIDATES API ---

export function getInterview(id) {
  const db = readFileSafely(INTERVIEWS_FILE);
  return db[id] || null;
}

export function saveInterview(id, state) {
  const db = readFileSafely(INTERVIEWS_FILE);
  db[id] = {
    ...db[id],
    ...state,
    updatedAt: new Date().toISOString(),
  };
  writeFileSafely(INTERVIEWS_FILE, db);
  return db[id];
}

export function getCandidatesByBatch(batchId) {
  const db = readFileSafely(INTERVIEWS_FILE);
  return Object.values(db).filter(cand => cand.batchId === batchId);
}

// --- BATCHES API ---

export function getBatch(batchId) {
  const db = readFileSafely(BATCHES_FILE);
  return db[batchId] || null;
}

export function getBatches() {
  const db = readFileSafely(BATCHES_FILE);
  return Object.values(db).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function saveBatch(batchId, batchData) {
  const db = readFileSafely(BATCHES_FILE);
  db[batchId] = {
    ...db[batchId],
    ...batchData,
    createdAt: db[batchId]?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  writeFileSafely(BATCHES_FILE, db);
  return db[batchId];
}

export function deleteBatch(batchId) {
  // 1. Delete from batches
  const batches = readFileSafely(BATCHES_FILE);
  if (batches[batchId]) {
    delete batches[batchId];
    writeFileSafely(BATCHES_FILE, batches);
  }

  // 2. Delete all interviews linked to this batch
  const interviews = readFileSafely(INTERVIEWS_FILE);
  let changed = false;
  for (const key of Object.keys(interviews)) {
    if (interviews[key].batchId === batchId) {
      delete interviews[key];
      changed = true;
    }
  }
  if (changed) {
    writeFileSafely(INTERVIEWS_FILE, interviews);
  }
  return true;
}
