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

jest.mock('expo-crypto', () => ({
  digestStringAsync: jest.fn(async (_algo: string, data: string) => {
    // digest ficticio pero irreversible-por-inspeccion: no incluye el texto plano
    let h = 0;
    for (let i = 0; i < data.length; i++) {
      h = (h * 31 + data.charCodeAt(i)) >>> 0;
    }
    const salt = data.split(':')[0];
    return `${salt}${h.toString(16).padStart(8, '0')}`;
  }),
  getRandomBytesAsync: jest.fn(async (n: number) => new Uint8Array(n).fill(7)),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}));

import { LocalAuthService } from './LocalAuthService';

const USERS_KEY = 'doctormaiz_users';

describe('LocalAuthService password hashing', () => {
  beforeEach(() => {
    mockStore.clear();
  });

  it('never stores the plain-text password', async () => {
    const service = new LocalAuthService();
    await service.register('Farmer', 'farmer@example.com', 'secret123');

    const raw = mockStore.get(USERS_KEY) ?? '';
    expect(raw).not.toContain('secret123');
  });

  it('stores a per-user salt so identical passwords hash differently', async () => {
    const service = new LocalAuthService();
    await service.register('A', 'a@example.com', 'same-password');

    const users = JSON.parse(mockStore.get(USERS_KEY) ?? '[]');
    expect(users[0].salt).toBeTruthy();
    expect(users[0].passwordHash).toContain(users[0].salt);
  });

  it('logs in with the new hash scheme', async () => {
    const service = new LocalAuthService();
    await service.register('Farmer', 'farmer@example.com', 'secret123');
    await service.logout();

    const result = await service.login('farmer@example.com', 'secret123');

    expect(result.success).toBe(true);
    expect(result.user?.email).toBe('farmer@example.com');
  });

  it('rejects a wrong password', async () => {
    const service = new LocalAuthService();
    await service.register('Farmer', 'farmer@example.com', 'secret123');

    const result = await service.login('farmer@example.com', 'wrong');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Contraseña incorrecta.');
  });
});

describe('LocalAuthService legacy migration', () => {
  function legacyHash(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      hash = (hash << 5) - hash + input.charCodeAt(i);
      hash |= 0;
    }
    return hash.toString(36);
  }

  beforeEach(() => {
    mockStore.clear();
    mockStore.set(
      USERS_KEY,
      JSON.stringify([
        {
          id: 'legacy-1',
          name: 'Legacy',
          email: 'legacy@example.com',
          passwordHash: legacyHash('secret123'),
        },
      ])
    );
  });

  it('still lets an existing user log in with their old password', async () => {
    const service = new LocalAuthService();

    const result = await service.login('legacy@example.com', 'secret123');

    expect(result.success).toBe(true);
  });

  it('upgrades the stored hash after a successful legacy login', async () => {
    const service = new LocalAuthService();
    await service.login('legacy@example.com', 'secret123');

    const users = JSON.parse(mockStore.get(USERS_KEY) ?? '[]');
    expect(users[0].salt).toBeTruthy();
    expect(users[0].passwordHash).not.toBe(legacyHash('secret123'));
  });

  it('still rejects a wrong password for a legacy user', async () => {
    const service = new LocalAuthService();

    const result = await service.login('legacy@example.com', 'wrong');

    expect(result.success).toBe(false);
  });
});
