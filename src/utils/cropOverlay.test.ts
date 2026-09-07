import { calculateOverlayCrop, cropPhotoToOverlay } from './cropOverlay';
import { ImageManipulator } from 'expo-image-manipulator';

jest.mock('expo-image-manipulator', () => {
  const mockCrop = jest.fn().mockReturnThis();
  const mockSaveAsync = jest.fn().mockResolvedValue({ uri: 'file:///cache/cropped.jpg' });
  const mockRenderAsync = jest.fn().mockResolvedValue({ saveAsync: mockSaveAsync });
  return {
    ImageManipulator: {
      manipulate: jest.fn().mockReturnValue({
        crop: mockCrop,
        renderAsync: mockRenderAsync,
      }),
    },
    SaveFormat: { JPEG: 'jpeg' },
  };
});

describe('calculateOverlayCrop', () => {
  it('calculates centered crop matching the overlay projected onto sensor pixels', () => {
    // Foto vertical 3000 x 4000 en pantalla 390 x 780
    // scale = max(390/3000 = 0.13, 780/4000 = 0.195) = 0.195
    // rawCropWidth = (260 / 0.195) * 1.15 = 1533
    // rawCropHeight = (320 / 0.195) * 1.15 = 1887
    const crop = calculateOverlayCrop(3000, 4000, 390, 780, 260, 320);

    expect(crop.width).toBeLessThan(3000);
    expect(crop.height).toBeLessThan(4000);
    expect(crop.originX).toBe(Math.round((3000 - crop.width) / 2));
    expect(crop.originY).toBe(Math.round((4000 - crop.height) / 2));
  });

  it('handles fallback when view dimensions are 0 (layout not ready)', () => {
    const crop = calculateOverlayCrop(2000, 2000, 0, 0);

    expect(crop.width).toBe(1500); // 75%
    expect(crop.height).toBe(1500);
    expect(crop.originX).toBe(250);
    expect(crop.originY).toBe(250);
  });

  it('keeps crop boundaries within the photo size', () => {
    // Overlay muy grande relativo a la pantalla
    const crop = calculateOverlayCrop(1000, 1000, 400, 400, 800, 800);

    expect(crop.originX).toBeGreaterThanOrEqual(0);
    expect(crop.originY).toBeGreaterThanOrEqual(0);
    expect(crop.originX + crop.width).toBeLessThanOrEqual(1000);
    expect(crop.originY + crop.height).toBeLessThanOrEqual(1000);
  });
});

describe('cropPhotoToOverlay', () => {
  it('crops the photo using ImageManipulator when overlay is smaller than photo', async () => {
    const croppedUri = await cropPhotoToOverlay('file:///photo.jpg', 3000, 4000, 400, 800);

    expect(ImageManipulator.manipulate).toHaveBeenCalledWith('file:///photo.jpg');
    expect(croppedUri).toBe('file:///cache/cropped.jpg');
  });

  it('skips manipulation if the crop covers the entire photo', async () => {
    // Si la foto ya es más pequeña que el marco guía, el crop cubre el 100% de la foto
    const sameUri = await cropPhotoToOverlay('file:///photo.jpg', 100, 100, 200, 200);

    expect(sameUri).toBe('file:///photo.jpg');
  });
});
