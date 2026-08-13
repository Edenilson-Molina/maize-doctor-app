const mockSyncScan = jest.fn();
const mockSyncCorrection = jest.fn();
const mockSyncContribution = jest.fn();
const mockGetSyncClient = jest.fn(() => ({
  syncScan: mockSyncScan,
  syncCorrection: mockSyncCorrection,
  syncContribution: mockSyncContribution,
}));

const mockGetUnsyncedScans = jest.fn();
const mockMarkScanSynced = jest.fn();
const mockGetUnsyncedCorrections = jest.fn();
const mockMarkCorrectionSynced = jest.fn();
const mockGetUnsyncedContributions = jest.fn();
const mockMarkContributionSynced = jest.fn();
const mockAddEventListener = jest.fn();

jest.mock('./index', () => ({
  getSyncClient: () => mockGetSyncClient(),
}));

jest.mock('@/data/queries/scanQueries', () => ({
  getUnsyncedScans: () => mockGetUnsyncedScans(),
  markScanSynced: (scan: unknown) => mockMarkScanSynced(scan),
}));

jest.mock('@/data/queries/correctionQueries', () => ({
  getUnsyncedCorrections: () => mockGetUnsyncedCorrections(),
  markCorrectionSynced: (correction: unknown) => mockMarkCorrectionSynced(correction),
}));

jest.mock('@/data/queries/datasetContributionQueries', () => ({
  getUnsyncedContributions: () => mockGetUnsyncedContributions(),
  markContributionSynced: (contribution: unknown) => mockMarkContributionSynced(contribution),
}));

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: (listener: unknown) => mockAddEventListener(listener),
  },
}));

import { flushPendingSync, startSyncListener } from './syncQueue';

describe('flushPendingSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUnsyncedScans.mockResolvedValue([]);
    mockGetUnsyncedCorrections.mockResolvedValue([]);
    mockGetUnsyncedContributions.mockResolvedValue([]);
    mockSyncScan.mockResolvedValue(undefined);
    mockSyncCorrection.mockResolvedValue(undefined);
    mockSyncContribution.mockResolvedValue(undefined);
  });

  it('syncs and marks every unsynced record across the three tables', async () => {
    const scan = { id: 'scan-1' };
    const correction = { id: 'correction-1' };
    const contribution = { id: 'contribution-1' };
    mockGetUnsyncedScans.mockResolvedValue([scan]);
    mockGetUnsyncedCorrections.mockResolvedValue([correction]);
    mockGetUnsyncedContributions.mockResolvedValue([contribution]);

    await flushPendingSync();

    expect(mockSyncScan).toHaveBeenCalledWith(scan);
    expect(mockMarkScanSynced).toHaveBeenCalledWith(scan);
    expect(mockSyncCorrection).toHaveBeenCalledWith(correction);
    expect(mockMarkCorrectionSynced).toHaveBeenCalledWith(correction);
    expect(mockSyncContribution).toHaveBeenCalledWith(contribution);
    expect(mockMarkContributionSynced).toHaveBeenCalledWith(contribution);
  });

  it('does not mark a record as synced when the upload fails', async () => {
    const scan = { id: 'scan-1' };
    mockGetUnsyncedScans.mockResolvedValue([scan]);
    mockSyncScan.mockRejectedValue(new Error('Network request failed'));

    await flushPendingSync();

    expect(mockMarkScanSynced).not.toHaveBeenCalled();
  });

  it('keeps processing remaining records after one fails', async () => {
    const scanA = { id: 'scan-a' };
    const scanB = { id: 'scan-b' };
    mockGetUnsyncedScans.mockResolvedValue([scanA, scanB]);
    mockSyncScan.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(undefined);

    await flushPendingSync();

    expect(mockMarkScanSynced).not.toHaveBeenCalledWith(scanA);
    expect(mockMarkScanSynced).toHaveBeenCalledWith(scanB);
  });
});

describe('startSyncListener', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUnsyncedScans.mockResolvedValue([]);
    mockGetUnsyncedCorrections.mockResolvedValue([]);
    mockGetUnsyncedContributions.mockResolvedValue([]);
  });

  it('does not flush on the first connectivity event even if connected', () => {
    let listener: (state: { isConnected: boolean }) => void = () => {};
    mockAddEventListener.mockImplementation((cb) => {
      listener = cb;
      return jest.fn();
    });

    startSyncListener();
    listener({ isConnected: true });

    expect(mockGetUnsyncedScans).not.toHaveBeenCalled();
  });

  it('flushes only when connectivity transitions from disconnected to connected', () => {
    let listener: (state: { isConnected: boolean }) => void = () => {};
    mockAddEventListener.mockImplementation((cb) => {
      listener = cb;
      return jest.fn();
    });

    startSyncListener();
    listener({ isConnected: false });
    expect(mockGetUnsyncedScans).not.toHaveBeenCalled();

    listener({ isConnected: true });
    expect(mockGetUnsyncedScans).toHaveBeenCalledTimes(1);

    listener({ isConnected: true });
    expect(mockGetUnsyncedScans).toHaveBeenCalledTimes(1);
  });

  it('returns the unsubscribe function from NetInfo', () => {
    const unsubscribe = jest.fn();
    mockAddEventListener.mockReturnValue(unsubscribe);

    const result = startSyncListener();

    expect(result).toBe(unsubscribe);
  });
});
