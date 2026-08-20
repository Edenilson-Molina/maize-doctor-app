import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { AuthService, UserSession, AuthResult } from './AuthService';
import { LocalAuthService } from './LocalAuthService';
import { remoteSession } from '@/api/RemoteSessionService';
import { clearCredentialMismatch, flagCredentialMismatch } from '@/api/remoteAuthStatus';

interface AuthState {
  isAuthenticated: boolean;
  isGuest: boolean;
  user: UserSession | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AuthResult>;
  register: (name: string, email: string, password: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

const authService: AuthService = new LocalAuthService();

/**
 * Tells apart "this device has never seen this account" from a genuine credential error.
 *
 * Only the former is worth retrying against the backend: a wrong password must not
 * silently succeed just because the server accepts a different one.
 *
 * @param {AuthResult} result Failed local login result.
 * @returns {boolean} True when the account is simply absent from this device.
 */
function isMissingAccountError(result: AuthResult): boolean {
  return result.error === 'No existe una cuenta con este correo.';
}

/**
 * Tells a rejected credential apart from an unreachable backend.
 *
 * Only a 401 means the local and remote passwords diverged; a network failure says
 * nothing about the credentials and must not raise a false warning.
 *
 * @param {unknown} error Error thrown by the remote session call.
 * @returns {boolean} True when the backend actively rejected the credentials.
 */
function isCredentialRejection(error: unknown): boolean {
  return error instanceof Error && /status 401/.test(error.message);
}

/**
 * Mirrors the login to the backend, recording whether the credentials still match.
 *
 * @param {string} email Account email.
 * @param {string} password Password that just authenticated locally.
 * @returns {void} Fire-and-forget: never blocks or fails the local login.
 */
function mirrorLogin(email: string, password: string): void {
  remoteSession
    .login(email, password)
    .then(() => clearCredentialMismatch())
    .catch((error: unknown) => {
      if (isCredentialRejection(error)) {
        return flagCredentialMismatch();
      }
      return undefined;
    })
    .catch(() => {});
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    authService.getStoredSession().then((session) => {
      setUser(session);
      setIsLoading(false);
    });
  }, []);

  const login = async (email: string, password: string): Promise<AuthResult> => {
    const result = await authService.login(email, password);
    if (result.success && result.user) {
      setUser(result.user);
      mirrorLogin(email, password);
      return result;
    }

    if (!isMissingAccountError(result)) {
      return result;
    }

    try {
      await remoteSession.login(email, password);
      const remoteUser = await remoteSession.getCurrentUser();
      if (!remoteUser) return result;

      const session = await authService.adoptRemoteAccount(remoteUser, password);
      setUser(session);
      return { success: true, user: session };
    } catch {
      return result;
    }
  };

  const register = async (
    name: string,
    email: string,
    password: string
  ): Promise<AuthResult> => {
    const result = await authService.register(name, email, password);
    if (result.success && result.user) {
      setUser(result.user);
      remoteSession.register(name, email, password).catch(() => {});
    }
    return result;
  };

  const logout = async (): Promise<void> => {
    await authService.logout();
    remoteSession.logout().catch(() => {});
    clearCredentialMismatch().catch(() => {});
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: user !== null,
        isGuest: user === null,
        user,
        isLoading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
