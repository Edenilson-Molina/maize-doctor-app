const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Decodifica un string base64 a bytes crudos, sin depender de `atob`/`Buffer`
 * (no garantizados como globals en todos los motores JS de React Native).
 *
 * @param {string} base64 String base64 estandar (con o sin padding `=`).
 * @returns {Uint8Array} Bytes decodificados.
 */
export function decodeBase64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/=+$/, '');
  const byteLength = Math.floor((clean.length * 6) / 8);
  const bytes = new Uint8Array(byteLength);

  let bitBuffer = 0;
  let bitCount = 0;
  let byteIndex = 0;

  for (let i = 0; i < clean.length; i++) {
    const value = BASE64_CHARS.indexOf(clean[i]);
    if (value === -1) continue;

    bitBuffer = (bitBuffer << 6) | value;
    bitCount += 6;

    if (bitCount >= 8) {
      bitCount -= 8;
      bytes[byteIndex++] = (bitBuffer >> bitCount) & 0xff;
    }
  }

  return bytes;
}

/**
 * Decodifica un string base64 que representa un buffer float32 (little-endian,
 * row-major) a un `Float32Array`.
 *
 * @param {string} base64 Bytes float32 codificados en base64.
 * @returns {Float32Array} Valores decodificados.
 */
export function decodeBase64ToFloat32Array(base64: string): Float32Array {
  const bytes = decodeBase64ToBytes(base64);
  return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
}
