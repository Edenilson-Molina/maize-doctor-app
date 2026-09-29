import * as Location from 'expo-location';
import { getLocationCoordinates, extractExifCoordinates } from './location';

describe('extractExifCoordinates', () => {
  it('returns null when exif is undefined or null', () => {
    expect(extractExifCoordinates(null)).toBeNull();
    expect(extractExifCoordinates(undefined)).toBeNull();
  });

  it('extracts positive latitude and longitude correctly', () => {
    const exif = {
      GPSLatitude: 13.692341,
      GPSLongitude: 89.192341,
      GPSLatitudeRef: 'N',
      GPSLongitudeRef: 'E',
    };
    expect(extractExifCoordinates(exif)).toEqual({
      latitude: 13.692341,
      longitude: 89.192341,
    });
  });

  it('applies negative sign for South and West references', () => {
    const exif = {
      GPSLatitude: 13.692341,
      GPSLongitude: 89.192341,
      GPSLatitudeRef: 'S',
      GPSLongitudeRef: 'W',
    };
    expect(extractExifCoordinates(exif)).toEqual({
      latitude: -13.692341,
      longitude: -89.192341,
    });
  });

  it('returns null if coordinates are not numbers', () => {
    expect(extractExifCoordinates({ GPSLatitude: 'invalid', GPSLongitude: 89.19 })).toBeNull();
  });
});

describe('getLocationCoordinates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns coordinates when permission is granted and current position is obtained', async () => {
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'granted' });
    (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValueOnce({
      coords: { latitude: 13.701234, longitude: -89.201234 },
    });

    const coords = await getLocationCoordinates(1000);
    expect(coords).toEqual({
      latitude: 13.701234,
      longitude: -89.201234,
    });
  });

  it('requests permission if not granted initially and returns coords if accepted', async () => {
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'undetermined' });
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'granted' });
    (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValueOnce({
      coords: { latitude: 14.123456, longitude: -88.987654 },
    });

    const coords = await getLocationCoordinates(1000);
    expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled();
    expect(coords).toEqual({
      latitude: 14.123456,
      longitude: -88.987654,
    });
  });

  it('returns null if permission is denied', async () => {
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'denied' });
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'denied' });

    const coords = await getLocationCoordinates(1000);
    expect(coords).toBeNull();
  });

  it('falls back to last known position if current position times out or returns null', async () => {
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'granted' });
    // Simulate timeout by resolving current position after 100ms when timeout is 20ms
    (Location.getCurrentPositionAsync as jest.Mock).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ coords: { latitude: 1, longitude: 1 } }), 100))
    );
    (Location.getLastKnownPositionAsync as jest.Mock).mockResolvedValueOnce({
      coords: { latitude: 13.68, longitude: -89.18 },
    });

    const coords = await getLocationCoordinates(20);
    expect(coords).toEqual({
      latitude: 13.68,
      longitude: -89.18,
    });
  });
});
