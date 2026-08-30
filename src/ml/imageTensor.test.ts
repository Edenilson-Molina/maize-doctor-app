import {
  buildInputTensor,
  isUnrecognized,
  l2Normalize,
  mahalanobisDistance,
  projectPCA,
  relativeMahalanobisDistance,
  softmax,
} from './imageTensor';

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

describe('l2Normalize', () => {
  it('produce un vector de norma unitaria', () => {
    const normalized = l2Normalize(new Float32Array([3, 4, 0]));
    const norm = Math.sqrt(normalized.reduce((acc, v) => acc + v * v, 0));

    expect(norm).toBeCloseTo(1, 5);
    expect(normalized[0]).toBeCloseTo(0.6, 5);
    expect(normalized[1]).toBeCloseTo(0.8, 5);
  });
});

describe('projectPCA', () => {
  it('proyecta al espacio reducido restando la media y aplicando las componentes', () => {
    // Componentes = filas [1,0,0] y [0,1,0]: se queda con las dos primeras
    // coordenadas despues de centrar.
    const features = new Float32Array([5, 7, 9]);
    const pcaMean = new Float32Array([1, 2, 3]);
    const pcaComponents = new Float32Array([1, 0, 0, 0, 1, 0]);

    const projected = projectPCA(features, pcaMean, pcaComponents, 2);

    expect(projected).toHaveLength(2);
    expect(projected[0]).toBeCloseTo(5 - 1, 5);
    expect(projected[1]).toBeCloseTo(7 - 2, 5);
  });

  it('proyecta correctamente sobre una componente rotada (no alineada a los ejes)', () => {
    const features = new Float32Array([1, 1, 0]);
    const pcaMean = new Float32Array([0, 0, 0]);
    // Componente = direccion [1,1,0]/sqrt(2): proyecta la diagonal sobre si misma.
    const c = 1 / Math.sqrt(2);
    const pcaComponents = new Float32Array([c, c, 0]);

    const projected = projectPCA(features, pcaMean, pcaComponents, 1);

    // (1*c + 1*c + 0*0) = 2c = sqrt(2)
    expect(projected[0]).toBeCloseTo(Math.sqrt(2), 5);
  });
});

describe('relativeMahalanobisDistance', () => {
  // PCA identidad (pcaDim = featureDim, componentes = matriz identidad, media 0):
  // no reduce nada, para poder verificar el score de RMD a mano igual que antes de
  // introducir la reduccion de dimensionalidad.
  const noOpPcaMean = new Float32Array([0, 0, 0]);
  const identity = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);

  it('cancela dimensiones que comparten media y covarianza entre la clase y el fondo', () => {
    // features = [3, 4, 0] normaliza a [0.6, 0.8, 0]. Dimension 0 discrimina (media de
    // clase != media de fondo). Dimensiones 1 y 2 comparten exactamente la misma media
    // y covarianza entre el modelo de clase y el de fondo, como pasaria si no llevan
    // señal relacionada con la clase (el caso que Ren et al. 2021 identifican como el
    // que hace fallar a Mahalanobis "plana" en near-OOD).
    const features = new Float32Array([3, 4, 0]);
    const classMean = new Float32Array([0.5, 100, -50]);
    const backgroundMean = new Float32Array([0, 100, -50]); // dims 1,2 iguales a las de clase
    const invCovariance = new Float32Array([1, 0, 0, 0, 0.01, 0, 0, 0, 0.02]); // misma matriz para clase y fondo

    const classDistance = mahalanobisDistance(l2Normalize(features), [classMean], invCovariance);
    const rmdScore = relativeMahalanobisDistance(
      features,
      [classMean],
      invCovariance,
      backgroundMean,
      invCovariance,
      noOpPcaMean,
      identity,
      3,
    );

    // Sin RMD, la distancia queda dominada por el ruido de las dimensiones 1 y 2.
    expect(classDistance).toBeGreaterThan(100);
    // Con RMD, esas dimensiones se cancelan exactamente y el score depende solo de
    // la dimension 0: (0.6-0.5)^2*1 - (0.6-0)^2*1 = 0.01 - 0.36 = -0.35
    expect(rmdScore).toBeCloseTo(-0.35, 4);
  });

  it('normaliza las features antes de comparar, igual que el pipeline de calibracion', () => {
    const meanPerClass = [new Float32Array([1, 0, 0])];
    const backgroundMean = new Float32Array([0, 0, 0]);

    // [2, 0, 0] normalizado es [1, 0, 0]: coincide exactamente con el centroide de
    // clase, así que la distancia de clase debe ser 0 pase lo que pase con la escala
    // original del vector.
    const distance = relativeMahalanobisDistance(
      new Float32Array([2, 0, 0]),
      meanPerClass,
      identity,
      backgroundMean,
      identity,
      noOpPcaMean,
      identity,
      3,
    );

    // distancia a la clase (0) - distancia al fondo (1, porque [1,0,0] dista 1 de [0,0,0]) = -1
    expect(distance).toBeCloseTo(-1, 5);
  });

  it('reduce dimensionalidad antes de comparar cuando se le da una proyeccion no trivial', () => {
    // Espacio original de 3 dims, proyectado a 2 quedandose solo con las dims 0 y 1
    // (la dim 2 se descarta, como pasaria con una dimension que PCA no retuvo).
    // features = [0.6, 0.8, 0] ya tiene norma unitaria, asi que l2Normalize no la altera.
    const pcaComponents2D = new Float32Array([1, 0, 0, 0, 1, 0]);
    const meanPerClass = [new Float32Array([0.5, 0])];
    const backgroundMean2D = new Float32Array([0, 0]);
    const identity2D = new Float32Array([1, 0, 0, 1]);

    const distance = relativeMahalanobisDistance(
      new Float32Array([0.6, 0.8, 0]),
      meanPerClass,
      identity2D,
      backgroundMean2D,
      identity2D,
      noOpPcaMean,
      pcaComponents2D,
      2,
    );

    // Proyectado: [0.6, 0.8]. classDistance=(0.6-0.5)^2+(0.8-0)^2=0.65
    // backgroundDistance=(0.6-0)^2+(0.8-0)^2=1.0 -> RMD=0.65-1.0=-0.35
    expect(distance).toBeCloseTo(-0.35, 5);
  });
});
