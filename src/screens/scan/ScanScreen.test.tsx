import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text, View } from 'react-native';
import { ScanScreen } from './ScanScreen';
import type { ScanStackParamList } from '@/navigation/types';
import { clearMetrics, getMetrics } from '@/lib/metrics';

const mockRequestPermission = jest.fn();
let mockPermission: { granted: boolean } | null = { granted: true };
const mockTakePictureAsync = jest
  .fn()
  .mockResolvedValue({ uri: 'file:///cache/photo.jpg', width: 3000, height: 4000 });

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

const mockCropPhotoToOverlay = jest.fn().mockImplementation((uri) => Promise.resolve(uri));
jest.mock('@/utils/cropOverlay', () => ({
  cropPhotoToOverlay: (...args: unknown[]) => mockCropPhotoToOverlay(...args),
}));

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: true, assets: [] }),
}));

const mockSavePhotoFile = jest.fn().mockResolvedValue('file:///document/scans/scan_abc.jpg');

jest.mock('@/data/scanStorage', () => ({
  savePhotoFile: (...args: unknown[]) => mockSavePhotoFile(...args),
}));

const mockCreateScan = jest.fn().mockResolvedValue({ id: 'scan-1' });
const mockUpdateScanResult = jest.fn().mockResolvedValue(undefined);

jest.mock('@/data/queries/scanQueries', () => ({
  createScan: (...args: unknown[]) => mockCreateScan(...args),
  updateScanResult: (...args: unknown[]) => mockUpdateScanResult(...args),
}));

const mockPredict = jest.fn().mockResolvedValue({
  label: 'common_rust',
  confidence: 0.82,
  distribution: { common_rust: 0.82, healthy: 0.18 },
  isUnrecognized: false,
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
      isUnrecognized: false,
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
        label: 'common_rust',
        confidence: 0.82,
        distribution: { common_rust: 0.82, healthy: 0.18 },
        lat: 13.69,
        lon: -89.19,
      }),
    );
    await waitFor(() =>
      expect(mockUpdateScanResult).toHaveBeenCalledWith(
        { id: 'scan-1' },
        {
          label: 'common_rust',
          confidence: 0.82,
          distribution: { common_rust: 0.82, healthy: 0.18 },
          isUnrecognized: false,
        },
        'file:///document/scans/scan_abc.jpg',
      ),
    );

    expect(await findByText('ScanResult: common_rust')).toBeTruthy();
  });

  it('does not create a record or save the photo when the photo is rejected', async () => {
    mockPredict.mockResolvedValueOnce({
      label: 'common_rust',
      confidence: 0.41,
      distribution: { common_rust: 0.41, healthy: 0.35 },
      isUnrecognized: true,
    });
    const { getByLabelText, findByText } = await renderScanScreen();

    fireEvent.press(getByLabelText('Tomar foto'));

    expect(await findByText('ScanResult: common_rust')).toBeTruthy();
    expect(mockCreateScan).not.toHaveBeenCalled();
    expect(mockSavePhotoFile).not.toHaveBeenCalled();
    expect(mockUpdateScanResult).not.toHaveBeenCalled();
  });

  it('picks a photo from gallery with EXIF coordinates and runs inference', async () => {
    const ImagePicker = require('expo-image-picker');
    ImagePicker.launchImageLibraryAsync.mockResolvedValueOnce({
      canceled: false,
      assets: [
        {
          uri: 'file:///gallery/leaf.jpg',
          exif: {
            GPSLatitude: 13.75,
            GPSLongitude: 89.25,
            GPSLatitudeRef: 'N',
            GPSLongitudeRef: 'W',
          },
        },
      ],
    });

    const { getByLabelText, findByText } = await renderScanScreen();
    fireEvent.press(getByLabelText('Elegir de galería'));

    await waitFor(() =>
      expect(mockCreateScan).toHaveBeenCalledWith({
        imageUri: 'file:///gallery/leaf.jpg',
        label: 'common_rust',
        confidence: 0.82,
        distribution: { common_rust: 0.82, healthy: 0.18 },
        lat: 13.75,
        lon: -89.25,
      }),
    );
    expect(await findByText('ScanResult: common_rust')).toBeTruthy();
  });

  it('attaches temperature and humidity to scan when live weather is available', async () => {
    const weatherService = require('@/services/weather/weatherService');
    jest.spyOn(weatherService, 'getLatestWeather').mockReturnValueOnce({
      temperature: 27,
      humidity: 75,
      windSpeed: 8,
      soilStatus: 'Adecuada',
      timestamp: Date.now(),
      source: 'live',
    });

    const { getByLabelText } = await renderScanScreen();
    fireEvent.press(getByLabelText('Tomar foto'));

    await waitFor(() =>
      expect(mockCreateScan).toHaveBeenCalledWith(
        expect.objectContaining({
          imageUri: 'file:///cache/photo.jpg',
          temperature: 27,
          humidity: 75,
        })
      )
    );
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
      isUnrecognized: false,
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
    mockSavePhotoFile.mockResolvedValue('file:///document/scans/scan_1.jpg');
    mockPredict.mockResolvedValue({
      label: 'common_rust',
      confidence: 0.82,
      distribution: { common_rust: 0.82, healthy: 0.18 },
      isUnrecognized: false,
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

    fireEvent.press(getByLabelText('Tomar foto'));

    await waitFor(() => expect(mockPredict).toHaveBeenCalled());
    expect(mockSavePhotoFile).toHaveBeenCalled();

    releaseSave('file:///document/scans/scan_1.jpg');
    await waitFor(() => expect(mockUpdateScanResult).toHaveBeenCalled());
  });

  it('persists the stored image and the result in a single write', async () => {
    const { getByLabelText } = await renderScanScreen();

    fireEvent.press(getByLabelText('Tomar foto'));

    await waitFor(() =>
      expect(mockUpdateScanResult).toHaveBeenCalledWith(
        { id: 'scan-1' },
        expect.objectContaining({ label: 'common_rust' }),
        'file:///document/scans/scan_1.jpg'
      )
    );
  });

  it('keeps the diagnosis and the camera URI when storing the photo fails', async () => {
    mockSavePhotoFile.mockRejectedValue(new Error('disk full'));
    const { getByLabelText, findByText } = await renderScanScreen();

    fireEvent.press(getByLabelText('Tomar foto'));

    expect(await findByText('ScanResult: common_rust')).toBeTruthy();
    // The record was created with its result, so nothing needs updating when the save fails.
    expect(mockCreateScan).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'common_rust', imageUri: 'file:///cache/photo.jpg' }),
    );
    expect(mockUpdateScanResult).not.toHaveBeenCalled();
  });
});
