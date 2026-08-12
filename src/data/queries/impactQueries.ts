import { getScanCount } from './scanQueries';
import { getContributionCount } from './datasetContributionQueries';

export interface ImpactStats {
  totalScans: number;
  totalContributions: number;
  totalActivity: number;
}

export async function getImpactStats(): Promise<ImpactStats> {
  const [totalScans, totalContributions] = await Promise.all([
    getScanCount(),
    getContributionCount(),
  ]);

  return {
    totalScans,
    totalContributions,
    totalActivity: totalScans + totalContributions,
  };
}
