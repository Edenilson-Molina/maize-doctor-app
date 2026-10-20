import { render, act } from '@testing-library/react-native';
import { HomeScreen } from './HomeScreen';

type Listener = (mockRows: unknown[]) => void;
const mockListeners: Listener[] = [];
let mockRows: unknown[] = [];

jest.mock('@/data/database', () => ({
  hasNativeModule: true,
  database: {
    collections: {
      get: () => ({
        query: () => ({
          observe: () => ({
            subscribe: (listener: Listener) => {
              mockListeners.push(listener);
              listener(mockRows);
              return { unsubscribe: () => {} };
            },
          }),
        }),
      }),
    },
  },
}));

jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    where: () => ({}),
    sortBy: () => ({}),
    take: () => ({}),
    desc: 'desc',
    notEq: () => ({}),
  },
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));

jest.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', name: 'Carlos Mendoza', email: 'carlos@ejemplo.com' } }),
}));

jest.mock('@/services/weather/useWeather', () => ({
  useWeather: () => ({ weather: { temperature: 28, humidity: 65, source: 'live' }, refreshWeather: jest.fn() }),
}));

jest.mock('@/components/AgroclimaticModal', () => ({ AgroclimaticModal: () => null }));

jest.mock('@/components/FieldCoverageMap', () => ({ FieldCoverageMap: () => null }));

const scan = (id: string, label: string) => ({
  id,
  label,
  confidence: 0.9,
  lat: 13.7,
  lon: -89.2,
  imageUri: `file:///document/scans/${id}.jpg`,
  _raw: { created_at: Date.now() },
});

describe('HomeScreen with the database', () => {
  beforeEach(() => {
    mockListeners.length = 0;
    mockRows = [];
  });

  it('shows a new scan without reopening the screen', async () => {
    const { queryByLabelText } = await render(
      <HomeScreen navigation={{ navigate: jest.fn() } as any} route={{} as any} />,
    );
    expect(queryByLabelText(/Ver detalle de escaneo Roya Comun/)).toBeNull();

    mockRows = [scan('scan-new', 'common_rust')];
    await act(async () => {
      mockListeners.forEach((listener) => listener(mockRows));
    });

    expect(queryByLabelText(/Ver detalle de escaneo Roya Comun/)).toBeTruthy();
  });
});
