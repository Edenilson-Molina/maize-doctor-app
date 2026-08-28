import { decodeBase64ToBytes, decodeBase64ToFloat32Array } from './base64';

describe('decodeBase64ToBytes', () => {
  it('decodifica un string base64 conocido ("hello" -> bytes ASCII)', () => {
    // Buffer.from('hello').toString('base64') === 'aGVsbG8='
    const bytes = decodeBase64ToBytes('aGVsbG8=');
    expect(Array.from(bytes)).toEqual([104, 101, 108, 108, 111]);
  });

  it('decodifica correctamente sin padding', () => {
    // Buffer.from('ab').toString('base64') === 'YWI='  -> sin '=' es 'YWI'
    const bytes = decodeBase64ToBytes('YWI');
    expect(Array.from(bytes)).toEqual([97, 98]);
  });
});

describe('decodeBase64ToFloat32Array', () => {
  it('hace roundtrip exacto con un Float32Array codificado por Node Buffer', () => {
    const original = new Float32Array([1.5, -2.25, 0, 3.14159, 1024.0]);
    const base64 = Buffer.from(original.buffer).toString('base64');

    const decoded = decodeBase64ToFloat32Array(base64);

    expect(decoded.length).toBe(original.length);
    for (let i = 0; i < original.length; i++) {
      expect(decoded[i]).toBeCloseTo(original[i], 5);
    }
  });

  it('decodifica correctamente un array grande (simula una matriz de covarianza)', () => {
    const size = 1024;
    const original = new Float32Array(size);
    for (let i = 0; i < size; i++) original[i] = Math.sin(i) * 100;
    const base64 = Buffer.from(original.buffer).toString('base64');

    const decoded = decodeBase64ToFloat32Array(base64);

    expect(decoded.length).toBe(size);
    expect(decoded[0]).toBeCloseTo(original[0], 4);
    expect(decoded[size - 1]).toBeCloseTo(original[size - 1], 4);
  });
});
