import NetInfo from '@react-native-community/netinfo';
import { getSyncClient } from './index';
import { getUnsyncedCorrections, markCorrectionSynced } from '@/data/queries/correctionQueries';
import {
  getUnsyncedContributions,
  markContributionSynced,
} from '@/data/queries/datasetContributionQueries';
import { remoteSession } from './RemoteSessionService';
import { logger } from '@/lib/logger';

export type SyncOutcome =
  | { status: 'no-backend'; synced: 0; failed: 0 }
  | { status: 'offline'; synced: 0; failed: 0 }
  | { status: 'unauthenticated'; synced: 0; failed: 0 }
  | { status: 'nothing-pending'; synced: 0; failed: 0 }
  | { status: 'synced'; synced: number; failed: 0 }
  | { status: 'partial'; synced: number; failed: number };

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

/**
 * Attempts an immediate sync, reporting why it could not run instead of failing silently.
 *
 * Unlike `flushPendingSync`, this never throws and never runs when a precondition
 * is missing, so callers can tell the user what actually happened.
 *
 * @returns {Promise<SyncOutcome>} Outcome describing the result or the blocking precondition.
 */
export async function trySyncNow(): Promise<SyncOutcome> {
  if (!process.env.EXPO_PUBLIC_API_URL) {
    return { status: 'no-backend', synced: 0, failed: 0 };
  }

  const [corrections, contributions] = await Promise.all([
    getUnsyncedCorrections(),
    getUnsyncedContributions(),
  ]);

  if (corrections.length === 0 && contributions.length === 0) {
    return { status: 'nothing-pending', synced: 0, failed: 0 };
  }

  const state = await NetInfo.fetch();
  if (!state.isConnected) {
    return { status: 'offline', synced: 0, failed: 0 };
  }

  const accessToken = await remoteSession.getAccessToken();
  if (!accessToken) {
    return { status: 'unauthenticated', synced: 0, failed: 0 };
  }

  const syncClient = getSyncClient();
  let synced = 0;
  let failed = 0;

  for (const correction of corrections) {
    try {
      await syncClient.syncCorrection(correction);
      await markCorrectionSynced(correction);
      synced += 1;
    } catch (error) {
      failed += 1;
      logger.warn(`No se pudo sincronizar la corrección ${correction.id}`, error);
    }
  }

  for (const contribution of contributions) {
    try {
      await syncClient.syncContribution(contribution);
      await markContributionSynced(contribution);
      synced += 1;
    } catch (error) {
      failed += 1;
      logger.warn(`No se pudo sincronizar la contribución ${contribution.id}`, error);
    }
  }

  return failed > 0 ? { status: 'partial', synced, failed } : { status: 'synced', synced, failed: 0 };
}
