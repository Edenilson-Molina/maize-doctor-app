const mockDrawImageRectOptions = jest.fn();
const mockDispose = jest.fn();
const mockMakeImageFromEncoded = jest.fn();
const mockDataFromURI = jest.fn();
const mockMakeOffscreen = jest.fn();
const mockReadPixels = jest.fn();

jest.mock('@shopify/react-native-skia', () => ({
  Skia: {
    Data: { fromURI: (...a: unknown[]) => mockDataFromURI(...a) },
    Image: { MakeImageFromEncoded: (...a: unknown[]) => mockMakeImageFromEncoded(...a) },
    Surface: { MakeOffscreen: (...a: unknown[]) => mockMakeOffscreen(...a) },
    XYWHRect: (x: number, y: number, w: number, h: number) => ({ x, y, width: w, height: h }),
  },
  ColorType: { RGBA_8888: 4 },
  AlphaType: { Unpremul: 2 },
  FilterMode: { Linear: 1 },
  MipmapMode: { None: 0 },
}));

import { buildInputTensor } from './imageTensor';
import { preprocessImageWithSkia } from './preprocessImageSkia';
import { resizeBilinearAntialias } from './resample';

function patternPixels(width: number, height: number): Uint8Array {
  const px = new Uint8Array(width * height * 4);
  for (let i = 0; i < px.length; i++) px[i] = (i * 11) % 256;
  return px;
}

function fakeImage(width: number, height: number) {
  return {
    width: () => width,
    height: () => height,
    readPixels: mockReadPixels,
    dispose: mockDispose,
  };
}

describe('preprocessImageWithSkia', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDataFromURI.mockResolvedValue({ dispose: mockDispose });
    mockMakeImageFromEncoded.mockReturnValue(fakeImage(600, 400));
    mockReadPixels.mockImplementation(
      (_x: number, _y: number, info: { width: number; height: number }) =>
        patternPixels(info.width, info.height),
    );
    mockMakeOffscreen.mockImplementation((w: number, h: number) => ({
      getCanvas: () => ({ drawImageRectOptions: mockDrawImageRectOptions }),
      makeImageSnapshot: () => fakeImage(w, h),
      dispose: mockDispose,
    }));
  });

  it('decodes in memory and reads the photo as RGBA_8888 without a native resize', async () => {
    await preprocessImageWithSkia('file:///leaf.jpg', 224);

    expect(mockDataFromURI).toHaveBeenCalledWith('file:///leaf.jpg');
    expect(mockMakeOffscreen).not.toHaveBeenCalled();
    const info = mockReadPixels.mock.calls[0][2];
    expect(info).toMatchObject({ width: 600, height: 400, colorType: 4 });
  });

  it('resamples the final step with the Pillow-equivalent filter', async () => {
    const tensor = await preprocessImageWithSkia('file:///leaf.jpg', 224);

    const expected = buildInputTensor(
      resizeBilinearAntialias(patternPixels(600, 400), 600, 400, 224, 224),
      224,
    );
    expect(tensor).toEqual(expected);
    expect(tensor.length).toBe(3 * 224 * 224);
  });

  it('halves only the sides that reach four times the target', async () => {
    mockMakeImageFromEncoded.mockReturnValue(fakeImage(4000, 1000));

    await preprocessImageWithSkia('file:///leaf.jpg', 224);

    const sizes = mockDrawImageRectOptions.mock.calls.map((c) => [c[2].width, c[2].height]);
    expect(sizes).toEqual([
      [2000, 500],
      [1000, 500],
      [500, 500],
    ]);
    expect(mockReadPixels.mock.calls[0][2]).toMatchObject({ width: 500, height: 500 });
  });

  it('releases every native resource it allocates', async () => {
    mockMakeImageFromEncoded.mockReturnValue(fakeImage(1800, 1800));

    await preprocessImageWithSkia('file:///leaf.jpg', 224);

    expect(mockMakeOffscreen).toHaveBeenCalledTimes(2);
    expect(mockDispose).toHaveBeenCalledTimes(6);
  });

  it('throws a clear error when the file cannot be decoded', async () => {
    mockMakeImageFromEncoded.mockReturnValue(null);

    await expect(preprocessImageWithSkia('file:///broken.jpg', 224)).rejects.toThrow(
      /No se pudo decodificar/,
    );
  });

  it('throws when the pixels cannot be read and still releases resources', async () => {
    mockReadPixels.mockReturnValue(null);

    await expect(preprocessImageWithSkia('file:///leaf.jpg', 224)).rejects.toThrow(/pixeles/);
    expect(mockDispose).toHaveBeenCalledTimes(2);
  });
});
