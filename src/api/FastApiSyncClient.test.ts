import { FastApiSyncClient } from './FastApiSyncClient';
import type { Correction } from '@/data/models/Correction';
import type { DatasetContribution } from '@/data/models/DatasetContribution';

describe('FastApiSyncClient', () => {
  const originalApiUrl = process.env.EXPO_PUBLIC_API_URL;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_URL = 'https://api.doctormaiz.test';
    fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 201 });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_API_URL = originalApiUrl;
  });

  it('posts a correction to /corrections with the expected shape', async () => {
    const client = new FastApiSyncClient();
    const correction = {
      id: 'correction-1',
      scanId: 'scan-1',
      observedLabel: 'northern_corn_leaf_blight',
      note: 'Veo insectos',
      status: 'pending',
      createdAt: new Date('2026-08-12T10:05:00.000Z'),
    } as unknown as Correction;

    await client.syncCorrection(correction);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.doctormaiz.test/corrections',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('posts a contribution to /dataset-contributions with the expected shape', async () => {
    const client = new FastApiSyncClient();
    const contribution = {
      id: 'contribution-1',
      imageUri: 'file:///document/contributions/contribution_1.jpg',
      label: 'healthy',
      note: null,
      createdAt: new Date('2026-08-12T10:10:00.000Z'),
    } as unknown as DatasetContribution;

    await client.syncContribution(contribution);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.doctormaiz.test/dataset-contributions',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('throws when the server responds with a non-2xx status', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    const client = new FastApiSyncClient();

    await expect(
      client.syncCorrection({ id: 'correction-1', createdAt: new Date() } as Correction)
    ).rejects.toThrow('Sync request to /corrections failed with status 500');
  });

  it('propagates a network error so the sync queue can skip and retry later', async () => {
    fetchMock.mockRejectedValue(new Error('Network request failed'));
    const client = new FastApiSyncClient();

    await expect(
      client.syncCorrection({ id: 'correction-1', createdAt: new Date() } as Correction)
    ).rejects.toThrow('Network request failed');
  });
});
