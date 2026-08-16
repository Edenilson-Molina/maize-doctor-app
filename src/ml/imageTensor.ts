const MEAN = [0.485, 0.456, 0.406] as const;
const STD = [0.229, 0.224, 0.225] as const;

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
