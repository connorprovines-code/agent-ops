import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '..', '..');
const DATA_DIR = resolve(ROOT_DIR, 'data');

export const CONFIG = {
  rootDir: ROOT_DIR,
  dataDir: DATA_DIR,
  dbPath: process.env.DB_PATH || resolve(DATA_DIR, 'agent-ops.db'),
  port: parseInt(process.env.PORT || '4200', 10),
  heartbeatIntervalMs: 30_000,
  deadThresholdMs: 120_000,
  reaperIntervalMs: 30_000,
};
