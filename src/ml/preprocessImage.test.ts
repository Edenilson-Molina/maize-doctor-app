import { buildInputTensor } from './imageTensor';

const mockDecodedPixels = new Uint8Array([
  10, 20, 30, 255, 40, 50, 60, 255, 70, 80, 90, 255, 100, 110, 120, 255,
]);

/**
 * Construye un JPEG minimo (sin datos de imagen reales) con un segmento
 * APP1/EXIF que declara la orientacion indicada, para ejercitar `readExifOrientation`
 * con bytes reales en lugar de mockear su resultado. Misma tecnica que en `exifOrientation.test.ts`.
 */
function mockBuildJpegWithOrientation(orientation: number): Uint8Array {
  const exifHeader = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"
  const tiffHeader = [0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00]; // "II", 42, IFD@8
  const ifdCount = [0x01, 0x00]; // 1 entry
  const orientationEntry = [
    0x12,
    0x01, // tag 0x0112 (Orientation)
    0x03,
    0x00, // type 3 (SHORT)
    0x01,
    0x00,
    0x00,
    0x00, // count 1
    orientation,
    0x00,
    0x00,
    0x00, // value
  ];
  const nextIfdOffset = [0x00, 0x00, 0x00, 0x00];
  const payload = [
    ...exifHeader,
    ...tiffHeader,
    ...ifdCount,
    ...orientationEntry,
    ...nextIfdOffset,
  ];
  const app1Length = payload.length + 2;

  return new Uint8Array([
    0xff,
    0xd8, // SOI
    0xff,
    0xe1,
    (app1Length >> 8) & 0xff,
    app1Length & 0xff, // APP1 marker + length
    ...payload,
  ]);
}

const mockBytes = jest.fn();
const mockReadBytes = jest.fn();
const mockHandleClose = jest.fn();

function mockContentFor(uri: string): Uint8Array {
  return uri === 'file://rotated.jpg'
    ? mockBuildJpegWithOrientation(6)
    : uri === 'file://original.jpg'
      ? new Uint8Array([0xff, 0xd8, 0xff, 0xd9]) // JPEG sin EXIF -> orientacion 1
      : new Uint8Array([1, 2, 3]); // archivo redimensionado; jpeg-js esta mockeado abajo
}

jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation((uri: string) => ({
    bytes: jest.fn((...args: unknown[]) => {
      mockBytes(uri, ...args);
      return Promise.resolve(mockContentFor(uri));
    }),
    open: jest.fn(() => ({
      readBytes: (length: number) => {
        mockReadBytes(uri, length);
        return mockContentFor(uri).slice(0, length);
      },
      close: mockHandleClose,
    })),
  })),
}));

interface MockManipulatorContext {
  rotate: jest.Mock;
  resize: jest.Mock;
  renderAsync: jest.Mock;
}

jest.mock('expo-image-manipulator', () => {
  const context: MockManipulatorContext = {
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

  it('llama a rotate con 90 grados cuando la orientacion EXIF es 6', async () => {
    await preprocessImage('file://rotated.jpg', 2);
    const context = (ImageManipulator.manipulate as jest.Mock).mock.results[0].value;
    expect(context.rotate).toHaveBeenCalledWith(90);
  });
});

describe('preprocessImage IO efficiency', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reads only the JPEG header for EXIF instead of the whole file', async () => {
    await preprocessImage('file://rotated.jpg', 2);

    expect(mockReadBytes).toHaveBeenCalled();
    const [, length] = mockReadBytes.mock.calls[0];
    expect(length).toBeLessThanOrEqual(65536);
    expect(mockBytes).not.toHaveBeenCalledWith('file://rotated.jpg');
  });

  it('closes the file handle after reading the header', async () => {
    await preprocessImage('file://rotated.jpg', 2);

    expect(mockHandleClose).toHaveBeenCalled();
  });

  it('still detects the EXIF rotation from the partial read', async () => {
    const context = (ImageManipulator.manipulate as jest.Mock)();
    (context.rotate as jest.Mock).mockClear();

    await preprocessImage('file://rotated.jpg', 2);

    expect(context.rotate).toHaveBeenCalledWith(90);
  });

  it('does not waste time on lossless compression for the throwaway intermediate', async () => {
    const context = (ImageManipulator.manipulate as jest.Mock)();
    const rendered = await (context.renderAsync as jest.Mock)();

    await preprocessImage('file://original.jpg', 2);

    const saveArgs = (rendered.saveAsync as jest.Mock).mock.calls.at(-1)?.[0];
    expect(saveArgs.compress).toBeLessThan(1);
  });
});
