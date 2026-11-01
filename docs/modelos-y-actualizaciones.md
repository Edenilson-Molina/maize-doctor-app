# Modelos ML y actualizaciones: como funciona hoy

Resumen del estado real del codigo, para no asumir capacidades que todavia no existen.

## 1. El modelo va embebido en el APK

No hay descarga de modelos ni OTA. El modelo y sus contratos son assets de build:

```
assets/model/
├── labels.json
├── manifest.json
├── model_int8.tflite
└── ood_stats.json
```

| Archivo | Contenido |
|---|---|
| `model_int8.tflite` | Modelo activo, con dos salidas: logits `[1,N]` y features pooled `[1,feature_dim]` |
| `labels.json` | Contrato con el pipeline: modelo, `image_size`, orden de clases y preprocesado |
| `ood_stats.json` | PCA, centroides, covarianzas y umbral del detector OOD |
| `manifest.json` | Run de origen, SHA-256 del `.tflite` y si `ood_stats.json` salio del mismo export |

`TFLiteInferenceEngine` (`src/ml/TFLiteInferenceEngine.ts`) resuelve el modelo con un `require` de ruta literal:

```js
function resolveModelAsset(): number {
  return require('../../assets/model/model_int8.tflite');
}
```

Metro resuelve ese `require` **en tiempo de compilacion**, asi que la ruta no puede ser dinamica: no se puede elegir el modelo en runtime.

### Modelo activo

**EfficientNet-Lite0, run `20260921_204608`**, el modelo oficial del clasificador. El `.tflite`, `labels.json` y `ood_stats.json` se copiaron juntos con `sync_mobile_model` desde `maize-doctor-classifier/outputs/main/efficientnet_lite0/20260921_204608/export/`; `manifest.json` registra el SHA-256 del `.tflite` (`bb31467a58c11cd474159bd5739a7a57b1f1edfda6b5dbfae8fa91337f3c56b1`, 3 743 728 B) y `ood_stats_synced: true`.

| | PyTorch FP32 | TFLite int8 |
|---|---|---|
| Accuracy (test, 5 015) | 0.9781 | 0.9787 |
| Macro F1 (test, 5 015) | 0.9480 | 0.9489 |

El int8 coincide con PyTorch en el 99.74 % de las predicciones del test. Reemplazo al Lite0 `20260812_221429` de la etapa 2; sobre las imagenes de test que comparten ambos splits no hay diferencia medible entre los dos.

`ood_stats.json` va en **schema_version 4**: el score OOD es la Relative Mahalanobis Distance (RMD) — distancia a la clase mas cercana menos distancia a una gaussiana de fondo sin condicionar por clase — calculada sobre features L2-normalizadas y reducidas por PCA (99 % de varianza explicada, 1280 -> 182 dims) antes de ajustar cualquier covarianza. El umbral es el percentil 95 del RMD sobre el split de validacion (`threshold=106.37`): rechaza el 3.8 % de 500 imagenes de test y detecta las cinco sondas sinteticas (negro, blanco, gris, ruido, azul).

`labels.json` es el contrato entre el pipeline de ML y la app. El engine mapea el indice de salida del modelo a una clase **solo** por ese archivo, nunca por el orden de `DIAGNOSIS_CLASSES`, porque ambos ordenes pueden divergir.

### Preprocesado igual al del entrenamiento

`preprocessImageWithSkia` (`src/ml/preprocessImageSkia.ts`) decodifica con Skia, que aplica la rotacion EXIF, y reduce a la mitad cada lado que mida al menos cuatro veces 224. El paso final a 224x224 lo hace `resizeBilinearAntialias` (`src/ml/resample.ts`), que replica byte a byte el `Resize` bilineal de Pillow que usa el entrenamiento; `resample.test.ts` lo compara contra salidas reales de Pillow.

Medido en el Motorola edge 40 neo con 143 imagenes (95 fotos de campo y 48 del corpus), el telefono da la misma prediccion que el int8 del servidor en las 143. Preprocesado: 98 ms de mediana (279 ms p95); inferencia: 23 ms de mediana.

### Validaciones que protegen el emparejamiento

`assertContract()` corre al cargar el modelo y falla ruidosamente si el `.tflite` embarcado no es el que el engine espera:

| Chequeo | Falla si |
|---|---|
| `dataType === 'float32'` | El modelo no es de cuantizacion dinamica (pesos int8, IO float32) |
| `shape` = 1x3x224x224 | El tamano de entrada no es 224 |
| `outputs[0]` = `labels.length` | El modelo tiene N clases y `labels.json` declara otra cantidad |
| `outputs[1]` existe y es float32 | El modelo solo tiene logits (sin features pooled para OOD) |
| `outputs[1]` = `ood_stats.featureDim` | El `.tflite` y `ood_stats.json` vienen de exports distintos |

Esto detecta un modelo mal copiado, pero **no** detecta que se copio el `.tflite` correcto y se olvido actualizar `labels.json`: si ambos tienen 9 clases, los nombres quedan desalineados en silencio. Por eso los archivos se copian siempre juntos con `sync_mobile_model`.

### Como se sube un modelo nuevo

1. Exportar en `maize-doctor-classifier` con `make modal-export-main RUN=<run_id> EXPORT_FORMATS=tflite QUANTIZE=int8` (`scripts/pipeline/export.py` envuelve el checkpoint en `FeatureExposedModel` para que el `.tflite` tenga dos salidas y genera `labels.json`). El export a TFLite depende de `litert-torch`, que solo soporta Linux.
2. Medir el `.tflite` sobre el test completo con `make modal-eval-export-main RUN=<run_id> EXPORT_FORMATS=tflite QUANTIZE=int8`.
3. Calcular `ood_stats.json` sobre el mismo checkpoint con `make compute-ood-stats RUN=<run_id>`.
4. Copiar los archivos a `assets/model/` con `make sync-mobile-model RUN_DIR=<run_dir> DEST=../maize-doctor-app/assets/model`, que verifica el hash del `.tflite` y avisa si falta `ood_stats.json`.
5. Recompilar el APK. **Un modelo nuevo obliga a un release nuevo de la app**: no hay forma de actualizar el modelo sin reinstalar.

## 2. Actualizaciones de la app desde la API

### Lado servidor: implementado

`GET /app-version?platform=android&currentVersionCode=N` (`app/routers/app_version.py`) busca el `AppRelease` activo de mayor `version_code` para la plataforma y responde:

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

`forceUpdate` se calcula como `currentVersionCode < min_supported_version_code`: el servidor decide si la version instalada quedo por debajo del minimo soportado. Si no hay ningun release activo para la plataforma responde **404**.

Los releases se registran con `POST /app-releases`, protegido por el token compartido `RELEASE_ADMIN_TOKEN` (cerrado por completo si ese ajuste esta vacio). Publicar desactiva los releases anteriores de la plataforma, para que un rollback no quede tapado por una fila vieja todavia activa. Ver `maize-doctor-api/README.md` -> "Publishing a new app release".

### Lado app: implementado

Tres piezas, todas con tests:

| Archivo | Rol |
|---|---|
| `src/api/AppUpdateService.ts` | Consulta `GET /app-version` y clasifica el resultado |
| `src/hooks/useAppUpdate.ts` | Lanza la consulta una vez por arranque y controla la visibilidad |
| `src/components/UpdatePrompt.tsx` | El dialogo que ve el usuario |

`checkForUpdate()` lee el `versionCode` instalado con `expo-application` (`nativeBuildVersion`) y devuelve uno de cuatro estados:

- `up-to-date` — el release publicado no es mas nuevo que el instalado.
- `optional` — hay version nueva; el dialogo ofrece "Descargar" y "Ahora no".
- `required` — el servidor puso `forceUpdate`; el dialogo no tiene salida (sin boton de descartar y con el boton atras de Android neutralizado).
- `unavailable` — no se pudo consultar.

**Nunca lanza y nunca bloquea el arranque.** Sin backend configurado, sin red, con un 404 porque no hay releases, con un payload malformado o si no se puede leer el `versionCode`, el resultado es `unavailable` y la app sigue normal: un aviso de actualizacion no justifica interrumpir una app que es offline-first.

Ademas de respetar `forceUpdate`, el cliente descarta cualquier release cuyo `latestVersionCode` no supere al instalado, para que un registro mal configurado en `app_releases` no pueda molestar a quien ya esta al dia.

El dialogo se monta en `App.tsx` **fuera** de `AuthProvider` y por encima del navegador, para que un update requerido tape toda la app sin depender de si hay sesion iniciada.

### Hosting del APK: assets de GitHub Releases

La API no hospeda el binario, solo guarda la URL. El APK vive como **asset de un GitHub release**, publicado por `.github/workflows/release-apk.yml` en cada merge a `main`. El mismo workflow registra el release con `POST /app-releases`, asi que la `downloadUrl` que termina en la base es la del asset:

```
https://github.com/<owner>/<repo>/releases/download/v<version>-<versionCode>/maize-doctor-<version>-<versionCode>.apk
```

`UpdatePrompt` abre esa URL con `Linking.openURL`, que en Android la manda al navegador y este descarga el APK. El usuario necesita permitir "instalar apps de origen desconocido": es la via normal para distribuir fuera de Play Store.

Mientras `app_releases` este vacia, el endpoint responde 404 y la app simplemente no muestra nada.

### Estado actual del deployment

```
GET /health       -> 200 {"status":"ok"}
GET /app-version  -> 404 {"detail":"No release found for platform"}
```

La API responde correctamente; el 404 solo significa que `app_releases` esta vacia.

## 3. Que falta

Nada para el flujo de actualizaciones de la app: build, publicacion y registro estan automatizados. Queda pendiente configurar los secrets del repositorio (`ANDROID_KEYSTORE_*` y `RELEASE_ADMIN_TOKEN`); sin ellos el workflow igual corre, pero firma con la keystore de debug y/o no registra el release. Ver `docs/build-produccion.md`.

Para actualizar el **modelo** sin republicar la app haria falta un mecanismo aparte (descargar el `.tflite` a almacenamiento local y cargarlo desde ahi en vez de por `require`); no esta contemplado en el codigo actual.
