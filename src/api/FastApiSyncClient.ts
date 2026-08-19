import type { SyncClient } from './SyncClient';
import { remoteSession } from './RemoteSessionService';
import type { Correction } from '@/data/models/Correction';
import type { DatasetContribution } from '@/data/models/DatasetContribution';

/**
 * Sends a request with the stored access token, refreshing once on a 401.
 *
 * @param {(token: string|null) => Promise<Response>} request Builds and sends the request for a given token.
 * @returns {Promise<Response>} Final response, after at most one refresh-and-retry.
 */
async function sendWithAuthRetry(
  request: (token: string | null) => Promise<Response>
): Promise<Response> {
  const accessToken = await remoteSession.getAccessToken();
  let response = await request(accessToken);

  if (response.status === 401) {
    const refreshedToken = await remoteSession.refreshAccessToken();
    if (refreshedToken) {
      response = await request(refreshedToken);
    }
  }

  return response;
}

async function post(path: string, body: unknown): Promise<void> {
  const baseUrl = process.env.EXPO_PUBLIC_API_URL;
  const response = await sendWithAuthRetry((token) =>
    fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    })
  );

  if (!response.ok) {
    throw new Error(`Sync request to ${path} failed with status ${response.status}`);
  }
}

/**
 * Uploads a multipart body, letting fetch set the boundary-bearing Content-Type.
 *
 * @param {string} path API path appended to `EXPO_PUBLIC_API_URL`.
 * @param {FormData} formData Body carrying the fields and the image file.
 * @returns {Promise<void>} Resolves when the server accepts the upload.
 * @throws {Error} If the server responds with a non-2xx status.
 */
async function postMultipart(path: string, formData: FormData): Promise<void> {
  const baseUrl = process.env.EXPO_PUBLIC_API_URL;
  const response = await sendWithAuthRetry((token) =>
    fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: formData,
    })
  );

  if (!response.ok) {
    throw new Error(`Sync request to ${path} failed with status ${response.status}`);
  }
}

export class FastApiSyncClient implements SyncClient {
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
    const formData = new FormData();
    formData.append('clientId', contribution.id);
    formData.append('label', contribution.label);
    formData.append('createdAt', contribution.createdAt.toISOString());
    if (contribution.note) {
      formData.append('note', contribution.note);
    }
    const filename = contribution.imageUri.split('/').pop() ?? 'contribution.jpg';
    const imageResponse = await fetch(contribution.imageUri);
    const imageBlob = await imageResponse.blob();
    formData.append('image', imageBlob, filename);

    await postMultipart('/dataset-contributions', formData);
  }
}
