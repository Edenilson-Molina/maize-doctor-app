# DoctorMaiz

Aplicación móvil de diagnóstico inteligente de enfermedades y plagas del maíz, desarrollada para agricultores de El Salvador.

## Descripción

DoctorMaiz utiliza inteligencia artificial (modelo CNN EfficientNet-B0) para identificar 9 condiciones en hojas de maíz a partir de una fotografía:

- **Hoja sana**
- **Roya común** — *Puccinia sorghi*
- **Tizón foliar del norte (NCLB)** — *Exserohilum turcicum*
- **Mancha gris de la hoja (GLS)** — *Cercospora zeae-maydis*
- **Necrosis letal del maíz (MLN)** — *MCMV + SCMV*
- **Gusano cogollero** — *Spodoptera frugiperda*
- **Deficiencia de nitrógeno**
- **Deficiencia de fósforo**
- **Deficiencia de potasio**

## Stack tecnológico

- **React Native** 0.86 + **Expo** SDK 57
- **TypeScript** 6.0
- **NativeWind** v4 (TailwindCSS 3.4) — design system Material 3
- **WatermelonDB** — persistencia local SQLite (offline-first)
- **fast-tflite** — inferencia on-device del modelo cuantizado (Int8)

## Inicio rápido

```bash
npm install
npx expo start
```

Para development build con módulos nativos (WatermelonDB, cámara, modelo TFLite):

```bash
npx expo prebuild --platform android
npx expo run:android
```

## Tests

```bash
npm test
```

## Estructura del proyecto

```
src/
├── auth/           # Autenticación local (SecureStore)
├── components/     # Componentes reutilizables (Icon, Logo, FormInput, TopAppBar)
├── content/        # Taxonomía de diagnóstico y recomendaciones agronómicas
├── data/           # WatermelonDB (schema, modelos, queries, mock data)
├── navigation/     # React Navigation (AuthStack, AppTabs)
└── screens/        # Pantallas (auth, home, history, profile, scan)
```

## Licencia

Proyecto académico — Universidad de El Salvador.
