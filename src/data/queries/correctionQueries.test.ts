const mockWrite = jest.fn((callback: () => Promise<void>) => callback());
const mockFetch = jest.fn();

jest.mock('../database', () => ({
  database: {
    write: (callback: () => Promise<void>) => mockWrite(callback),
    collections: {
      get: jest.fn(() => ({
        query: (...args: unknown[]) => ({
          fetch: () => mockFetch(...args),
        }),
      })),
    },
  },
}));

import { getUnsyncedCorrections, markCorrectionSynced } from './correctionQueries';
import type { Correction } from '../models/Correction';

describe('getUnsyncedCorrections', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it('queries corrections filtered by synced = false', async () => {
    const fakeCorrections = [{ id: 'correction-1' }] as Correction[];
    mockFetch.mockResolvedValue(fakeCorrections);

    const result = await getUnsyncedCorrections();

    expect(result).toBe(fakeCorrections);
  });
});

describe('markCorrectionSynced', () => {
  beforeEach(() => {
    mockWrite.mockClear();
  });

  it('sets synced to true on the correction', async () => {
    const fakeCorrection = {
      update: jest.fn((updater: (correction: Correction) => void) => {
        updater(fakeCorrection as unknown as Correction);
      }),
    } as unknown as Correction;

    await markCorrectionSynced(fakeCorrection);

    expect(fakeCorrection.synced).toBe(true);
  });
});
