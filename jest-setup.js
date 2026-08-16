jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-fast-tflite', () => ({ loadTensorflowModel: jest.fn() }));
