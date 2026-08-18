import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider } from '@/auth/AuthContext';
import { ProfileScreen } from './ProfileScreen';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

const mockGetImpactStats = jest.fn();
const mockGetPendingSyncCount = jest.fn();
const mockTrySyncNow = jest.fn();
const mockAlert = jest.fn();

jest.mock('@/data/queries/pendingSyncQueries', () => ({
  getPendingSyncCount: () => mockGetPendingSyncCount(),
}));

jest.mock('@/api/syncQueue', () => ({
  trySyncNow: () => mockTrySyncNow(),
}));

jest.mock('@/data/queries/impactQueries', () => ({
  getImpactStats: () => mockGetImpactStats(),
}));

async function renderProfileScreen() {
  return render(
    <NavigationContainer>
      <AuthProvider>
        <ProfileScreen />
      </AuthProvider>
    </NavigationContainer>,
  );
}

describe('ProfileScreen', () => {
  beforeEach(() => {
    mockGetImpactStats.mockReset();
    mockGetPendingSyncCount.mockResolvedValue(0);
    mockTrySyncNow.mockResolvedValue({ status: 'synced', synced: 1, failed: 0 });
    jest.spyOn(Alert, 'alert').mockImplementation((...args) => mockAlert(...args));
  });

  it('shows the real scan count and starting rank while there is no activity', async () => {
    mockGetImpactStats.mockResolvedValue({
      totalScans: 0,
      totalContributions: 0,
      totalActivity: 0,
    });
    const { findByText } = await renderProfileScreen();

    expect(await findByText('Nuevo')).toBeTruthy();
    expect(await findByText('0%')).toBeTruthy();
    expect(
      await findByText("Faltan 10 escaneos o contribuciones para el rango 'Contribuidor'."),
    ).toBeTruthy();
  });

  it('reflects real scan and contribution counts once loaded', async () => {
    mockGetImpactStats.mockResolvedValue({
      totalScans: 45,
      totalContributions: 5,
      totalActivity: 50,
    });
    const { findByText } = await renderProfileScreen();

    expect(await findByText('45')).toBeTruthy();
    expect(await findByText('Experto de Campo')).toBeTruthy();
  });

  it('shows a maximum-rank message once the top tier is reached', async () => {
    mockGetImpactStats.mockResolvedValue({
      totalScans: 180,
      totalContributions: 30,
      totalActivity: 210,
    });
    const { findByText } = await renderProfileScreen();

    expect(await findByText('Master Field')).toBeTruthy();
    expect(
      await findByText('¡Alcanzaste el rango máximo! Gracias por tu aporte a la ciencia.'),
    ).toBeTruthy();
  });

  it('offers signing in and explains the account is optional while signed out', async () => {
    mockGetImpactStats.mockResolvedValue({
      totalScans: 0,
      totalContributions: 0,
      totalActivity: 0,
    });
    const { findByText, queryByText } = await renderProfileScreen();

    expect(await findByText('Iniciar Sesión')).toBeTruthy();
    expect(
      await findByText(
        'Tu cuenta solo sirve para sincronizar tus aportes cuando haya internet. Puedes escanear y revisar tu historial sin iniciar sesión.',
      ),
    ).toBeTruthy();
    expect(queryByText('Cerrar Sesión')).toBeNull();
  });
});

describe('ProfileScreen pending sync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetImpactStats.mockResolvedValue({
      totalScans: 0,
      totalContributions: 0,
      totalActivity: 0,
    });
    mockGetPendingSyncCount.mockResolvedValue(0);
    mockTrySyncNow.mockResolvedValue({ status: 'synced', synced: 2, failed: 0 });
    jest.spyOn(Alert, 'alert').mockImplementation((...args) => mockAlert(...args));
  });

  it('shows how many records are waiting to upload', async () => {
    mockGetPendingSyncCount.mockResolvedValue(2);

    const { findByText } = await renderProfileScreen();

    expect(await findByText('2 aportes sin sincronizar')).toBeTruthy();
  });

  it('uses the singular wording for a single pending record', async () => {
    mockGetPendingSyncCount.mockResolvedValue(1);

    const { findByText } = await renderProfileScreen();

    expect(await findByText('1 aporte sin sincronizar')).toBeTruthy();
  });

  it('hides the pending row when everything is synced', async () => {
    mockGetPendingSyncCount.mockResolvedValue(0);

    const { queryByText, findByText } = await renderProfileScreen();

    await findByText('Nuevo');
    expect(queryByText(/sin sincronizar/)).toBeNull();
  });

  it('retries the sync and reports the result when tapped', async () => {
    mockGetPendingSyncCount.mockResolvedValue(2);

    const { findByLabelText } = await renderProfileScreen();

    await fireEvent.press(await findByLabelText('Sincronizar ahora'));

    await waitFor(() => expect(mockTrySyncNow).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockAlert).toHaveBeenCalled());
  });
});
