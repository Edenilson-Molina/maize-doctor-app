# Generar y guardar los secrets de CI

Los comandos de esta guia estan verificados en esta maquina (Git Bash + JDK 17 de la cache de
Gradle). Todo se guarda en **`Edenilson-Molina/maize-doctor-app`**, salvo el ultimo paso, que
va en el servidor de la API.

| Secret | Para que |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | La keystore, en base64 |
| `ANDROID_KEYSTORE_PASSWORD` | Password del almacen |
| `ANDROID_KEY_ALIAS` | Alias de la clave |
| `ANDROID_KEY_PASSWORD` | Password de la clave |
| `RELEASE_ADMIN_TOKEN` | Autoriza `POST /app-releases` (el mismo valor va en la API) |

Sin ellos el workflow **igual corre**: firma con la keystore de debug y/o no registra el
release, y lo avisa en el summary del job. No se rompe, pero el resultado no sirve para
publicar.

---

## 1. Generar la keystore

Una sola vez en la vida del proyecto. Hacelo **fuera del repo** — por ejemplo en
`C:\Users\Usuario\keys\`:

```bash
mkdir -p ~/keys && cd ~/keys

export JAVA_HOME="$HOME/.gradle/jdks/eclipse_adoptium-17-amd64-windows.2"

"$JAVA_HOME/bin/keytool" -genkeypair -v \
  -storetype PKCS12 \
  -keystore maize-doctor-release.keystore \
  -alias maize-doctor \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -dname "CN=DoctorMaiz, OU=DoctorMaiz, O=DoctorMaiz, L=San Salvador, ST=San Salvador, C=SV"
```

Te va a pedir el password del almacen dos veces. Con PKCS12 el password de la clave es el
mismo que el del almacen, asi que `ANDROID_KEYSTORE_PASSWORD` y `ANDROID_KEY_PASSWORD` llevan
el **mismo valor**.

`-validity 10000` son ~27 anos: el certificado debe sobrevivir a todas las actualizaciones
futuras de la app.

> **Respaldala en dos lugares distintos, fuera del repo.** Si se pierde, Android deja de
> aceptar actualizaciones del mismo `applicationId` y hay que publicar la app como una nueva,
> perdiendo a todos los usuarios instalados. Es el unico archivo de este proyecto que no se
> puede regenerar.

`*.keystore` ya esta en `.gitignore`, pero igual conviene tenerla fuera del arbol del repo.

### Verificarla

```bash
"$JAVA_HOME/bin/keytool" -list -v -keystore maize-doctor-release.keystore | head -20
```

## 2. Pasarla a base64

Un secret de GitHub solo guarda texto, asi que la keystore (binaria) va codificada:

```bash
cd ~/keys
base64 -w0 maize-doctor-release.keystore > keystore.b64
wc -c keystore.b64      # ~3700 caracteres para una PKCS12 de 2048 bits
```

`-w0` es imprescindible: sin el, `base64` corta en lineas de 76 caracteres y el
`base64 -d` del workflow falla.

Comprobar que la ida y vuelta es exacta antes de subirla:

```bash
base64 -d keystore.b64 > roundtrip.tmp
sha256sum maize-doctor-release.keystore roundtrip.tmp
# los dos hashes deben ser identicos
rm roundtrip.tmp
```

Copiar el contenido al portapapeles (Windows):

```bash
clip < keystore.b64
```

Despues de pegarlo en GitHub, borra el `.b64`: es la keystore entera en texto plano.

```bash
rm keystore.b64
```

## 3. Generar el token de la API

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Usa `token_urlsafe` y no `openssl rand -base64`, porque este ultimo puede producir `+` y `/`,
incomodos de pegar en variables de entorno y archivos `.env`.

Guarda el valor: lo vas a necesitar **dos veces** (secret de GitHub y entorno de la API).

## 4. Guardarlos en GitHub

`gh` no esta instalado en esta maquina, asi que via web:

**Settings → Secrets and variables → Actions → New repository secret**

```
https://github.com/Edenilson-Molina/maize-doctor-app/settings/secrets/actions
```

Crear los cinco, con el nombre **exacto** (distingue mayusculas):

| Name | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | el contenido de `keystore.b64` |
| `ANDROID_KEYSTORE_PASSWORD` | el password del paso 1 |
| `ANDROID_KEY_ALIAS` | `maize-doctor` |
| `ANDROID_KEY_PASSWORD` | el mismo password |
| `RELEASE_ADMIN_TOKEN` | el token del paso 3 |

Son **repository secrets**, no environment secrets: el workflow los lee como
`secrets.X` sin declarar ningun `environment:`.

Una vez guardados **no se pueden volver a leer**, solo reemplazar. Por eso el respaldo del
paso 1 importa.

### Variable opcional

En la pestana **Variables** (no Secrets) se puede definir `API_URL` para apuntar el registro a
otro backend. Sin ella, el workflow usa `https://api.maize-doctor.deras.dev`.

## 5. Configurar el token en la API

El servidor tiene que conocer el **mismo** `RELEASE_ADMIN_TOKEN`, o rechazara al workflow con
401. En el entorno donde corre `maize-doctor-api`:

```bash
RELEASE_ADMIN_TOKEN=<el token del paso 3>
```

Con Docker Compose va en el `.env` del servidor; en otro hosting, en sus variables de entorno.
Hay que **reiniciar el servicio** para que lo tome.

Recorda que un token vacio o sin definir deja el endpoint **cerrado para todos** (no abierto):
es a proposito, para que un deploy sin configurar no quede publicable por cualquiera.

## 6. Comprobar que quedo bien

```bash
curl -X POST https://api.maize-doctor.deras.dev/app-releases \
  -H "Authorization: Bearer <token>" \
  -H 'Content-Type: application/json' \
  -d '{"platform":"android","versionCode":999999,"versionName":"0.0.0-probe",
       "minSupportedVersionCode":1,"downloadUrl":"https://example.com/probe.apk"}'
```

- `201` → el token es correcto.
- `401` → no coincide con el del servidor, o el servidor no lo tiene configurado.

Si dio 201, **borra la fila de prueba**, porque quedo como el release activo y las apps
instaladas la verian como una actualizacion:

```sql
DELETE FROM app_releases WHERE version_code = 999999;
```

Para probar la keystore, lo mas simple es dejar correr el workflow y mirar el summary: la fila
**Firma** debe decir `release` y no `debug`.

## Si se filtra un secret

1. GitHub → el secret → **Update**, con un valor nuevo.
2. Para `RELEASE_ADMIN_TOKEN`: generar otro (paso 3) y actualizarlo tambien en la API.
3. Para la keystore: **no se puede rotar** sin romper la ruta de actualizacion de las apps ya
   instaladas. Si se filtro la keystore junto con su password, cualquiera puede firmar un APK
   que Android acepte como actualizacion legitima de tu app; en ese caso hay que publicar con
   un `applicationId` nuevo. Otra razon para tratarla con mas cuidado que al resto.
