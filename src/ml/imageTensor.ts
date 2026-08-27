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
