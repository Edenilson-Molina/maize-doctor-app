import { readExifOrientation } from './exifOrientation';

function buildJpegWithOrientation(orientation: number): Uint8Array {
  const exifHeader = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"
  const tiffHeader = [0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00]; // "II", 42, IFD@8
  const ifdCount = [0x01, 0x00]; // 1 entry
  const orientationEntry = [
    0x12, 0x01, // tag 0x0112 (Orientation)
    0x03, 0x00, // type 3 (SHORT)
    0x01, 0x00, 0x00, 0x00, // count 1
    orientation, 0x00, 0x00, 0x00, // value
  ];
  const nextIfdOffset = [0x00, 0x00, 0x00, 0x00];
  const payload = [...exifHeader, ...tiffHeader, ...ifdCount, ...orientationEntry, ...nextIfdOffset];
  const app1Length = payload.length + 2;

  return new Uint8Array([
    0xff, 0xd8, // SOI
    0xff, 0xe1, (app1Length >> 8) & 0xff, app1Length & 0xff, // APP1 marker + length
    ...payload,
  ]);
}

describe('readExifOrientation', () => {
  it('lee orientacion 6 (rotar 90 CW) de un JPEG con EXIF valido', () => {
    expect(readExifOrientation(buildJpegWithOrientation(6))).toBe(6);
  });

  it('lee orientacion 3 (rotar 180)', () => {
    expect(readExifOrientation(buildJpegWithOrientation(3))).toBe(3);
  });

  it('devuelve 1 si el JPEG no tiene segmento APP1/EXIF', () => {
    const noExif = new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x02, 0x00, 0xff, 0xd9]);
    expect(readExifOrientation(noExif)).toBe(1);
  });

  it('devuelve 1 para una orientacion espejada no soportada (fuera de alcance)', () => {
    expect(readExifOrientation(buildJpegWithOrientation(2))).toBe(1);
  });

  it('devuelve 1 si los bytes no son un JPEG', () => {
    expect(readExifOrientation(new Uint8Array([0x00, 0x01, 0x02]))).toBe(1);
  });
});
