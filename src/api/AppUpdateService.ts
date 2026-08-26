import { Platform } from 'react-native';
import * as Application from 'expo-application';
import { logger } from '@/lib/logger';

export interface AppUpdateInfo {
  latestVersionCode: number;
  latestVersionName: string;
  minSupportedVersionCode: number;
  forceUpdate: boolean;
  downloadUrl: string;
  releaseNotes: string | null;
}

export type UpdateCheck =
  | { status: 'up-to-date' }
  | { status: 'unavailable' }
  | { status: 'optional'; info: AppUpdateInfo }
  | { status: 'required'; info: AppUpdateInfo };

/**
 * Reads the version code Android assigned to the installed build.
 *
 * @returns {number|null} Installed version code, or null when it cannot be read.
 */
export function getInstalledVersionCode(): number | null {
  const raw = Application.nativeBuildVersion;
  if (!raw) return null;

  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Asks the backend whether a newer release exists for this platform.
 *
 * Never throws and never blocks startup: any failure (no backend configured,
 * offline, 404 because no release is published, malformed payload) resolves to
 * `unavailable`, since an update prompt is not worth interrupting the app over.
 *
 * @returns {Promise<UpdateCheck>} Outcome describing whether the user should update.
 */
export async function checkForUpdate(): Promise<UpdateCheck> {
  const baseUrl = process.env.EXPO_PUBLIC_API_URL;
  if (!baseUrl) return { status: 'unavailable' };

  const installedVersionCode = getInstalledVersionCode();
  if (installedVersionCode === null) return { status: 'unavailable' };

  try {
    const query = `platform=${Platform.OS}&currentVersionCode=${installedVersionCode}`;
    const response = await fetch(`${baseUrl}/app-version?${query}`);

    if (!response.ok) return { status: 'unavailable' };

    const info = (await response.json()) as AppUpdateInfo;
    if (typeof info?.latestVersionCode !== 'number' || !info?.downloadUrl) {
      return { status: 'unavailable' };
    }

    if (info.latestVersionCode <= installedVersionCode) {
      return { status: 'up-to-date' };
    }

    return info.forceUpdate ? { status: 'required', info } : { status: 'optional', info };
  } catch (error) {
    logger.warn('No se pudo consultar la version disponible', error);
    return { status: 'unavailable' };
  }
}
