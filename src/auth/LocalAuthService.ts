import * as SecureStore from 'expo-secure-store';
import type { AuthService, AuthResult, UserSession } from './AuthService';

const SESSION_KEY = 'doctormaiz_session';
const USERS_KEY = 'doctormaiz_users';

interface StoredUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
}

function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash.toString(36);
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

    if (found.passwordHash !== simpleHash(password)) {
      return { success: false, error: 'Contraseña incorrecta.' };
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

    const newUser: StoredUser = {
      id: generateId(),
      name: name.trim(),
      email: normalizedEmail,
      passwordHash: simpleHash(password),
    };

    users.push(newUser);
    await this.saveUsers(users);

    const session: UserSession = { id: newUser.id, name: newUser.name, email: newUser.email };
    await this.saveSession(session);
    return { success: true, user: session };
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
