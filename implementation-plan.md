# Plan de Implementación por Fases — DoctorMaiz (React Native + Expo)

## Contexto

`seach-set-tech.md` recomienda React Native + Expo + FastAPI. El export de Stitch da 10 pantallas + design system (`agri_precision_core/DESIGN.md`) que cubren los requisitos funcionales. El proyecto está vacío. Este plan reestructura la construcción en **fases secuenciales con criterios de salida verificables**, y resuelve un problema concreto planteado por el usuario: **el modelo todavía no está entrenado**, por lo que toda la app debe poder construirse y probarse sin él.

La estrategia para eso (detallada abajo) es la misma que ya se usaba para las fricciones offline-first: **aislar cada dependencia externa que aún no existe (modelo ML, backend FastAPI) detrás de una interfaz, con una implementación "mock" intercambiable por la real cuando esté lista.** Esto evita bloquear 8 de las 9 fases del roadmap por la ausencia del modelo.

**Actualización (`model-ml.md`):** el equipo de ML (Universidad de El Salvador) publicó la especificación formal del modelo — arquitectura CNN con transfer learning entrenada en PyTorch y exportada a TFLite Int8, **9 clases reales** (no las 6 que se habían asumido de los mockups de Stitch), y restricciones duras de tamaño/latencia/dispositivo. Este plan se ajusta a esa especificación en la taxonomía, el contrato de inferencia y los criterios de salida de la Fase 8b.

**Actualización (`best.pth`):** ya existe un checkpoint entrenado — **EfficientNet-B0** (confirma la arquitectura asumida en `seach-set-tech.md`), formato PyTorch `state_dict`, 16.3 MB en float32. **Esto no es todavía el artefacto que la app puede consumir**: sigue siendo necesario convertirlo a TFLite Int8 (la app no puede cargar `.pth`, y `fast-tflite` requiere el flatbuffer `.tflite`). La Fase 8 se divide en **8a (conversión y cuantización, trabajo Python/ML)** y **8b (integración en la app, ya existente)**. Como el motor de inferencia ya está desacoplado detrás de `InferenceEngine`, la Fase 8a puede arrancar **ya, en paralelo** con las Fases 0–7, en vez de esperar a que termine la UI.

## Taxonomía de diagnóstico (fuente de verdad: `model-ml.md`, congelada en Fase 0)

Los mockups de Stitch usaban nombres de clase provisionales/incorrectos (p. ej. "Roya Polvosa" no existe en el dataset real). La taxonomía real tiene **9 clases** — 6 enfermedades/plagas foliares + 3 deficiencias nutricionales:

```
DiagnosisClass =
  | "healthy"              // Hoja sana
  | "common_rust"          // Roya común — Puccinia sorghi        ⚠ pocas imágenes reales (106)
  | "northern_leaf_blight" // NCLB — Exserohilum turcicum
  | "gray_leaf_spot"       // GLS — Cercospora zeae-maydis
  | "lethal_necrosis"      // MLN — MCMV + SCMV (sin imágenes de laboratorio, solo campo)
  | "fall_armyworm"        // Gusano cogollero — Spodoptera frugiperda
  | "nitrogen_deficiency"  // Deficiencia de N                    ⚠ pocas imágenes reales (523)
  | "phosphorus_deficiency"// Deficiencia de P                    ⚠ pocas imágenes reales (612)
  | "potassium_deficiency" // Deficiencia de K                    ⚠ pocas imágenes reales (266)
```

Las clases marcadas ⚠ tienen pocas imágenes reales de campo en el dataset de entrenamiento — el modelo podría ser menos confiable en ellas. La UI debe tratarlas igual que cualquier otra (sin lógica especial de negocio), pero al redactar el copy de recomendaciones conviene reforzar el mensaje de "confirmar con un experto" para estos casos, dado que el propio equipo de ML prioriza *recall* sobre *precision* (menos falsos negativos, a costa de más falsos positivos).

Cada clase tiene una entrada en `content/recommendations.ts` (texto de recomendación, severidad, color de status strip) — contenido estático, no depende del modelo. Las clases `gray_leaf_spot`, `lethal_necrosis`, `phosphorus_deficiency` y `potassium_deficiency` son nuevas respecto a los mockups de Stitch (que no las contemplaban) y **necesitan copy agronómico nuevo** — no existe una pantalla de referencia de la que portarlo; se redacta ad-hoc siguiendo el mismo formato que las clases existentes (título, patógeno/causa, 2 recomendaciones accionables).

## Restricciones técnicas del modelo (fuente: `model-ml.md`)

Estas restricciones condicionan directamente los criterios de salida de las Fases 8a/8b y el diseño del contrato de inferencia:

| Restricción | Valor | Impacto en la app |
|---|---|---|
| Tamaño del modelo | ≤ 20 MB (post Int8) | Se bundlea en `assets/model/model.tflite`; verificar tamaño final del APK/AAB. |
| Latencia de inferencia | ≤ 300 ms por imagen | Benchmark obligatorio en Fase 8b antes de aceptar el modelo. |
| Dispositivo objetivo | Android ≥ 4 GB RAM, CPU Snapdragon serie 6xx o equivalente | Es el dispositivo de referencia para todas las pruebas de rendimiento (Fase 3, 4 y 8), no un simulador ni un flagship. |
| Entrada | Imagen 224×224, normalizada | El **esquema exacto de normalización/cuantización (escala y zero-point del tensor de entrada Int8) debe leerse de los metadatos del propio `.tflite`** en runtime (vía `interpreter.getInputTensor()`), no asumirse hardcodeado — un desajuste aquí degrada la precisión silenciosamente sin lanzar ningún error. |
| Backend de sync | FastAPI + MySQL | Confirma el esquema de la Fase 7; no cambia el diseño del cliente de sync. |

## Pipeline de conversión `best.pth` → `model.tflite` (Fase 8a, detalle técnico)

Este trabajo es Python/ML, **fuera del repo de la app RN** (vive en el repo/carpeta del modelo, p. ej. `ml-export/`). Lo único que cruza hacia `doctor-maiz-app/assets/model/` es el `.tflite` final más su ficha técnica.

1. **Reconstruir la arquitectura y cargar pesos.** Recrear `EfficientNet-B0` (torchvision) con la cabeza de clasificación reemplazada para 9 clases, y cargar `best.pth` con `model.load_state_dict(...)`. Poner el modelo en `eval()` antes de exportar.
2. **Confirmar el mapeo clase→índice.** ⚠️ **Riesgo abierto:** no fue posible inspeccionar `best.pth` en este entorno (no hay Python/PyTorch instalado aquí), así que no se pudo verificar el orden real de las 9 salidas del checkpoint. Antes de exportar, extraer el `class_to_idx` exacto usado en entrenamiento (del `ImageFolder`/dataset o de un archivo de labels que debería acompañar al checkpoint) y verificar que coincide con el orden de `DiagnosisClass` definido arriba. Si no coincide, hay dos opciones: reordenar la capa de salida antes de exportar, o remapear índices en el postprocesado de la app — pero debe decidirse explícitamente, no asumirse.
3. **Exportar a TFLite.** Dos rutas posibles (probar la primera; si algún operador de EfficientNet-B0 no es compatible, caer a la segunda):
   - **`ai-edge-torch`** (Google): conversión directa PyTorch → LiteRT/TFLite vía `torch.export`, sin pasos intermedios.
   - **Ruta clásica:** PyTorch → ONNX (`torch.onnx.export`) → TensorFlow (`onnx2tf`) → TFLite.
4. **Cuantización Int8 post-entrenamiento (PTQ).** Requiere un dataset representativo (100–500 imágenes reales cubriendo las 9 clases, mismo preprocesamiento 224×224 que en entrenamiento) para calibrar escala y zero-point del tensor de entrada/salida.
5. **Congelar y documentar el preprocesamiento exacto** (resize, orden de canal RGB, mean/std de normalización) en un `model_card.json` versionado junto al `.tflite` — idealmente incrustado como metadata TFLite (TFLite Metadata Writer API) para que la app lo lea en runtime en vez de duplicar la configuración a mano en dos lenguajes distintos.
6. **Validar equivalencia antes de aceptar el artefacto.** Correr el mismo lote de imágenes de prueba por el modelo PyTorch original y por el `.tflite` cuantizado; comparar clase top-1 y confianza. La cuantización no debería mover el Macro F1 lejos del ≥0.85 objetivo — si la degradación es notoria, revisar el rango de calibración del PTQ antes de tocar la app.
7. **Verificar tamaño y latencia en desktop** (con el intérprete de TFLite, antes de ir a dispositivo) como primer filtro de los criterios de la Fase 8b.

**Higiene de repositorio:** `best.pth` (16.3 MB) no debería versionarse dentro del repo de la app móvil — es un artefacto de entrenamiento, no código de la app, y no aporta historial útil ahí. Mantenerlo en el repo/carpeta de ML, y que el único binario que entra al repo de `doctor-maiz-app` sea el `model.tflite` ya cuantizado (≤20 MB) — vía Git LFS o distribuido como asset de release, no como commit directo si el equipo quiere mantener el repo liviano.

---

## Cómo probamos sin el modelo entrenado (respuesta a la pregunta técnica)

**Principio:** el modelo es un detalle de implementación detrás de una interfaz fija; todo lo demás (cámara, UI, base de datos local, sync, navegación) se construye y prueba contra un motor de inferencia falso que respeta el mismo contrato.

### 1. Contrato de inferencia (`src/ml/InferenceEngine.ts`)

```ts
interface InferenceResult {
  label: DiagnosisClass;
  confidence: number; // 0–1
  distribution: Record<DiagnosisClass, number>;
}
interface InferenceEngine {
  predict(imageUri: string): Promise<InferenceResult>;
}
```

### 2. `MockInferenceEngine`

- Devuelve un resultado eligiendo una `DiagnosisClass` (aleatoria, cíclica, o forzada por un dev-menu para reproducir un caso específico al hacer demos).
- Simula latencia real con `setTimeout(600–1500ms)` para poder probar los estados de carga de la UI (spinner, skeleton) igual que con el modelo real.
- Vive en `src/ml/MockInferenceEngine.ts`, cero dependencias nativas — corre en Jest, en el simulador, y en dispositivo.

### 3. `TFLiteInferenceEngine`

- Implementación real con `fast-tflite`, se construye en la Fase 8b una vez que el pipeline de conversión (Fase 8a) entregue `model.tflite` a partir de `best.pth`.
- Debe cumplir el mismo input (imagen 224×224×3) y output (vector de probabilidades en el mismo orden que `DiagnosisClass`, las 9 clases de `model-ml.md`) que ya se validó contra el mock — así el swap es un cambio de una línea.
- La normalización/cuantización del tensor de entrada **no se hardcodea**: se lee de los metadatos del `.tflite` (`interpreter.getInputTensor(0)`) para evitar un desajuste silencioso con lo que el equipo de ML usó al exportar desde PyTorch.

### 4. Selección de motor

`src/ml/index.ts`:
```ts
export const getInferenceEngine = (): InferenceEngine =>
  process.env.EXPO_PUBLIC_USE_MOCK_MODEL === 'false'
    ? new TFLiteInferenceEngine()
    : new MockInferenceEngine();
```
Por defecto `true` hasta que exista el `.tflite` real. Ningún componente de UI conoce la diferencia.

### 5. El mismo patrón aplica al backend FastAPI

Si el backend tampoco está listo, `AuthService` y `SyncClient` siguen el mismo esquema (`LocalAuthService`/`MockSyncClient` vs. implementación real contra FastAPI) para no bloquear las fases de auth y sync tampoco.

### 6. Pirámide de pruebas resultante

| Nivel | Qué prueba | Herramienta | ¿Necesita modelo real? |
|---|---|---|---|
| Unit | WatermelonDB models, `syncQueue`, mapeo clase→recomendación, `MockInferenceEngine` | Jest | No |
| Componente | Cada pantalla, incluida `ScanResult` renderizada para **las 9 clases** vía `MockInferenceEngine` inyectado | React Native Testing Library | No |
| Manual en dispositivo | Flujo completo cámara → captura → inferencia (mock) → guardar → historial → corrección, en modo avión | `expo run:android` en equipo real | No |
| Validación del modelo | Precisión/latencia/memoria del `.tflite` real en dispositivo objetivo | Manual, con set de fotos de referencia | Sí (Fase 8b, aislada) |

Con esto, las Fases 0–7 y 9 quedan completamente desbloqueadas y probadas sin esperar a la integración del modelo real; solo la Fase 8b depende de que la Fase 8a (conversión de `best.pth`) haya entregado el `.tflite`.

---

## Fases

### Fase 0 — Fundaciones y Design System ✅ COMPLETADA
**Objetivo:** esqueleto de la app y todos los tokens visuales reutilizables (resuelve las fricciones de fuentes/íconos/branding/nav/tailwind).

- [x] `npx create-expo-app` + configuración del proyecto (package `com.doctormaiz.app`).
- [x] `nativewind` v4: `tailwind.config.js` con todos los tokens de `DESIGN.md` (colores Material 3, tipografía, spacing, border-radius).
- [x] `metro.config.js` con `withNativeWind` + resolver ESM para RxJS.
- [x] `babel.config.js` con `babel-preset-expo`, `jsxImportSource: nativewind`, decorators legacy, module-resolver `@/ → ./src`.
- [x] `tsconfig.json` con strict, baseUrl, paths `@/*`, experimentalDecorators, ignoreDeprecations.
- [x] Fuentes: `@expo-google-fonts/hanken-grotesk`, `inter`, `jetbrains-mono` + `useFonts` splash gate en `App.tsx`.
- [x] Íconos: `@expo/vector-icons` (MaterialCommunityIcons) con componente `<Icon>` tipado.
- [x] Logo SVG: `src/components/Logo.tsx` con `react-native-svg`, renderiza el corn logo a tamaño configurable.
- [x] `TopAppBar.tsx`: Logo (32px) + "DoctorMaiz", bg primary-container, safe area insets.
- [x] `BottomTabBar.tsx`: 4 tabs (Inicio/Escanear/Historial/Perfil) con iconos active/inactive, accessibility labels en español.
- [x] `RootNavigator.tsx`: `AuthStack` (Login/Register/ForgotPassword) vs `AppTabs` (Home/Scan/History/Profile), condicionado por `isAuthenticated`.
- [x] `src/navigation/types.ts`: `AuthStackParamList` + `AppTabParamList`.
- [x] `src/global.css` + `nativewind-env.d.ts` + `src/types/css.d.ts`.
- [x] **Prueba de salida:** Jest + RNTL renderiza `RootNavigator` — 1 test passing.

### Fase 1 — Autenticación ✅ COMPLETADA
**Objetivo:** Login, Registro, Recuperar contraseña, con sesión persistida localmente.

- [x] `src/auth/AuthService.ts`: interfaces `UserSession`, `AuthResult`, `AuthService`.
- [x] `src/auth/LocalAuthService.ts`: implementación con `expo-secure-store` (keys `doctormaiz_session`, `doctormaiz_users`), `simpleHash`, `generateId`.
- [x] `src/auth/AuthContext.tsx`: React Context con `isAuthenticated`, `user`, `isLoading`, `login`, `register`, `logout`. Carga sesión almacenada en mount.
- [x] `src/auth/validation.ts`: `validateEmail` (regex), `validatePassword` (min 6), `validateName` (min 2), `validateLoginForm`, `validateRegisterForm` (con confirmación de password), `hasErrors`.
- [x] `src/components/FormInput.tsx`: input reutilizable con label, icono, error, secureTextEntry toggle.
- [x] `src/screens/auth/LoginScreen.tsx`: Logo (96px), card con email/password FormInputs, "¿Olvidó su contraseña?", "Entrar", "Sistema en línea", "Crear una cuenta nueva", footer "RESILIENCIA & PRECISIÓN".
- [x] `src/screens/auth/RegisterScreen.tsx`: Logo (80px), name/email/password/confirmPassword, "Registrarse" (**sin Google**), "Ya tienes cuenta?".
- [x] `src/screens/auth/ForgotPasswordScreen.tsx`: Logo (80px), email input, "Enviar instrucciones", estado de éxito con icono, "VOLVER AL INICIO DE SESIÓN".
- [x] **Prueba de salida:** 15 tests de validación + 2 tests de LoginScreen + 1 test de RootNavigator = 18 tests passing.

### Fase 2 — Dashboard + Historial (datos locales) ✅ COMPLETADA
**Objetivo:** capa de datos local funcionando de punta a punta, sin cámara ni modelo todavía.

- [x] Esquema WatermelonDB v1: tablas `scans` (10 columnas), `corrections` (6 columnas, `scan_id` indexado), `dataset_contributions` (5 columnas).
- [x] Modelos WatermelonDB: `Scan.ts`, `Correction.ts` (con `CorrectionStatus`), `DatasetContribution.ts` — decorators sin definite assignment (`!:` removido por compatibilidad Babel).
- [x] `src/data/database.ts`: inicialización condicional — detecta `NativeModules.WMDatabaseBridge`, usa SQLiteAdapter si disponible, `null` si no (Expo Go fallback).
- [x] `src/data/queries/scanQueries.ts`: `observeScans`, `observeScansByLabel`, `observeRecentScans`, `getScanCount`, `getScanCountByLabel`, `createScan`.
- [x] `src/data/queries/correctionQueries.ts`: `observeCorrectionsForScan`, `createCorrection`.
- [x] `src/data/seedDevData.ts`: 20 escaneos seed cubriendo las 9 clases, coordenadas El Salvador, timestamps distribuidos en 15 días. Solo siembra si `count === 0`.
- [x] `src/data/mockData.ts`: datos mock en memoria (mismo esquema que seed) para Expo Go fallback.
- [x] `src/content/diagnosis.ts`: `DiagnosisClass` (9 clases), `DIAGNOSIS_CLASSES`, `DiagnosisInfo`, `DIAGNOSIS_MAP` con copy agronómico completo. Clases con pocos datos incluyen "Confirmar con un especialista".
- [x] `HomeScreen.tsx` (rediseñado según mockup Stitch `panel_principal_v3`): saludo "Hola, {nombre}" + ubicación, FAB "Iniciar Nuevo Escaneo", 4 métricas ambientales 2x2 (temp, humedad, hum.suelo, viento), banner "¡Sé parte de la Ciencia!", scan cards en grid con thumbnail placeholder (icon leaf) + status strip + badge confianza coloreado, sección "Cobertura del Campo" con mapa placeholder.
- [x] `HistoryScreen.tsx` (rediseñado según mockup Stitch `historial_de_an_lisis_v2`): barra búsqueda, filter chips dinámicos (9 clases + "Todos"), agrupación por fecha (Actividad Reciente / Semana Pasada / Anteriores) con SectionList, cards h-120 con color strip izquierdo + thumbnail placeholder icon (100px) + título + fecha/hora + badge confianza + línea de recomendación con icono.
- [x] `ProfileScreen.tsx` (rediseñado según mockup Stitch `perfil_e_impacto_doctormaiz`): avatar circular con badge verificación, nombre + ubicación, sección "Impacto Colectivo" (2 métricas + barra progreso en dark card), lista Configuración (Cuenta, Notificaciones, Modo Offline toggle, Soporte, Cerrar Sesión en rojo), versión del app.
- [x] **Prueba de salida:** 39 tests passing — diagnosis (16), schema (6), validation (15), LoginScreen (2), RootNavigator (1). Mock de `@/data/database` en tests de navegación para evitar dependencia nativa.

**Notas técnicas resueltas durante Fase 2:**
- RxJS CJS paths: resuelto con resolver ESM en `metro.config.js`.
- WatermelonDB decorators + Babel `@babel/plugin-transform-typescript`: removido `!:` (definite assignment) de modelos, no necesario con legacy decorators.
- `@babel/plugin-transform-class-properties` con `loose: true` conflictuaba con private methods de RN 0.86: removido, babel-preset-expo lo maneja.
- WatermelonDB JSI no disponible en Expo Go: `jsi: false` + detección condicional de `NativeModules.WMDatabaseBridge` + fallback a datos mock en memoria.
- `ANDROID_HOME` configurado permanentemente: `C:\Users\usuario\AppData\Local\Android\Sdk` + `platform-tools` y `emulator` en PATH.
- `expo-dev-client` instalado para development builds con módulos nativos (WatermelonDB).

### Fase 3 — Cámara y Captura
**Objetivo:** capturar una foto con la guía de recorte, sin inferencia todavía.

- [ ] `react-native-vision-camera` + permisos + config plugin.
- [ ] Máscara de hoja: `react-native-svg` `<Path>` reproduciendo el `clip-path` del mockup `escaneo_de_hoja_localizado`; línea de escaneo y guías animadas con `react-native-reanimated`.
- [ ] Captura → `expo-file-system` guarda el archivo local → crea un registro `scans` con `label: null` (pendiente de inferencia).
- [ ] **Prueba de salida:** manual en dispositivo real (cámara no es confiable en simulador) — foto capturada, archivo existe, registro creado.

### Fase 4 — Motor de Inferencia (mock) + Resultado del Análisis
**Objetivo:** pantalla de resultado completa y funcional, usando `MockInferenceEngine`.

- [ ] Implementar el contrato de inferencia descrito arriba.
- [ ] `resultado_del_an_lisis_v2`: donut de confianza con `react-native-svg` (`strokeDasharray` calculado desde `confidence`), recomendaciones desde `content/recommendations.ts` según `label`. Si `confidence` es baja, mostrar además la segunda clase más probable de `distribution` (ya viene en el contrato) para comunicar la incertidumbre en vez de ocultarla — relevante dado que el modelo prioriza recall sobre precisión.
- [ ] Se redacta el copy agronómico faltante para `gray_leaf_spot`, `lethal_necrosis`, `phosphorus_deficiency` y `potassium_deficiency` (no existían en los mockups de Stitch).
- [ ] **Prueba de salida:** RNTL renderiza `ScanResult` para las 9 clases inyectando el mock directamente (sin cámara); manual: capturar foto real → ver resultado mockeado con latencia simulada.

### Fase 5 — Retroalimentación Colaborativa + Dataset Nacional
- [ ] `detalle_e_inteligencia_colaborativa_v2`: formulario de corrección escribe en `corrections`, timeline de estados.
- [ ] `contribuci_n_al_dataset_nacional`: escribe en `dataset_contributions` con copia local de imagen. El `<select>` de "Etiqueta de Diagnóstico" del mockup tenía opciones inventadas (p. ej. "Roya Polvosa"); se reemplaza por las 9 clases reales de `DiagnosisClass`.
- [ ] **Prueba de salida:** RNTL de formularios y transición de estados; unit tests de las queries de corrección.

### Fase 6 — Perfil e Impacto
- [ ] Agregaciones locales (conteos, rango) sobre las tablas existentes — sin depender de backend para v1.
- [ ] **Prueba de salida:** unit tests de las funciones de agregación con datos sembrados.

### Fase 7 — Sincronización con FastAPI
- [ ] `api/client.ts` + `api/syncQueue.ts`; `@react-native-community/netinfo` dispara `flushPendingSync()` al reconectar.
- [ ] Si el backend real no está listo, desarrollar contra un stub (`msw` o FastAPI mínimo) — mismo patrón mock/real.
- [ ] **Prueba de salida:** unit tests mockeando `fetch`; manual: alternar modo avión y confirmar que la cola sube los pendientes al reconectar.

### Fase 8a — Conversión y Cuantización del Modelo (`best.pth` → `model.tflite`)
**Objetivo:** producir el artefacto `.tflite` desplegable a partir del checkpoint EfficientNet-B0 ya entrenado. Trabajo Python/ML, independiente del resto del roadmap — **puede arrancar ya, en paralelo con las Fases 0–7**.

- [ ] Ver el detalle técnico completo en "Pipeline de conversión `best.pth` → `model.tflite`" más arriba (reconstrucción del modelo, verificación del orden de clases, exportación, PTQ Int8, `model_card.json`, validación de equivalencia).
- [ ] **Prueba de salida:** el `.tflite` cuantizado reproduce (dentro de un margen razonable) las predicciones del `best.pth` original sobre el mismo set de imágenes de prueba; tamaño y latencia medidos en desktop como primer filtro.

### Fase 8b — Integración del Modelo en la App
**Objetivo:** conectar el `model.tflite` producido en 8a al `InferenceEngine` real de la app.

- [ ] Recibir `model.tflite` (Int8) + `model_card.json`, validar que input/output respeten el contrato fijado en Fase 4: 224×224 de entrada, salida con las 9 clases en el mismo orden que `DiagnosisClass`, normalización leída de los metadatos del propio modelo (no hardcodeada).
- [ ] Implementar `TFLiteInferenceEngine` con `fast-tflite`; benchmark de latencia/memoria en el dispositivo de referencia de `model-ml.md` (Android ≥ 4 GB RAM, Snapdragon serie 6xx o equivalente) — **no** en el dispositivo de desarrollo si es un flagship, ni en simulador.
- [ ] Flip de `EXPO_PUBLIC_USE_MOCK_MODEL=false` — sin cambios en el resto de la app.
- [ ] **Criterios de aceptación (duros, de `model-ml.md`):**
  - Tamaño de `model.tflite` ≤ 20 MB.
  - Latencia de inferencia ≤ 300 ms por imagen en el dispositivo de referencia.
  - Verificación de que el orden de salida del tensor coincide 1:1 con `DiagnosisClass` (un desajuste de orden produce diagnósticos incorrectos silenciosos).
- [ ] **Prueba de salida:** comparación manual contra fotos de referencia por clase (prestando atención a las 4 clases con pocos datos reales); medición de tiempo de inferencia y tamaño final del binario en el dispositivo objetivo.

### Fase 9 — Hardening y QA End-to-End Offline
- [ ] Recorrido completo en modo avión de todos los flujos (auth → escaneo → resultado → historial → corrección → dataset → perfil).
- [ ] Revisión visual contra cada `screen.png` de Stitch.
- [ ] Limpieza de código de desarrollo (seed data, overrides del dev-menu) detrás de `__DEV__`.

---

## Verificación general

- `expo prebuild` + `expo run:android` en dispositivo real para cámara/inferencia — idealmente un Android ≥ 4 GB RAM / Snapdragon serie 6xx, que es el dispositivo de referencia de `model-ml.md`, no el teléfono de desarrollo más nuevo disponible.
- Cada fase se valida en modo avión antes de pasar a la siguiente — el offline-first no se prueba al final, se prueba fase por fase.
- La Fase 8a (conversión de `best.pth`) puede arrancar de inmediato y en paralelo; solo la Fase 8b (integración en la app) depende de que 8a entregue el `.tflite` validado.
- Los criterios de tamaño (≤20 MB) y latencia (≤300 ms) de `model-ml.md` son de aceptación del `.tflite` al cierre de la Fase 8a/8b, no metas del código de la app en sí — si no se cumplen tras cuantizar, es un problema de conversión/arquitectura, no de la integración RN.
