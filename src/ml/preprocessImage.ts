import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File } from 'expo-file-system';
import jpeg from 'jpeg-js';
import { readExifOrientation } from './exifOrientation';
import { buildInputTensor } from './imageTensor';

const ROTATION_BY_ORIENTATION: Record<1 | 3 | 6 | 8, number> = {
  1: 0,
  3: 180,
  6: 90,
  8: -90,
};

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
  const originalBytes = await new File(imageUri).bytes();
  const rotationDegrees = ROTATION_BY_ORIENTATION[readExifOrientation(originalBytes)];

  let context = ImageManipulator.manipulate(imageUri);
  if (rotationDegrees !== 0) {
    context = context.rotate(rotationDegrees);
  }
  const rendered = await context.resize({ width: size, height: size }).renderAsync();
  const resized = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 1 });

  const resizedBytes = await new File(resized.uri).bytes();
  const decoded = jpeg.decode(resizedBytes, { useTArray: true });

  return buildInputTensor(decoded.data, size);
}
