import { Q } from '@nozbe/watermelondb';
import { database } from '../database';
import { Correction } from '../models/Correction';
import type { DiagnosisClass } from '@/content/diagnosis';

const correctionsCollection = database.collections.get<Correction>('corrections');

export function observeCorrectionsForScan(scanId: string) {
  return correctionsCollection
    .query(Q.where('scan_id', scanId), Q.sortBy('created_at', Q.desc))
    .observe();
}

export async function createCorrection(data: {
  scanId: string;
  observedLabel: DiagnosisClass;
  note?: string | null;
}): Promise<Correction> {
  return database.write(async () => {
    return correctionsCollection.create((correction) => {
      correction.scanId = data.scanId;
      correction.observedLabel = data.observedLabel;
      correction.note = data.note ?? null;
      correction.status = 'pending';
      correction.synced = false;
    });
  });
}
