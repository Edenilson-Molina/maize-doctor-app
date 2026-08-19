import * as SecureStore from 'expo-secure-store';

const USER_KEY = 'doctormaiz_remote_user';
const ACCESS_TOKEN_KEY = 'doctormaiz_remote_access_token';
const REFRESH_TOKEN_KEY = 'doctormaiz_remote_refresh_token';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface RemoteUser {
  id: string;
  name: string;
  email: string;
}

function apiUrl(path: string): string {
  return `${process.env.EXPO_PUBLIC_API_URL}${path}`;
}

async function storeTokens(tokens: TokenPair): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

/**
 * Best-effort mirror of the local account onto the backend, holding the JWT pair
 * that authenticates sync requests.
 *
 * Every method is a no-op when `EXPO_PUBLIC_API_URL` is unset, so callers never
 * have to check whether a backend is configured.
 */
export class RemoteSessionService {
  /**
   * Registers the account remotely, falling back to a login when the email is
   * already taken on the server.
   *
   * @param {string} name Display name for the new account.
   * @param {string} email Email the account is registered under.
   * @param {string} password Plain-text password, sent over TLS.
   * @returns {Promise<void>} Resolves once a token pair is stored.
   * @throws {Error} If the server rejects both the registration and the fallback login.
   */
  async register(name: string, email: string, password: string): Promise<void> {
    if (!process.env.EXPO_PUBLIC_API_URL) return;
    const response = await fetch(apiUrl('/auth/register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });

    if (response.status === 409) {
      await this.login(email, password);
      return;
    }

    if (!response.ok) {
      throw new Error(`Remote register failed with status ${response.status}`);
    }
    const body = await response.json();
    await storeTokens({ accessToken: body.accessToken, refreshToken: body.refreshToken });
    if (body.user) {
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(body.user));
    }
  }

  /**
   * Authenticates against the backend and stores the returned token pair.
   *
   * @param {string} email Email the account is registered under.
   * @param {string} password Plain-text password, sent over TLS.
   * @returns {Promise<void>} Resolves once a token pair is stored.
   * @throws {Error} If the server rejects the credentials.
   */
  async login(email: string, password: string): Promise<void> {
    if (!process.env.EXPO_PUBLIC_API_URL) return;
    const response = await fetch(apiUrl('/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
      throw new Error(`Remote login failed with status ${response.status}`);
    }
    const body = await response.json();
    await storeTokens({ accessToken: body.accessToken, refreshToken: body.refreshToken });
    if (body.user) {
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(body.user));
    }
  }

  /**
   * Clears the stored tokens and revokes the refresh token server-side.
   *
   * @returns {Promise<void>} Resolves once local tokens are cleared, regardless of network state.
   */
  async logout(): Promise<void> {
    if (!process.env.EXPO_PUBLIC_API_URL) return;

    const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
    if (!refreshToken) return;
    try {
      await fetch(apiUrl('/auth/logout'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // Best-effort: local tokens are already cleared regardless of network state.
    }
  }

  /**
   * @returns {Promise<RemoteUser|null>} Account returned by the last successful remote login.
   */
  async getCurrentUser(): Promise<RemoteUser | null> {
    const raw = await SecureStore.getItemAsync(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as RemoteUser;
  }

  /**
   * @returns {Promise<string|null>} Stored access token, or null when there is no remote session.
   */
  async getAccessToken(): Promise<string | null> {
    return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  }

  /**
   * Exchanges the stored refresh token for a new token pair.
   *
   * @returns {Promise<string|null>} Fresh access token, or null when the refresh is unavailable or rejected.
   */
  async refreshAccessToken(): Promise<string | null> {
    const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    if (!refreshToken || !process.env.EXPO_PUBLIC_API_URL) return null;
    const response = await fetch(apiUrl('/auth/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) return null;
    const body = await response.json();
    await storeTokens({ accessToken: body.accessToken, refreshToken: body.refreshToken });
    return body.accessToken;
  }
}

export const remoteSession = new RemoteSessionService();
