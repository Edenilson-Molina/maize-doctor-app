const mockWrite = jest.fn((callback: () => Promise<void>) => callback());

jest.mock('../database', () => ({
  database: {
    write: (callback: () => Promise<void>) => mockWrite(callback),
    collections: { get: jest.fn(() => ({})) },
  },
}));

import { updateScanResult } from './scanQueries';
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
