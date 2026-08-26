import { Platform } from 'react-native';
import { checkForUpdate, getInstalledVersionCode } from './AppUpdateService';

jest.mock('expo-application', () => ({ nativeBuildVersion: '5' }));

import * as Application from 'expo-application';

/**
 * Rewrites the read-only `nativeBuildVersion` the native module exposes.
 *
 * @param {string|null} value Version code the installed build should report.
 */
function setInstalledVersion(value: string | null): void {
  Object.defineProperty(Application, 'nativeBuildVersion', {
    value,
    configurable: true,
  });
}

function respondWith(body: unknown, ok = true, status = 200) {
  return jest.fn().mockResolvedValue({ ok, status, json: async () => body });
}

const release = {
  latestVersionCode: 9,
  latestVersionName: '1.2.0',
  minSupportedVersionCode: 4,
  forceUpdate: false,
  downloadUrl: 'https://releases.test/app-1.2.0.apk',
  releaseNotes: 'Correcciones',
};

describe('AppUpdateService', () => {
  const originalApiUrl = process.env.EXPO_PUBLIC_API_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    setInstalledVersion('5');
    process.env.EXPO_PUBLIC_API_URL = 'https://api.doctormaiz.test';
  });

  afterAll(() => {
    process.env.EXPO_PUBLIC_API_URL = originalApiUrl;
  });

  it('reads the installed version code as a number', () => {
    expect(getInstalledVersionCode()).toBe(5);
  });

  it('reports no version code when the platform exposes none', () => {
    setInstalledVersion(null);
    expect(getInstalledVersionCode()).toBeNull();
  });

  it('asks the backend for this platform and installed version', async () => {
    global.fetch = respondWith(release) as never;

    await checkForUpdate();

    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe(
      `https://api.doctormaiz.test/app-version?platform=${Platform.OS}&currentVersionCode=5`
    );
  });

  it('flags an optional update when a newer release exists', async () => {
    global.fetch = respondWith(release) as never;

    const result = await checkForUpdate();

    expect(result).toEqual({ status: 'optional', info: release });
  });

  it('flags a required update when the server forces it', async () => {
    const forced = { ...release, forceUpdate: true };
    global.fetch = respondWith(forced) as never;

    const result = await checkForUpdate();

    expect(result).toEqual({ status: 'required', info: forced });
  });

  it('reports up-to-date when the installed build is the latest', async () => {
    global.fetch = respondWith({ ...release, latestVersionCode: 5 }) as never;

    expect(await checkForUpdate()).toEqual({ status: 'up-to-date' });
  });

  it('ignores a release that is older than the installed build', async () => {
    global.fetch = respondWith({ ...release, latestVersionCode: 2, forceUpdate: true }) as never;

    expect(await checkForUpdate()).toEqual({ status: 'up-to-date' });
  });

  it('stays quiet when no release is published yet', async () => {
    global.fetch = respondWith({ detail: 'No release found for platform' }, false, 404) as never;

    expect(await checkForUpdate()).toEqual({ status: 'unavailable' });
  });

  it('stays quiet when the device is offline', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network request failed')) as never;

    expect(await checkForUpdate()).toEqual({ status: 'unavailable' });
  });

  it('stays quiet when the payload is malformed', async () => {
    global.fetch = respondWith({ latestVersionCode: 'nine' }) as never;

    expect(await checkForUpdate()).toEqual({ status: 'unavailable' });
  });

  it('stays quiet when the version code cannot be read', async () => {
    setInstalledVersion(null);
    global.fetch = respondWith(release) as never;

    expect(await checkForUpdate()).toEqual({ status: 'unavailable' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('does not call the backend when none is configured', async () => {
    process.env.EXPO_PUBLIC_API_URL = '';
    global.fetch = respondWith(release) as never;

    expect(await checkForUpdate()).toEqual({ status: 'unavailable' });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
