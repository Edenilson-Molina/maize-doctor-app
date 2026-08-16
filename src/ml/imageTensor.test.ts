import { buildInputTensor, softmax } from './imageTensor';

describe('buildInputTensor', () => {
  it('normaliza un pixel segun mean/std de ImageNet', () => {
    const pixels = new Uint8Array([128, 128, 128, 255]);
    const tensor = buildInputTensor(pixels, 1);

    expect(tensor).toHaveLength(3);
    expect(tensor[0]).toBeCloseTo((128 / 255 - 0.485) / 0.229, 5);
    expect(tensor[1]).toBeCloseTo((128 / 255 - 0.456) / 0.224, 5);
    expect(tensor[2]).toBeCloseTo((128 / 255 - 0.406) / 0.225, 5);
  });

  it('ordena el tensor como NCHW: todo el canal R antes que G, G antes que B', () => {
    const pixels = new Uint8Array([
      10, 20, 30, 255,
      40, 50, 60, 255,
      70, 80, 90, 255,
      100, 110, 120, 255,
    ]);
    const tensor = buildInputTensor(pixels, 2);
    const normalize = (value: number, mean: number, std: number) => (value / 255 - mean) / std;

    expect(tensor).toHaveLength(12);
    expect(tensor[0]).toBeCloseTo(normalize(10, 0.485, 0.229), 5);
    expect(tensor[3]).toBeCloseTo(normalize(100, 0.485, 0.229), 5);
    expect(tensor[4]).toBeCloseTo(normalize(20, 0.456, 0.224), 5);
    expect(tensor[8]).toBeCloseTo(normalize(30, 0.406, 0.225), 5);
  });
});

describe('softmax', () => {
  it('devuelve una distribucion que suma 1 y preserva el orden', () => {
    const probs = softmax(new Float32Array([1, 2, 3]));
    expect(probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
    expect(probs[2]).toBeGreaterThan(probs[1]);
    expect(probs[1]).toBeGreaterThan(probs[0]);
  });

  it('es estable ante logits grandes (resta el maximo, no produce NaN)', () => {
    const probs = softmax(new Float32Array([1000, 1001, 1002]));
    expect(Number.isNaN(probs[0])).toBe(false);
    expect(probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 4);
  });
});
