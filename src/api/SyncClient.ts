import type { Scan } from '@/data/models/Scan';
import type { Correction } from '@/data/models/Correction';
import type { DatasetContribution } from '@/data/models/DatasetContribution';

export interface SyncClient {
  syncScan(scan: Scan): Promise<void>;
  syncCorrection(correction: Correction): Promise<void>;
  syncContribution(contribution: DatasetContribution): Promise<void>;
}
