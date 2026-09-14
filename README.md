# DoctorMaiz | Expo + React Native + TypeScript

Aplicación móvil de diagnóstico de enfermedades, plagas y deficiencias nutricionales del maíz, desarrollada para agricultores de El Salvador. El diagnóstico corre **completamente en el dispositivo**, con funciones extras adicionales de sincronización opcional con un backend FastAPI.

## Descripción

DoctorMaiz identifica 9 condiciones en hojas de maíz a partir de una fotografía, usando una CNN cuantizada que se ejecuta sobre la CPU del teléfono:

- **Hoja sana**
- **Roya común** — *Puccinia sorghi*
- **Tizón foliar del norte (NCLB)** — *Exserohilum turcicum*
- **Mancha gris de la hoja (GLS)** — *Cercospora zeae-maydis*
- **Necrosis letal del maíz (MLN)** — *MCMV + SCMV*
- **Gusano cogollero** — *Spodoptera frugiperda*
- **Deficiencia de nitrógeno**
- **Deficiencia de fósforo**
- **Deficiencia de potasio**

El modelo se entrena y se exporta en [`maize-doctor-classifier`](https://github.com/daiv05/maize-doctor-classifier); este repositorio solo lo consume.

## El modelo embarcado

| | |
|---|---|
| Arquitectura | `efficientnet_lite0` cuantizado a Int8 |
| Tamaño | ~3.5 MB |
| Entrada | 224 × 224 RGB, normalización ImageNet, tensor NCHW |
| Salidas | logits `[1, 9]` + features pooled `[1, 1280]` |
| Latencia de inferencia | ~60 ms (Motorola edge 40 neo, MediaTek Dimensity 7030) |
| Macro F1 en test | 0.9468 sobre 5 015 imágenes retenidas |

Los tres artefactos viven en `assets/model/` y deben venir siempre del **mismo** directorio de export del pipeline:

- `model_int8.tflite` — el modelo activo, el único que entra al APK.
- `labels.json` — nombre del modelo, `image_size` y el orden exacto de las 9 clases.
- `ood_stats.json` — media PCA, covarianza y umbral del detector fuera de dominio.

Metro resuelve el `require` del `.tflite` en tiempo de compilación, así que el modelo activo se elige copiando archivos, no por configuración en runtime. Para hacerlo con verificación de hash se usa `make sync-mobile-model` desde el repositorio del clasificador. Detalle completo en [docs/modelos-y-actualizaciones.md](docs/modelos-y-actualizaciones.md).

### Detector fuera de dominio (OOD)

Antes de mostrar un diagnóstico, `TFLiteInferenceEngine` calcula la **distancia de Mahalanobis relativa (RMD)** entre las features pooled de la imagen y los centroides por clase almacenados en `ood_stats.json`. Si la distancia supera el umbral calibrado, el resultado se marca `isUnrecognized` y la app indica que no reconoció la imagen en lugar de forzar una etiqueta. Así se evita diagnosticar fotos que no son hojas de maíz.

## Guía de severidad

El modelo dice **qué** tiene la hoja, no **cuánto**: sus salidas son una clase y una confianza, y ninguna mide área foliar afectada. No se entrenó un modelo de niveles de daño porque las imágenes consolidadas traen una sola etiqueta por imagen, sin anotación de severidad, y producirla exige un fitopatólogo aplicando la escala diagramática propia de cada patógeno.

Para cubrir ese vacío, debajo de cada resultado de inferencia la app despliega los niveles de severidad de la clase diagnosticada, traducidos a lenguaje llano, y el agricultor compara su hoja contra las descripciones. La app declara explícitamente que no mide el nivel; el que la persona elija no se guarda ni se sincroniza.

Las ocho clases de daño usan tres niveles ascendentes con acento verde, ámbar y rojo; `healthy` usa los dos estados de monitoreo del catálogo. El contenido es una reescritura del *Catálogo Científico de Escalas de Severidad y Manejo Integrado (MIP)* del repositorio del clasificador, que homologa las escalas de CIMMYT, Embrapa, Iowa State University Extension e IPNI. Vive en `src/content/severity.ts` y se renderiza con `src/components/SeverityGuide.tsx`, en `ScanResult` y en `ScanDetail`. Detalle completo en [docs/guia-de-severidad.md](docs/guia-de-severidad.md).

## Stack tecnológico

- **React Native** 0.86 + **Expo** SDK 57 (nueva arquitectura habilitada)
- **TypeScript** 6.0
- **NativeWind** v4 (TailwindCSS 3.4) — design system Material 3
- **WatermelonDB** — persistencia local SQLite (offline-first)
- **react-native-fast-tflite** — inferencia on-device del modelo Int8
- **@shopify/react-native-skia** — decodificado y reescalado con antialiasing de la foto
- Tipografías Hanken Grotesk, Inter y JetBrains Mono

## Cómo correr el proyecto

El proyecto usa módulos nativos (WatermelonDB, cámara, TFLite, Skia), por lo que **no funciona en Expo Go**. Necesita un *development build* instalado en el emulador o en un dispositivo físico.

### A. Setup inicial

Este bloque se ejecuta una vez por máquina o checkout, y se repite solo al agregar una dependencia con módulo nativo o al cambiar `app.json` o algún config plugin nativo.

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Habilitar rutas largas de Windows**, para evitar el error `Filename longer than 260 characters` al compilar C++/CMake. Desde PowerShell **como Administrador**:
   ```powershell
   Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1 -Type DWord
   git config --global core.longpaths true
   ```
   Reiniciar la PC después de este cambio. No basta por sí solo: el `ninja.exe` del Android SDK ignora esa configuración. Lo que sí funciona es ubicar el proyecto en una ruta corta y sin espacios, por ejemplo `C:\dev\doctor-maiz-app`.

3. **Generar el proyecto nativo Android:**
   ```bash
   npx expo prebuild --platform android
   ```
   Crea la carpeta `android/`, que no se versiona.

4. **Compilar e instalar el development build:**
   ```bash
   npx expo run:android
   ```
   La primera vez descarga Gradle y las dependencias nativas. Con el **emulador** abierto instala ahí directamente; para un **dispositivo físico**, ver la sección B primero.

### B. Requisitos extra para dispositivo físico (Android)

1. **Habilitar Opciones de Desarrollador**: Ajustes → Acerca del teléfono → tocar 7 veces "Número de compilación".
2. **Activar Depuración USB**: Ajustes → Opciones de desarrollador → Depuración USB.
3. **Conectar el celular por USB** y aceptar el diálogo de autorización del teléfono.
4. **Verificar que el dispositivo es reconocido:**
   ```bash
   adb devices
   ```
   Debe aparecer como `device`, no como `unauthorized` ni `offline`.
5. **Celular y PC en la misma red Wi-Fi**, porque Metro se conecta por IP local:
   ```bash
   adb reverse tcp:8081 tcp:8081
   ```
6. Correr `npx expo run:android` con el celular conectado. Expo prioriza el dispositivo físico sobre el emulador si solo hay uno conectado; con varios, pide elegir.

### C. Día a día

Con el development build ya instalado, sin recompilar nativo:

1. Emulador: `emulator -avd Pixel_4`. Dispositivo físico: conectarlo por USB (pasos B.2–B.4), o por Wi-Fi si ya se configuró `adb tcpip`.

2. Iniciar Metro:
   ```bash
   npx expo start --dev-client
   ```

3. Abrir la app "DoctorMaiz" ya instalada, que se conecta sola al Metro activo.

4. Los cambios en `.ts`/`.tsx` recargan con Fast Refresh. Tras modificar `babel.config.js`, `metro.config.js` o `tailwind.config.js`, reiniciar con cache limpia:
   ```bash
   npx expo start --dev-client --clear
   ```

## Configuración

Variables en `.env` (plantilla en `.env.example`):

- `EXPO_PUBLIC_USE_MOCK_MODEL` — `true` por defecto usa `MockInferenceEngine`; exactamente `false` activa `TFLiteInferenceEngine`.
- `EXPO_PUBLIC_API_URL` — URL base de `maize-doctor-api`. Sin definir, `getSyncClient()` usa `MockSyncClient` y no se intenta ninguna sesión remota; la app sigue plenamente funcional. El valor por entorno (emulador, dispositivo físico, simulador iOS) está en el [README de `maize-doctor-api`](https://github.com/daiv05/maize-doctor-api).

Los builds de producción **no** usan `.env`: `npm run build:apk` corre con `NODE_ENV=production`, lo que hace que Expo cargue `.env.production`, que sí está versionado. Ver [docs/build-produccion.md](docs/build-produccion.md).

## Sincronización opcional

Cuando hay `EXPO_PUBLIC_API_URL` y sesión remota, la app envía correcciones de diagnóstico y aportes de imágenes al backend mediante `FastApiSyncClient`, encolando lo que falle (`src/api/syncQueue.ts`). También consulta `GET /app-version` a través de `AppUpdateService` para avisar de una actualización y, si la versión instalada está por debajo del mínimo soportado, mostrar un diálogo bloqueante. Nada de esto es necesario para diagnosticar.

## Scripts

```bash
npm test            # Jest
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm run format      # Prettier sobre src/ y App.tsx
npm run build:apk   # APK de release firmado (scripts/build-apk.js)
```

## Estructura del proyecto

```
src/
├── api/            # Cliente de maize-doctor-api, cola de sync, chequeo de versión
├── auth/           # Autenticación local (SecureStore)
├── components/     # Componentes reutilizables (Icon, Logo, FormInput, TopAppBar, ScanThumbnail)
├── content/        # Taxonomía de diagnóstico, recomendaciones agronómicas y guía de severidad
├── data/           # WatermelonDB (schema, modelos, queries, mock data)
├── fonts/          # Shims de carga de tipografías
├── hooks/          # useAppUpdate
├── lib/            # Logger, métricas del pipeline, ranking de resultados
├── ml/             # Motores de inferencia, preprocesado Skia, EXIF, tensor, OOD
├── navigation/     # React Navigation (AuthStack, AppTabs)
├── screens/        # Pantallas (auth, home, history, profile, scan)
├── theme/          # Tokens del design system
└── utils/          # Recorte según el marco guía de la cámara
```

## Documentación

- [docs/guia-de-severidad.md](docs/guia-de-severidad.md) — por qué no hay modelo de niveles de daño y cómo lo compensa la app.
- [docs/build-produccion.md](docs/build-produccion.md) — APK de release y firma.
- [docs/modelos-y-actualizaciones.md](docs/modelos-y-actualizaciones.md) — cómo se embarca y se reemplaza el modelo.
- [docs/secrets-de-ci.md](docs/secrets-de-ci.md) — secretos del workflow de release.

## Licencia

Distribuido bajo la licencia MIT. Ver [LICENSE](LICENSE).

Proyecto académico desarrollado en la Universidad de El Salvador. Las dependencias de terceros conservan sus propias licencias.
