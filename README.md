# DoctorMaiz | Expo + React Native + TypeScript
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

## Cómo correr el proyecto

El proyecto usa módulos nativos (WatermelonDB, cámara, modelo TFLite), por lo que **no funciona en Expo Go**. Necesita un *development build* instalado en el emulador o en un dispositivo físico.

### A. Setup inicial (solo la primera vez)

<!-- Se ejecuta una sola vez por máquina/checkout, o cada vez que se agregue una dependencia con módulo nativo -->

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Habilitar rutas largas de Windows** (evita el error `Filename longer than 260 characters` al compilar C++/CMake). Desde PowerShell **como Administrador**:
   ```powershell
   Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1 -Type DWord
   git config --global core.longpaths true
   ```
   Reiniciar la PC después de este cambio.
   <!-- En la práctica esto no bastó por sí solo: ninja.exe (Android SDK) ignora esta configuración. Lo que realmente funcionó fue ubicar el proyecto en una ruta corta sin espacios, ej. C:\dev\doctor-maiz-app, en vez de rutas largas como C:\Users\usuario\Documents\... -->

3. **Generar el proyecto nativo Android:**
   ```bash
   npx expo prebuild --platform android
   ```
   Crea la carpeta `android/` (no se versiona en git).

4. **Compilar e instalar el development build:**
   ```bash
   npx expo run:android
   ```
   La primera vez descarga Gradle y las dependencias nativas — puede tardar varios minutos. Con el **emulador** abierto, instala y abre la app ahí directamente. Con un **dispositivo físico**, ver la sección B primero.

<!-- Solo se repite este bloque si se agrega una librería con módulo nativo nueva, o si cambia app.json / algún config plugin nativo -->

### B. Requisitos extra para dispositivo físico (Android)

<!-- Solo aplica si se va a probar en un celular real en vez del emulador -->

1. **Habilitar Opciones de Desarrollador** en el celular: Ajustes → Acerca del teléfono → tocar 7 veces "Número de compilación".
2. **Activar Depuración USB**: Ajustes → Opciones de desarrollador → Depuración USB.
3. **Conectar el celular por USB** a la PC y aceptar el diálogo de autorización que aparece en el teléfono.
4. **Verificar que el dispositivo es reconocido:**
   ```bash
   adb devices
   ```
   Debe listar el dispositivo como `device` (no `unauthorized` ni `offline`).
5. **Celular y PC en la misma red Wi-Fi** (Metro se conecta por IP local; si el celular usa datos móviles no va a conectar).
   ```bash
   # Redireccionar el puerto vía USB
   adb reverse tcp:8081 tcp:8081
   ```
6. Correr `npx expo run:android` (paso 4 de la sección A) con el celular conectado — Expo detecta el dispositivo físico y lo prioriza sobre el emulador si solo hay uno conectado. Si hay varios, pedirá elegir cuál usar.

### C. Día a día (development build ya instalado)

<!-- Se repite cada vez que se quiere seguir trabajando, sin recompilar nativo -->

1. Emulador: abrirlo si no está corriendo.
   ```bash
   emulator -avd Pixel_4
   ```
   Dispositivo físico: conectarlo por USB con depuración habilitada (pasos B.2–B.4), o por Wi-Fi si ya se configuró `adb tcpip`.

2. Iniciar el servidor de Metro:
   ```bash
   npx expo start --dev-client
   ```

3. Abrir la app "DoctorMaiz" ya instalada — se conecta sola al Metro activo.

4. Los cambios en `.ts`/`.tsx` recargan solos (Fast Refresh). Si se modifica `babel.config.js`, `metro.config.js` o `tailwind.config.js`, reiniciar Metro con cache limpia:
   ```bash
   npx expo start --dev-client --clear
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
