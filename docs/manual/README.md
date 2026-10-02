# Manual de Usuario y Guía de Campo --- Doctor Maíz

Este directorio contiene el código fuente en **LaTeX** y los recursos gráficos para compilar el **Manual Oficial de Usuario y Guía de Campo de Doctor Maíz** en formato PDF de alta calidad editorial.

---

## 📁 Estructura del Directorio

```
docs/manual/
├── manual_usuario.tex     # Documento principal en LaTeX (reporte moderno y elegante)
├── manual_usuario.pdf     # Documento PDF compilado listo para distribución (20 páginas)
├── build_manual.bat       # Script batch de compilación en 1 clic (Windows cmd)
├── build_manual.ps1       # Script PowerShell para compilación automatizada
├── README.md              # Este archivo descriptivo
└── img/                   # Capturas reales de la app tomadas desde Pixel 4
    ├── app_icon.png                 # Logo oficial de Doctor Maíz
    ├── pixel4_home_top.png          # Panel principal y variables agroclimáticas
    ├── pixel4_camera.png            # Visor de cámara con silueta de encuadre
    ├── pixel4_detail_scan.png       # Pantalla de diagnóstico y severidad
    ├── pixel4_detail_accordion.png  # Guía de severidad desplegada (Qué se ve / Qué hacer)
    ├── map_screen.png               # Mapa de cobertura con geolocalización
    ├── pixel4_history.png           # Historial con filtros por patógeno
    ├── pixel4_profile.png           # Perfil con métricas de impacto y sincronización
    ├── pixel4_profile_guest.png     # Perfil en modo invitado (offline-first)
    ├── pixel4_login.png             # Inicio de sesión
    ├── pixel4_register.png          # Registro de nueva cuenta
    ├── pixel4_forgot_password.png   # Recuperación de contraseña
    └── pixel4_contribute.png        # Donación voluntaria de diagnósticos
```

---

## 🎨 Características de Diseño y Maquetación

- **Tipografía Moderna:** Sans-serif limpia (Helvetica/URW Nimbus Sans) con jerarquía visual adaptada a lectura técnica y manuales de campo.
- **Paleta Cromática Fitosanitaria:**
  - `MaizDarkGreen` (`#1B4332`) y `MaizPrimary` (`#2D6A4F`): Identidad corporativa de Doctor Maíz.
  - `MaizMint` (`#52B788`) y `MaizPaleGreen` (`#E8F5E9`): Acentos botánicos y fondos suaves.
  - `MaizGold` (`#D4A373`): Advertencias y severidad moderada.
  - `MaizRed` (`#BA1A1A`): Alertas fitosanitarias críticas.
- **Cajas Estilizadas (`tcolorbox`):**
  - `\begin{agronote}`: Recomendaciones agronómicas y manejo preventivo.
  - `\begin{agroalert}`: Advertencias sobre síntomas críticos y descansos.
  - `\begin{campotip}`: Buenas prácticas de toma de fotos y calibración GPS en campo.
- **Capturas Nativas Integradas:** Imágenes reales capturadas directamente del emulador con la aplicación en ejecución.

---

## ⚙️ Cómo Compilar

### Opción 1: Con el script Batch (Windows)
Haga doble clic sobre [`build_manual.bat`](file:///c:/dev/doctor-maiz-app/docs/manual/build_manual.bat) o ejecute en consola:
```cmd
docs\manual\build_manual.bat
```

### Opción 2: Con PowerShell
Ejecute:
```powershell
./docs/manual/build_manual.ps1
```

### Opción 3: Manualmente con `pdflatex`
```bash
cd docs/manual
pdflatex -interaction=nonstopmode manual_usuario.tex
pdflatex -interaction=nonstopmode manual_usuario.tex
```
*(Se ejecuta dos veces para actualizar el índice de contenidos y las referencias cruzadas).*
