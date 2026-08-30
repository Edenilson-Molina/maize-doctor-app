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

/**
 * Normaliza un vector de features a norma L2 unitaria.
 *
 * Requisito de Mahalanobis++ (Ren et al. 2025, arXiv:2505.18032): normalizar antes de
 * calcular distancias de Mahalanobis acerca el vector de features al supuesto gaussiano
 * en que se basa el metodo. Debe aplicarse igual aqui que al calcular `ood_stats.json`
 * (`compute_ood_stats.py`), o las distancias no van a ser comparables con el umbral.
 *
 * @param {Float32Array} features Vector de features pooled, sin normalizar.
 * @returns {Float32Array} Vector normalizado, misma longitud.
 */
export function l2Normalize(features: Float32Array): Float32Array {
  let sumSquares = 0;
  for (const value of features) {
    sumSquares += value * value;
  }
  const norm = Math.sqrt(sumSquares);
  return Float32Array.from(features, (value) => value / norm);
}

/**
 * Proyecta un vector de features al espacio reducido por PCA calibrado en `compute_ood_stats.py`.
 *
 * El feature vector crudo (1280 dims) tiene un espectro de autovalores muy sesgado: la
 * mayoria de las dimensiones son esencialmente ruido numerico sin señal real. Sin esta
 * reduccion, invertir la covarianza de esas 1280 dimensiones deja el ruido con un peso
 * desproporcionado en la distancia de Mahalanobis y el detector no separa nada (ver
 * metodologia y validacion en maize-doctor-classifier/docs/es/deep-learning/ood-detection.md).
 *
 * @param {Float32Array} features Vector de features pooled, ya L2-normalizado.
 * @param {Float32Array} pcaMean Media usada al ajustar PCA (misma longitud que `features`).
 * @param {Float32Array} pcaComponents Componentes principales aplanadas row-major (`pcaDim x featureDim`).
 * @param {number} pcaDim Numero de componentes retenidas.
 * @returns {Float32Array} Vector proyectado, longitud `pcaDim`.
 */
export function projectPCA(
  features: Float32Array,
  pcaMean: Float32Array,
  pcaComponents: Float32Array,
  pcaDim: number,
): Float32Array {
  const featureDim = features.length;
  const centered = new Float64Array(featureDim);
  for (let i = 0; i < featureDim; i++) {
    centered[i] = features[i] - pcaMean[i];
  }

  const projected = new Float32Array(pcaDim);
  for (let k = 0; k < pcaDim; k++) {
    const rowOffset = k * featureDim;
    let sum = 0;
    for (let i = 0; i < featureDim; i++) {
      sum += pcaComponents[rowOffset + i] * centered[i];
    }
    projected[k] = sum;
  }
  return projected;
}

/**
 * Calcula la Relative Mahalanobis Distance (RMD) de `features` a la clase mas cercana.
 *
 * La distancia de Mahalanobis "plana" puede quedar dominada por dimensiones del feature
 * vector que no discriminan entre clases (estadisticas de "imagen natural" genericas),
 * dejando pasar imagenes fuera de dominio que comparten esas dimensiones con el dataset
 * de entrenamiento aunque no sean una hoja de maiz. RMD corrige esto restando la distancia
 * a una gaussiana de fondo (ajustada sobre todo el train, sin condicionar por clase): las
 * dimensiones no discriminantes tienen la misma media/covarianza bajo ambos modelos y se
 * cancelan, dejando solo la señal especifica de clase (Ren et al. 2021, arXiv:2106.09022).
 * Ambas gaussianas se ajustan sobre el espacio reducido por `projectPCA`, no sobre el
 * feature vector crudo. Metodologia completa: maize-doctor-classifier/docs/es/deep-learning/ood-detection.md.
 *
 * @param {Float32Array} features Vector de features pooled (penultima capa del modelo), sin normalizar ni proyectar.
 * @param {Float32Array[]} meanPerClass Centroide de cada clase (en el espacio reducido por PCA), mismo orden que `labels`.
 * @param {Float32Array} invCovariance Inversa de la covarianza pooled (en el espacio reducido), aplanada row-major.
 * @param {Float32Array} backgroundMean Media de la gaussiana de fondo (en el espacio reducido, todo el train, sin condicionar por clase).
 * @param {Float32Array} backgroundInvCovariance Inversa de la covarianza de la gaussiana de fondo, aplanada row-major.
 * @param {Float32Array} pcaMean Media usada al ajustar PCA (mismo longitud que `features`).
 * @param {Float32Array} pcaComponents Componentes principales aplanadas row-major (`pcaDim x featureDim`).
 * @param {number} pcaDim Numero de componentes retenidas por PCA.
 * @returns {number} Score RMD: distancia a la clase mas cercana menos distancia al fondo. Puede ser negativo.
 */
export function relativeMahalanobisDistance(
  features: Float32Array,
  meanPerClass: Float32Array[],
  invCovariance: Float32Array,
  backgroundMean: Float32Array,
  backgroundInvCovariance: Float32Array,
  pcaMean: Float32Array,
  pcaComponents: Float32Array,
  pcaDim: number,
): number {
  const normalized = l2Normalize(features);
  const reduced = projectPCA(normalized, pcaMean, pcaComponents, pcaDim);
  const classDistance = mahalanobisDistance(reduced, meanPerClass, invCovariance);
  const backgroundDistance = mahalanobisDistance(reduced, [backgroundMean], backgroundInvCovariance);
  return classDistance - backgroundDistance;
}
