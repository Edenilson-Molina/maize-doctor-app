import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text, View } from 'react-native';
import { ScanScreen } from './ScanScreen';
import type { ScanStackParamList } from '@/navigation/types';
import { clearMetrics, getMetrics } from '@/lib/metrics';

const mockRequestPermission = jest.fn();
let mockPermission: { granted: boolean } | null = { granted: true };
const mockTakePictureAsync = jest.fn().mockResolvedValue({ uri: 'file:///cache/photo.jpg' });

jest.mock('expo-camera', () => {
  const { View: RNView } = require('react-native');
  const React = require('react');
  return {
    CameraView: React.forwardRef((props: { children?: React.ReactNode }, ref: unknown) => {
      React.useImperativeHandle(ref, () => ({ takePictureAsync: mockTakePictureAsync }));
      return <RNView>{props.children}</RNView>;
    }),
    useCameraPermissions: () => [mockPermission, mockRequestPermission],
  };
});

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: true, assets: [] }),
}));

const mockSavePhotoFile = jest.fn().mockResolvedValue('file:///document/scans/scan_abc.jpg');

jest.mock('@/data/scanStorage', () => ({
  savePhotoFile: (...args: unknown[]) => mockSavePhotoFile(...args),
}));

const mockCreateScan = jest.fn().mockResolvedValue({ id: 'scan-1' });
const mockUpdateScanResult = jest.fn().mockResolvedValue(undefined);
const mockUpdateScanImageUri = jest.fn().mockResolvedValue(undefined);

jest.mock('@/data/queries/scanQueries', () => ({
  createScan: (...args: unknown[]) => mockCreateScan(...args),
  updateScanResult: (...args: unknown[]) => mockUpdateScanResult(...args),
  updateScanImageUri: (...args: unknown[]) => mockUpdateScanImageUri(...args),
}));

const mockPredict = jest.fn().mockResolvedValue({
  label: 'common_rust',
  confidence: 0.82,
  distribution: { common_rust: 0.82, healthy: 0.18 },
});

jest.mock('@/ml', () => ({
  getInferenceEngine: () => ({
    predict: mockPredict,
  }),
}));

jest.mock('./LeafOverlay', () => {
  const { View: RNView } = require('react-native');
  return { LeafOverlay: () => <RNView testID="leaf-overlay" /> };
});

const Stack = createNativeStackNavigator<ScanStackParamList>();

async function renderScanScreen() {
  return render(
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="ScanCamera" component={ScanScreen} />
        <Stack.Screen name="ScanResult">
          {({ route }) => (
            <View>
              <Text>ScanResult: {route.params.label}</Text>
            </View>
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>,
  );
}

describe('ScanScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPermission = { granted: true };
    mockPredict.mockReset().mockResolvedValue({
      label: 'common_rust',
      confidence: 0.82,
      distribution: { common_rust: 0.82, healthy: 0.18 },
    });
  });

  it('shows a permission request when access is denied', async () => {
    mockPermission = { granted: false };
    const { getByText } = await renderScanScreen();

    fireEvent.press(getByText('Permitir acceso a la cámara'));

    expect(mockRequestPermission).toHaveBeenCalled();
  });

  it('renders the camera shutter when permission is granted', async () => {
    const { queryByText } = await renderScanScreen();

    expect(queryByText('Permitir acceso a la cámara')).toBeNull();
  });

  it('captures a photo, saves it, runs inference, and navigates to ScanResult', async () => {
    const { getByLabelText, findByText } = await renderScanScreen();

    fireEvent.press(getByLabelText('Tomar foto'));

    await waitFor(() => expect(mockTakePictureAsync).toHaveBeenCalled());
    await waitFor(() => expect(mockSavePhotoFile).toHaveBeenCalledWith('file:///cache/photo.jpg'));
    // The record is created against the camera URI and repointed once the background
    // save lands, so inference does not wait on storage.
    await waitFor(() =>
      expect(mockCreateScan).toHaveBeenCalledWith({
        imageUri: 'file:///cache/photo.jpg',
        label: null,
      }),
    );
    await waitFor(() =>
      expect(mockUpdateScanResult).toHaveBeenCalledWith(
        { id: 'scan-1' },
        {
          label: 'common_rust',
          confidence: 0.82,
          distribution: { common_rust: 0.82, healthy: 0.18 },
        },
      ),
    );

    expect(await findByText('ScanResult: common_rust')).toBeTruthy();
  });

  it('shows an inline error and stops the spinner when inference fails, without navigating', async () => {
    mockPredict.mockRejectedValueOnce(new Error('modelo no disponible'));
    const { getByLabelText, findByText, queryByText } = await renderScanScreen();

    fireEvent.press(getByLabelText('Tomar foto'));

    expect(await findByText('No se pudo analizar la foto. Intente de nuevo.')).toBeTruthy();
    expect(queryByText(/ScanResult:/)).toBeNull();
  });
});

describe('ScanScreen pipeline metrics', () => {
  beforeEach(() => {
    clearMetrics();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    mockPredict.mockResolvedValue({
      label: 'common_rust',
      confidence: 0.82,
      distribution: { common_rust: 0.82, healthy: 0.18 },
    });
  });

  it('records the full pipeline as a single measurement', async () => {
    const { getByLabelText } = await renderScanScreen();

    await fireEvent.press(getByLabelText('Tomar foto'));

    await waitFor(() => expect(mockPredict).toHaveBeenCalled());
    await waitFor(() => expect(getMetrics().some((m) => m.stage === 'pipeline')).toBe(true));
  });

  it('marks the pipeline measurement as failed when inference throws', async () => {
    mockPredict.mockRejectedValue(new Error('boom'));
    const { getByLabelText } = await renderScanScreen();

    await fireEvent.press(getByLabelText('Tomar foto'));

    await waitFor(() => {
      const pipeline = getMetrics().find((m) => m.stage === 'pipeline');
      expect(pipeline?.failed).toBe(true);
    });
  });
});

describe('ScanScreen background photo save', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearMetrics();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    mockCreateScan.mockResolvedValue({ id: 'scan-1' });
    mockUpdateScanResult.mockResolvedValue(undefined);
    mockUpdateScanImageUri.mockResolvedValue(undefined);
    mockSavePhotoFile.mockResolvedValue('file:///document/scans/scan_1.jpg');
    mockPredict.mockResolvedValue({
      label: 'common_rust',
      confidence: 0.82,
      distribution: { common_rust: 0.82, healthy: 0.18 },
    });
  });

  it('runs inference without waiting for the photo to be stored', async () => {
    let releaseSave: (uri: string) => void = () => {};
    mockSavePhotoFile.mockReturnValue(
      new Promise<string>((resolve) => {
        releaseSave = resolve;
      })
    );
    const { getByLabelText } = await renderScanScreen();

    // Not awaited: the pipeline intentionally keeps a pending save in flight, so the
    // press only settles after it is released below.
    fireEvent.press(getByLabelText('Tomar foto'));

    // Inference must have run even though the save is still pending.
    await waitFor(() => expect(mockPredict).toHaveBeenCalled());
    expect(mockSavePhotoFile).toHaveBeenCalled();

    releaseSave('file:///document/scans/scan_1.jpg');
    await waitFor(() => expect(mockUpdateScanImageUri).toHaveBeenCalled());
  });

  it('repoints the scan at the stored image once the save finishes', async () => {
    const { getByLabelText } = await renderScanScreen();

    await fireEvent.press(getByLabelText('Tomar foto'));

    await waitFor(() =>
      expect(mockUpdateScanImageUri).toHaveBeenCalledWith(
        { id: 'scan-1' },
        'file:///document/scans/scan_1.jpg'
      )
    );
  });

  it('still shows the diagnosis when storing the photo fails', async () => {
    mockSavePhotoFile.mockRejectedValue(new Error('disk full'));
    const { getByLabelText } = await renderScanScreen();

    await fireEvent.press(getByLabelText('Tomar foto'));

    await waitFor(() => expect(mockPredict).toHaveBeenCalled());
    await waitFor(() => expect(mockUpdateScanResult).toHaveBeenCalled());
  });

  it('does not leave the scan pointing at a missing file when the save fails', async () => {
    mockSavePhotoFile.mockRejectedValue(new Error('disk full'));
    const { getByLabelText } = await renderScanScreen();

    await fireEvent.press(getByLabelText('Tomar foto'));

    await waitFor(() => expect(mockPredict).toHaveBeenCalled());
    expect(mockUpdateScanImageUri).not.toHaveBeenCalled();
  });
});
