# Fase 8b — TFLite Model Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder `throw new Error('TFLiteInferenceEngine aún no implementado')` in `src/ml/index.ts` with a real, on-device TFLite inference engine that reproduces the corn-leaf-desease-project pipeline's predictions, matches its documented preprocessing contract exactly, and never mislabels a class due to an index/order mismatch.

**Architecture:** A small preprocessing module (`src/ml/imageTensor.ts` for pure tensor math, `src/ml/exifOrientation.ts` for EXIF parsing, `src/ml/preprocessImage.ts` for I/O orchestration) turns a captured photo into the exact NCHW float32 tensor the model expects, byte-for-byte matching `docs/es/deployment/react-native.md` from the corn-leaf-desease-project repo. `TFLiteInferenceEngine` (`src/ml/TFLiteInferenceEngine.ts`) loads the bundled `.tflite` via `react-native-fast-tflite`, runs it, and maps the output index to a `DiagnosisClass` **by reading `assets/model/labels.json`** — never by assuming array order — because this plan found a live naming mismatch (and a latent ordering mismatch) between the app's own `DiagnosisClass` order and the model's real `class_to_idx` order.

**Tech Stack:** `react-native-fast-tflite` (Nitro-based TFLite runtime), `jpeg-js` (pure-JS JPEG decode, no native deps), `expo-image-manipulator` (EXIF-aware rotate + stretch-resize), `expo-file-system`'s `File` API.

**Spec:** `docs/es/deployment/react-native.md` (corn-leaf-desease-project repo) — the model I/O contract this plan implements. `implementation-plan.md` Fase 8b section (acceptance criteria). Companion plan: `docs/superpowers/plans/2026-08-15-finish-fase-8a-mobile-export.md` in the corn-leaf-desease-project repo — **this plan depends on that one's Task 4 having already copied `assets/model/candidates/<model>/model_int8.tflite` (×3) and `assets/model/labels.json` into this repo.** Do not start Task 6 below until those files exist on disk.

## Global Constraints

- **Never hardcode class order.** `assets/model/labels.json` (produced by the companion plan) is the single source of truth for output-index → class-name mapping. `DiagnosisClass`'s declaration order in `content/diagnosis.ts` is a UI concern only (filter-chip order etc.) and is allowed to differ from the model's `class_to_idx` order — the engine must never index into `DIAGNOSIS_CLASSES` by a raw model output index.
- **Correction to this repo's own `implementation-plan.md`:** the model's TFLite export uses *dynamic* per-channel Int8 quantization (weights only), so its input/output tensors are float32 in both the FP32 and Int8 artifacts — there is no runtime scale/zero-point to read, and `react-native-fast-tflite`'s public API doesn't expose one anyway. `TFLiteInferenceEngine` asserts `dataType === 'float32'` at load time instead of doing quantization-metadata plumbing.
- Preprocessing must match `docs/es/deployment/react-native.md` exactly: EXIF-correct orientation → **stretch** (not crop/pad) to 224×224 → RGB/255 → ImageNet mean/std normalize → NCHW layout. Any deviation degrades accuracy silently, with no error thrown.
- `EXPO_PUBLIC_*` is the only env var namespace visible to the client bundle (coding-standards.md §2) — no secrets, ever.
- One component/module = one file per responsibility (coding-standards.md §3); interfaces (`InferenceEngine`) never share a file with their implementation (§7).
- TypeScript `strict: true`, no explicit `any` (coding-standards.md §1).
- Expo Go cannot run native modules — every task from Task 2 onward requires a development build (`expo run:android` / `expo prebuild`), not Expo Go.
- Existing test pyramid: pure logic → Jest unit test; orchestration touching native modules → Jest with mocks; camera/device-only behavior → manual verification on a Snapdragon 6xx-class Android device (never simulated in CI). Follow this exactly, don't invent a new tier.

---

### Task 1: Fix the `northern_leaf_blight` naming mismatch and app repo Git hygiene

**Files:**
- Modify: `src/content/diagnosis.ts`
- Modify: `src/content/diagnosis.test.ts`
- Modify: `src/data/seedDevData.ts`
- Modify: `src/data/mockData.ts`
- Modify: `src/screens/scan/ScanResult.test.tsx`
- Modify: `src/screens/history/ScanDetail.test.tsx`
- Modify: `src/api/FastApiSyncClient.test.ts`
- Modify: `.gitignore`
- Delete (from Git history going forward, see Step 3): `best.pth`

**Interfaces:**
- Produces: `DiagnosisClass` now includes the literal `'northern_corn_leaf_blight'` (matching `config/dataset.yaml`'s real class name in the corn-leaf-desease-project repo and `assets/model/labels.json`) instead of `'northern_leaf_blight'`. Every later task that resolves a model output index to a class name via `labels.json` depends on this literal matching exactly, or `DIAGNOSIS_MAP[label]` returns `undefined` for that class.

- [ ] **Step 1: Rename the literal everywhere it appears**

Replace every occurrence of the exact substring `northern_leaf_blight` with `northern_corn_leaf_blight` in all 7 files listed above (type union member, array entry, object key, and every quoted string value in the test files — a plain substring replace is correct for all of these since TypeScript object keys here are written as bare identifiers, same characters as the quoted form). Confirm no other occurrences remain:

```bash
grep -rn "northern_leaf_blight" src/
```

Expected: zero matches (the corrected `northern_corn_leaf_blight` will still match a substring search for `northern_leaf_blight`... use a word-boundary check instead):

```bash
grep -rn "northern_leaf_blight'" src/
```

Expected: zero matches (the trailing quote/colon distinguishes the old short name from the new longer one, which never ends in exactly `leaf_blight'` at that boundary — visually confirm each of the 7 files by re-reading them if this check is ambiguous).

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: all existing tests pass (87+ tests per the last recorded count in `implementation-plan.md` Fase 6, plus whatever has been added since) — this is a pure rename, no behavior changes, so nothing should fail or need updating beyond the literal string itself.

- [ ] **Step 3: Remove `best.pth` from the repository**

`best.pth` (a 16 MB PyTorch training checkpoint) is currently committed at the repo root — `implementation-plan.md`'s own "Higiene de repositorio" note says this should never happen; the real source of truth is `outputs-remote/main/efficientnet_b0/20260811_211306/best.pth` in the corn-leaf-desease-project repo. It is not consumed by any app code (confirmed: no reference to `best.pth` anywhere in `src/`).

```bash
git rm best.pth
```

Add to `.gitignore` (under a new `# ML checkpoints (never belong in this repo — see corn-leaf-desease-project)` comment):

```
*.pth
```

- [ ] **Step 4: Commit**

```bash
git add src/content/diagnosis.ts src/content/diagnosis.test.ts src/data/seedDevData.ts src/data/mockData.ts src/screens/scan/ScanResult.test.tsx src/screens/history/ScanDetail.test.tsx src/api/FastApiSyncClient.test.ts .gitignore
git commit -m "fix: rename northern_leaf_blight to northern_corn_leaf_blight to match model taxonomy"
git rm --cached best.pth 2>/dev/null; git commit -am "chore: remove ML training checkpoint from app repo, add *.pth to gitignore"
```

(If `git rm best.pth` in Step 3 already staged the deletion, the second commit's `git rm --cached` is a no-op guard — just verify `git status` shows `best.pth` as deleted and `.gitignore` as modified before committing, and combine into a single commit if that's cleaner in your working tree.)

---

### Task 2: Install the TFLite runtime and wire the native build

**Files:**
- Modify: `package.json`
- Modify: `app.json`
- Modify: `metro.config.js`
- Create: `src/types/jpeg-js.d.ts`

**Interfaces:**
- Produces: `react-native-fast-tflite` and `jpeg-js` available as imports; Metro treats `.tflite` files as binary assets; the dev client's native build includes both libraries. Later tasks (5, 6) import from these packages.

- [ ] **Step 1: Add the dependencies**

In `package.json`, add to `"dependencies"`:

```json
    "react-native-fast-tflite": "^3.0.1",
    "jpeg-js": "^0.4.4",
```

Run: `npm install`
Expected: installs cleanly, `node_modules/react-native-fast-tflite` and `node_modules/jpeg-js` exist.

- [ ] **Step 2: Register `.tflite` as a Metro asset extension**

In `metro.config.js`, add the registration right after `getDefaultConfig` (before the NativeWind wrapper, so it applies to the same underlying `resolver` object):

```js
const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('tflite');

const nwConfig = withNativeWind(config, { input: './src/global.css' });
```

- [ ] **Step 3: Register the `react-native-fast-tflite` Expo config plugin**

In `app.json`, add to the `"plugins"` array (after the existing `expo-image-picker` entry):

```json
      "react-native-fast-tflite"
```

(No delegate options — this ships CPU-only inference for now, matching the low/mid-range Android reference device; GPU delegate is a possible later optimization, out of scope here.)

- [ ] **Step 4: Add local type declarations for `jpeg-js`**

`jpeg-js` ships no TypeScript types. Following the existing precedent in this repo (`src/types/css.d.ts` for NativeWind), create `src/types/jpeg-js.d.ts`:

```ts
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
```

- [ ] **Step 5: Rebuild the dev client and verify it compiles**

```bash
npx expo prebuild --clean
npx expo run:android
```

Expected: build succeeds and the app launches on a connected device/emulator with no native-linking errors mentioning `fast-tflite` or `TFLite`. This is a prerequisite check only — no model is loaded yet (Task 6 does that); this step just proves the native module links.

- [ ] **Step 6: Typecheck and commit**

Run: `npm run typecheck`
Expected: no errors (in particular, no "cannot find module 'jpeg-js'" or "cannot find module 'react-native-fast-tflite'").

```bash
git add package.json package-lock.json app.json metro.config.js src/types/jpeg-js.d.ts
git commit -m "chore: install react-native-fast-tflite and jpeg-js, wire native build"
```

---

### Task 3: Pure tensor math — `imageTensor.ts`

**Files:**
- Create: `src/ml/imageTensor.ts`
- Test: `src/ml/imageTensor.test.ts`

**Interfaces:**
- Produces: `buildInputTensor(pixels: Uint8Array, size: number): Float32Array` — RGBA pixel buffer → flattened NCHW float32 tensor, ImageNet-normalized. `softmax(logits: Float32Array): Float32Array`. Both consumed by `preprocessImage.ts` (Task 5) and `TFLiteInferenceEngine.ts` (Task 6) respectively.

- [ ] **Step 1: Write the failing tests**

Create `src/ml/imageTensor.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- imageTensor`
Expected: FAIL — `Cannot find module './imageTensor'`.

- [ ] **Step 3: Write the implementation**

Create `src/ml/imageTensor.ts`:

```ts
const MEAN = [0.485, 0.456, 0.406] as const;
const STD = [0.229, 0.224, 0.225] as const;

/**
 * Construye el tensor NCHW normalizado que el modelo espera a partir de un buffer
 * de pixeles RGBA ya redimensionado a size x size.
 *
 * @param {Uint8Array} pixels Buffer RGBA (4 bytes/pixel), longitud size*size*4.
 * @param {number} size Lado del cuadrado de entrada (224 para los modelos actuales).
 * @returns {Float32Array} Tensor aplanado en orden NCHW: canal completo antes del siguiente.
 */
export function buildInputTensor(pixels: Uint8Array, size: number): Float32Array {
  const input = new Float32Array(3 * size * size);
  for (let i = 0; i < size * size; i++) {
    for (let c = 0; c < 3; c++) {
      input[c * size * size + i] = (pixels[i * 4 + c] / 255 - MEAN[c]) / STD[c];
    }
  }
  return input;
}

/**
 * Aplica softmax a los logits crudos del modelo.
 *
 * @param {Float32Array} logits Salida cruda del modelo (sin normalizar).
 * @returns {Float32Array} Distribucion de probabilidad, misma longitud que logits.
 */
export function softmax(logits: Float32Array): Float32Array {
  const max = Math.max(...logits);
  const exps = Float32Array.from(logits, (v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return Float32Array.from(exps, (v) => v / sum);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- imageTensor`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/ml/imageTensor.ts src/ml/imageTensor.test.ts
git commit -m "feat(ml): add pure NCHW tensor-building and softmax functions"
```

---

### Task 4: EXIF orientation parser — `exifOrientation.ts`

**Files:**
- Create: `src/ml/exifOrientation.ts`
- Test: `src/ml/exifOrientation.test.ts`

**Interfaces:**
- Produces: `readExifOrientation(bytes: Uint8Array): 1 | 3 | 6 | 8` — reads the EXIF `Orientation` tag from a JPEG's APP1 segment. Recognizes the 4 pure-rotation values (by far the most common from phone cameras); mirrored values (2, 4, 5, 7) and any JPEG without EXIF both return `1` (no correction) — deliberately out of scope, see rationale in the docstring. Consumed by `preprocessImage.ts` (Task 5).

- [ ] **Step 1: Write the failing tests**

Create `src/ml/exifOrientation.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- exifOrientation`
Expected: FAIL — `Cannot find module './exifOrientation'`.

- [ ] **Step 3: Write the implementation**

Create `src/ml/exifOrientation.ts`:

```ts
/**
 * Lee el tag de orientacion EXIF (0x0112) del segmento APP1 de un JPEG.
 *
 * Solo reconoce las 4 orientaciones de rotacion pura (1, 3, 6, 8) que producen
 * casi todas las fotos de camara de telefono. Las orientaciones espejadas
 * (2, 4, 5, 7) son casi inexistentes en capturas reales de camara y se tratan
 * como "sin corregir" (se devuelve 1) para no ampliar el alcance de este parser.
 *
 * @param {Uint8Array} bytes Bytes crudos del archivo JPEG.
 * @returns {1 | 3 | 6 | 8} Orientacion EXIF reconocida, o 1 si no hay tag o no es una de las 4.
 */
export function readExifOrientation(bytes: Uint8Array): 1 | 3 | 6 | 8 {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return 1;

  let offset = 2;
  while (offset < bytes.length - 1 && bytes[offset] === 0xff) {
    const marker = bytes[offset + 1];
    if (marker === 0xe1) return readOrientationFromApp1(bytes, offset + 4);
    if (marker === 0xda) break; // Start of Scan: no hay mas metadata antes de los datos de imagen
    const segmentLength = (bytes[offset + 2] << 8) | bytes[offset + 3];
    offset += 2 + segmentLength;
  }
  return 1;
}

function readOrientationFromApp1(bytes: Uint8Array, app1PayloadStart: number): 1 | 3 | 6 | 8 {
  const exifTag = String.fromCharCode(...bytes.slice(app1PayloadStart, app1PayloadStart + 4));
  if (exifTag !== 'Exif') return 1;

  const tiffOffset = app1PayloadStart + 6;
  const littleEndian = bytes[tiffOffset] === 0x49; // "II" little-endian, "MM" big-endian
  const readUint16 = (o: number): number =>
    littleEndian ? bytes[o] | (bytes[o + 1] << 8) : (bytes[o] << 8) | bytes[o + 1];
  const readUint32 = (o: number): number =>
    littleEndian
      ? bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16) | (bytes[o + 3] << 24)
      : (bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3];

  const ifdOffset = tiffOffset + readUint32(tiffOffset + 4);
  const entryCount = readUint16(ifdOffset);
  for (let i = 0; i < entryCount; i++) {
    const entryOffset = ifdOffset + 2 + i * 12;
    if (readUint16(entryOffset) === 0x0112) {
      const value = readUint16(entryOffset + 8);
      return value === 3 || value === 6 || value === 8 ? value : 1;
    }
  }
  return 1;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- exifOrientation`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/ml/exifOrientation.ts src/ml/exifOrientation.test.ts
git commit -m "feat(ml): add EXIF orientation parser for the 4 common phone-camera rotations"
```

---

### Task 5: Preprocessing orchestration — `preprocessImage.ts`

**Files:**
- Create: `src/ml/preprocessImage.ts`
- Test: `src/ml/preprocessImage.test.ts`

**Interfaces:**
- Consumes: `readExifOrientation` (Task 4), `buildInputTensor` (Task 3).
- Produces: `preprocessImage(imageUri: string, size: number): Promise<Float32Array>`. Consumed by `TFLiteInferenceEngine.predict()` (Task 6).

- [ ] **Step 1: Write the failing test**

Create `src/ml/preprocessImage.test.ts`:

```ts
import { buildInputTensor } from './imageTensor';

const DECODED_PIXELS = new Uint8Array([
  10, 20, 30, 255,
  40, 50, 60, 255,
  70, 80, 90, 255,
  100, 110, 120, 255,
]);

jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation((uri: string) => ({
    bytes: jest.fn().mockResolvedValue(
      uri === 'file://original.jpg'
        ? new Uint8Array([0xff, 0xd8, 0xff, 0xd9]) // JPEG sin EXIF -> orientacion 1
        : new Uint8Array([1, 2, 3]), // contenido del archivo redimensionado; jpeg-js esta mockeado abajo
    ),
  })),
}));

jest.mock('expo-image-manipulator', () => {
  const context = {
    rotate: jest.fn(() => context),
    resize: jest.fn(() => context),
    renderAsync: jest.fn().mockResolvedValue({
      saveAsync: jest.fn().mockResolvedValue({ uri: 'file://resized.jpg' }),
    }),
  };
  return {
    SaveFormat: { JPEG: 'jpeg' },
    ImageManipulator: { manipulate: jest.fn(() => context) },
  };
});

jest.mock('jpeg-js', () => ({
  decode: jest.fn(() => ({ width: 2, height: 2, data: DECODED_PIXELS })),
}));

import { preprocessImage } from './preprocessImage';
import { ImageManipulator } from 'expo-image-manipulator';

describe('preprocessImage', () => {
  it('decodifica la imagen redimensionada y produce el mismo tensor que buildInputTensor', async () => {
    const tensor = await preprocessImage('file://original.jpg', 2);
    expect(tensor).toEqual(buildInputTensor(DECODED_PIXELS, 2));
  });

  it('redimensiona estirando a size x size (sin preservar aspecto)', async () => {
    await preprocessImage('file://original.jpg', 2);
    const context = (ImageManipulator.manipulate as jest.Mock).mock.results[0].value;
    expect(context.resize).toHaveBeenCalledWith({ width: 2, height: 2 });
  });

  it('no llama a rotate cuando la orientacion EXIF es 1 (sin corregir)', async () => {
    await preprocessImage('file://original.jpg', 2);
    const context = (ImageManipulator.manipulate as jest.Mock).mock.results[0].value;
    expect(context.rotate).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- preprocessImage`
Expected: FAIL — `Cannot find module './preprocessImage'`.

- [ ] **Step 3: Write the implementation**

Create `src/ml/preprocessImage.ts`:

```ts
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File } from 'expo-file-system';
import jpeg from 'jpeg-js';
import { readExifOrientation } from './exifOrientation';
import { buildInputTensor } from './imageTensor';

const ROTATION_BY_ORIENTATION: Record<1 | 3 | 6 | 8, number> = {
  1: 0,
  3: 180,
  6: 90,
  8: -90,
};

/**
 * Prepara una foto capturada/elegida para el modelo: corrige orientacion EXIF,
 * la estira a size x size (sin preservar aspecto, igual que el pipeline de
 * entrenamiento) y devuelve el tensor NCHW normalizado listo para inferencia.
 *
 * @param {string} imageUri URI file:// de la foto ya guardada (ver scanStorage.ts).
 * @param {number} size Lado del cuadrado de entrada del modelo (224).
 * @returns {Promise<Float32Array>} Tensor aplanado NCHW, longitud 3*size*size.
 */
export async function preprocessImage(imageUri: string, size: number): Promise<Float32Array> {
  const originalBytes = await new File(imageUri).bytes();
  const rotationDegrees = ROTATION_BY_ORIENTATION[readExifOrientation(originalBytes)];

  let context = ImageManipulator.manipulate(imageUri);
  if (rotationDegrees !== 0) {
    context = context.rotate(rotationDegrees);
  }
  const rendered = await context.resize({ width: size, height: size }).renderAsync();
  const resized = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 1 });

  const resizedBytes = await new File(resized.uri).bytes();
  const decoded = jpeg.decode(resizedBytes, { useTArray: true });

  return buildInputTensor(decoded.data, size);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- preprocessImage`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/ml/preprocessImage.ts src/ml/preprocessImage.test.ts
git commit -m "feat(ml): add image preprocessing pipeline matching the training contract"
```

---

### Task 6: `TFLiteInferenceEngine`

**Files:**
- Create: `src/ml/TFLiteInferenceEngine.ts`
- Test: `src/ml/TFLiteInferenceEngine.test.ts`

**Interfaces:**
- Consumes: `preprocessImage` (Task 5), `softmax` (Task 3), `InferenceEngine`/`InferenceResult` (already defined in `src/ml/InferenceEngine.ts`), `assets/model/labels.json` and `assets/model/candidates/<model>/model_int8.tflite` (produced by the companion corn-leaf-desease-project plan's Task 4 — **must exist on disk before this task starts**).
- Produces: `class TFLiteInferenceEngine implements InferenceEngine`. Consumed by `src/ml/index.ts`'s factory (Task 7).

**Prerequisite check before Step 1:** confirm the companion plan's handoff landed:

```bash
ls assets/model/labels.json assets/model/candidates/efficientnet_b0/model_int8.tflite assets/model/candidates/efficientnet_lite0/model_int8.tflite assets/model/candidates/shufflenet_v2_x1_0/model_int8.tflite
```

Expected: all 4 files exist. If not, stop and complete Task 4 of `2026-08-15-finish-fase-8a-mobile-export.md` in the corn-leaf-desease-project repo first.

- [ ] **Step 1: Write the failing tests**

Create `src/ml/TFLiteInferenceEngine.test.ts`. This test is the direct regression check for the class-order/naming bug found while auditing this repo: it asserts the engine maps the model's output index through `labels.json`, using the **real** index order from the companion plan's Fase 8a output (`common_rust=0, fall_armyworm=1, gray_leaf_spot=2, healthy=3, lethal_necrosis=4, nitrogen_deficiency=5, northern_corn_leaf_blight=6, phosphorus_deficiency=7, potassium_deficiency=8`) — which does **not** match `DIAGNOSIS_CLASSES`' declaration order in `content/diagnosis.ts`.

```ts
jest.mock('react-native-fast-tflite', () => ({ loadTensorflowModel: jest.fn() }));
jest.mock('./preprocessImage', () => ({ preprocessImage: jest.fn() }));

import { loadTensorflowModel } from 'react-native-fast-tflite';
import { preprocessImage } from './preprocessImage';
import { TFLiteInferenceEngine } from './TFLiteInferenceEngine';
import { DIAGNOSIS_CLASSES } from '@/content/diagnosis';
import labelsData from '../../assets/model/labels.json';

describe('TFLiteInferenceEngine', () => {
  beforeEach(() => {
    (preprocessImage as jest.Mock).mockResolvedValue(new Float32Array(3 * 224 * 224));
  });

  it('mapea el logit mas alto a la clase de labels.json en esa posicion, no al orden de DIAGNOSIS_CLASSES', async () => {
    const healthyIndex = labelsData.labels.indexOf('healthy');
    const fakeLogits = new Float32Array(labelsData.labels.length).fill(0);
    fakeLogits[healthyIndex] = 10;
    (loadTensorflowModel as jest.Mock).mockResolvedValue({
      inputs: [{ dataType: 'float32', shape: [1, 3, 224, 224] }],
      outputs: [{ dataType: 'float32', shape: [1, labelsData.labels.length] }],
      runSync: jest.fn(() => [fakeLogits.buffer]),
    });

    const engine = new TFLiteInferenceEngine();
    const result = await engine.predict('file://leaf.jpg');

    expect(result.label).toBe('healthy');
    expect(DIAGNOSIS_CLASSES.indexOf('healthy')).not.toBe(healthyIndex);
  });

  it('la distribucion cubre las 9 clases y suma aproximadamente 1', async () => {
    const fakeLogits = new Float32Array(labelsData.labels.length).fill(0);
    (loadTensorflowModel as jest.Mock).mockResolvedValue({
      inputs: [{ dataType: 'float32', shape: [1, 3, 224, 224] }],
      outputs: [{ dataType: 'float32', shape: [1, labelsData.labels.length] }],
      runSync: jest.fn(() => [fakeLogits.buffer]),
    });

    const engine = new TFLiteInferenceEngine();
    const result = await engine.predict('file://leaf.jpg');

    expect(Object.keys(result.distribution)).toHaveLength(labelsData.labels.length);
    const sum = Object.values(result.distribution).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 4);
  });

  it('lanza un error claro si el modelo declara un tensor de entrada no-float32', async () => {
    (loadTensorflowModel as jest.Mock).mockResolvedValue({
      inputs: [{ dataType: 'int8', shape: [1, 3, 224, 224] }],
      outputs: [{ dataType: 'float32', shape: [1, labelsData.labels.length] }],
      runSync: jest.fn(),
    });

    const engine = new TFLiteInferenceEngine();
    await expect(engine.predict('file://leaf.jpg')).rejects.toThrow(/float32/);
  });

  it('lanza un error claro si labels.json y la forma de salida del modelo no coinciden en numero de clases', async () => {
    (loadTensorflowModel as jest.Mock).mockResolvedValue({
      inputs: [{ dataType: 'float32', shape: [1, 3, 224, 224] }],
      outputs: [{ dataType: 'float32', shape: [1, 3] }],
      runSync: jest.fn(),
    });

    const engine = new TFLiteInferenceEngine();
    await expect(engine.predict('file://leaf.jpg')).rejects.toThrow(/labels\.json/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- TFLiteInferenceEngine`
Expected: FAIL — `Cannot find module './TFLiteInferenceEngine'`.

- [ ] **Step 3: Write the implementation**

Create `src/ml/TFLiteInferenceEngine.ts`:

```ts
import { loadTensorflowModel, type TensorflowModel } from 'react-native-fast-tflite';
import type { DiagnosisClass } from '@/content/diagnosis';
import { logger } from '@/lib/logger';
import type { InferenceEngine, InferenceResult } from './InferenceEngine';
import { preprocessImage } from './preprocessImage';
import { softmax } from './imageTensor';
import labelsData from '../../assets/model/labels.json';

const INPUT_SIZE = 224;
const LABELS = labelsData.labels as DiagnosisClass[];

function resolveModelAsset(): number {
  const candidate = process.env.EXPO_PUBLIC_MODEL_CANDIDATE ?? 'shufflenet_v2_x1_0';
  switch (candidate) {
    case 'efficientnet_b0':
      return require('../../assets/model/candidates/efficientnet_b0/model_int8.tflite');
    case 'efficientnet_lite0':
      return require('../../assets/model/candidates/efficientnet_lite0/model_int8.tflite');
    case 'shufflenet_v2_x1_0':
    default:
      return require('../../assets/model/candidates/shufflenet_v2_x1_0/model_int8.tflite');
  }
}

export class TFLiteInferenceEngine implements InferenceEngine {
  private modelPromise: Promise<TensorflowModel> | null = null;

  private async getModel(): Promise<TensorflowModel> {
    if (!this.modelPromise) {
      this.modelPromise = loadTensorflowModel(resolveModelAsset(), []);
    }
    const model = await this.modelPromise;
    this.assertContract(model);
    return model;
  }

  private assertContract(model: TensorflowModel): void {
    const input = model.inputs[0];
    if (input.dataType !== 'float32') {
      throw new Error(
        `TFLiteInferenceEngine: se esperaba tensor de entrada float32, el modelo tiene '${input.dataType}'. ` +
          'Este pipeline exporta con cuantizacion dinamica (pesos int8, entrada/salida float32); un tensor ' +
          'de entrada no-float32 significa que el .tflite embarcado no es el que este engine espera.',
      );
    }
    const expectedLength = 3 * INPUT_SIZE * INPUT_SIZE;
    const declaredLength = input.shape.reduce((a, b) => a * b, 1);
    if (declaredLength !== expectedLength) {
      throw new Error(
        `TFLiteInferenceEngine: forma de entrada inesperada ${JSON.stringify(input.shape)} ` +
          `(se esperaban ${expectedLength} elementos para un tensor 1x3x${INPUT_SIZE}x${INPUT_SIZE}).`,
      );
    }
    const outputSize = model.outputs[0].shape[model.outputs[0].shape.length - 1];
    if (outputSize !== LABELS.length) {
      throw new Error(
        `TFLiteInferenceEngine: labels.json tiene ${LABELS.length} clases pero el modelo declara ` +
          `${outputSize} salidas.`,
      );
    }
  }

  async predict(imageUri: string): Promise<InferenceResult> {
    const model = await this.getModel();
    const inputTensor = await preprocessImage(imageUri, INPUT_SIZE);

    const [outputBuffer] = model.runSync([inputTensor.buffer]);
    const probabilities = softmax(new Float32Array(outputBuffer));

    const distribution = {} as Record<DiagnosisClass, number>;
    let bestIndex = 0;
    for (let i = 0; i < LABELS.length; i++) {
      distribution[LABELS[i]] = probabilities[i];
      if (probabilities[i] > probabilities[bestIndex]) bestIndex = i;
    }

    return {
      label: LABELS[bestIndex],
      confidence: probabilities[bestIndex],
      distribution,
    };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- TFLiteInferenceEngine`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/ml/TFLiteInferenceEngine.ts src/ml/TFLiteInferenceEngine.test.ts
git commit -m "feat(ml): implement TFLiteInferenceEngine, mapping output index via labels.json"
```

---

### Task 7: Wire the real engine into the factory and add candidate/mock env vars

**Files:**
- Modify: `src/ml/index.ts`
- Create: `src/ml/index.test.ts`
- Create: `.env.example`

**Interfaces:**
- Produces: `getInferenceEngine()` now returns a real `TFLiteInferenceEngine` when `EXPO_PUBLIC_USE_MOCK_MODEL === 'false'`, replacing the placeholder throw.

- [ ] **Step 1: Write the failing test**

Create `src/ml/index.test.ts`:

```ts
jest.mock('./MockInferenceEngine', () => ({ MockInferenceEngine: jest.fn() }));
jest.mock('./TFLiteInferenceEngine', () => ({ TFLiteInferenceEngine: jest.fn() }));

import { MockInferenceEngine } from './MockInferenceEngine';
import { TFLiteInferenceEngine } from './TFLiteInferenceEngine';

describe('getInferenceEngine', () => {
  const originalEnv = process.env.EXPO_PUBLIC_USE_MOCK_MODEL;

  afterEach(() => {
    process.env.EXPO_PUBLIC_USE_MOCK_MODEL = originalEnv;
    jest.resetModules();
  });

  it('devuelve TFLiteInferenceEngine cuando EXPO_PUBLIC_USE_MOCK_MODEL es exactamente "false"', async () => {
    process.env.EXPO_PUBLIC_USE_MOCK_MODEL = 'false';
    const { getInferenceEngine } = await import('./index');
    getInferenceEngine();
    expect(TFLiteInferenceEngine).toHaveBeenCalled();
    expect(MockInferenceEngine).not.toHaveBeenCalled();
  });

  it('devuelve MockInferenceEngine por defecto (variable sin definir)', async () => {
    delete process.env.EXPO_PUBLIC_USE_MOCK_MODEL;
    const { getInferenceEngine } = await import('./index');
    getInferenceEngine();
    expect(MockInferenceEngine).toHaveBeenCalled();
    expect(TFLiteInferenceEngine).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/ml/index.test`
Expected: FAIL — the current `getInferenceEngine()` throws instead of constructing `TFLiteInferenceEngine` when the flag is `'false'`.

- [ ] **Step 3: Update the implementation**

Modify `src/ml/index.ts`:

```ts
import type { InferenceEngine } from './InferenceEngine';
import { MockInferenceEngine } from './MockInferenceEngine';
import { TFLiteInferenceEngine } from './TFLiteInferenceEngine';

export type { InferenceEngine, InferenceResult } from './InferenceEngine';

export const getInferenceEngine = (): InferenceEngine => {
  if (process.env.EXPO_PUBLIC_USE_MOCK_MODEL === 'false') {
    return new TFLiteInferenceEngine();
  }
  return new MockInferenceEngine();
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/ml/index.test`
Expected: PASS, 2 tests.

- [ ] **Step 5: Add `.env.example`**

Create `.env.example` at the repo root (documents the two `EXPO_PUBLIC_*` vars this plan introduces/uses, per coding-standards.md §2 — no real secrets, these are both plain feature flags):

```
# true (default) usa MockInferenceEngine; 'false' exactamente activa TFLiteInferenceEngine.
EXPO_PUBLIC_USE_MOCK_MODEL=true

# Solo relevante durante el benchmark de la Tarea 8: que candidato de assets/model/candidates/
# cargar. Uno de: efficientnet_b0 | efficientnet_lite0 | shufflenet_v2_x1_0.
EXPO_PUBLIC_MODEL_CANDIDATE=shufflenet_v2_x1_0
```

- [ ] **Step 6: Run the full suite and commit**

Run: `npm test && npm run typecheck`
Expected: all tests pass, no type errors.

```bash
git add src/ml/index.ts src/ml/index.test.ts .env.example
git commit -m "feat(ml): wire TFLiteInferenceEngine into the engine factory"
```

---

### Task 8: On-device benchmark, final model selection, and candidate cleanup

**Files:**
- Delete: `assets/model/candidates/<two unchosen models>/`
- Move: `assets/model/candidates/<chosen model>/model_int8.tflite` → `assets/model/model_int8.tflite`
- Modify: `src/ml/TFLiteInferenceEngine.ts` (collapse `resolveModelAsset()` to a single `require`)
- Modify: `.env.example` (remove `EXPO_PUBLIC_MODEL_CANDIDATE`)

**Interfaces:** none new — this task only measures, decides, and simplifies what Tasks 6–7 already built.

This is the Fase 8b acceptance-criteria task from `implementation-plan.md`: size ≤ 20 MB (already true for all 3 candidates — Task 4 of the companion plan), latency ≤ 300 ms on a Snapdragon 6xx-class device (only measurable here), and output-order correctness verified against the server (`react-native.md`'s own recommended check).

- [ ] **Step 1: Build the dev client on the reference device class**

```bash
npx expo run:android
```

On an Android device with ≥ 4 GB RAM and a Snapdragon 6xx-class (or equivalent) CPU — **not** the newest/fastest device available, per `model-ml.md`'s explicit constraint. Confirm `adb devices` shows it before proceeding.

- [ ] **Step 2: Instrument and measure latency for each candidate**

Temporarily wrap the `model.runSync(...)` call in `TFLiteInferenceEngine.predict()` with timing, logged via the existing `logger`:

```ts
    const start = performance.now();
    const [outputBuffer] = model.runSync([inputTensor.buffer]);
    logger.warn('TFLiteInferenceEngine: runSync tomo', performance.now() - start, 'ms');
```

For each of the 3 candidates, set `EXPO_PUBLIC_MODEL_CANDIDATE` in `.env.local` (gitignored per `.gitignore`'s existing `.env*.local` rule) to `efficientnet_b0`, `efficientnet_lite0`, and `shufflenet_v2_x1_0` in turn, set `EXPO_PUBLIC_USE_MOCK_MODEL=false`, and for each: `npx expo start --clear` (env vars are inlined at bundle time, a full reload is required per candidate), capture 5 photos of real leaves through the app's normal camera flow, and record the logged `runSync` latency for each. Also record `ls -la assets/model/candidates/<model>/model_int8.tflite` for the exact shipped size.

Expected: a small table of (model, mean latency ms, size MB) for all 3 — this is the missing half of the comparison table the companion plan's Task 4 handed off (which had size + desktop macro-F1, not on-device latency).

- [ ] **Step 3: Verify output-order correctness against the server**

Per `react-native.md`'s "Verificar que la app coincide con el servidor" section: pick one test-split image referenced in the corn-leaf-desease-project repo's `outputs-remote/main/<model>/*/export/eval_tflite_int8_predictions.csv` (produced by the companion plan's Task 3), copy that exact image onto the test device, run it through the app's gallery-picker flow, and confirm the app's predicted `label` and approximate `confidence` match the CSV row for that image. This is the cheapest possible end-to-end check that preprocessing (Tasks 3–5) and label mapping (Task 6) are both correct together, not just individually unit-tested.

Expected: predicted class matches exactly; confidence within a few percentage points (small floating-point/JPEG-recompression differences between the desktop eval path and the on-device path are expected and fine — a completely different class or wildly different confidence means revisit preprocessing).

- [ ] **Step 4: Pick the final model and remove the runSync timing instrumentation**

Using latency (Step 2) + size (already known) + macro-F1 (from the companion plan's handoff) + the ≤300ms/≤20MB hard constraints, pick one model. Remove the temporary `performance.now()` logging added in Step 2 from `TFLiteInferenceEngine.predict()`.

- [ ] **Step 5: Collapse to a single shipped model**

```bash
mkdir -p assets/model
mv assets/model/candidates/<chosen-model>/model_int8.tflite assets/model/model_int8.tflite
rm -rf assets/model/candidates
```

Simplify `TFLiteInferenceEngine.ts`'s `resolveModelAsset()` to:

```ts
function resolveModelAsset(): number {
  return require('../../assets/model/model_int8.tflite');
}
```

Remove the `EXPO_PUBLIC_MODEL_CANDIDATE` line from `.env.example`. Update `TFLiteInferenceEngine.test.ts`'s mock/import of `labelsData` if its relative path changed (it didn't — `labels.json` was already at `assets/model/labels.json`, only `candidates/` moves).

- [ ] **Step 6: Run the full verification suite**

```bash
npm test
npm run typecheck
npm run lint
```

Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add assets/model src/ml/TFLiteInferenceEngine.ts .env.example
git commit -m "feat(ml): finalize on-device model selection after latency benchmark"
```

- [ ] **Step 8: Flip the default and do a final full manual pass**

Set `EXPO_PUBLIC_USE_MOCK_MODEL=false` as the checked-in default is **not** recommended (keep mock-by-default for CI/Jest/Expo-Go-less contributors, per the existing pattern) — instead, confirm `.env.local` on the test device has it set to `false`, and run the complete offline flow from `implementation-plan.md`'s Fase 9 checklist once with the real model: camera → capture → real inference → `ScanResult` → historial → corrección, in airplane mode, on the reference device. This is the same manual-in-airplane-mode pattern already used for every previous phase (coding-standards.md §12) — no new tooling, just the existing checklist with the mock swapped for the real engine.

---

## Self-Review Notes

- **Spec coverage:** every Fase 8b bullet from `implementation-plan.md` is covered — receive artifact + validate contract (Task 6's `assertContract`), implement `TFLiteInferenceEngine` (Task 6), benchmark on reference device (Task 8), flip `EXPO_PUBLIC_USE_MOCK_MODEL=false` (Task 7 + Task 8 Step 8), all 3 hard acceptance criteria (size/latency/order — Task 8 Steps 2–3).
- **Corrected, not carried over:** the original plan's "leer normalización/cuantización de metadatos del tensor de entrada en runtime" requirement is explicitly replaced with a load-time `dataType === 'float32'` assertion (Global Constraints + Task 6), because the research underlying this plan found (a) `react-native-fast-tflite` doesn't expose scale/zero-point at all, and (b) this pipeline's dynamic quantization means there isn't one to read on the input tensor in the first place.
- **Placeholder scan:** no TBD/"handle edge cases"/unvalidated-assumption code paths; the two genuinely open questions found during research (whether `ImageManipulator` auto-applies EXIF, and the model's true NCHW vs NHWC layout) are resolved by not relying on either assumption — EXIF is corrected explicitly (Task 4) regardless of what `ImageManipulator` might already do, and the input shape is asserted at runtime (Task 6) rather than hardcoded.
- **Type consistency:** `InferenceResult`/`InferenceEngine` (pre-existing, untouched) is implemented identically by `TFLiteInferenceEngine` (Task 6) and `MockInferenceEngine` (pre-existing) — `getInferenceEngine()`'s return type in Task 7 is unchanged. `buildInputTensor(pixels, size)` (Task 3) is called with matching argument order/types from `preprocessImage.ts` (Task 5) and tested identically in both files' tests.
