import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Directory, File, Paths } from 'expo-file-system';

const MAX_DIMENSION = 1600;
const JPEG_COMPRESSION = 0.8;

function generateFileName(): string {
  return `scan_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 9)}.jpg`;
}

function getScansDirectory(): Directory {
  const directory = new Directory(Paths.document, 'scans');
  if (!directory.exists) {
    directory.create({ intermediates: true, idempotent: true });
  }
  return directory;
}

export async function savePhotoFile(sourceUri: string): Promise<string> {
  const context = ImageManipulator.manipulate(sourceUri).resize({ width: MAX_DIMENSION });
  const rendered = await context.renderAsync();
  const resized = await rendered.saveAsync({ compress: JPEG_COMPRESSION, format: SaveFormat.JPEG });

  const destination = new File(getScansDirectory(), generateFileName());
  await new File(resized.uri).copy(destination);

  return destination.uri;
}
