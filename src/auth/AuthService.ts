export interface UserSession {
  id: string;
  name: string;
  email: string;
}

export interface AuthResult {
  success: boolean;
  error?: string;
  user?: UserSession;
}

export interface AuthService {
  login(email: string, password: string): Promise<AuthResult>;
  register(name: string, email: string, password: string): Promise<AuthResult>;
  logout(): Promise<void>;
  getStoredSession(): Promise<UserSession | null>;
  adoptRemoteAccount(user: UserSession, password: string): Promise<UserSession>;
}
