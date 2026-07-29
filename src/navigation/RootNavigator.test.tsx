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
  it('renders login screen when not authenticated', async () => {
    const { getByText } = await renderWithProviders();
    expect(getByText('Iniciar Sesion')).toBeTruthy();
    expect(getByText('Entrar')).toBeTruthy();
  });
});
