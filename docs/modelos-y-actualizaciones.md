# Modelos ML y actualizaciones: como funciona hoy

Resumen del estado real del codigo, para no asumir capacidades que todavia no existen.

## 1. El modelo va embebido en el APK

No hay descarga de modelos ni OTA. El `.tflite` es un asset de build:

```
assets/model/
├── labels.json                 # contrato: nombre del modelo, image_size, orden de clases
├── model_int8.tflite           # el modelo ACTIVO (el unico que se embarca), dos salidas:
│                                # logits [1,N] + features pooled [1,feature_dim]
├── ood_stats.json              # centroides/covarianza/umbral Mahalanobis (detector OOD)
└── candidates/                 # staging, NO se embarcan (no los referencia ningun require)
    ├── efficientnet_b0/model_int8.tflite       (4.7 MB)
    ├── efficientnet_lite0/model_int8.tflite    (3.7 MB)
    └── shufflenet_v2_x1_0/model_int8.tflite    (1.5 MB)
```

`TFLiteInferenceEngine` (`src/ml/TFLiteInferenceEngine.ts`) resuelve el modelo con un
`require` de ruta literal:

```js
function resolveModelAsset(): number {
  return require('../../assets/model/model_int8.tflite');
}
```

Metro resuelve ese `require` **en tiempo de compilacion**. Por eso:

- La ruta no puede ser dinamica: no se puede elegir el modelo en runtime.
- Solo `assets/model/model_int8.tflite` entra al APK; `candidates/` se ignora al empaquetar
  aunque ocupe espacio en el repo.

### Como se especifica el modelo activo

Hoy es una **copia de archivo**, no una configuracion:

```bash
# Copiar SIEMPRE el trio desde el mismo directorio de export del pipeline
# (make sync-mobile-model / scripts/pipeline/sync_mobile_model.py hace esto
# automaticamente, con verificacion de hash del .tflite).
SRC=../maize-doctor-classifier/outputs-remote/main/<modelo>/<run_id>/export
cp "$SRC/model_int8.tflite" assets/model/model_int8.tflite
cp "$SRC/labels.json"       assets/model/labels.json
cp "$SRC/ood_stats.json"    assets/model/ood_stats.json
```

Los `candidates/` sirven para comparar tamanos, pero no traen `labels.json` ni
`ood_stats.json`: copiar de ahi obliga a conseguir esos archivos por separado, que es justo
como se produce el desalineo descrito abajo.

Actualmente activo: **`efficientnet_lite0`** (3.7 MB, dos salidas: logits + features pooled
de 1280 dims). El `.tflite`, su `labels.json` y su `ood_stats.json` se copiaron juntos desde
el export autoritativo del pipeline
(`maize-doctor-classifier/outputs-remote/main/efficientnet_lite0/20260812_221429/export/`),
con sha256 `3a0623cd985a23b954e424e605a2e00c91f8d592e376dfe3149e5820485bc2b3` del `.tflite`
verificado contra el origen.

`ood_stats.json` va en **schema_version 4**: el score OOD es la Relative Mahalanobis
Distance (RMD) — distancia a la clase mas cercana menos distancia a una gaussiana de fondo
sin condicionar por clase — calculada sobre features L2-normalizadas y reducidas por PCA
(99% de varianza explicada, 1280 -> 186 dims para este modelo) antes de ajustar cualquier
covarianza. La reduccion PCA es necesaria: el feature vector crudo tiene un espectro de
varianza muy sesgado, y sin reducirlo antes las dimensiones de ruido dominan la distancia.
El umbral se calibra en el percentil 95 del score RMD sobre el split de val
(`threshold=31.47`). Metodologia completa y validacion (sondas sinteticas + fotos reales de
cada clase + una foto real que no es hoja, todas correctamente clasificadas) en
[`maize-doctor-classifier/docs/es/deep-learning/ood-detection.md`](../../maize-doctor-classifier/docs/es/deep-learning/ood-detection.md).

Por que lite0 y no shufflenet, segun `eval_tflite_int8.json` de cada uno (5015 muestras):

| | shufflenet_v2_x1_0 | efficientnet_lite0 |
|---|---|---|
| accuracy | 0.9651 | **0.9785** |
| macro F1 | 0.9229 | **0.9477** |
| peor clase (`potassium_deficiency`) | 0.7709 | **0.8229** |
| tamano | 1.5 MB | 3.7 MB |

lite0 gana en **todas** las clases; el costo es +2.2 MB en el APK.

`labels.json` es el contrato entre el pipeline de ML y la app. El engine mapea el indice de
salida del modelo a una clase **solo** por ese archivo, nunca por el orden de
`DIAGNOSIS_CLASSES`, porque ambos ordenes pueden divergir.

### Validaciones que protegen el emparejamiento

`assertContract()` corre al cargar el modelo y falla ruidosamente si el `.tflite` embarcado
no es el que el engine espera:

| Chequeo | Falla si |
|---|---|
| `dataType === 'float32'` | El modelo no es de cuantizacion dinamica (pesos int8, IO float32) |
| `shape` = 1x3x224x224 | El tamano de entrada no es 224 |
| `outputs[0]` = `labels.length` | El modelo tiene N clases y `labels.json` declara otra cantidad |
| `outputs[1]` existe y es float32 | El modelo solo tiene logits (sin features pooled para OOD) |
| `outputs[1]` = `ood_stats.featureDim` | El `.tflite` y `ood_stats.json` vienen de exports distintos |

Esto detecta un modelo mal copiado, pero **no** detecta que copiaste el `.tflite` correcto y
olvidaste actualizar `labels.json`: si ambos tienen 9 clases, los nombres quedan desalineados
en silencio y cada diagnostico sale mal etiquetado. Sincronizar los tres archivos siempre.

### Como se sube un modelo nuevo

1. Exportar en `maize-doctor-classifier` con `make export-main EXPORT_FORMATS=tflite
   QUANTIZE=int8` (`scripts/pipeline/export.py` envuelve el checkpoint en
   `FeatureExposedModel` para que el `.tflite` tenga dos salidas, y genera `labels.json` via
   `write_labels_json`). El export a TFLite depende de `litert-torch`, que solo soporta
   Linux — correr este paso en WSL u otro entorno Linux, no en Windows/macOS nativo.
2. Calcular `ood_stats.json` sobre el mismo checkpoint con `make compute-ood-stats`
   (`scripts/pipeline/compute_ood_stats.py`).
3. Copiar los tres archivos a `assets/model/` con `make sync-mobile-model RUN_DIR=<run>
   DEST=../maize-doctor-app/assets/model` (verifica el hash del `.tflite` y avisa si falta
   `ood_stats.json`).
4. Recompilar el APK. **Un modelo nuevo obliga a un release nuevo de la app** — no hay forma
   de actualizar el modelo sin reinstalar.

## 2. Actualizaciones de la app desde la API

### Lado servidor: implementado

`GET /app-version?platform=android&currentVersionCode=N` (`app/routers/app_version.py`)
busca el `AppRelease` activo de mayor `version_code` para la plataforma y responde:

```json
{
  "latestVersionCode": 11,
  "latestVersionName": "1.3.0",
  "minSupportedVersionCode": 8,
  "forceUpdate": false,
  "downloadUrl": "https://.../app-1.3.0.apk",
  "releaseNotes": "Bug fixes"
}
```

`forceUpdate` se calcula como `currentVersionCode < min_supported_version_code`: el servidor
decide si la version instalada quedo por debajo del minimo soportado. Si no hay ningun release
activo para la plataforma responde **404**.

Los releases se registran con `POST /app-releases`, protegido por el token compartido
`RELEASE_ADMIN_TOKEN` (cerrado por completo si ese ajuste esta vacio). Publicar desactiva los
releases anteriores de la plataforma, para que un rollback no quede tapado por una fila vieja
todavia activa. Ver `maize-doctor-api/README.md` -> "Publishing a new app release".

### Lado app: implementado

Tres piezas, todas con tests:

| Archivo | Rol |
|---|---|
| `src/api/AppUpdateService.ts` | Consulta `GET /app-version` y clasifica el resultado |
| `src/hooks/useAppUpdate.ts` | Lanza la consulta una vez por arranque y controla la visibilidad |
| `src/components/UpdatePrompt.tsx` | El dialogo que ve el usuario |

`checkForUpdate()` lee el `versionCode` instalado con `expo-application`
(`nativeBuildVersion`) y devuelve uno de cuatro estados:

- `up-to-date` — el release publicado no es mas nuevo que el instalado.
- `optional` — hay version nueva; el dialogo ofrece "Descargar" y "Ahora no".
- `required` — el servidor puso `forceUpdate`; el dialogo no tiene salida
  (sin boton de descartar y con el boton atras de Android neutralizado).
- `unavailable` — no se pudo consultar.

**Nunca lanza y nunca bloquea el arranque.** Sin backend configurado, sin red, con un 404
porque no hay releases, con un payload malformado o si no se puede leer el `versionCode`,
el resultado es `unavailable` y la app sigue normal: un aviso de actualizacion no justifica
interrumpir una app que es offline-first.

Ademas de respetar `forceUpdate`, el cliente descarta cualquier release cuyo
`latestVersionCode` no supere al instalado, para que un registro mal configurado en
`app_releases` no pueda molestar a quien ya esta al dia.

El dialogo se monta en `App.tsx` **fuera** de `AuthProvider` y por encima del navegador, para
que un update requerido tape toda la app sin depender de si hay sesion iniciada.

### Hosting del APK: assets de GitHub Releases

La API no hospeda el binario, solo guarda la URL. El APK vive como **asset de un GitHub
release**, publicado por `.github/workflows/release-apk.yml` en cada merge a `main`. El mismo
workflow registra el release con `POST /app-releases`, asi que la `downloadUrl` que termina en
la base es la del asset:

```
https://github.com/<owner>/<repo>/releases/download/v<version>-<versionCode>/maize-doctor-<version>-<versionCode>.apk
```

`UpdatePrompt` abre esa URL con `Linking.openURL`, que en Android la manda al navegador y este
descarga el APK. El usuario necesita permitir "instalar apps de origen desconocido" — es la
via normal para distribuir fuera de Play Store.

Mientras `app_releases` este vacia, el endpoint responde 404 y la app simplemente no muestra
nada.

### Estado actual del deployment

```
GET /health       -> 200 {"status":"ok"}
GET /app-version  -> 404 {"detail":"No release found for platform"}
```

La API responde correctamente; el 404 solo significa que `app_releases` esta vacia.

## 3. Que falta

Nada para el flujo de actualizaciones de la app: build, publicacion y registro estan
automatizados. Queda pendiente configurar los secrets del repositorio
(`ANDROID_KEYSTORE_*` y `RELEASE_ADMIN_TOKEN`); sin ellos el workflow igual corre, pero firma
con la keystore de debug y/o no registra el release. Ver `docs/build-produccion.md`.

Para actualizar el **modelo** sin republicar la app haria falta un mecanismo aparte
(descargar el `.tflite` a almacenamiento local y cargarlo desde ahi en vez de por `require`);
no esta contemplado en el codigo actual.
