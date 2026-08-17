import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import { AuthProvider, useAuth } from './AuthContext';

const mockLocalLogin = jest.fn();
const mockLocalRegister = jest.fn();
const mockLocalLogout = jest.fn();
const mockGetStoredSession = jest.fn();

jest.mock('./LocalAuthService', () => ({
  LocalAuthService: jest.fn().mockImplementation(() => ({
    login: (...args: unknown[]) => mockLocalLogin(...args),
    register: (...args: unknown[]) => mockLocalRegister(...args),
    logout: (...args: unknown[]) => mockLocalLogout(...args),
    getStoredSession: () => mockGetStoredSession(),
  })),
}));

const mockRemoteLogin = jest.fn();
const mockRemoteRegister = jest.fn();
const mockRemoteLogout = jest.fn();

jest.mock('@/api/RemoteSessionService', () => ({
  remoteSession: {
    login: (...args: unknown[]) => mockRemoteLogin(...args),
    register: (...args: unknown[]) => mockRemoteRegister(...args),
    logout: (...args: unknown[]) => mockRemoteLogout(...args),
  },
}));

let lastLoginError: unknown = null;

/**
 * Exposes the auth context through pressable actions so the provider can be
 * exercised via the public `render` API.
 */
function AuthProbe() {
  const { login, register, logout, isLoading } = useAuth();

  return (
    <>
      <Text>{isLoading ? 'loading' : 'ready'}</Text>
      <Pressable
        accessibilityLabel="do-login"
        onPress={() => {
          lastLoginError = null;
          login('farmer@example.com', 'secret').catch((error) => {
            lastLoginError = error;
          });
        }}
      >
        <Text>login</Text>
      </Pressable>
      <Pressable
        accessibilityLabel="do-login-wrong"
        onPress={() => {
          login('farmer@example.com', 'wrong');
        }}
      >
        <Text>login-wrong</Text>
      </Pressable>
      <Pressable
        accessibilityLabel="do-register"
        onPress={() => {
          register('Farmer', 'farmer@example.com', 'secret');
        }}
      >
        <Text>register</Text>
      </Pressable>
      <Pressable accessibilityLabel="do-logout" onPress={() => void logout()}>
        <Text>logout</Text>
      </Pressable>
    </>
  );
}

async function renderProbe() {
  return render(
    <AuthProvider>
      <AuthProbe />
    </AuthProvider>
  );
}

describe('AuthContext remote mirroring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    lastLoginError = null;
    mockGetStoredSession.mockResolvedValue(null);
    mockRemoteLogin.mockResolvedValue(undefined);
    mockRemoteRegister.mockResolvedValue(undefined);
    mockRemoteLogout.mockResolvedValue(undefined);
  });

  it('mirrors a successful local login to the remote session', async () => {
    mockLocalLogin.mockResolvedValue({
      success: true,
      user: { id: 'u1', name: 'Farmer', email: 'farmer@example.com' },
    });
    const { getByLabelText, findByText } = await renderProbe();
    await findByText('ready');

    fireEvent.press(getByLabelText('do-login'));

    await waitFor(() =>
      expect(mockRemoteLogin).toHaveBeenCalledWith('farmer@example.com', 'secret')
    );
  });

  it('does not mirror to remote when local login fails', async () => {
    mockLocalLogin.mockResolvedValue({ success: false, error: 'Contraseña incorrecta.' });
    const { getByLabelText, findByText } = await renderProbe();
    await findByText('ready');

    fireEvent.press(getByLabelText('do-login-wrong'));

    await waitFor(() => expect(mockLocalLogin).toHaveBeenCalled());
    expect(mockRemoteLogin).not.toHaveBeenCalled();
  });

  it('does not reject login when the remote mirror call fails', async () => {
    mockLocalLogin.mockResolvedValue({
      success: true,
      user: { id: 'u1', name: 'Farmer', email: 'farmer@example.com' },
    });
    mockRemoteLogin.mockRejectedValue(new Error('Network request failed'));
    const { getByLabelText, findByText } = await renderProbe();
    await findByText('ready');

    fireEvent.press(getByLabelText('do-login'));

    await waitFor(() => expect(mockRemoteLogin).toHaveBeenCalled());
    expect(lastLoginError).toBeNull();
  });

  it('mirrors a successful local register to the remote session', async () => {
    mockLocalRegister.mockResolvedValue({
      success: true,
      user: { id: 'u1', name: 'Farmer', email: 'farmer@example.com' },
    });
    const { getByLabelText, findByText } = await renderProbe();
    await findByText('ready');

    fireEvent.press(getByLabelText('do-register'));

    await waitFor(() =>
      expect(mockRemoteRegister).toHaveBeenCalledWith('Farmer', 'farmer@example.com', 'secret')
    );
  });

  it('mirrors logout to the remote session', async () => {
    mockGetStoredSession.mockResolvedValue({
      id: 'u1',
      name: 'Farmer',
      email: 'farmer@example.com',
    });
    mockLocalLogout.mockResolvedValue(undefined);
    const { getByLabelText, findByText } = await renderProbe();
    await findByText('ready');

    fireEvent.press(getByLabelText('do-logout'));

    await waitFor(() => expect(mockRemoteLogout).toHaveBeenCalledTimes(1));
  });
});
