# Estándar de Codificación — DoctorMaiz

Aplica a todo el código de `doctor-maiz-app` (React Native + Expo + TypeScript), en todas las fases de `IMPLEMENTATION_PLAN.md`. El objetivo es que cualquier fase, pantalla o módulo nuevo se vea como si lo hubiera escrito la misma persona.

## 1. Principios generales

1. **TypeScript estricto siempre.** `strict: true` en `tsconfig.json`. Prohibido `any` explícito; si el tipo es genuinamente desconocido, usar `unknown` y hacer narrowing.
2. **No construir para el futuro hipotético.** Se implementa lo que la fase actual del plan necesita; no se agregan abstracciones, flags o parámetros "por si acaso".
3. **Cero red implícita.** Ningún módulo fuera de `src/api/` puede hacer `fetch`/llamadas de red directamente. Si algo "podría necesitar" red, pasa primero por la capa de servicio con patrón mock/real (sección 8).
4. **Los tokens de diseño son la única fuente de estilos.** Nada de colores, espaciados o tamaños de fuente hardcodeados — todo sale de `theme/tailwind.config.js` (portado de `agri_precision_core/DESIGN.md`).
5. **Comentarios solo para el "por qué".** No se documenta lo que el código ya dice con nombres claros. Se comenta una decisión no obvia, un workaround, o una restricción externa (p. ej. por qué la normalización del tensor se lee en runtime y no se hardcodea).

## 2. Configuración del proyecto

- **Linter:** ESLint con `eslint-config-expo` + reglas de `@typescript-eslint` (`no-unused-vars`, `no-explicit-any`, `consistent-type-imports`).
- **Formato:** Prettier (`singleQuote: true`, `semi: true`, `printWidth: 100`). Se ejecuta en pre-commit (`lint-staged` + `husky`), no como revisión manual.
- **Alias de imports:** `@/` apunta a `src/` (configurado en `tsconfig.json` y `babel.config.js`) — nunca `../../../` de más de dos niveles; si se necesita más, el módulo está mal ubicado.
- **Variables de entorno:** solo `EXPO_PUBLIC_*` llegan al bundle del cliente (p. ej. `EXPO_PUBLIC_USE_MOCK_MODEL`, `EXPO_PUBLIC_API_URL`). Ningún secreto real vive en variables `EXPO_PUBLIC_*` porque quedan visibles en el binario.

## 3. Estructura de carpetas

Se respeta la estructura definida en `IMPLEMENTATION_PLAN.md` (Fase 0). Regla de ubicación: **un archivo vive donde vive por lo que hace, no por a qué pantalla pertenece** — ej. `ConfidenceDonut` va en `components/`, no dentro de `screens/scan/`, aunque hoy solo lo use una pantalla.

```
src/
  theme/       tokens, fuentes, ícono
  components/  UI reutilizable y sin lógica de negocio
  screens/     una carpeta por dominio de pantalla, un archivo por pantalla
  data/        WatermelonDB (schema, models, queries)
  ml/          InferenceEngine y sus implementaciones
  auth/        AuthService y sus implementaciones
  api/         cliente HTTP + cola de sync
  content/     copy estático (recomendaciones agronómicas, textos legales)
```

- Un componente = una carpeta si tiene estilos/subcomponentes propios (`Button/index.tsx`, `Button/Button.test.tsx`); un componente = un archivo si es simple.
- Nada de carpetas `utils/` o `helpers/` genéricas — una función utilitaria vive junto al módulo que más la usa, o en `src/lib/<dominio>.ts` si es transversal (ej. `lib/format.ts` para fechas/números).

## 4. Convenciones de nombres

| Elemento | Convención | Ejemplo |
|---|---|---|
| Componentes | `PascalCase`, archivo = nombre del componente | `ScanResult.tsx` |
| Hooks | `camelCase` con prefijo `use` | `useLeafInference.ts` |
| Tipos e interfaces | `PascalCase`, sin prefijo `I` | `InferenceResult`, no `IInferenceResult` |
| Uniones de literales (enums de dominio) | `PascalCase` el tipo, `snake_case` los valores | `DiagnosisClass = "common_rust" \| ...` |
| Constantes | `SCREAMING_SNAKE_CASE` solo si es una constante global real | `MAX_IMAGE_SIZE_MB` |
| Archivos de test | mismo nombre + `.test.ts(x)` junto al archivo probado | `syncQueue.test.ts` |
| Tablas WatermelonDB | `snake_case` plural | `scans`, `dataset_contributions` |

No se usan `enum` de TypeScript (generan código extra en runtime); se usan uniones de literales de string, como ya se definió para `DiagnosisClass`.

## 5. Componentes React Native

- Solo **componentes funcionales con hooks**. Cero clases.
- Props siempre tipadas con una `interface` declarada arriba del componente, nunca inline en la firma si tiene más de 2 props.
- Un componente no decide *cómo* obtener sus datos — los recibe por props o los pide a través de un hook (`useScans()`, `useAuth()`). Esto es lo que permite testear `ScanResult` con datos mockeados sin tocar cámara ni modelo (ver `IMPLEMENTATION_PLAN.md`, Fase 4).
- Nada de lógica de negocio dentro de JSX condicional profundo — si un `return` tiene más de 2 niveles de `? :` anidados, se extrae a una función o a un componente hijo.
- Un componente no debe superar ~150 líneas; si crece más, probablemente esconde un sub-componente o un hook.

```tsx
interface ConfidenceDonutProps {
  confidence: number; // 0–1
  size?: number;
}

export function ConfidenceDonut({ confidence, size = 96 }: ConfidenceDonutProps) {
  // ...
}
```

## 6. Estilos (NativeWind)

- Todas las clases de Tailwind vienen del `tailwind.config.js` portado del design system — no se inventan valores nuevos de color/spacing ad-hoc en una pantalla.
- Orden de clases dentro de un `className`: layout → spacing → tamaño → tipografía → color → estado (`hover:`/`active:` no aplican en RN, pero si se usan variantes de NativeWind para pressed/disabled van al final).
- Estilos condicionales complejos (más de 3 clases que cambian según estado) se resuelven con una función `cn()` tipo `clsx`, no con template strings concatenados a mano.
- `StyleSheet.create` solo se usa para lo que NativeWind no puede expresar (máscaras SVG, animaciones de Reanimated) — nunca como alternativa a Tailwind por preferencia personal.

## 7. Tipado y modelado de datos

- Los "contratos" entre capas (`InferenceEngine`, `AuthService`, `SyncClient`) se definen como `interface` en su propio archivo, separadas de sus implementaciones — una interfaz nunca vive en el mismo archivo que su implementación concreta.
- Las respuestas de WatermelonDB y de la API nunca se usan tal cual en componentes: se mapean a un tipo de dominio propio de la app (aísla a la UI de cambios en el schema de la DB o del backend).
- `null` significa "todavía no existe" (ej. `scan.label: null` mientras la inferencia está pendiente); `undefined` no se usa para modelar estado de negocio, solo para props opcionales.

## 8. Patrón de dependencias intercambiables (mock/real)

Regla general del proyecto, no solo para el modelo ML: **toda dependencia externa que aún no está lista (o que no se quiere golpear en cada test) se aísla detrás de una interfaz con una implementación mock y una real**, seleccionadas por una única función factory. Ya aplicado a:

- `InferenceEngine` → `MockInferenceEngine` / `TFLiteInferenceEngine`
- `AuthService` → `LocalAuthService` / implementación contra FastAPI
- `SyncClient` → stub / cliente real

Cuando se agregue una dependencia externa nueva (otro sensor, otra API), se sigue el mismo patrón antes de escribir la pantalla que la consume — nunca al revés.

## 9. Manejo de estado

- Estado de servidor/local persistente (escaneos, correcciones, sesión) vive en WatermelonDB o `expo-secure-store`, **no** en un store global en memoria.
- Estado de UI efímero (formularios, toggles, pasos de un wizard) vive en el componente con `useState`/`useReducer`.
- Estado compartido entre pantallas que no es persistente (ej. "hay conexión") va en un Context dedicado y pequeño (`NetworkContext`), no en un store monolítico tipo Redux — no se introduce una librería de estado global salvo que aparezca una necesidad concreta que Context no resuelva.

## 10. Persistencia local (WatermelonDB)

- Cada tabla tiene su propio archivo de modelo en `data/models/` y su propio archivo de queries en `data/queries/` — no se escriben queries WatermelonDB sueltas dentro de componentes.
- Todo registro sincronizable tiene los campos `createdAt` y `synced` (ver esquemas de `scans`, `corrections`, `dataset_contributions` en el plan) — es lo único que `syncQueue` necesita para decidir qué subir.
- Las migraciones de schema se versionan explícitamente (WatermelonDB `schemaMigrations`); nunca se edita un schema existente en producción sin una migración.

## 11. Manejo de errores y offline-first

- Ninguna pantalla asume que hay red. Toda llamada a `api/` está envuelta en `try/catch` y su fallo **nunca** bloquea el flujo local (guardar un escaneo, ver el historial) — el error de red solo afecta el estado `synced`.
- Los errores que sí debe ver el usuario (ej. cámara sin permisos) se comunican con el mismo lenguaje visual que el design system (banners/estados, no `Alert.alert` nativo salvo confirmaciones destructivas).
- Nada de `console.log` en código de producción — se usa un logger mínimo (`lib/logger.ts`) que en `__DEV__` imprime y en producción es un no-op (o envía a un sink si se agrega telemetría más adelante).

## 12. Pruebas

Sigue la pirámide ya definida en `IMPLEMENTATION_PLAN.md`:

- **Unit (Jest):** funciones puras, queries de WatermelonDB, `MockInferenceEngine`. Un archivo de test por módulo, mismo nombre + `.test.ts`.
- **Componente (RNTL):** una pantalla se prueba inyectando sus dependencias mockeadas (no se monta la app completa para probar un botón).
- **Manual en dispositivo:** todo flujo que toque cámara, GPS o sensores reales — no se simula en CI.
- No se escribe un test que dependa de temporización real (`setTimeout` sin mock) ni de datos de red reales.
- Un PR que agrega lógica de negocio (no solo UI estática) sin al menos un test unitario no se aprueba.

## 13. Comentarios y documentación

- JSDoc solo en funciones exportadas de `ml/`, `data/`, `api/` cuyo contrato no es obvio por la firma de tipos (ej. qué asume `predict()` sobre el formato de la imagen de entrada).
- No se documenta con comentarios lo que ya está en el tipo (`// id del escaneo` sobre `scanId: string` sobra).
- Decisiones de arquitectura (por qué se descartó el mapa offline, por qué se lee la cuantización en runtime) viven en `IMPLEMENTATION_PLAN.md`, no dispersas en comentarios de código.

## 14. Git y control de versiones

- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`). Un commit = un cambio lógico.
- **Ramas:** `feature/<fase>-<descripcion>` (ej. `feature/fase3-camara-captura`), `fix/<descripcion>`.
- **Binarios pesados** (`best.pth`, `model.tflite`) nunca se commitean directo al repo de la app — ver nota de higiene en `IMPLEMENTATION_PLAN.md` (Git LFS o asset de release).
- Un PR describe qué fase/parte del plan cubre y cómo se probó (unit/RNTL/manual en dispositivo), siguiendo la sección "Prueba de salida" de esa fase.

## 15. Seguridad

- Credenciales y tokens de sesión solo en `expo-secure-store`, nunca en `AsyncStorage` plano ni en el estado de React.
- Ningún dato personal (nombre, ubicación GPS) se envía a `api/` sin que el usuario haya iniciado sesión y consentido la sincronización.
- Validación de inputs de formularios (email, password) ocurre siempre en el cliente antes de tocar cualquier servicio, real o mock.

## 16. Rendimiento

- Listas largas (Historial) usan `FlashList`/`FlatList` con `keyExtractor` estable, nunca `.map()` dentro de un `ScrollView`.
- Imágenes capturadas se redimensionan antes de guardarse en disco (no se conserva la resolución nativa de la cámara si el modelo consume 224×224).
- Animaciones (scan-line, pulso) corren en el hilo de UI vía `react-native-reanimated`, nunca con `setInterval` + `setState`.

## 17. Checklist antes de abrir un PR

- [ ] `tsc --noEmit` sin errores.
- [ ] ESLint y Prettier sin warnings.
- [ ] Tests nuevos para la lógica de negocio agregada.
- [ ] Ningún color/spacing hardcodeado fuera del theme.
- [ ] Ninguna llamada de red fuera de `src/api/`.
- [ ] Si se tocó una dependencia externa no lista, existe su mock correspondiente.
- [ ] Probado en modo avión si el flujo toca datos locales o cámara.
