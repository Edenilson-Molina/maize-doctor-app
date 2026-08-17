import type { Correction } from '@/data/models/Correction';
import type { DatasetContribution } from '@/data/models/DatasetContribution';

export interface SyncClient {
  syncCorrection(correction: Correction): Promise<void>;
  syncContribution(contribution: DatasetContribution): Promise<void>;
}
