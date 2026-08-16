declare module 'jpeg-js' {
  export interface DecodedJpeg {
    width: number;
    height: number;
    data: Uint8Array;
  }

  export interface DecodeOptions {
    useTArray?: boolean;
    formatAsRGBA?: boolean;
  }

  export function decode(jpegData: Uint8Array, options?: DecodeOptions): DecodedJpeg;
}
