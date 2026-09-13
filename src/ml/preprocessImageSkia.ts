import {
  AlphaType,
  ColorType,
  FilterMode,
  MipmapMode,
  Skia,
  type SkImage,
} from '@shopify/react-native-skia';
import { buildInputTensor } from './imageTensor';

/**
 * Reduce una imagen a la mitad tantas veces como haga falta para que el escalado final
 * no salte más de un factor de dos.
 *
 * `drawImageRectOptions` con `FilterMode.Linear` y `MipmapMode.None` muestrea cuatro
 * téxeles por píxel de salida. Bajar una foto de 12 MP a 224 en un solo paso descarta
 * así más del 99 % de los píxeles y produce aliasing severo: el pipeline de entrenamiento
 * escala con un filtro de soporte proporcional al factor, que promedia todos. Medido sobre
 * imágenes del corpus, esa diferencia cambia la clase predicha y multiplica por cincuenta
 * la distancia de Mahalanobis del detector OOD, que entonces rechaza hojas legítimas.
 *
 * Cada paso a la mitad con filtro lineal equivale a promediar bloques de 2x2 —el mismo
 * cálculo que un nivel de mipmap—, así que encadenarlos reconstruye el promedio que falta.
 *
 * @param {SkImage} image Imagen decodificada.
 * @param {number} size Lado del cuadrado de destino.
 * @returns {{image: SkImage, dispose: () => void}} Imagen reducida y la liberación de los
 *   recursos intermedios que se crearon para obtenerla.
 */
function halveUntilNear(image: SkImage, size: number): { image: SkImage; dispose: () => void } {
  const surfaces: { dispose: () => void }[] = [];
  const images: SkImage[] = [];
  let current = image;

  while (current.width() >= size * 2 && current.height() >= size * 2) {
    const width = Math.max(size, Math.floor(current.width() / 2));
    const height = Math.max(size, Math.floor(current.height() / 2));
    const surface = Skia.Surface.MakeOffscreen(width, height);
    if (!surface) break;

    surface
      .getCanvas()
      .drawImageRectOptions(
        current,
        Skia.XYWHRect(0, 0, current.width(), current.height()),
        Skia.XYWHRect(0, 0, width, height),
        FilterMode.Linear,
        MipmapMode.None,
      );

    const reduced = surface.makeImageSnapshot();
    surfaces.push(surface);
    images.push(reduced);
    current = reduced;
  }

  return {
    image: current,
    dispose: () => {
      for (const img of images) img.dispose();
      for (const surface of surfaces) surface.dispose();
    },
  };
}

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

  const reduced = halveUntilNear(image, size);

  try {
    surface
      .getCanvas()
      .drawImageRectOptions(
        reduced.image,
        Skia.XYWHRect(0, 0, reduced.image.width(), reduced.image.height()),
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
    reduced.dispose();
    image.dispose();
    data.dispose();
  }
}
