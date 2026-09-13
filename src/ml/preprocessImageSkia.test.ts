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
    mockMakeOffscreen.mockImplementation((w: number, h: number) => ({
      getCanvas: () => ({ drawImageRectOptions: mockDrawImageRectOptions }),
      makeImageSnapshot: () =>
        mockMakeImageSnapshot({
          width: () => w,
          height: () => h,
          readPixels: mockReadPixels,
          dispose: mockDispose,
        }),
      dispose: mockDispose,
    }));
    mockMakeImageSnapshot.mockImplementation((img: unknown) => img);
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

    const calls = mockDrawImageRectOptions.mock.calls;
    const [firstSrc] = calls[0].slice(1);
    const [, lastDst] = calls[calls.length - 1].slice(1);
    expect(firstSrc).toEqual({ x: 0, y: 0, width: 400, height: 300 });
    expect(lastDst).toEqual({ x: 0, y: 0, width: SIZE, height: SIZE });
  });

  it('halves the image in steps instead of jumping straight to the target', async () => {
    mockMakeImageFromEncoded.mockReturnValue({
      width: () => 1792,
      height: () => 1792,
      dispose: mockDispose,
    });

    await preprocessImageWithSkia('file:///leaf.jpg', 224);

    const destinations = mockDrawImageRectOptions.mock.calls.map((c) => c[2].width);
    expect(destinations).toEqual([896, 448, 224, 224]);
  });

  it('scales in a single step when the source is already close to the target', async () => {
    mockMakeImageFromEncoded.mockReturnValue({
      width: () => 300,
      height: () => 300,
      dispose: mockDispose,
    });

    await preprocessImageWithSkia('file:///leaf.jpg', 224);

    expect(mockDrawImageRectOptions).toHaveBeenCalledTimes(1);
  });

  it('releases every native resource it allocates', async () => {
    mockMakeImageFromEncoded.mockReturnValue({
      width: () => 300,
      height: () => 300,
      dispose: mockDispose,
    });

    await preprocessImageWithSkia('file:///leaf.jpg', 224);

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
