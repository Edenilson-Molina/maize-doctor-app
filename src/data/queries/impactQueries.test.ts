const mockGetScanCount = jest.fn();
const mockGetContributionCount = jest.fn();

jest.mock('./scanQueries', () => ({
  getScanCount: () => mockGetScanCount(),
}));

jest.mock('./datasetContributionQueries', () => ({
  getContributionCount: () => mockGetContributionCount(),
}));

import { getImpactStats } from './impactQueries';

describe('getImpactStats', () => {
  beforeEach(() => {
    mockGetScanCount.mockReset();
    mockGetContributionCount.mockReset();
  });

  it('combines scan and contribution counts into a total activity figure', async () => {
    mockGetScanCount.mockResolvedValue(7);
    mockGetContributionCount.mockResolvedValue(3);

    const stats = await getImpactStats();

    expect(stats).toEqual({
      totalScans: 7,
      totalContributions: 3,
      totalActivity: 10,
    });
  });

  it('handles zero activity', async () => {
    mockGetScanCount.mockResolvedValue(0);
    mockGetContributionCount.mockResolvedValue(0);

    const stats = await getImpactStats();

    expect(stats.totalActivity).toBe(0);
  });
});
