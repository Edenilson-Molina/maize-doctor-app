# Builds de produccion (APK Android)

## Que define "prod"

No hay servicio de build en la nube (no hay `eas.json`): el APK se compila localmente con
Gradle. Lo que distingue un build de prod de uno de desarrollo son **variables de entorno
que Expo incrusta en el bundle JS en tiempo de compilacion**, no una bandera de runtime.

Expo carga los `.env` segun `NODE_ENV`. Con `NODE_ENV=production` el orden de precedencia es:

```
.env.production.local  >  .env.production  >  .env.local  >  .env
```

Por eso `.env.production` (versionado, sin secretos) gana sobre `.env` (local, ignorado por git)
y fija los valores de produccion:

| Variable | Prod | Efecto |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | `https://api.maize-doctor.deras.dev` | Base URL de la API desplegada |
| `EXPO_PUBLIC_USE_MOCK_MODEL` | `false` | Activa `TFLiteInferenceEngine` (modelo real) |

`EXPO_PUBLIC_USE_MOCK_MODEL` debe ser exactamente `"false"`. `getInferenceEngine()`
(`src/ml/index.ts`) lanza un error si un build no-`__DEV__` dejara el mock activo, para que
sea imposible publicar un APK que devuelva predicciones aleatorias.

Como estos valores quedan **compilados dentro del APK**, cambiar la URL de la API exige
recompilar; no se puede reconfigurar un APK ya generado.

## Requisitos del entorno

- **JDK 17.** El JDK 25 que trae Android Studio falla al configurar CMake
  (`WARNING: A restricted method in java.lang.System has been called`).
- **Android SDK** en `ANDROID_HOME`, y `android/local.properties` con `sdk.dir`.

`android/` esta en `.gitignore` y `expo prebuild` la **borra y regenera entera**. Eso se lleva
por delante dos archivos locales que hay que recrear despues de cada prebuild:

| Archivo | Contenido |
|---|---|
| `android/local.properties` | `sdk.dir=C\:\\Users\\<user>\\AppData\\Local\\Android\\Sdk` (formato properties de Java: `:` y `\` van escapados) |
| `android/keystore.properties` | credenciales de firma (ver mas abajo) |

Ademas, si un daemon de Gradle sigue vivo, `expo prebuild` falla a medias con
`EBUSY: resource busy or locked` y deja `android/` parcialmente borrada. Matar los daemons
antes (`Get-Process java | Stop-Process -Force`) y, si quedo a medias, `rm -rf android` y repetir.

```bash
export JAVA_HOME="$HOME/.gradle/jdks/eclipse_adoptium-17-amd64-windows.2"
export ANDROID_HOME="/c/Users/Usuario/AppData/Local/Android/Sdk"
```

## Compilar

```bash
npm run build:apk
```

El script `scripts/build-apk.js` fuerza `NODE_ENV=production` de forma portable (sin
depender de `cross-env`) y aborta si falta `.env.production`, para no generar nunca un APK
que apunte al backend local por accidente.

Equivalente manual:

```bash
cd android && NODE_ENV=production ./gradlew assembleRelease
```

APK resultante: `android/app/build/outputs/apk/release/app-release.apk`

### Verificar el APK generado

Sobre el APK mismo, que es lo que se reparte:

```bash
cd android/app/build/outputs/apk/release

# 1. Apunta a prod y no quedo rastro del backend local
unzip -p app-release.apk assets/index.android.bundle | grep -c "api.maize-doctor.deras.dev"  # > 0
unzip -p app-release.apk assets/index.android.bundle | grep -c "localhost:8010"              # 0

# 2. Lleva el modelo real (3741176 bytes = efficientnet_lite0) y no los candidatos
unzip -l app-release.apk | grep "\.tflite"
unzip -l app-release.apk | grep -c candidates                                                # 0

# 3. Quien lo firmo
$ANDROID_HOME/build-tools/*/apksigner.bat verify --print-certs app-release.apk
```

Sobre el motor de inferencia: en el bundle de produccion Metro inlinea
`EXPO_PUBLIC_USE_MOCK_MODEL` y elimina la rama muerta, asi que el mensaje de guardia
(`refusing to ship`) **no debe aparecer** y si deben aparecer los strings de
`assertContract()` del engine TFLite:

```bash
grep -c "refusing to ship" bundle                        # 0  -> rama del mock eliminada
grep -c "se esperaba tensor de entrada float32" bundle   # 1  -> engine TFLite presente
```

### ABIs y tamano

El plugin fija `reactNativeArchitectures=armeabi-v7a,arm64-v8a`. Por defecto Expo incluye
tambien `x86` y `x86_64`, que solo sirven para emuladores: cada dependencia nativa se
duplica por ABI (`librnskia.so` ~12 MB por arquitectura), y con las cuatro el APK pasa de
los 200 MB. Si hace falta correr un release en emulador x86, compilar puntualmente con
`-PreactNativeArchitectures=x86_64`.

## Firma

`android/` es carpeta generada, asi que la configuracion de firma vive en el config plugin
`plugins/withReleaseSigning.js` (registrado en `app.json`), que sobrevive a `expo prebuild`.

El plugin agrega un `signingConfig release` alimentado por `android/keystore.properties`
(ignorado por git). **Si ese archivo no existe, el release se firma con la keystore de debug**,
suficiente para repartir APKs de prueba pero no para publicar ni para actualizar una app ya
instalada con otra firma.

Para firmar en serio, copiar `android-keystore.properties.example` a
`android/keystore.properties` y generar la keystore:

```bash
keytool -genkeypair -v -storetype PKCS12 \
  -keystore maize-doctor-release.keystore \
  -alias maize-doctor -keyalg RSA -keysize 2048 -validity 10000
```

Respaldar la keystore fuera del repo: si se pierde, Android ya no acepta actualizaciones del
mismo `applicationId` y habria que publicar la app como una nueva.

## Versionado

`versionCode` y `versionName` viven en `app.json` (`expo.version` y `expo.android.versionCode`);
Gradle los recibe via prebuild. `versionCode` es el entero que compara `GET /app-version` para
decidir si hay actualizacion, y Android rechaza instalar un APK cuyo `versionCode` no sea mayor
al instalado.

En CI **no hay que tocar `versionCode`**: el workflow lo sobreescribe con `github.run_number`,
que crece solo. El valor que queda en `app.json` en el repo (`1`) solo aplica a builds locales.
`versionName` (`expo.version`) si sale del repo y es el que ve el usuario.

En CI esto es automatico (ver "Release automatico en CI"). Compilando a mano, hay que registrar
el release en la API para que las apps instaladas lo detecten
(ver `maize-doctor-api/README.md` -> "Publishing a new app release").

## Checklist de release manual

Solo hace falta cuando se compila fuera de CI; lo normal es dejar que el workflow lo haga.

1. Elegir el modelo activo copiando `model_int8.tflite` y `labels.json` **del mismo directorio
   de export** del pipeline (ver `docs/modelos-y-actualizaciones.md`).
2. Subir `expo.version` en `app.json`, y `expo.android.versionCode` a un numero mayor al del
   ultimo release publicado: si no sube, las apps instaladas no ven el release.
3. `npm test` y `npm run typecheck` en verde. No correr los tests con Gradle compilando en
   paralelo: la maquina saturada produce fallos por timeout que no son regresiones.
4. Confirmar que existen `android/local.properties` y `android/keystore.properties`.
5. `npm run build:apk`.
6. Verificar el APK (seccion "Verificar el APK generado"), incluida la firma.
7. Publicar el binario y registrar el release con `POST /app-releases`.

## Release automatico en CI

`.github/workflows/release-apk.yml` corre en cada push a `main` (es decir, cada merge de PR) y
tambien a mano desde la pestana Actions (`workflow_dispatch`):

1. `npm ci --legacy-peer-deps`, typecheck y tests.
2. Fija `expo.android.versionCode` = `github.run_number`.
3. Restaura la keystore desde secrets, `expo prebuild`, `gradlew assembleRelease`.
4. Verifica el APK: que apunte a la API de produccion, que no lleve el motor mock y que
   incluya el cliente de actualizaciones. Si algo falla, el job aborta antes de publicar.
5. Publica el APK como asset de un GitHub release con tag `v<version>-<versionCode>`.
6. Registra el release en la API (`POST /app-releases`) con la URL del asset.

### Por que el versionCode es `run_number`

Android rechaza instalar un APK cuyo `versionCode` no supere al instalado, y el cliente de
actualizaciones ignora releases que no sean mayores al que corre en el telefono. `run_number`
crece solo y nunca se repite, asi que cada release es instalable sobre el anterior sin tener
que acordarse de subirlo a mano en `app.json`. El `versionName` si sale de `app.json`
(`expo.version`), que es el que ve el usuario.

### Secrets y variables

| Nombre | Tipo | Sin el... |
|---|---|---|
| `ANDROID_KEYSTORE_BASE64` | secret | firma con la keystore de **debug** y avisa en el summary |
| `ANDROID_KEYSTORE_PASSWORD` | secret | idem |
| `ANDROID_KEY_ALIAS` | secret | idem |
| `ANDROID_KEY_PASSWORD` | secret | idem |
| `RELEASE_ADMIN_TOKEN` | secret | publica el APK pero **no lo registra**: las apps instaladas no lo veran |
| `API_URL` | variable (opcional) | usa `https://api.maize-doctor.deras.dev` |

Como generarlos y guardarlos, paso a paso: **`docs/secrets-de-ci.md`**.

El workflow escribe `android/keystore.properties` **dos veces**: antes y despues del prebuild,
porque `expo prebuild` borra `android/` entera y se lleva el primero.
