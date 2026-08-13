import type { SyncClient } from './SyncClient';
import type { Scan } from '@/data/models/Scan';
import type { Correction } from '@/data/models/Correction';
import type { DatasetContribution } from '@/data/models/DatasetContribution';

const MIN_LATENCY_MS = 200;
const MAX_LATENCY_MS = 500;

function simulateLatency(): Promise<void> {
  const latency = MIN_LATENCY_MS + Math.random() * (MAX_LATENCY_MS - MIN_LATENCY_MS);
  return new Promise((resolve) => setTimeout(resolve, latency));
}

export class MockSyncClient implements SyncClient {
  async syncScan(_scan: Scan): Promise<void> {
    await simulateLatency();
  }

  async syncCorrection(_correction: Correction): Promise<void> {
    await simulateLatency();
  }

  async syncContribution(_contribution: DatasetContribution): Promise<void> {
    await simulateLatency();
  }
}
