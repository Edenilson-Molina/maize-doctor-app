import { Asset } from 'expo-asset';
import { loadTensorflowModel, type TensorflowModel } from 'react-native-fast-tflite';
import type { DiagnosisClass } from '@/content/diagnosis';
import type { InferenceEngine, InferenceResult } from './InferenceEngine';
import { preprocessImage } from './preprocessImage';
import { preprocessImageWithSkia } from './preprocessImageSkia';
import { measure, recordMetric } from '@/lib/metrics';
import { isUnrecognized, mahalanobisDistance, softmax } from './imageTensor';
import { decodeBase64ToFloat32Array } from './base64';
import labelsData from '../../assets/model/labels.json';
import oodStatsData from '../../assets/model/ood_stats.json';

const INPUT_SIZE = 224;
const LABELS = labelsData.labels as DiagnosisClass[];

interface OodStats {
  featureDim: number;
  meanPerClass: Float32Array[];
  invCovariance: Float32Array;
  threshold: number;
}

/**
 * Decodifica `ood_stats.json` (centroides/covarianza en base64 float32) a los
 * tipados que `mahalanobisDistance` espera.
 *
 * @returns {OodStats} Estadisticas OOD listas para usar.
 */
function loadOodStats(): OodStats {
  const featureDim = oodStatsData.feature_dim;
  const flatMeans = decodeBase64ToFloat32Array(oodStatsData.mean_per_class_b64);
  const meanPerClass: Float32Array[] = [];
  for (let c = 0; c < oodStatsData.num_classes; c++) {
    meanPerClass.push(flatMeans.subarray(c * featureDim, (c + 1) * featureDim));
  }
  return {
    featureDim,
    meanPerClass,
    invCovariance: decodeBase64ToFloat32Array(oodStatsData.inv_covariance_b64),
    threshold: oodStatsData.threshold,
  };
}

const OOD_STATS = loadOodStats();

/**
 * Resolves the bundled .tflite model to a `file://` URI.
 *
 * `loadTensorflowModel(require(...))` relies on `Image.resolveAssetSource`,
 * which in release builds points at an Android resource name (no URL scheme)
 * instead of a fetchable path - the library's native asset loader then fails
 * with `MalformedURLException: no protocol`. Materializing the asset via
 * `expo-asset` first sidesteps that path and always yields a real file URI.
 *
 * @returns {Promise<string>} `file://` URI of the model on local storage.
 */
async function resolveModelAsset(): Promise<string> {
  const asset = await Asset.fromModule(require('../../assets/model/model_int8.tflite')).downloadAsync();
  if (!asset.localUri) {
    throw new Error('TFLiteInferenceEngine: no se pudo materializar el asset del modelo .tflite');
  }
  return asset.localUri;
}

/**
 * Motor de inferencia real sobre el modelo TFLite embarcado en la app.
 * Mapea el indice de salida del modelo a una clase de diagnostico
 * exclusivamente a traves de `assets/model/labels.json` (nunca del
 * orden declarado en `DIAGNOSIS_CLASSES`), ya que ambos ordenes
 * pueden divergir.
 */
export class TFLiteInferenceEngine implements InferenceEngine {
  /** First predict of the session pays one-off model loading; its timings are outliers. */
  private static hasRunOnce = false;

  private static modelPromise: Promise<TensorflowModel> | null = null;

  private async getModel(): Promise<TensorflowModel> {
    if (!TFLiteInferenceEngine.modelPromise) {
      TFLiteInferenceEngine.modelPromise = resolveModelAsset()
        .then((uri) => loadTensorflowModel({ url: uri }, []))
        .catch((err) => {
          TFLiteInferenceEngine.modelPromise = null;
          throw err;
        });
    }
    const model = await TFLiteInferenceEngine.modelPromise;
    this.assertContract(model);
    return model;
  }

  private assertContract(model: TensorflowModel): void {
    const input = model.inputs[0];
    if (input.dataType !== 'float32') {
      throw new Error(
        `TFLiteInferenceEngine: se esperaba tensor de entrada float32, el modelo tiene '${input.dataType}'. ` +
          'Este pipeline exporta con cuantizacion dinamica (pesos int8, entrada/salida float32); un tensor ' +
          'de entrada no-float32 significa que el .tflite embarcado no es el que este engine espera.',
      );
    }
    const expectedLength = 3 * INPUT_SIZE * INPUT_SIZE;
    const declaredLength = input.shape.reduce((a, b) => a * b, 1);
    if (declaredLength !== expectedLength) {
      throw new Error(
        `TFLiteInferenceEngine: forma de entrada inesperada ${JSON.stringify(input.shape)} ` +
          `(se esperaban ${expectedLength} elementos para un tensor 1x3x${INPUT_SIZE}x${INPUT_SIZE}).`,
      );
    }
    const outputSize = model.outputs[0].shape[model.outputs[0].shape.length - 1];
    if (outputSize !== LABELS.length) {
      throw new Error(
        `TFLiteInferenceEngine: labels.json tiene ${LABELS.length} clases pero el modelo declara ` +
          `${outputSize} salidas.`,
      );
    }

    const featuresOutput = model.outputs[1];
    if (!featuresOutput) {
      throw new Error(
        'TFLiteInferenceEngine: el modelo tiene un solo output (logits). Se esperaba un ' +
          'segundo output de features pooled para el detector OOD por distancia de Mahalanobis.',
      );
    }
    if (featuresOutput.dataType !== 'float32') {
      throw new Error(
        `TFLiteInferenceEngine: se esperaba el segundo output (features) en float32, el modelo ` +
          `tiene '${featuresOutput.dataType}'.`,
      );
    }
    const featuresLength = featuresOutput.shape[featuresOutput.shape.length - 1];
    if (featuresLength !== OOD_STATS.featureDim) {
      throw new Error(
        `TFLiteInferenceEngine: ood_stats.json tiene feature_dim=${OOD_STATS.featureDim} pero el ` +
          `modelo declara ${featuresLength} en su segundo output.`,
      );
    }
  }

  async predict(imageUri: string): Promise<InferenceResult> {
    const isCold = !TFLiteInferenceEngine.hasRunOnce;
    const model = await this.getModel();

    // Skia decodes and scales natively, skipping the JPEG round-trip the
    // ImageManipulator path needs. Kept behind a flag so the previous path stays
    // available if a device disagrees.
    const preprocess =
      process.env.EXPO_PUBLIC_SKIA_PREPROCESS === 'false' ? preprocessImage : preprocessImageWithSkia;

    const inputTensor = await measure('preprocess', () => preprocess(imageUri, INPUT_SIZE), {
      cold: isCold,
    });

    // runSync is synchronous, so this brackets the model call alone - no file IO,
    // no tensor building - which is the number worth comparing across devices.
    const inferenceStartedAt = Date.now();
    const [logitsBuffer, featuresBuffer] = model.runSync([inputTensor.buffer as ArrayBuffer]);
    recordMetric({
      stage: 'inference',
      durationMs: Date.now() - inferenceStartedAt,
      cold: isCold,
    });
    TFLiteInferenceEngine.hasRunOnce = true;

    const probabilities = softmax(new Float32Array(logitsBuffer));
    const features = new Float32Array(featuresBuffer);

    const distribution = {} as Record<DiagnosisClass, number>;
    let bestIndex = 0;
    for (let i = 0; i < LABELS.length; i++) {
      distribution[LABELS[i]] = probabilities[i];
      if (probabilities[i] > probabilities[bestIndex]) bestIndex = i;
    }

    const distance = mahalanobisDistance(features, OOD_STATS.meanPerClass, OOD_STATS.invCovariance);
    const isOutOfDomain = distance > OOD_STATS.threshold;

    return {
      label: LABELS[bestIndex],
      confidence: probabilities[bestIndex],
      distribution,
      isUnrecognized: isUnrecognized(probabilities) || isOutOfDomain,
    };
  }
}
