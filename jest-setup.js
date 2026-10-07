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

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'granted', granted: true })
  ),
  getForegroundPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'granted', granted: true })
  ),
  getCurrentPositionAsync: jest.fn(() =>
    Promise.resolve({
      coords: { latitude: 13.69, longitude: -89.19, accuracy: 5 },
    })
  ),
  getLastKnownPositionAsync: jest.fn(() =>
    Promise.resolve({
      coords: { latitude: 13.69, longitude: -89.19, accuracy: 5 },
    })
  ),
  Accuracy: {
    Lowest: 1,
    Low: 2,
    Balanced: 3,
    High: 4,
    Highest: 5,
    BestForNavigation: 6,
  },
}));

jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MockMapView = React.forwardRef((props, ref) => {
    return React.createElement(View, { ...props, ref, testID: props.testID || 'map-view' });
  });
  const MockMarker = (props) =>
    React.createElement(View, { ...props, testID: props.testID || 'map-marker' });
  const MockCallout = (props) =>
    React.createElement(View, { ...props, testID: props.testID || 'map-callout' });

  return {
    __esModule: true,
    default: MockMapView,
    Marker: MockMarker,
    Callout: MockCallout,
    PROVIDER_DEFAULT: 'default',
    PROVIDER_GOOGLE: 'google',
  };
});
jest.mock('react-native-webview', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MockWebView = React.forwardRef((props, ref) => {
    React.useImperativeHandle(ref, () => ({
      injectJavaScript: jest.fn(),
      reload: jest.fn(),
      postMessage: jest.fn(),
    }));
    return React.createElement(View, { ...props, testID: props.testID || 'web-view' });
  });
  return {
    WebView: MockWebView,
    default: MockWebView,
  };
});
