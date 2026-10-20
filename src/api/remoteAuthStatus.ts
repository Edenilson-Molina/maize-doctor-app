import * as SecureStore from 'expo-secure-store';

const MISMATCH_KEY = 'doctormaiz_remote_credential_mismatch';
const PENDING_REGISTER_KEY = 'doctormaiz_remote_register_pending';

/**
 * Records that the account exists locally but the backend registration failed, so the
 * next successful local login retries it instead of leaving sync permanently unauthenticated.
 *
 * @returns {Promise<void>} Resolves once the flag is stored; never throws.
 */
export async function flagRemoteRegisterPending(): Promise<void> {
  try {
    await SecureStore.setItemAsync(PENDING_REGISTER_KEY, '1');
  } catch {
    // Best-effort: without the flag the account simply stays local-only, as before.
  }
}

/**
 * Clears the pending-registration flag once the backend has the account.
 *
 * @returns {Promise<void>} Resolves once the flag is removed; never throws.
 */
export async function clearRemoteRegisterPending(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(PENDING_REGISTER_KEY);
  } catch {
    // Best-effort: a stale flag only causes one extra registration attempt.
  }
}

/**
 * @returns {Promise<boolean>} True when a backend registration failed and still needs a retry.
 */
export async function hasRemoteRegisterPending(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(PENDING_REGISTER_KEY)) === '1';
  } catch {
    return false;
  }
}

/**
 * Records that the backend rejected the credentials that just worked locally.
 *
 * The stored JWT keeps sync alive until the refresh token expires, so without this
 * flag the divergence would only surface weeks later as an unexplained failure.
 *
 * @returns {Promise<void>} Resolves once the flag is stored; never throws.
 */
export async function flagCredentialMismatch(): Promise<void> {
  try {
    await SecureStore.setItemAsync(MISMATCH_KEY, '1');
  } catch {
    // Surfacing the warning is best-effort; it must never break login.
  }
}

/**
 * Clears the mismatch flag after a successful remote authentication.
 *
 * @returns {Promise<void>} Resolves once the flag is removed; never throws.
 */
export async function clearCredentialMismatch(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(MISMATCH_KEY);
  } catch {
    // Best-effort: a stale flag only means one extra warning.
  }
}

/**
 * @returns {Promise<boolean>} True when the local and backend passwords are known to differ.
 */
export async function hasCredentialMismatch(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(MISMATCH_KEY)) === '1';
  } catch {
    return false;
  }
}
