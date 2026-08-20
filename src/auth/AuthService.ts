export interface UserSession {
  /**
   * Device-local account id. Deliberately NOT the backend's id: a locally
   * registered account keeps its generated id, while one adopted from the
   * backend (`adoptRemoteAccount`) carries the server UUID.
   *
   * Nothing may rely on the two matching. This id never crosses the wire — sync
   * sends the record's own `clientId`, and the backend derives the owner from
   * the JWT — so the divergence is invisible by design. Any future feature that
   * needs a stable cross-device identity must reconcile explicitly rather than
   * assume equality.
   */
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
