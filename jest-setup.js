jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-fast-tflite', () => ({ loadTensorflowModel: jest.fn() }));
jest.mock('@shopify/react-native-skia', () => ({
  Skia: {
    Data: { fromURI: jest.fn() },
    Image: { MakeImageFromEncoded: jest.fn() },
    Surface: { MakeOffscreen: jest.fn() },
    XYWHRect: jest.fn(),
  },
  ColorType: { RGBA_8888: 4 },
  AlphaType: { Unpremul: 2 },
  FilterMode: { Linear: 1 },
  MipmapMode: { None: 0 },
}));
