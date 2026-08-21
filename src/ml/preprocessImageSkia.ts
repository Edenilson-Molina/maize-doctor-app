import {
  AlphaType,
  ColorType,
  FilterMode,
  MipmapMode,
  Skia,
} from '@shopify/react-native-skia';
import { buildInputTensor } from './imageTensor';

/**
 * Prepara una foto para el modelo decodificando y escalando de forma nativa.
 *
 * A diferencia de la ruta con `expo-image-manipulator`, aqui no se escribe ni se
 * vuelve a leer un JPEG intermedio: Skia decodifica en memoria, dibuja escalado a
 * size x size y devuelve los pixeles RGBA directamente. Eso elimina un encode JPEG,
 * una escritura a disco, una lectura y el decode en JavaScript de `jpeg-js`.
 *
 * Estira la imagen al cuadrado sin preservar el aspecto, igual que el pipeline de
 * entrenamiento. La rotacion EXIF la resuelve el decodificador nativo.
 *
 * @param {string} imageUri URI file:// de la foto.
 * @param {number} size Lado del cuadrado de entrada del modelo (224).
 * @returns {Promise<Float32Array>} Tensor aplanado NCHW, longitud 3*size*size.
 * @throws {Error} Si la imagen no se puede decodificar o leer.
 */
export async function preprocessImageWithSkia(
  imageUri: string,
  size: number,
): Promise<Float32Array> {
  const data = await Skia.Data.fromURI(imageUri);
  const image = Skia.Image.MakeImageFromEncoded(data);
  if (!image) {
    data.dispose();
    throw new Error(`No se pudo decodificar la imagen ${imageUri}`);
  }

  const surface = Skia.Surface.MakeOffscreen(size, size);
  if (!surface) {
    image.dispose();
    data.dispose();
    throw new Error('No se pudo crear la superficie de escalado');
  }

  try {
    surface
      .getCanvas()
      .drawImageRectOptions(
        image,
        Skia.XYWHRect(0, 0, image.width(), image.height()),
        Skia.XYWHRect(0, 0, size, size),
        FilterMode.Linear,
        MipmapMode.None,
      );

    const snapshot = surface.makeImageSnapshot();
    try {
      const pixels = snapshot.readPixels(0, 0, {
        width: size,
        height: size,
        colorType: ColorType.RGBA_8888,
        alphaType: AlphaType.Unpremul,
      });

      if (!pixels) {
        throw new Error('No se pudieron leer los pixeles de la imagen escalada');
      }

      return buildInputTensor(pixels as Uint8Array, size);
    } finally {
      snapshot.dispose();
    }
  } finally {
    surface.dispose();
    image.dispose();
    data.dispose();
  }
}
