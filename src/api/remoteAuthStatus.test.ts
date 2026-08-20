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

import {
  clearCredentialMismatch,
  flagCredentialMismatch,
  hasCredentialMismatch,
} from './remoteAuthStatus';

describe('remoteAuthStatus', () => {
  beforeEach(() => {
    mockStore.clear();
  });

  it('reports no mismatch by default', async () => {
    await expect(hasCredentialMismatch()).resolves.toBe(false);
  });

  it('remembers a flagged mismatch', async () => {
    await flagCredentialMismatch();

    await expect(hasCredentialMismatch()).resolves.toBe(true);
  });

  it('clears the flag once the session is healthy again', async () => {
    await flagCredentialMismatch();
    await clearCredentialMismatch();

    await expect(hasCredentialMismatch()).resolves.toBe(false);
  });

  it('never throws when secure storage is unavailable', async () => {
    const SecureStore = jest.requireMock('expo-secure-store');
    SecureStore.getItemAsync.mockRejectedValueOnce(new Error('keystore unavailable'));

    await expect(hasCredentialMismatch()).resolves.toBe(false);
  });
});
