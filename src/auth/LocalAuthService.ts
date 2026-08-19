import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import type { AuthService, AuthResult, UserSession } from './AuthService';

const SESSION_KEY = 'doctormaiz_session';
const USERS_KEY = 'doctormaiz_users';

interface StoredUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  /** Absent on accounts created before the salted-hash migration. */
  salt?: string;
}

/**
 * Pre-migration hash. Kept only to verify credentials of accounts created before
 * salted hashing existed, so those users are not locked out; never used to store
 * a new hash.
 *
 * @param {string} input Value to hash.
 * @returns {string} 32-bit non-cryptographic digest.
 */
function legacyHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash.toString(36);
}

/**
 * Generates a random per-user salt.
 *
 * @returns {Promise<string>} Hex-encoded 16-byte salt.
 */
async function generateSalt(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(16);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Hashes a password with its salt using SHA-256.
 *
 * @param {string} password Plain-text password.
 * @param {string} salt Per-user salt.
 * @returns {Promise<string>} Hex-encoded digest.
 */
async function hashPassword(password: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${password}`);
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

export class LocalAuthService implements AuthService {
  private async getUsers(): Promise<StoredUser[]> {
    const raw = await SecureStore.getItemAsync(USERS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StoredUser[];
  }

  private async saveUsers(users: StoredUser[]): Promise<void> {
    await SecureStore.setItemAsync(USERS_KEY, JSON.stringify(users));
  }

  private async saveSession(user: UserSession): Promise<void> {
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(user));
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const users = await this.getUsers();
    const found = users.find((u) => u.email === email.toLowerCase().trim());

    if (!found) {
      return { success: false, error: 'No existe una cuenta con este correo.' };
    }

    if (found.salt) {
      const expected = await hashPassword(password, found.salt);
      if (found.passwordHash !== expected) {
        return { success: false, error: 'Contraseña incorrecta.' };
      }
    } else {
      if (found.passwordHash !== legacyHash(password)) {
        return { success: false, error: 'Contraseña incorrecta.' };
      }
      const salt = await generateSalt();
      found.salt = salt;
      found.passwordHash = await hashPassword(password, salt);
      await this.saveUsers(users);
    }

    const session: UserSession = { id: found.id, name: found.name, email: found.email };
    await this.saveSession(session);
    return { success: true, user: session };
  }

  async register(name: string, email: string, password: string): Promise<AuthResult> {
    const users = await this.getUsers();
    const normalizedEmail = email.toLowerCase().trim();

    if (users.some((u) => u.email === normalizedEmail)) {
      return { success: false, error: 'Ya existe una cuenta con este correo.' };
    }

    const salt = await generateSalt();
    const newUser: StoredUser = {
      id: generateId(),
      name: name.trim(),
      email: normalizedEmail,
      passwordHash: await hashPassword(password, salt),
      salt,
    };

    users.push(newUser);
    await this.saveUsers(users);

    const session: UserSession = { id: newUser.id, name: newUser.name, email: newUser.email };
    await this.saveSession(session);
    return { success: true, user: session };
  }

  /**
   * Creates (or refreshes) the local account for a user that authenticated remotely.
   *
   * Lets a user sign in on a device that has never seen their account, keeping the
   * app usable offline afterwards with the same credentials.
   *
   * @param {UserSession} user Account as returned by the backend.
   * @param {string} password Password the user just authenticated with.
   * @returns {Promise<UserSession>} The stored local session.
   */
  async adoptRemoteAccount(user: UserSession, password: string): Promise<UserSession> {
    const users = await this.getUsers();
    const normalizedEmail = user.email.toLowerCase().trim();
    const salt = await generateSalt();
    const passwordHash = await hashPassword(password, salt);
    const existing = users.find((u) => u.email === normalizedEmail);

    if (existing) {
      existing.name = user.name;
      existing.salt = salt;
      existing.passwordHash = passwordHash;
    } else {
      users.push({
        id: user.id,
        name: user.name,
        email: normalizedEmail,
        passwordHash,
        salt,
      });
    }

    await this.saveUsers(users);
    const session: UserSession = { id: user.id, name: user.name, email: normalizedEmail };
    await this.saveSession(session);
    return session;
  }

  async logout(): Promise<void> {
    await SecureStore.deleteItemAsync(SESSION_KEY);
  }

  async getStoredSession(): Promise<UserSession | null> {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserSession;
  }
}
