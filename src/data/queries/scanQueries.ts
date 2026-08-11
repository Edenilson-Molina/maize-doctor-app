import { Q } from '@nozbe/watermelondb';
import { database } from '../database';
import { Scan } from '../models/Scan';
import type { DiagnosisClass } from '@/content/diagnosis';

const scansCollection = database.collections.get<Scan>('scans');

export function observeScans() {
  return scansCollection.query(Q.sortBy('created_at', Q.desc)).observe();
}

export function observeScansByLabel(label: DiagnosisClass) {
  return scansCollection.query(Q.where('label', label), Q.sortBy('created_at', Q.desc)).observe();
}

export function observeRecentScans(limit: number = 5) {
  return scansCollection.query(Q.sortBy('created_at', Q.desc), Q.take(limit)).observe();
}

export async function getScanCount(): Promise<number> {
  return scansCollection.query().fetchCount();
}

export async function getScanCountByLabel(label: DiagnosisClass): Promise<number> {
  return scansCollection.query(Q.where('label', label)).fetchCount();
}

export async function getScanById(id: string): Promise<Scan> {
  return scansCollection.find(id);
}

export async function createScan(data: {
  imageUri: string;
  label?: DiagnosisClass | null;
  confidence?: number | null;
  distribution?: Record<string, number> | null;
  lat?: number | null;
  lon?: number | null;
  temperature?: number | null;
  humidity?: number | null;
}): Promise<Scan> {
  return database.write(async () => {
    return scansCollection.create((scan) => {
      scan.imageUri = data.imageUri;
      scan.label = data.label ?? null;
      scan.confidence = data.confidence ?? null;
      scan.distribution = data.distribution ?? null;
      scan.lat = data.lat ?? null;
      scan.lon = data.lon ?? null;
      scan.temperature = data.temperature ?? null;
      scan.humidity = data.humidity ?? null;
      scan.synced = false;
    });
  });
}

export async function updateScanResult(
  scan: Scan,
  result: {
    label: DiagnosisClass;
    confidence: number;
    distribution: Record<string, number>;
  },
): Promise<void> {
  await database.write(async () => {
    await scan.update((s) => {
      s.label = result.label;
      s.confidence = result.confidence;
      s.distribution = result.distribution;
    });
  });
}
