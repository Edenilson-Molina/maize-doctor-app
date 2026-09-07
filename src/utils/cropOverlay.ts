import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

export interface CropRect {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

export const DEFAULT_OVERLAY_WIDTH = 260;
export const DEFAULT_OVERLAY_HEIGHT = 320;

/**
 * Calcula el rectángulo de recorte en el espacio de píxeles de la foto capturada
 * correspondiente al marco centrado del LeafOverlay en la pantalla.
 *
 * En CameraView con resizeMode "cover", la imagen de la cámara se escala para cubrir
 * la pantalla completa: scale = Math.max(viewWidth / photoWidth, viewHeight / photoHeight).
 * Esta función proyecta el marco de pantalla al espacio de la foto y añade un 15%
 * de margen de seguridad para no cortar bordes de la lesión si la hoja sobresale un poco.
 *
 * @param photoWidth Ancho de la foto capturada en píxeles.
 * @param photoHeight Alto de la foto capturada en píxeles.
 * @param viewWidth Ancho del visor en dp/puntos.
 * @param viewHeight Alto del visor en dp/puntos.
 * @param overlayWidth Ancho del marco visual en dp (default: 260).
 * @param overlayHeight Alto del marco visual en dp (default: 320).
 * @returns {CropRect} Rectángulo listo para ImageManipulator.crop().
 */
export function calculateOverlayCrop(
  photoWidth: number,
  photoHeight: number,
  viewWidth: number,
  viewHeight: number,
  overlayWidth: number = DEFAULT_OVERLAY_WIDTH,
  overlayHeight: number = DEFAULT_OVERLAY_HEIGHT,
): CropRect {
  if (photoWidth <= 0 || photoHeight <= 0) {
    return { originX: 0, originY: 0, width: Math.max(1, photoWidth), height: Math.max(1, photoHeight) };
  }

  // Fallback si la vista aún no ha reportado dimensiones válidas
  if (viewWidth <= 0 || viewHeight <= 0) {
    const defaultSide = Math.min(photoWidth, photoHeight);
    const originX = Math.round((photoWidth - defaultSide * 0.75) / 2);
    const originY = Math.round((photoHeight - defaultSide * 0.75) / 2);
    const size = Math.round(defaultSide * 0.75);
    return { originX, originY, width: size, height: size };
  }

  const scale = Math.max(viewWidth / photoWidth, viewHeight / photoHeight);

  // Margen de seguridad del 15% sobre el marco
  const rawCropWidth = (overlayWidth / scale) * 1.15;
  const rawCropHeight = (overlayHeight / scale) * 1.15;

  const cropWidth = Math.min(photoWidth, Math.round(rawCropWidth));
  const cropHeight = Math.min(photoHeight, Math.round(rawCropHeight));

  const originX = Math.max(0, Math.min(photoWidth - cropWidth, Math.round((photoWidth - cropWidth) / 2)));
  const originY = Math.max(0, Math.min(photoHeight - cropHeight, Math.round((photoHeight - cropHeight) / 2)));

  return { originX, originY, width: cropWidth, height: cropHeight };
}

/**
 * Recorta la foto capturada al área centrada del marco guía.
 *
 * @param photoUri URI local del archivo de foto.
 * @param photoWidth Ancho en píxeles.
 * @param photoHeight Alto en píxeles.
 * @param viewWidth Ancho del visor de cámara en pantalla.
 * @param viewHeight Alto del visor de cámara en pantalla.
 * @returns {Promise<string>} URI de la imagen recortada.
 */
export async function cropPhotoToOverlay(
  photoUri: string,
  photoWidth: number,
  photoHeight: number,
  viewWidth: number,
  viewHeight: number,
): Promise<string> {
  const cropRect = calculateOverlayCrop(photoWidth, photoHeight, viewWidth, viewHeight);

  // Si el recorte abarcaría prácticamente el 100% de la foto, no gastar tiempo re-codificando
  if (cropRect.width >= photoWidth * 0.98 && cropRect.height >= photoHeight * 0.98) {
    return photoUri;
  }

  const context = ImageManipulator.manipulate(photoUri).crop(cropRect);
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ compress: 0.9, format: SaveFormat.JPEG });
  return saved.uri;
}

