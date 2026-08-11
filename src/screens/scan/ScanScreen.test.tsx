import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ScanScreen } from './ScanScreen';

const mockRequestPermission = jest.fn();
let mockPermission: { granted: boolean } | null = { granted: true };
const mockTakePictureAsync = jest.fn().mockResolvedValue({ uri: 'file:///cache/photo.jpg' });

jest.mock('expo-camera', () => {
  const { View } = require('react-native');
  const React = require('react');
  return {
    CameraView: React.forwardRef((props: { children?: React.ReactNode }, ref: unknown) => {
      React.useImperativeHandle(ref, () => ({ takePictureAsync: mockTakePictureAsync }));
      return <View>{props.children}</View>;
    }),
    useCameraPermissions: () => [mockPermission, mockRequestPermission],
  };
});

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: true, assets: [] }),
}));

jest.mock('@/data/scanStorage', () => ({
  savePhotoFile: jest.fn().mockResolvedValue('file:///document/scans/scan_abc.jpg'),
}));

jest.mock('@/data/queries/scanQueries', () => ({
  createScan: jest.fn().mockResolvedValue({ id: 'scan-1' }),
}));

jest.mock('./LeafOverlay', () => {
  const { View } = require('react-native');
  return { LeafOverlay: () => <View testID="leaf-overlay" /> };
});

describe('ScanScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPermission = { granted: true };
  });

  it('shows a permission request when access is denied', async () => {
    mockPermission = { granted: false };
    const { getByText } = await render(<ScanScreen />);

    fireEvent.press(getByText('Permitir acceso a la cámara'));

    expect(mockRequestPermission).toHaveBeenCalled();
  });

  it('renders the camera shutter when permission is granted', async () => {
    const { queryByText } = await render(<ScanScreen />);

    expect(queryByText('Permitir acceso a la cámara')).toBeNull();
  });

  it('captures a photo, saves the file and creates a scan record', async () => {
    const { savePhotoFile } = require('@/data/scanStorage');
    const { createScan } = require('@/data/queries/scanQueries');
    const { getByLabelText, unmount } = await render(<ScanScreen />);
    fireEvent.press(getByLabelText('Tomar foto'));

    await waitFor(() => expect(mockTakePictureAsync).toHaveBeenCalled());
    await waitFor(() => expect(savePhotoFile).toHaveBeenCalledWith('file:///cache/photo.jpg'));
    await waitFor(() =>
      expect(createScan).toHaveBeenCalledWith({
        imageUri: 'file:///document/scans/scan_abc.jpg',
        label: null,
      }),
    );

    await unmount();
  });
});
