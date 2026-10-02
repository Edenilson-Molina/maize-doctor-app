import * as Location from 'expo-location';
import { logger } from '@/lib/logger';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Attempts to retrieve the current GPS coordinates of the device.
 *
 * Checks/requests foreground permissions and queries the position with Balanced
 * accuracy and a timeout. If the current position query times out or fails, it falls back
 * to the last known position. Returns null if permissions are denied or GPS is unavailable.
 *
 * @param {number} [timeoutMs=3000] Maximum time to wait for a GPS lock.
 * @returns {Promise<Coordinates | null>}
 */
export async function getLocationCoordinates(timeoutMs: number = 3000): Promise<Coordinates | null> {
  try {
    let { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      const permissionResponse = await Location.requestForegroundPermissionsAsync();
      status = permissionResponse.status;
    }
    if (status !== 'granted') {
      return null;
    }

    let timerId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<null>((resolve) => {
      timerId = setTimeout(() => resolve(null), timeoutMs);
    });

    const positionPromise = Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const location = await Promise.race([positionPromise, timeoutPromise]);
    if (timerId) clearTimeout(timerId);

    if (location?.coords) {
      return {
        latitude: Number(location.coords.latitude.toFixed(6)),
        longitude: Number(location.coords.longitude.toFixed(6)),
      };
    }

    const lastKnown = await Location.getLastKnownPositionAsync();
    if (lastKnown?.coords) {
      return {
        latitude: Number(lastKnown.coords.latitude.toFixed(6)),
        longitude: Number(lastKnown.coords.longitude.toFixed(6)),
      };
    }
  } catch (error) {
    logger.warn('No se pudo obtener la geolocalización', error);
  }
  return null;
}

/**
 * Extracts coordinates from image EXIF metadata if available.
 *
 * Supports GPSLatitude/GPSLongitude numbers along with Ref direction flags (N/S, E/W).
 *
 * @param {Record<string, any> | null | undefined} exif EXIF dictionary from ImagePicker.
 * @returns {Coordinates | null}
 */
export function extractExifCoordinates(exif?: Record<string, any> | null): Coordinates | null {
  if (!exif) return null;

  const lat = exif.GPSLatitude ?? exif.latitude;
  const lon = exif.GPSLongitude ?? exif.longitude;

  if (typeof lat === 'number' && typeof lon === 'number' && !isNaN(lat) && !isNaN(lon)) {
    let finalLat = lat;
    let finalLon = lon;
    if (exif.GPSLatitudeRef === 'S' && finalLat > 0) finalLat = -finalLat;
    if (exif.GPSLongitudeRef === 'W' && finalLon > 0) finalLon = -finalLon;
    return {
      latitude: Number(finalLat.toFixed(6)),
      longitude: Number(finalLon.toFixed(6)),
    };
  }
  return null;
}
