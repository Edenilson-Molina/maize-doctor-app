const mockSyncCorrection = jest.fn();
const mockSyncContribution = jest.fn();
const mockGetSyncClient = jest.fn(() => ({
  syncCorrection: mockSyncCorrection,
  syncContribution: mockSyncContribution,
}));

const mockGetUnsyncedCorrections = jest.fn();
const mockMarkCorrectionSynced = jest.fn();
const mockGetUnsyncedContributions = jest.fn();
const mockMarkContributionSynced = jest.fn();
const mockAddEventListener = jest.fn();
const mockFetch = jest.fn();
const mockGetAccessToken = jest.fn();

jest.mock('./index', () => ({
  getSyncClient: () => mockGetSyncClient(),
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
    fetch: () => mockFetch(),
  },
}));

jest.mock('./RemoteSessionService', () => ({
  remoteSession: {
    getAccessToken: () => mockGetAccessToken(),
  },
}));

import { flushPendingSync, startSyncListener, trySyncNow } from './syncQueue';

describe('flushPendingSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUnsyncedCorrections.mockResolvedValue([]);
    mockGetUnsyncedContributions.mockResolvedValue([]);
    mockSyncCorrection.mockResolvedValue(undefined);
    mockSyncContribution.mockResolvedValue(undefined);
  });

  it('syncs and marks every unsynced record across the tracked tables', async () => {
    const correction = { id: 'correction-1' };
    const contribution = { id: 'contribution-1' };
    mockGetUnsyncedCorrections.mockResolvedValue([correction]);
    mockGetUnsyncedContributions.mockResolvedValue([contribution]);

    await flushPendingSync();

    expect(mockSyncCorrection).toHaveBeenCalledWith(correction);
    expect(mockMarkCorrectionSynced).toHaveBeenCalledWith(correction);
    expect(mockSyncContribution).toHaveBeenCalledWith(contribution);
    expect(mockMarkContributionSynced).toHaveBeenCalledWith(contribution);
  });

  it('does not mark a record as synced when the upload fails', async () => {
    const correction = { id: 'correction-1' };
    mockGetUnsyncedCorrections.mockResolvedValue([correction]);
    mockSyncCorrection.mockRejectedValue(new Error('Network request failed'));

    await flushPendingSync();

    expect(mockMarkCorrectionSynced).not.toHaveBeenCalled();
  });

  it('keeps processing remaining records after one fails', async () => {
    const correctionA = { id: 'correction-a' };
    const correctionB = { id: 'correction-b' };
    mockGetUnsyncedCorrections.mockResolvedValue([correctionA, correctionB]);
    mockSyncCorrection.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(undefined);

    await flushPendingSync();

    expect(mockMarkCorrectionSynced).not.toHaveBeenCalledWith(correctionA);
    expect(mockMarkCorrectionSynced).toHaveBeenCalledWith(correctionB);
  });
});

describe('startSyncListener', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

    expect(mockGetUnsyncedCorrections).not.toHaveBeenCalled();
  });

  it('flushes only when connectivity transitions from disconnected to connected', () => {
    let listener: (state: { isConnected: boolean }) => void = () => {};
    mockAddEventListener.mockImplementation((cb) => {
      listener = cb;
      return jest.fn();
    });

    startSyncListener();
    listener({ isConnected: false });
    expect(mockGetUnsyncedCorrections).not.toHaveBeenCalled();

    listener({ isConnected: true });
    expect(mockGetUnsyncedCorrections).toHaveBeenCalledTimes(1);

    listener({ isConnected: true });
    expect(mockGetUnsyncedCorrections).toHaveBeenCalledTimes(1);
  });

  it('returns the unsubscribe function from NetInfo', () => {
    const unsubscribe = jest.fn();
    mockAddEventListener.mockReturnValue(unsubscribe);

    const result = startSyncListener();

    expect(result).toBe(unsubscribe);
  });
});

describe('trySyncNow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUnsyncedCorrections.mockResolvedValue([]);
    mockGetUnsyncedContributions.mockResolvedValue([]);
    mockSyncCorrection.mockResolvedValue(undefined);
    mockSyncContribution.mockResolvedValue(undefined);
    mockFetch.mockResolvedValue({ isConnected: true });
    mockGetAccessToken.mockResolvedValue('token-123');
    process.env.EXPO_PUBLIC_API_URL = 'https://api.doctormaiz.test';
  });

  it('reports offline without attempting any upload', async () => {
    mockFetch.mockResolvedValue({ isConnected: false });
    mockGetUnsyncedContributions.mockResolvedValue([{ id: 'contribution-1' }]);

    const result = await trySyncNow();

    expect(result.status).toBe('offline');
    expect(mockSyncContribution).not.toHaveBeenCalled();
  });

  it('reports a missing session without attempting any upload', async () => {
    mockGetAccessToken.mockResolvedValue(null);
    mockGetUnsyncedContributions.mockResolvedValue([{ id: 'contribution-1' }]);

    const result = await trySyncNow();

    expect(result.status).toBe('unauthenticated');
    expect(mockSyncContribution).not.toHaveBeenCalled();
  });

  it('reports no backend configured when EXPO_PUBLIC_API_URL is unset', async () => {
    process.env.EXPO_PUBLIC_API_URL = '';
    mockGetUnsyncedContributions.mockResolvedValue([{ id: 'contribution-1' }]);

    const result = await trySyncNow();

    expect(result.status).toBe('no-backend');
    expect(mockSyncContribution).not.toHaveBeenCalled();
  });

  it('reports how many records synced on success', async () => {
    mockGetUnsyncedContributions.mockResolvedValue([{ id: 'c-1' }, { id: 'c-2' }]);
    mockGetUnsyncedCorrections.mockResolvedValue([{ id: 'k-1' }]);

    const result = await trySyncNow();

    expect(result).toEqual({ status: 'synced', synced: 3, failed: 0 });
  });

  it('reports nothing-pending when there are no unsynced records', async () => {
    const result = await trySyncNow();

    expect(result).toEqual({ status: 'nothing-pending', synced: 0, failed: 0 });
  });

  it('reports partial failure without throwing', async () => {
    mockGetUnsyncedContributions.mockResolvedValue([{ id: 'c-1' }, { id: 'c-2' }]);
    mockSyncContribution
      .mockRejectedValueOnce(new Error('Network request failed'))
      .mockResolvedValueOnce(undefined);

    const result = await trySyncNow();

    expect(result).toEqual({ status: 'partial', synced: 1, failed: 1 });
  });
});
