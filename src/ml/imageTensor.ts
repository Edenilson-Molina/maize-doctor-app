const MEAN = [0.485, 0.456, 0.406] as const;
const STD = [0.229, 0.224, 0.225] as const;

/**
 * Confianza minima de la clase top-1 para aceptar una prediccion como valida.
 *
 * El modelo es closed-set (9 clases de hoja de maiz, sin clase "unknown"), por lo
 * que siempre elige una clase incluso ante una imagen fuera de dominio. Con 9 clases
 * el azar puro da ~11% por clase, asi que 0.6 exige una decision claramente por
 * encima del ruido sin rechazar fotos legitimas tomadas en condiciones imperfectas.
 */
export const MIN_CONFIDENCE = 0.6;

/**
 * Margen minimo entre las probabilidades top-1 y top-2 para aceptar la prediccion.
 *
 * Filtra el caso en que dos clases quedan casi empatadas (tipico de imagenes
 * ambiguas o fuera de dominio que activan mas de una clase por igual), incluso
 * si la confianza top-1 por si sola supera `MIN_CONFIDENCE`.
 */
export const MIN_MARGIN = 0.15;

/**
 * Construye el tensor NCHW normalizado que el modelo espera a partir de un buffer
 * de pixeles RGBA ya redimensionado a size x size.
 *
 * @param {Uint8Array} pixels Buffer RGBA (4 bytes/pixel), longitud size*size*4.
 * @param {number} size Lado del cuadrado de entrada (224 para los modelos actuales).
 * @returns {Float32Array} Tensor aplanado en orden NCHW: canal completo antes del siguiente.
 */
export function buildInputTensor(pixels: Uint8Array, size: number): Float32Array {
  const input = new Float32Array(3 * size * size);
  for (let i = 0; i < size * size; i++) {
    for (let c = 0; c < 3; c++) {
      input[c * size * size + i] = (pixels[i * 4 + c] / 255 - MEAN[c]) / STD[c];
    }
  }
  return input;
}

/**
 * Aplica softmax a los logits crudos del modelo.
 *
 * @param {Float32Array} logits Salida cruda del modelo (sin normalizar).
 * @returns {Float32Array} Distribucion de probabilidad, misma longitud que logits.
 */
export function softmax(logits: Float32Array): Float32Array {
  const max = Math.max(...logits);
  const exps = Float32Array.from(logits, (v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return Float32Array.from(exps, (v) => v / sum);
}

/**
 * Decide si una prediccion debe tratarse como no reconocida, es decir, que la
 * imagen probablemente no corresponde a ninguna de las clases del modelo.
 *
 * Aplica dos reglas independientes sobre la distribucion de probabilidad ya
 * ordenada por softmax: confianza top-1 insuficiente, o margen insuficiente
 * entre las dos clases mas probables.
 *
 * @param {Float32Array} probabilities Distribucion de probabilidad (softmax), sin ordenar.
 * @returns {boolean} `true` si la prediccion no alcanza el umbral de confianza o margen.
 */
export function isUnrecognized(probabilities: Float32Array): boolean {
  let top1 = -Infinity;
  let top2 = -Infinity;
  for (const p of probabilities) {
    if (p > top1) {
      top2 = top1;
      top1 = p;
    } else if (p > top2) {
      top2 = p;
    }
  }
  return top1 < MIN_CONFIDENCE || top1 - top2 < MIN_MARGIN;
}

/**
 * Calcula la distancia de Mahalanobis minima entre `features` y cualquiera de los
 * centroides de clase, usando una covarianza pooled compartida entre clases.
 *
 * Se toma el minimo sobre todas las clases (no solo la predicha por softmax): una
 * imagen fuera de dominio puede colapsar la confianza en una clase equivocada, asi
 * que este chequeo no debe depender de que el softmax haya acertado la clase.
 *
 * @param {Float32Array} features Vector de features pooled (penultima capa del modelo).
 * @param {Float32Array[]} meanPerClass Centroide de cada clase, mismo orden que `labels`.
 * @param {Float32Array} invCovariance Inversa de la covarianza pooled, aplanada row-major
 *   (`featureDim x featureDim`).
 * @returns {number} La menor distancia de Mahalanobis al cuadrado entre `features` y
 *   los centroides de clase.
 */
export function mahalanobisDistance(
  features: Float32Array,
  meanPerClass: Float32Array[],
  invCovariance: Float32Array,
): number {
  const featureDim = features.length;
  let minDistance = Infinity;

  for (const mean of meanPerClass) {
    const diff = new Float64Array(featureDim);
    for (let i = 0; i < featureDim; i++) {
      diff[i] = features[i] - mean[i];
    }

    let distance = 0;
    for (let i = 0; i < featureDim; i++) {
      let rowDotDiff = 0;
      const rowOffset = i * featureDim;
      for (let j = 0; j < featureDim; j++) {
        rowDotDiff += invCovariance[rowOffset + j] * diff[j];
      }
      distance += diff[i] * rowDotDiff;
    }

    if (distance < minDistance) {
      minDistance = distance;
    }
  }

  return minDistance;
}
