jest.mock('@/data/database', () => ({
  database: {
    collections: {
      get: jest.fn().mockReturnValue({
        query: jest.fn().mockReturnValue({
          fetch: jest.fn().mockResolvedValue([]),
          fetchCount: jest.fn().mockResolvedValue(0),
          observe: jest.fn().mockReturnValue({ subscribe: jest.fn() }),
        }),
      }),
    },
  },
}));

jest.mock('@/data/seedDevData', () => ({
  seedDevData: jest.fn().mockResolvedValue(undefined),
}));

const mockGetStoredSession = jest.fn();

jest.mock('@/auth/LocalAuthService', () => ({
  LocalAuthService: jest.fn().mockImplementation(() => ({
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    getStoredSession: () => mockGetStoredSession(),
  })),
}));

jest.mock('@/api/RemoteSessionService', () => ({
  remoteSession: {
    login: jest.fn().mockResolvedValue(undefined),
    register: jest.fn().mockResolvedValue(undefined),
    logout: jest.fn().mockResolvedValue(undefined),
  },
}));

import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/auth/AuthContext';
import { RootNavigator } from './RootNavigator';

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function renderWithProviders() {
  return render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

describe('RootNavigator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lands on the app tabs without a session, not on the login screen', async () => {
    mockGetStoredSession.mockResolvedValue(null);

    const { findByText, queryByText } = await renderWithProviders();

    expect(await findByText('Hola, Agricultor')).toBeTruthy();
    expect(queryByText('Iniciar Sesion')).toBeNull();
  });

  it('lands on the app tabs when a stored session exists', async () => {
    mockGetStoredSession.mockResolvedValue({
      id: 'u1',
      name: 'Farmer Uno',
      email: 'farmer@example.com',
    });

    const { findByText } = await renderWithProviders();

    expect(await findByText('Hola, Farmer')).toBeTruthy();
  });
});
