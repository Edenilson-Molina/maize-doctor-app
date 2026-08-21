const mockReadPixels = jest.fn();
const mockDrawImageRectOptions = jest.fn();
const mockMakeImageSnapshot = jest.fn();
const mockDispose = jest.fn();
const mockMakeImageFromEncoded = jest.fn();
const mockDataFromURI = jest.fn();
const mockMakeOffscreen = jest.fn();

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

import { preprocessImageWithSkia } from './preprocessImageSkia';

const SIZE = 2;

function buildPixels(size: number): Uint8Array {
  const px = new Uint8Array(size * size * 4);
  for (let i = 0; i < px.length; i++) px[i] = (i * 11) % 256;
  return px;
}

describe('preprocessImageWithSkia', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDataFromURI.mockResolvedValue({ dispose: mockDispose });
    mockMakeImageFromEncoded.mockReturnValue({
      width: () => 400,
      height: () => 300,
      dispose: mockDispose,
    });
    mockReadPixels.mockReturnValue(buildPixels(SIZE));
    mockMakeImageSnapshot.mockReturnValue({ readPixels: mockReadPixels, dispose: mockDispose });
    mockMakeOffscreen.mockReturnValue({
      getCanvas: () => ({ drawImageRectOptions: mockDrawImageRectOptions }),
      makeImageSnapshot: mockMakeImageSnapshot,
      dispose: mockDispose,
    });
  });

  it('decodes and scales natively without writing an intermediate file', async () => {
    await preprocessImageWithSkia('file:///leaf.jpg', SIZE);

    expect(mockDataFromURI).toHaveBeenCalledWith('file:///leaf.jpg');
    expect(mockMakeOffscreen).toHaveBeenCalledWith(SIZE, SIZE);
    expect(mockDrawImageRectOptions).toHaveBeenCalled();
  });

  it('reads pixels as RGBA_8888, matching the tensor builder', async () => {
    await preprocessImageWithSkia('file:///leaf.jpg', SIZE);

    const info = mockReadPixels.mock.calls[0][2];
    expect(info.colorType).toBe(4);
    expect(info.width).toBe(SIZE);
    expect(info.height).toBe(SIZE);
  });

  it('produces the NCHW tensor the model expects', async () => {
    const tensor = await preprocessImageWithSkia('file:///leaf.jpg', SIZE);

    expect(tensor).toBeInstanceOf(Float32Array);
    expect(tensor.length).toBe(3 * SIZE * SIZE);
  });

  it('stretches the source to a square, matching the training pipeline', async () => {
    await preprocessImageWithSkia('file:///leaf.jpg', SIZE);

    const [src, dst] = mockDrawImageRectOptions.mock.calls[0].slice(1);
    expect(src).toEqual({ x: 0, y: 0, width: 400, height: 300 });
    expect(dst).toEqual({ x: 0, y: 0, width: SIZE, height: SIZE });
  });

  it('releases every native resource it allocates', async () => {
    await preprocessImageWithSkia('file:///leaf.jpg', SIZE);

    // data + image + snapshot + surface
    expect(mockDispose).toHaveBeenCalledTimes(4);
  });

  it('throws a clear error when the file cannot be decoded', async () => {
    mockMakeImageFromEncoded.mockReturnValue(null);

    await expect(preprocessImageWithSkia('file:///broken.jpg', SIZE)).rejects.toThrow(
      /No se pudo decodificar/
    );
  });
});
