import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { Contribute } from './Contribute';

const mockLaunchCameraAsync = jest.fn();
const mockLaunchImageLibraryAsync = jest.fn().mockResolvedValue({ canceled: true, assets: [] });
const mockSavePhotoFile = jest
  .fn()
  .mockResolvedValue('file:///document/contributions/contribution_1.jpg');
const mockCreateDatasetContribution = jest.fn().mockResolvedValue(undefined);
const mockGetContributionCount = jest.fn().mockResolvedValue(0);
const mockTrySyncNow = jest.fn();
const mockAlert = jest.fn();

jest.mock('expo-image-picker', () => ({
  launchCameraAsync: (...args: unknown[]) => mockLaunchCameraAsync(...args),
  launchImageLibraryAsync: (...args: unknown[]) => mockLaunchImageLibraryAsync(...args),
}));

jest.mock('@/data/scanStorage', () => ({
  savePhotoFile: (...args: unknown[]) => mockSavePhotoFile(...args),
}));

jest.mock('@/api/syncQueue', () => ({
  trySyncNow: () => mockTrySyncNow(),
}));

jest.mock('@/data/queries/datasetContributionQueries', () => ({
  createDatasetContribution: (data: unknown) => mockCreateDatasetContribution(data),
  getContributionCount: () => mockGetContributionCount(),
}));

function renderContribute() {
  const navigation = { goBack: jest.fn() };
  const route = { key: 'Contribute', name: 'Contribute' as const, params: undefined };
  return render(<Contribute route={route} navigation={navigation as never} />);
}

describe('Contribute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation((...args) => mockAlert(...args));
    mockGetContributionCount.mockResolvedValue(0);
    mockLaunchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: [] });
    mockTrySyncNow.mockResolvedValue({ status: 'synced', synced: 1, failed: 0 });
  });

  it('disables the submit button until a photo and a label are chosen', async () => {
    const { findByLabelText } = await renderContribute();

    const submitButton = await findByLabelText('Contribuir al Dataset');
    expect(submitButton.props.accessibilityState.disabled).toBe(true);
  });

  it('shows a real local contribution count instead of a fake global number', async () => {
    mockGetContributionCount.mockResolvedValue(3);
    const { findByText } = await renderContribute();

    expect(await findByText(/Ya contribuiste 3 imágenes desde este dispositivo\./)).toBeTruthy();
  });

  it('takes a photo, selects a label, and contributes to the dataset', async () => {
    mockLaunchCameraAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///cache/photo.jpg' }],
    });
    const { findByLabelText, findByText, getByLabelText } = await renderContribute();

    await fireEvent.press(getByLabelText('Tomar foto'));
    await waitFor(() => expect(mockLaunchCameraAsync).toHaveBeenCalled());

    await fireEvent.press(getByLabelText('Roya Comun'));

    const submitButton = await findByLabelText('Contribuir al Dataset');
    expect(submitButton.props.accessibilityState.disabled).toBe(false);

    await fireEvent.press(submitButton);

    await waitFor(() =>
      expect(mockSavePhotoFile).toHaveBeenCalledWith(
        'file:///cache/photo.jpg',
        'contributions',
        'contribution',
      ),
    );
    await waitFor(() =>
      expect(mockCreateDatasetContribution).toHaveBeenCalledWith({
        imageUri: 'file:///document/contributions/contribution_1.jpg',
        label: 'common_rust',
        note: null,
      }),
    );
    expect(await findByText('Impulsa la Agricultura del Futuro')).toBeTruthy();
  });
});

describe('Contribute sync feedback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation((...args) => mockAlert(...args));
    mockGetContributionCount.mockResolvedValue(0);
    mockSavePhotoFile.mockResolvedValue('file:///document/contributions/contribution_1.jpg');
    mockCreateDatasetContribution.mockResolvedValue(undefined);
    mockLaunchCameraAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///cache/photo.jpg' }],
    });
    mockTrySyncNow.mockResolvedValue({ status: 'synced', synced: 1, failed: 0 });
  });

  async function fillAndSubmit() {
    const utils = await renderContribute();
    const { findByLabelText, getByLabelText } = utils;

    await fireEvent.press(getByLabelText('Tomar foto'));
    await waitFor(() => expect(mockLaunchCameraAsync).toHaveBeenCalled());
    await fireEvent.press(getByLabelText('Roya Comun'));
    await fireEvent.press(await findByLabelText('Contribuir al Dataset'));

    return utils;
  }

  it('triggers a sync attempt after saving the contribution', async () => {
    await fillAndSubmit();

    await waitFor(() => expect(mockCreateDatasetContribution).toHaveBeenCalled());
    await waitFor(() => expect(mockTrySyncNow).toHaveBeenCalledTimes(1));
  });

  it('tells the user to sign in when there is no session', async () => {
    mockTrySyncNow.mockResolvedValue({ status: 'unauthenticated', synced: 0, failed: 0 });

    const utils = await fillAndSubmit();

    const { findByText } = utils;
    expect(await findByText('Guardado en el dispositivo')).toBeTruthy();
    expect(await findByText(/Inicia sesión desde tu perfil/)).toBeTruthy();
  });

  it('still saves locally when the sync attempt throws', async () => {
    mockTrySyncNow.mockRejectedValue(new Error('boom'));

    await fillAndSubmit();

    await waitFor(() => expect(mockCreateDatasetContribution).toHaveBeenCalled());
    await waitFor(() => expect(mockTrySyncNow).toHaveBeenCalled());
  });
});
