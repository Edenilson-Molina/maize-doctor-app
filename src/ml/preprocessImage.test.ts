import { buildInputTensor } from './imageTensor';

const mockDecodedPixels = new Uint8Array([
  10, 20, 30, 255,
  40, 50, 60, 255,
  70, 80, 90, 255,
  100, 110, 120, 255,
]);

jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation((uri: string) => ({
    bytes: jest.fn().mockResolvedValue(
      uri === 'file://original.jpg'
        ? new Uint8Array([0xff, 0xd8, 0xff, 0xd9]) // JPEG sin EXIF -> orientacion 1
        : new Uint8Array([1, 2, 3]), // contenido del archivo redimensionado; jpeg-js esta mockeado abajo
    ),
  })),
}));

jest.mock('expo-image-manipulator', () => {
  const context = {
    rotate: jest.fn(() => context),
    resize: jest.fn(() => context),
    renderAsync: jest.fn().mockResolvedValue({
      saveAsync: jest.fn().mockResolvedValue({ uri: 'file://resized.jpg' }),
    }),
  };
  return {
    SaveFormat: { JPEG: 'jpeg' },
    ImageManipulator: { manipulate: jest.fn(() => context) },
  };
});

jest.mock('jpeg-js', () => ({
  decode: jest.fn(() => ({ width: 2, height: 2, data: mockDecodedPixels })),
}));

import { preprocessImage } from './preprocessImage';
import { ImageManipulator } from 'expo-image-manipulator';

describe('preprocessImage', () => {
  it('decodifica la imagen redimensionada y produce el mismo tensor que buildInputTensor', async () => {
    const tensor = await preprocessImage('file://original.jpg', 2);
    expect(tensor).toEqual(buildInputTensor(mockDecodedPixels, 2));
  });

  it('redimensiona estirando a size x size (sin preservar aspecto)', async () => {
    await preprocessImage('file://original.jpg', 2);
    const context = (ImageManipulator.manipulate as jest.Mock).mock.results[0].value;
    expect(context.resize).toHaveBeenCalledWith({ width: 2, height: 2 });
  });

  it('no llama a rotate cuando la orientacion EXIF es 1 (sin corregir)', async () => {
    await preprocessImage('file://original.jpg', 2);
    const context = (ImageManipulator.manipulate as jest.Mock).mock.results[0].value;
    expect(context.rotate).not.toHaveBeenCalled();
  });
});
