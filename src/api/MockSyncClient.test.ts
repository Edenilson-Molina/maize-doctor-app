import { MockSyncClient } from './MockSyncClient';
import type { Scan } from '@/data/models/Scan';
import type { Correction } from '@/data/models/Correction';
import type { DatasetContribution } from '@/data/models/DatasetContribution';

describe('MockSyncClient', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('resolves syncScan without making any real network call', async () => {
    const client = new MockSyncClient();
    const promise = client.syncScan({} as Scan);
    await jest.advanceTimersByTimeAsync(500);
    await expect(promise).resolves.toBeUndefined();
  });

  it('resolves syncCorrection without making any real network call', async () => {
    const client = new MockSyncClient();
    const promise = client.syncCorrection({} as Correction);
    await jest.advanceTimersByTimeAsync(500);
    await expect(promise).resolves.toBeUndefined();
  });

  it('resolves syncContribution without making any real network call', async () => {
    const client = new MockSyncClient();
    const promise = client.syncContribution({} as DatasetContribution);
    await jest.advanceTimersByTimeAsync(500);
    await expect(promise).resolves.toBeUndefined();
  });
});
