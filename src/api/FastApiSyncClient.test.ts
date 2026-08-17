import { FastApiSyncClient } from './FastApiSyncClient';
import type { Correction } from '@/data/models/Correction';
import type { DatasetContribution } from '@/data/models/DatasetContribution';

const mockGetAccessToken = jest.fn();
const mockRefreshAccessToken = jest.fn();

jest.mock('./RemoteSessionService', () => ({
  remoteSession: {
    getAccessToken: () => mockGetAccessToken(),
    refreshAccessToken: () => mockRefreshAccessToken(),
  },
}));

describe('FastApiSyncClient', () => {
  const originalApiUrl = process.env.EXPO_PUBLIC_API_URL;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_URL = 'https://api.doctormaiz.test';
    fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 201 });
    global.fetch = fetchMock as unknown as typeof fetch;
    mockGetAccessToken.mockReset().mockResolvedValue(null);
    mockRefreshAccessToken.mockReset().mockResolvedValue(null);
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

  it('attaches an Authorization header when a token is available', async () => {
    mockGetAccessToken.mockResolvedValue('token-123');
    const client = new FastApiSyncClient();
    const correction = {
      id: 'correction-1',
      scanId: 'scan-1',
      observedLabel: 'healthy',
      note: null,
      status: 'pending',
      createdAt: new Date('2026-08-12T10:05:00.000Z'),
    } as unknown as Correction;

    await client.syncCorrection(correction);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.doctormaiz.test/corrections',
      expect.objectContaining({
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token-123' },
      })
    );
  });

  it('refreshes and retries once on a 401, then succeeds', async () => {
    mockGetAccessToken.mockResolvedValue('expired-token');
    mockRefreshAccessToken.mockResolvedValue('fresh-token');
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValueOnce({ ok: true, status: 201 });
    const client = new FastApiSyncClient();
    const correction = {
      id: 'correction-1',
      scanId: 'scan-1',
      observedLabel: 'healthy',
      note: null,
      status: 'pending',
      createdAt: new Date('2026-08-12T10:05:00.000Z'),
    } as unknown as Correction;

    await client.syncCorrection(correction);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://api.doctormaiz.test/corrections',
      expect.objectContaining({
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer fresh-token' },
      })
    );
  });

  it('refreshes on a 401 even when no access token was stored', async () => {
    mockGetAccessToken.mockResolvedValue(null);
    mockRefreshAccessToken.mockResolvedValue('fresh-token');
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValueOnce({ ok: true, status: 201 });
    const client = new FastApiSyncClient();
    const correction = {
      id: 'correction-1',
      scanId: 'scan-1',
      observedLabel: 'healthy',
      note: null,
      status: 'pending',
      createdAt: new Date('2026-08-12T10:05:00.000Z'),
    } as unknown as Correction;

    await client.syncCorrection(correction);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://api.doctormaiz.test/corrections',
      expect.objectContaining({
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer fresh-token' },
      })
    );
  });

  it('throws when a 401 cannot be refreshed, without retrying again', async () => {
    mockGetAccessToken.mockResolvedValue('expired-token');
    mockRefreshAccessToken.mockResolvedValue(null);
    fetchMock.mockResolvedValue({ ok: false, status: 401 });
    const client = new FastApiSyncClient();
    const correction = {
      id: 'correction-1',
      scanId: 'scan-1',
      observedLabel: 'healthy',
      note: null,
      status: 'pending',
      createdAt: new Date('2026-08-12T10:05:00.000Z'),
    } as unknown as Correction;

    await expect(client.syncCorrection(correction)).rejects.toThrow(
      'Sync request to /corrections failed with status 401'
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
