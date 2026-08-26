import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useAppUpdate } from './useAppUpdate';
import { checkForUpdate } from '@/api/AppUpdateService';

jest.mock('@/api/AppUpdateService', () => ({ checkForUpdate: jest.fn() }));

const mockCheckForUpdate = checkForUpdate as jest.MockedFunction<typeof checkForUpdate>;

const info = {
  latestVersionCode: 9,
  latestVersionName: '1.2.0',
  minSupportedVersionCode: 4,
  forceUpdate: false,
  downloadUrl: 'https://releases.test/app-1.2.0.apk',
  releaseNotes: null,
};

describe('useAppUpdate', () => {
  beforeEach(() => {
    mockCheckForUpdate.mockReset();
  });

  it('stays hidden while the app is up to date', async () => {
    mockCheckForUpdate.mockResolvedValue({ status: 'up-to-date' });

    const { result } = await renderHook(() => useAppUpdate());

    await waitFor(() => expect(mockCheckForUpdate).toHaveBeenCalled());
    expect(result.current.visible).toBe(false);
    expect(result.current.info).toBeNull();
  });

  it('stays hidden when the check could not run', async () => {
    mockCheckForUpdate.mockResolvedValue({ status: 'unavailable' });

    const { result } = await renderHook(() => useAppUpdate());

    await waitFor(() => expect(mockCheckForUpdate).toHaveBeenCalled());
    expect(result.current.visible).toBe(false);
  });

  it('shows an optional update and lets it be dismissed', async () => {
    mockCheckForUpdate.mockResolvedValue({ status: 'optional', info });

    const { result } = await renderHook(() => useAppUpdate());

    await waitFor(() => expect(result.current.visible).toBe(true));
    expect(result.current.required).toBe(false);

    await act(async () => {
      result.current.dismiss();
    });

    expect(result.current.visible).toBe(false);
  });

  it('keeps a required update on screen after a dismiss attempt', async () => {
    mockCheckForUpdate.mockResolvedValue({ status: 'required', info });

    const { result } = await renderHook(() => useAppUpdate());

    await waitFor(() => expect(result.current.visible).toBe(true));
    expect(result.current.required).toBe(true);

    await act(async () => {
      result.current.dismiss();
    });

    expect(result.current.visible).toBe(true);
  });

  it('checks only once per launch', async () => {
    mockCheckForUpdate.mockResolvedValue({ status: 'up-to-date' });

    const { rerender } = await renderHook(() => useAppUpdate());
    await waitFor(() => expect(mockCheckForUpdate).toHaveBeenCalledTimes(1));

    await act(async () => {
      rerender({});
    });

    expect(mockCheckForUpdate).toHaveBeenCalledTimes(1);
  });
});
