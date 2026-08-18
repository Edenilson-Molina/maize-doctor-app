const mockGetUnsyncedCorrections = jest.fn();
const mockGetUnsyncedContributions = jest.fn();

jest.mock('./correctionQueries', () => ({
  getUnsyncedCorrections: () => mockGetUnsyncedCorrections(),
}));

jest.mock('./datasetContributionQueries', () => ({
  getUnsyncedContributions: () => mockGetUnsyncedContributions(),
}));

import { getPendingSyncCount } from './pendingSyncQueries';

describe('getPendingSyncCount', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('adds up unsynced corrections and contributions', async () => {
    mockGetUnsyncedCorrections.mockResolvedValue([{ id: 'k-1' }, { id: 'k-2' }]);
    mockGetUnsyncedContributions.mockResolvedValue([{ id: 'c-1' }]);

    await expect(getPendingSyncCount()).resolves.toBe(3);
  });

  it('returns zero when nothing is pending', async () => {
    mockGetUnsyncedCorrections.mockResolvedValue([]);
    mockGetUnsyncedContributions.mockResolvedValue([]);

    await expect(getPendingSyncCount()).resolves.toBe(0);
  });
});
