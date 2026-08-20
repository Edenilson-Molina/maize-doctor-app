jest.mock('react-native-fast-tflite', () => ({ loadTensorflowModel: jest.fn() }));
jest.mock('./preprocessImage', () => ({ preprocessImage: jest.fn() }));

import { loadTensorflowModel } from 'react-native-fast-tflite';
import { preprocessImage } from './preprocessImage';
import { TFLiteInferenceEngine } from './TFLiteInferenceEngine';
import { DIAGNOSIS_CLASSES } from '@/content/diagnosis';
import labelsData from '../../assets/model/labels.json';
import { clearMetrics, getMetrics } from '@/lib/metrics';

describe('TFLiteInferenceEngine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Se resetea el cache estatico del modelo para que cada test dispare su propio loadTensorflowModel().
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (TFLiteInferenceEngine as any).modelPromise = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (TFLiteInferenceEngine as any).hasRunOnce = false;
    (preprocessImage as jest.Mock).mockResolvedValue(new Float32Array(3 * 224 * 224));
  });

  it('mapea el logit mas alto a la clase de labels.json en esa posicion, no al orden de DIAGNOSIS_CLASSES', async () => {
    const healthyIndex = labelsData.labels.indexOf('healthy');
    const fakeLogits = new Float32Array(labelsData.labels.length).fill(0);
    fakeLogits[healthyIndex] = 10;
    (loadTensorflowModel as jest.Mock).mockResolvedValue({
      inputs: [{ dataType: 'float32', shape: [1, 3, 224, 224] }],
      outputs: [{ dataType: 'float32', shape: [1, labelsData.labels.length] }],
      runSync: jest.fn(() => [fakeLogits.buffer]),
    });

    const engine = new TFLiteInferenceEngine();
    const result = await engine.predict('file://leaf.jpg');

    expect(result.label).toBe('healthy');
    expect(DIAGNOSIS_CLASSES.indexOf('healthy')).not.toBe(healthyIndex);
  });

  it('la distribucion cubre las 9 clases y suma aproximadamente 1', async () => {
    const fakeLogits = new Float32Array(labelsData.labels.length).fill(0);
    (loadTensorflowModel as jest.Mock).mockResolvedValue({
      inputs: [{ dataType: 'float32', shape: [1, 3, 224, 224] }],
      outputs: [{ dataType: 'float32', shape: [1, labelsData.labels.length] }],
      runSync: jest.fn(() => [fakeLogits.buffer]),
    });

    const engine = new TFLiteInferenceEngine();
    const result = await engine.predict('file://leaf.jpg');

    expect(Object.keys(result.distribution)).toHaveLength(labelsData.labels.length);
    const sum = Object.values(result.distribution).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 4);
  });

  it('lanza un error claro si el modelo declara un tensor de entrada no-float32', async () => {
    (loadTensorflowModel as jest.Mock).mockResolvedValue({
      inputs: [{ dataType: 'int8', shape: [1, 3, 224, 224] }],
      outputs: [{ dataType: 'float32', shape: [1, labelsData.labels.length] }],
      runSync: jest.fn(),
    });

    const engine = new TFLiteInferenceEngine();
    await expect(engine.predict('file://leaf.jpg')).rejects.toThrow(/float32/);
  });

  it('lanza un error claro si labels.json y la forma de salida del modelo no coinciden en numero de clases', async () => {
    (loadTensorflowModel as jest.Mock).mockResolvedValue({
      inputs: [{ dataType: 'float32', shape: [1, 3, 224, 224] }],
      outputs: [{ dataType: 'float32', shape: [1, 3] }],
      runSync: jest.fn(),
    });

    const engine = new TFLiteInferenceEngine();
    await expect(engine.predict('file://leaf.jpg')).rejects.toThrow(/labels\.json/);
  });

  it('labels.json contiene exactamente las mismas clases que DIAGNOSIS_CLASSES (orden puede diferir)', () => {
    expect([...labelsData.labels].sort()).toEqual([...DIAGNOSIS_CLASSES].sort());
  });
});

describe('TFLiteInferenceEngine timing metrics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearMetrics();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (TFLiteInferenceEngine as any).modelPromise = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (TFLiteInferenceEngine as any).hasRunOnce = false;
    (preprocessImage as jest.Mock).mockResolvedValue(new Float32Array(3 * 224 * 224));
    (loadTensorflowModel as jest.Mock).mockResolvedValue({
      inputs: [{ dataType: 'float32', shape: [1, 3, 224, 224] }],
      outputs: [{ dataType: 'float32', shape: [1, labelsData.labels.length] }],
      runSync: jest.fn(() => [new Float32Array(labelsData.labels.length).buffer]),
    });
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('records preprocess and inference as separate stages', async () => {
    const engine = new TFLiteInferenceEngine();
    await engine.predict('file:///leaf.jpg');

    const stages = getMetrics().map((m) => m.stage);
    expect(stages).toContain('preprocess');
    expect(stages).toContain('inference');
  });

  it('marks the first run of the session as cold', async () => {
    const engine = new TFLiteInferenceEngine();
    await engine.predict('file:///leaf.jpg');
    await engine.predict('file:///leaf.jpg');

    const inference = getMetrics().filter((m) => m.stage === 'inference');
    expect(inference[0].cold).toBe(true);
    expect(inference[1].cold).toBeFalsy();
  });
});
