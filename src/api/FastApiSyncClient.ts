import type { SyncClient } from './SyncClient';
import type { Scan } from '@/data/models/Scan';
import type { Correction } from '@/data/models/Correction';
import type { DatasetContribution } from '@/data/models/DatasetContribution';

async function post(path: string, body: unknown): Promise<void> {
  const baseUrl = process.env.EXPO_PUBLIC_API_URL;
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Sync request to ${path} failed with status ${response.status}`);
  }
}

export class FastApiSyncClient implements SyncClient {
  async syncScan(scan: Scan): Promise<void> {
    await post('/scans', {
      clientId: scan.id,
      imageUri: scan.imageUri,
      label: scan.label,
      confidence: scan.confidence,
      distribution: scan.distribution,
      lat: scan.lat,
      lon: scan.lon,
      temperature: scan.temperature,
      humidity: scan.humidity,
      createdAt: scan.createdAt.toISOString(),
    });
  }

  async syncCorrection(correction: Correction): Promise<void> {
    await post('/corrections', {
      clientId: correction.id,
      scanId: correction.scanId,
      observedLabel: correction.observedLabel,
      note: correction.note,
      status: correction.status,
      createdAt: correction.createdAt.toISOString(),
    });
  }

  async syncContribution(contribution: DatasetContribution): Promise<void> {
    await post('/dataset-contributions', {
      clientId: contribution.id,
      imageUri: contribution.imageUri,
      label: contribution.label,
      note: contribution.note,
      createdAt: contribution.createdAt.toISOString(),
    });
  }
}
