import { buildInputTensor, isUnrecognized, mahalanobisDistance, softmax } from './imageTensor';

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

describe('isUnrecognized', () => {
  it('acepta una prediccion con confianza alta y margen amplio', () => {
    expect(isUnrecognized(new Float32Array([0.85, 0.1, 0.05]))).toBe(false);
  });

  it('rechaza cuando la confianza top-1 no alcanza el minimo', () => {
    expect(isUnrecognized(new Float32Array([0.55, 0.3, 0.15]))).toBe(true);
  });

  it('rechaza cuando el margen entre top-1 y top-2 es insuficiente aunque la confianza sea alta', () => {
    // top1=0.65, top2=0.6: ambas superan 0.6 de confianza, pero el margen (0.05) es insuficiente
    expect(isUnrecognized(new Float32Array([0.65, 0.6, 0.05]))).toBe(true);
  });

  it('acepta cuando confianza y margen superan ambos umbrales por poco', () => {
    // top1=0.65 (>0.6), top2=0.45, margen=0.2 (>0.15)
    expect(isUnrecognized(new Float32Array([0.65, 0.45, 0.35]))).toBe(false);
  });
});

describe('mahalanobisDistance', () => {
  // Covarianza identidad: la distancia de Mahalanobis se reduce a distancia
  // euclidiana al cuadrado, facil de verificar a mano.
  const identity = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);

  it('con covarianza identidad, es la distancia euclidiana al cuadrado al centroide', () => {
    const features = new Float32Array([3, 0, 0]);
    const mean = new Float32Array([0, 0, 0]);
    // (3-0)^2 + (0-0)^2 + (0-0)^2 = 9
    expect(mahalanobisDistance(features, [mean], identity)).toBeCloseTo(9, 5);
  });

  it('devuelve 0 cuando features coincide exactamente con un centroide', () => {
    const features = new Float32Array([1, 2, 3]);
    const mean = new Float32Array([1, 2, 3]);
    expect(mahalanobisDistance(features, [mean], identity)).toBeCloseTo(0, 5);
  });

  it('toma el minimo sobre todos los centroides de clase', () => {
    const features = new Float32Array([0, 0, 0]);
    const near = new Float32Array([1, 0, 0]); // distancia^2 = 1
    const far = new Float32Array([5, 0, 0]); // distancia^2 = 25
    expect(mahalanobisDistance(features, [far, near], identity)).toBeCloseTo(1, 5);
  });

  it('con una covarianza no identidad, escala la distancia por eje segun la inversa', () => {
    // Covarianza inversa diag(4, 1, 1): el eje 0 pesa 4x mas que los otros.
    const invCovariance = new Float32Array([4, 0, 0, 0, 1, 0, 0, 0, 1]);
    const features = new Float32Array([1, 1, 0]);
    const mean = new Float32Array([0, 0, 0]);
    // 4*(1)^2 + 1*(1)^2 + 1*(0)^2 = 5
    expect(mahalanobisDistance(features, [mean], invCovariance)).toBeCloseTo(5, 5);
  });
});
