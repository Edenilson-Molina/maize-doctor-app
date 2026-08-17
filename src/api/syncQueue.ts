import NetInfo from '@react-native-community/netinfo';
import { getSyncClient } from './index';
import { getUnsyncedCorrections, markCorrectionSynced } from '@/data/queries/correctionQueries';
import {
  getUnsyncedContributions,
  markContributionSynced,
} from '@/data/queries/datasetContributionQueries';
import { logger } from '@/lib/logger';

export async function flushPendingSync(): Promise<void> {
  const syncClient = getSyncClient();

  const corrections = await getUnsyncedCorrections();
  for (const correction of corrections) {
    try {
      await syncClient.syncCorrection(correction);
      await markCorrectionSynced(correction);
    } catch (error) {
      logger.warn(`No se pudo sincronizar la corrección ${correction.id}`, error);
    }
  }

  const contributions = await getUnsyncedContributions();
  for (const contribution of contributions) {
    try {
      await syncClient.syncContribution(contribution);
      await markContributionSynced(contribution);
    } catch (error) {
      logger.warn(`No se pudo sincronizar la contribución ${contribution.id}`, error);
    }
  }
}

export function startSyncListener(): () => void {
  let wasConnected: boolean | null = null;

  return NetInfo.addEventListener((state) => {
    const isConnected = !!state.isConnected;
    if (isConnected && wasConnected === false) {
      flushPendingSync();
    }
    wasConnected = isConnected;
  });
}
