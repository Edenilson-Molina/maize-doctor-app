import { loadTensorflowModel, type TensorflowModel } from 'react-native-fast-tflite';
import type { DiagnosisClass } from '@/content/diagnosis';
import type { InferenceEngine, InferenceResult } from './InferenceEngine';
import { preprocessImage } from './preprocessImage';
import { softmax } from './imageTensor';
import labelsData from '../../assets/model/labels.json';

const INPUT_SIZE = 224;
const LABELS = labelsData.labels as DiagnosisClass[];

function resolveModelAsset(): number {
  return require('../../assets/model/model_int8.tflite');
}

/**
 * Motor de inferencia real sobre el modelo TFLite embarcado en la app.
 * Mapea el indice de salida del modelo a una clase de diagnostico
 * exclusivamente a traves de `assets/model/labels.json` (nunca del
 * orden declarado en `DIAGNOSIS_CLASSES`), ya que ambos ordenes
 * pueden divergir.
 */
export class TFLiteInferenceEngine implements InferenceEngine {
  private static modelPromise: Promise<TensorflowModel> | null = null;

  private async getModel(): Promise<TensorflowModel> {
    if (!TFLiteInferenceEngine.modelPromise) {
      TFLiteInferenceEngine.modelPromise = loadTensorflowModel(resolveModelAsset(), []).catch(
        (err) => {
          TFLiteInferenceEngine.modelPromise = null;
          throw err;
        },
      );
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
  }

  async predict(imageUri: string): Promise<InferenceResult> {
    const model = await this.getModel();
    const inputTensor = await preprocessImage(imageUri, INPUT_SIZE);

    const [outputBuffer] = model.runSync([inputTensor.buffer as ArrayBuffer]);
    const probabilities = softmax(new Float32Array(outputBuffer));

    const distribution = {} as Record<DiagnosisClass, number>;
    let bestIndex = 0;
    for (let i = 0; i < LABELS.length; i++) {
      distribution[LABELS[i]] = probabilities[i];
      if (probabilities[i] > probabilities[bestIndex]) bestIndex = i;
    }

    return {
      label: LABELS[bestIndex],
      confidence: probabilities[bestIndex],
      distribution,
    };
  }
}
