import { render, fireEvent } from '@testing-library/react-native';
import { HomeScreen } from './HomeScreen';

const mockNavigate = jest.fn();
const mockTabNavigate = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      navigate: mockTabNavigate,
    }),
  };
});

jest.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', name: 'Carlos Mendoza', email: 'carlos@ejemplo.com' },
  }),
}));

function renderHomeScreen() {
  const navigation = {
    navigate: mockNavigate,
    goBack: jest.fn(),
  } as any;
  const route = { key: 'HomeMain', name: 'HomeMain' as const, params: undefined };
  return render(<HomeScreen navigation={navigation} route={route} />);
}

describe('HomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders farmer greeting and environmental metrics', async () => {
    const { findByText } = await renderHomeScreen();

    expect(await findByText('Hola, Carlos')).toBeTruthy();
    expect(await findByText('Temperatura')).toBeTruthy();
    expect(await findByText('Humedad')).toBeTruthy();
    expect(await findByText('Cobertura del Campo')).toBeTruthy();
  });

  it('renders the interactive field coverage map with geolocalized scans', async () => {
    const { findByTestId } = await renderHomeScreen();

    expect(await findByTestId('field-coverage-map')).toBeTruthy();
  });

  it('navigates to Scan tab when Iniciar Nuevo Escaneo button is pressed', async () => {
    const { findByLabelText } = await renderHomeScreen();

    const fab = await findByLabelText('Iniciar Nuevo Escaneo');
    await fireEvent.press(fab);

    expect(mockTabNavigate).toHaveBeenCalledWith('Scan');
  });

  it('navigates to ScanDetail when a recent scan card is pressed', async () => {
    const { findAllByLabelText } = await renderHomeScreen();

    const scanCards = await findAllByLabelText(/Ver detalle de escaneo/);
    expect(scanCards.length).toBeGreaterThan(0);

    await fireEvent.press(scanCards[0]);
    expect(mockNavigate).toHaveBeenCalledWith(
      'ScanDetail',
      expect.objectContaining({ scanId: expect.any(String) })
    );
  });
});
