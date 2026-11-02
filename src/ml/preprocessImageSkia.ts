import {
  AlphaType,
  ColorType,
  FilterMode,
  MipmapMode,
  Skia,
  type SkImage,
} from '@shopify/react-native-skia';
import { buildInputTensor } from './imageTensor';
import { resizeBilinearAntialias } from './resample';

const MAX_FINAL_FACTOR = 4;

/**
 * Reduce a la mitad cada lado que mida al menos `MAX_FINAL_FACTOR` veces el destino,
 * hasta que ninguno lo alcance.
 *
 * Cada paso a la mitad con filtro lineal promedia pares de píxeles, así que la imagen
 * intermedia conserva el contenido de toda la foto con muchos menos píxeles que leer
 * desde JavaScript. Los lados ya cercanos al destino se dejan intactos.
 *
 * @param {SkImage} image Imagen decodificada.
 * @param {number} size Lado del cuadrado de destino.
 * @returns {{image: SkImage, dispose: () => void}} Imagen reducida y la liberación de los
 *   recursos intermedios que se crearon para obtenerla.
 */
function halveLargeSides(image: SkImage, size: number): { image: SkImage; dispose: () => void } {
  const limit = size * MAX_FINAL_FACTOR;
  const surfaces: { dispose: () => void }[] = [];
  const images: SkImage[] = [];
  let current = image;
  while (current.width() >= limit || current.height() >= limit) {
    const width = current.width() >= limit ? Math.floor(current.width() / 2) : current.width();
    const height = current.height() >= limit ? Math.floor(current.height() / 2) : current.height();
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
 * Prepara una foto para el modelo con el mismo remuestreo que el entrenamiento.
 *
 * Skia decodifica en memoria (resolviendo la rotación EXIF) y reduce a la mitad los
 * lados muy grandes; el paso final a `size x size` lo hace `resizeBilinearAntialias`,
 * que replica byte a byte el `Resize` bilineal de Pillow usado al entrenar. Estira la
 * imagen al cuadrado sin preservar el aspecto, igual que el pipeline de entrenamiento.
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

  const reduced = halveLargeSides(image, size);

  try {
    const width = reduced.image.width();
    const height = reduced.image.height();
    const pixels = reduced.image.readPixels(0, 0, {
      width,
      height,
      colorType: ColorType.RGBA_8888,
      alphaType: AlphaType.Unpremul,
    });

    if (!pixels) {
      throw new Error('No se pudieron leer los pixeles de la imagen');
    }

    return buildInputTensor(
      resizeBilinearAntialias(pixels as Uint8Array, width, height, size, size),
      size,
    );
  } finally {
    reduced.dispose();
    image.dispose();
    data.dispose();
  }
}
