const mockWrite = jest.fn((callback: () => Promise<void>) => callback());
const mockFind = jest.fn();
const mockFetch = jest.fn();

jest.mock('../database', () => ({
  database: {
    write: (callback: () => Promise<void>) => mockWrite(callback),
    collections: {
      get: jest.fn(() => ({
        find: (id: string) => mockFind(id),
        query: (...args: unknown[]) => ({
          fetch: () => mockFetch(...args),
        }),
      })),
    },
  },
}));

import { updateScanResult, getScanById, getUnsyncedScans, markScanSynced } from './scanQueries';
import type { Scan } from '../models/Scan';

describe('updateScanResult', () => {
  beforeEach(() => {
    mockWrite.mockClear();
  });

  it('writes the label, confidence, and distribution onto the scan', async () => {
    const fakeScan = {
      update: jest.fn((updater: (scan: Scan) => void) => {
        updater(fakeScan as unknown as Scan);
      }),
    } as unknown as Scan;

    await updateScanResult(fakeScan, {
      label: 'common_rust',
      confidence: 0.82,
      distribution: { common_rust: 0.82, healthy: 0.18 },
    });

    expect(mockWrite).toHaveBeenCalledTimes(1);
    expect(fakeScan.update).toHaveBeenCalledTimes(1);
    expect(fakeScan.label).toBe('common_rust');
    expect(fakeScan.confidence).toBe(0.82);
    expect(fakeScan.distribution).toEqual({ common_rust: 0.82, healthy: 0.18 });
  });
});

describe('getScanById', () => {
  beforeEach(() => {
    mockFind.mockClear();
  });

  it('finds the scan by id in the scans collection', async () => {
    const fakeScan = { id: 'scan-1' } as Scan;
    mockFind.mockResolvedValue(fakeScan);

    const result = await getScanById('scan-1');

    expect(mockFind).toHaveBeenCalledWith('scan-1');
    expect(result).toBe(fakeScan);
  });
});

describe('getUnsyncedScans', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it('queries scans filtered by synced = false', async () => {
    const fakeScans = [{ id: 'scan-1' }, { id: 'scan-2' }] as Scan[];
    mockFetch.mockResolvedValue(fakeScans);

    const result = await getUnsyncedScans();

    expect(result).toBe(fakeScans);
  });
});

describe('markScanSynced', () => {
  beforeEach(() => {
    mockWrite.mockClear();
  });

  it('sets synced to true on the scan', async () => {
    const fakeScan = {
      update: jest.fn((updater: (scan: Scan) => void) => {
        updater(fakeScan as unknown as Scan);
      }),
    } as unknown as Scan;

    await markScanSynced(fakeScan);

    expect(fakeScan.synced).toBe(true);
  });
});
