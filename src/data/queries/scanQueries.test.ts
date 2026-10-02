const mockWrite = jest.fn((callback: () => Promise<void>) => callback());
const mockFind = jest.fn();
const mockCreate = jest.fn((creator: (scan: any) => void) => {
  const s = {} as any;
  creator(s);
  return s;
});

jest.mock('../database', () => ({
  database: {
    write: (callback: () => Promise<void>) => mockWrite(callback),
    collections: {
      get: jest.fn(() => ({
        find: (id: string) => mockFind(id),
        create: (creator: (scan: any) => void) => mockCreate(creator),
      })),
    },
  },
}));

import { updateScanResult, getScanById, createScan } from './scanQueries';
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

describe('updateScanResult with a stored image', () => {
  beforeEach(() => {
    mockWrite.mockClear();
  });

  it('writes the result and the stored image in one transaction', async () => {
    const fakeScan = {
      update: jest.fn((updater: (scan: Scan) => void) => {
        updater(fakeScan as unknown as Scan);
      }),
    } as unknown as Scan;

    await updateScanResult(
      fakeScan,
      { label: 'common_rust', confidence: 0.9, distribution: { common_rust: 0.9 } },
      'file:///document/scans/scan_final.jpg',
    );

    expect(mockWrite).toHaveBeenCalledTimes(1);
    expect(fakeScan.imageUri).toBe('file:///document/scans/scan_final.jpg');
    expect(fakeScan.label).toBe('common_rust');
  });

  it('leaves the existing image untouched when no stored URI is given', async () => {
    const fakeScan = {
      imageUri: 'file:///cache/photo.jpg',
      update: jest.fn((updater: (scan: Scan) => void) => {
        updater(fakeScan as unknown as Scan);
      }),
    } as unknown as Scan;

    await updateScanResult(fakeScan, {
      label: 'healthy',
      confidence: 0.9,
      distribution: { healthy: 0.9 },
    });

    expect(fakeScan.imageUri).toBe('file:///cache/photo.jpg');
  });
});

describe('createScan', () => {
  beforeEach(() => {
    mockWrite.mockClear();
    mockCreate.mockClear();
  });

  it('creates a scan record with coordinates, image URI and initial flags', async () => {
    const result = await createScan({
      imageUri: 'file:///cache/leaf.jpg',
      label: null,
      lat: 13.6923,
      lon: -89.1923,
    });

    expect(mockWrite).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(result.imageUri).toBe('file:///cache/leaf.jpg');
    expect(result.label).toBeNull();
    expect(result.lat).toBe(13.6923);
    expect(result.lon).toBe(-89.1923);
    expect(result.synced).toBe(false);
  });
});
