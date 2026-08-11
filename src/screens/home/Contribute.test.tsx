import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Contribute } from './Contribute';

const mockLaunchCameraAsync = jest.fn();
const mockLaunchImageLibraryAsync = jest.fn().mockResolvedValue({ canceled: true, assets: [] });
const mockSavePhotoFile = jest
  .fn()
  .mockResolvedValue('file:///document/contributions/contribution_1.jpg');
const mockCreateDatasetContribution = jest.fn().mockResolvedValue(undefined);
const mockGetContributionCount = jest.fn().mockResolvedValue(0);

jest.mock('expo-image-picker', () => ({
  launchCameraAsync: (...args: unknown[]) => mockLaunchCameraAsync(...args),
  launchImageLibraryAsync: (...args: unknown[]) => mockLaunchImageLibraryAsync(...args),
}));

jest.mock('@/data/scanStorage', () => ({
  savePhotoFile: (...args: unknown[]) => mockSavePhotoFile(...args),
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
    mockGetContributionCount.mockResolvedValue(0);
    mockLaunchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: [] });
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
