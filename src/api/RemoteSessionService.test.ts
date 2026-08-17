import { RemoteSessionService } from './RemoteSessionService';

const mockStore = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn((key: string, value: string) => {
    mockStore.set(key, value);
    return Promise.resolve();
  }),
  getItemAsync: jest.fn((key: string) => Promise.resolve(mockStore.get(key) ?? null)),
  deleteItemAsync: jest.fn((key: string) => {
    mockStore.delete(key);
    return Promise.resolve();
  }),
}));

describe('RemoteSessionService', () => {
  const originalApiUrl = process.env.EXPO_PUBLIC_API_URL;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    mockStore.clear();
    process.env.EXPO_PUBLIC_API_URL = 'https://api.doctormaiz.test';
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_API_URL = originalApiUrl;
  });

  it('stores tokens returned by /auth/login', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ accessToken: 'access-1', refreshToken: 'refresh-1' }),
    });
    const service = new RemoteSessionService();

    await service.login('farmer@example.com', 'secret');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.doctormaiz.test/auth/login',
      expect.objectContaining({ method: 'POST' })
    );
    await expect(service.getAccessToken()).resolves.toBe('access-1');
  });

  it('stores tokens returned by /auth/register', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ accessToken: 'access-2', refreshToken: 'refresh-2' }),
    });
    const service = new RemoteSessionService();

    await service.register('Farmer', 'farmer2@example.com', 'secret');

    await expect(service.getAccessToken()).resolves.toBe('access-2');
  });

  it('falls back to login when the email is already registered (409)', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 409 })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ accessToken: 'access-409', refreshToken: 'refresh-409' }),
      });
    const service = new RemoteSessionService();

    await service.register('Farmer', 'farmer@example.com', 'secret');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://api.doctormaiz.test/auth/login',
      expect.objectContaining({ method: 'POST' })
    );
    await expect(service.getAccessToken()).resolves.toBe('access-409');
  });

  it('propagates the login failure when a 409 fallback has the wrong password', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 409 })
      .mockResolvedValueOnce({ ok: false, status: 401 });
    const service = new RemoteSessionService();

    await expect(service.register('Farmer', 'farmer@example.com', 'wrong')).rejects.toThrow(
      'Remote login failed with status 401'
    );
    await expect(service.getAccessToken()).resolves.toBeNull();
  });

  it('throws on a failed login without storing anything', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401 });
    const service = new RemoteSessionService();

    await expect(service.login('farmer@example.com', 'wrong')).rejects.toThrow(
      'Remote login failed with status 401'
    );
    await expect(service.getAccessToken()).resolves.toBeNull();
  });

  it('no-ops when EXPO_PUBLIC_API_URL is not set', async () => {
    process.env.EXPO_PUBLIC_API_URL = '';
    const service = new RemoteSessionService();

    await service.login('farmer@example.com', 'secret');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refreshes and stores a new token pair', async () => {
    mockStore.set('doctormaiz_remote_refresh_token', 'refresh-1');
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ accessToken: 'access-new', refreshToken: 'refresh-new' }),
    });
    const service = new RemoteSessionService();

    const token = await service.refreshAccessToken();

    expect(token).toBe('access-new');
    await expect(service.getAccessToken()).resolves.toBe('access-new');
  });

  it('returns null from refreshAccessToken when there is no stored refresh token', async () => {
    const service = new RemoteSessionService();

    await expect(service.refreshAccessToken()).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('clears local tokens on logout even if the remote call fails', async () => {
    mockStore.set('doctormaiz_remote_access_token', 'access-1');
    mockStore.set('doctormaiz_remote_refresh_token', 'refresh-1');
    fetchMock.mockRejectedValue(new Error('Network request failed'));
    const service = new RemoteSessionService();

    await service.logout();

    await expect(service.getAccessToken()).resolves.toBeNull();
  });
});
