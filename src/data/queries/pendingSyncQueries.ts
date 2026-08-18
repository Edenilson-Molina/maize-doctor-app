import { getUnsyncedCorrections } from './correctionQueries';
import { getUnsyncedContributions } from './datasetContributionQueries';

/**
 * Counts the records still waiting to be uploaded to the backend.
 *
 * @returns {Promise<number>} Combined total of unsynced corrections and contributions.
 */
export async function getPendingSyncCount(): Promise<number> {
  const [corrections, contributions] = await Promise.all([
    getUnsyncedCorrections(),
    getUnsyncedContributions(),
  ]);

  return corrections.length + contributions.length;
}
