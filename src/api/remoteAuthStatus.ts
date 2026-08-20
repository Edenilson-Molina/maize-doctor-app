import * as SecureStore from 'expo-secure-store';

const MISMATCH_KEY = 'doctormaiz_remote_credential_mismatch';

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
