const PRECISION_BITS = 22;
const PRECISION_SCALE = 1 << PRECISION_BITS;
const ROUNDING_OFFSET = 1 << (PRECISION_BITS - 1);

interface Coefficients {
  kernelSize: number;
  bounds: Int32Array;
  weights: Int32Array;
}

function triangle(x: number): number {
  const distance = x < 0 ? -x : x;
  return distance < 1 ? 1 - distance : 0;
}

/**
 * Calcula los pesos fijos de un eje igual que `precompute_coeffs` y
 * `normalize_coeffs_8bpc` de Pillow para el filtro bilineal.
 *
 * @param {number} inSize Longitud del eje de origen.
 * @param {number} outSize Longitud del eje de destino.
 * @returns {Coefficients} Pesos en punto fijo de 22 bits y, por cada salida, el primer
 *   índice de origen y cuántos índices aporta.
 */
function precomputeCoefficients(inSize: number, outSize: number): Coefficients {
  const scale = inSize / outSize;
  const filterScale = Math.max(scale, 1);
  const support = filterScale;
  const kernelSize = Math.ceil(support) * 2 + 1;
  const bounds = new Int32Array(outSize * 2);
  const weights = new Int32Array(outSize * kernelSize);
  const raw = new Float64Array(kernelSize);

  for (let out = 0; out < outSize; out++) {
    const center = (out + 0.5) * scale;
    const first = Math.max(Math.trunc(center - support + 0.5), 0);
    const count = Math.min(Math.trunc(center + support + 0.5), inSize) - first;
    let total = 0;
    for (let i = 0; i < count; i++) {
      raw[i] = triangle((i + first - center + 0.5) / filterScale);
      total += raw[i];
    }
    for (let i = 0; i < count; i++) {
      const weight = total !== 0 ? raw[i] / total : raw[i];
      weights[out * kernelSize + i] =
        weight < 0
          ? Math.trunc(-0.5 + weight * PRECISION_SCALE)
          : Math.trunc(0.5 + weight * PRECISION_SCALE);
    }
    bounds[out * 2] = first;
    bounds[out * 2 + 1] = count;
  }
  return { kernelSize, bounds, weights };
}

function clip8(accumulator: number): number {
  const value = Math.floor(accumulator / PRECISION_SCALE);
  return value < 0 ? 0 : value > 255 ? 255 : value;
}

/**
 * Redimensiona una imagen RGBA con el remuestreo bilineal con antialias de Pillow
 * (`Image.resize(..., BILINEAR)`), el mismo que aplica `torchvision.transforms.Resize`
 * sobre imágenes PIL al entrenar.
 *
 * El soporte del filtro crece con el factor de reducción, así que cada píxel de salida
 * promedia todos los de origen que cubre. Replica la aritmética de 8 bits de Pillow:
 * pasada horizontal, redondeo a 8 bits y pasada vertical.
 *
 * @param {Uint8Array} source Píxeles RGBA de origen, `width * height * 4` bytes.
 * @param {number} width Ancho de origen.
 * @param {number} height Alto de origen.
 * @param {number} targetWidth Ancho de destino.
 * @param {number} targetHeight Alto de destino.
 * @returns {Uint8Array} Píxeles RGBA de destino con alfa 255.
 */
export function resizeBilinearAntialias(
  source: Uint8Array,
  width: number,
  height: number,
  targetWidth: number,
  targetHeight: number,
): Uint8Array {
  let horizontal = source;
  if (targetWidth !== width) {
    const { kernelSize, bounds, weights } = precomputeCoefficients(width, targetWidth);
    horizontal = new Uint8Array(targetWidth * height * 4);
    for (let y = 0; y < height; y++) {
      const rowIn = y * width * 4;
      const rowOut = y * targetWidth * 4;
      for (let x = 0; x < targetWidth; x++) {
        const first = bounds[x * 2];
        const count = bounds[x * 2 + 1];
        const base = x * kernelSize;
        let r = ROUNDING_OFFSET;
        let g = ROUNDING_OFFSET;
        let b = ROUNDING_OFFSET;
        for (let i = 0; i < count; i++) {
          const weight = weights[base + i];
          const offset = rowIn + (first + i) * 4;
          r += source[offset] * weight;
          g += source[offset + 1] * weight;
          b += source[offset + 2] * weight;
        }
        const out = rowOut + x * 4;
        horizontal[out] = clip8(r);
        horizontal[out + 1] = clip8(g);
        horizontal[out + 2] = clip8(b);
        horizontal[out + 3] = 255;
      }
    }
  }

  if (targetHeight === height) {
    return horizontal;
  }
  const { kernelSize, bounds, weights } = precomputeCoefficients(height, targetHeight);
  const result = new Uint8Array(targetWidth * targetHeight * 4);
  for (let y = 0; y < targetHeight; y++) {
    const first = bounds[y * 2];
    const count = bounds[y * 2 + 1];
    const base = y * kernelSize;
    for (let x = 0; x < targetWidth; x++) {
      let r = ROUNDING_OFFSET;
      let g = ROUNDING_OFFSET;
      let b = ROUNDING_OFFSET;
      for (let i = 0; i < count; i++) {
        const weight = weights[base + i];
        const offset = ((first + i) * targetWidth + x) * 4;
        r += horizontal[offset] * weight;
        g += horizontal[offset + 1] * weight;
        b += horizontal[offset + 2] * weight;
      }
      const out = (y * targetWidth + x) * 4;
      result[out] = clip8(r);
      result[out + 1] = clip8(g);
      result[out + 2] = clip8(b);
      result[out + 3] = 255;
    }
  }
  return result;
}
