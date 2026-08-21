import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File } from 'expo-file-system';
import jpeg from 'jpeg-js';
import { readExifOrientation } from './exifOrientation';
import { buildInputTensor } from './imageTensor';

/**
 * EXIF lives in the JPEG's APP1 segment, near the start of the file. Reading this
 * prefix is enough to resolve orientation, instead of loading a multi-megabyte
 * photo into memory just to inspect its header.
 */
const EXIF_HEADER_BYTES = 64 * 1024;

/** Throwaway intermediate: it is decoded immediately, so lossless costs IO for nothing. */
const INTERMEDIATE_COMPRESSION = 0.9;

const ROTATION_BY_ORIENTATION: Record<1 | 3 | 6 | 8, number> = {
  1: 0,
  3: 180,
  6: 90,
  8: -90,
};

/**
 * Reads just enough of the file to resolve its EXIF orientation.
 *
 * @param {string} imageUri URI file:// of the photo.
 * @returns {1 | 3 | 6 | 8} Orientation tag, defaulting to 1 when absent or unreadable.
 */
function readOrientationFromHeader(imageUri: string): 1 | 3 | 6 | 8 {
  const handle = new File(imageUri).open();
  try {
    return readExifOrientation(handle.readBytes(EXIF_HEADER_BYTES));
  } finally {
    handle.close();
  }
}

/**
 * Prepara una foto capturada/elegida para el modelo: corrige orientacion EXIF,
 * la estira a size x size (sin preservar aspecto, igual que el pipeline de
 * entrenamiento) y devuelve el tensor NCHW normalizado listo para inferencia.
 *
 * @param {string} imageUri URI file:// de la foto ya guardada (ver scanStorage.ts).
 * @param {number} size Lado del cuadrado de entrada del modelo (224).
 * @returns {Promise<Float32Array>} Tensor aplanado NCHW, longitud 3*size*size.
 */
export async function preprocessImage(imageUri: string, size: number): Promise<Float32Array> {
  const rotationDegrees = ROTATION_BY_ORIENTATION[readOrientationFromHeader(imageUri)];

  let context = ImageManipulator.manipulate(imageUri);
  if (rotationDegrees !== 0) {
    // Asume que ImageManipulator NO aplica ya la rotacion EXIF por si solo (comportamiento no
    // documentado en el SDK de Expo); verificar manualmente en dispositivo con una foto apaisada
    // real de la app de camara de fabrica antes de publicar (Manual en dispositivo).
    context = context.rotate(rotationDegrees);
  }
  const rendered = await context.resize({ width: size, height: size }).renderAsync();
  const resized = await rendered.saveAsync({
    format: SaveFormat.JPEG,
    compress: INTERMEDIATE_COMPRESSION,
  });

  const resizedBytes = await new File(resized.uri).bytes();
  const decoded = jpeg.decode(resizedBytes, { useTArray: true });

  return buildInputTensor(decoded.data, size);
}
