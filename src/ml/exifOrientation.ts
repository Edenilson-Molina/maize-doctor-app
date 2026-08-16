/**
 * Lee el tag de orientacion EXIF (0x0112) del segmento APP1 de un JPEG.
 *
 * Solo reconoce las 4 orientaciones de rotacion pura (1, 3, 6, 8) que producen
 * casi todas las fotos de camara de telefono. Las orientaciones espejadas
 * (2, 4, 5, 7) son casi inexistentes en capturas reales de camara y se tratan
 * como "sin corregir" (se devuelve 1) para no ampliar el alcance de este parser.
 *
 * @param {Uint8Array} bytes Bytes crudos del archivo JPEG.
 * @returns {1 | 3 | 6 | 8} Orientacion EXIF reconocida, o 1 si no hay tag o no es una de las 4.
 */
export function readExifOrientation(bytes: Uint8Array): 1 | 3 | 6 | 8 {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return 1;

  let offset = 2;
  while (offset < bytes.length - 1 && bytes[offset] === 0xff) {
    const marker = bytes[offset + 1];
    if (marker === 0xe1) return readOrientationFromApp1(bytes, offset + 4);
    if (marker === 0xda) break; // Start of Scan: no hay mas metadata antes de los datos de imagen
    const segmentLength = (bytes[offset + 2] << 8) | bytes[offset + 3];
    offset += 2 + segmentLength;
  }
  return 1;
}

function readOrientationFromApp1(bytes: Uint8Array, app1PayloadStart: number): 1 | 3 | 6 | 8 {
  const exifTag = String.fromCharCode(...bytes.slice(app1PayloadStart, app1PayloadStart + 4));
  if (exifTag !== 'Exif') return 1;

  const tiffOffset = app1PayloadStart + 6;
  const littleEndian = bytes[tiffOffset] === 0x49; // "II" little-endian, "MM" big-endian
  const readUint16 = (o: number): number =>
    littleEndian ? bytes[o] | (bytes[o + 1] << 8) : (bytes[o] << 8) | bytes[o + 1];
  const readUint32 = (o: number): number =>
    littleEndian
      ? bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16) | (bytes[o + 3] << 24)
      : (bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3];

  const ifdOffset = tiffOffset + readUint32(tiffOffset + 4);
  const entryCount = readUint16(ifdOffset);
  for (let i = 0; i < entryCount; i++) {
    const entryOffset = ifdOffset + 2 + i * 12;
    if (readUint16(entryOffset) === 0x0112) {
      const value = readUint16(entryOffset + 8);
      return value === 3 || value === 6 || value === 8 ? value : 1;
    }
  }
  return 1;
}
