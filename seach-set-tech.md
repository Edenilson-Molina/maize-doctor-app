# Documento de Arquitectura y Selección Tecnológica

## 1. Descripción y Requerimientos del Proyecto

**Propósito Principal**
Desarrollo de una solución tecnológica orientada al sector agrícola para la detección y diagnóstico temprano de enfermedades, plagas y deficiencias nutricionales en hojas de maíz, operando de manera autónoma en zonas sin cobertura de red.

**Requerimientos Centrales**

* **Inferencia Offline:** Ejecución local de un modelo de visión artificial (EfficientNet-B0, cuantizado a TFLite) en dispositivos de gama media y baja.
* **Captura de Calidad (GIGO):** Módulo de cámara con máscara de recorte (guía visual) para estandarizar la proporción y el enfoque de las fotografías capturadas.
* **Diagnóstico y Acción:** Presentación clara del resultado y su nivel de confianza, acompañado de un módulo de recomendaciones agronómicas informativas (no sustitutivas).
* **Trazabilidad:** Almacenamiento local del historial de pruebas, incluyendo fecha, resultado y coordenadas geográficas (GPS).
* **Circuito de Mejora Continua (Falsos Positivos):** Funcionalidad de auditoría para que el usuario o especialista corrija diagnósticos erróneos, almacenando localmente la nueva etiqueta.
* **Sincronización Asíncrona:** Arquitectura de servidor central en **FastAPI** que reciba en lotes (batch) los historiales, mapas de calor y correcciones de falsos positivos una vez el dispositivo recupere la conexión a internet.

---

## 2. Análisis Profundo de Opciones Tecnológicas

Para trasladar el diseño inicial web (Nuxt) a un entorno móvil capaz de ejecutar modelos de Machine Learning, existen tres caminos arquitectónicos viables.

### Opción 1: Ecosistema React Native + Expo (Multiplataforma Declarativa)

Permite construir aplicaciones móviles usando JavaScript/TypeScript, conectándose directamente a módulos nativos a través de JSI (JavaScript Interface) para tareas de alto rendimiento.

| Componente | Tecnología | Análisis de Desempeño y Viabilidad |
| --- | --- | --- |
| **Visión e IA** | `react-native-vision-camera` + `fast-tflite` | **Alto.** JSI elimina el cuello de botella del "puente" JS-Nativo. Los fotogramas pasan de la cámara al modelo TFLite (en memoria C++) en tiempo real, permitiendo inferencia de 15-30 FPS. |
| **Persistencia** | `WatermelonDB` | **Excelente.** Diseñada para el patrón *Offline-First*. Su carga perezosa evita que la app se congele en teléfonos antiguos al consultar historiales largos de escaneos. |
| **Pros** | Velocidad de desarrollo, reutilización de conocimientos de tecnologías web, excelente manejo de bases de datos offline, despliegue simultáneo en Android e iOS. |  |
| **Contras** | Tamaño del ejecutable final (APK) más pesado (aprox. 40-50 MB) debido al empaquetamiento del motor JavaScript. Gestión de tareas en segundo plano limitada por el sistema operativo. |  |

### Opción 2: Ecosistema Android Nativo (Kotlin)

Desarrollo directo sobre las herramientas oficiales de Google para el sistema operativo Android, ofreciendo acceso de bajo nivel al hardware.

| Componente | Tecnología | Análisis de Desempeño y Viabilidad |
| --- | --- | --- |
| **Visión e IA** | `CameraX API` + `TFLite Task Library` | **Máximo.** La integración nativa de Google permite la manipulación de *Bitmaps* y ejecución de tensores con el menor consumo de memoria RAM posible. |
| **Persistencia** | `Room Database` + `WorkManager` | **Excelente.** Room ofrece robustez y WorkManager es infalible para garantizar que la sincronización con FastAPI ocurra incluso si la app está cerrada. |
| **Pros** | Rendimiento insuperable, tamaño de APK mínimo (aprox. 15-20 MB), control absoluto sobre el ciclo de vida de la batería y la cámara. |  |
| **Contras** | Solo funciona para Android. Desarrollo más lento y verboso. Requiere aprender los paradigmas específicos de Android (Ciclo de vida de Actividades/Fragmentos). |  |

### Opción 3: Ecosistema Flutter (Multiplataforma de Alto Rendimiento)

Framework de Google basado en el lenguaje Dart que compila directamente a código máquina ARM, dibujando su propia interfaz píxel por píxel.

| Componente | Tecnología | Análisis de Desempeño y Viabilidad |
| --- | --- | --- |
| **Visión e IA** | `camera` + `tflite_flutter` | **Medio/Alto.** Muy rápido, pero manipular los *streams* de la cámara e integrarlos con los tensores suele ser ligeramente más complejo y propenso a problemas de recorte (cropping) que en las otras opciones. |
| **Persistencia** | `Isar Database` o `Hive` | **Excelente.** Bases de datos NoSQL ultrarrápidas con soporte nativo para arquitecturas asíncronas. |
| **Pros** | Interfaces de usuario de altísima calidad que se ven idénticas en cualquier dispositivo (*Pixel-perfect*). Compilación nativa veloz. |  |
| **Contras** | Requiere dominar un lenguaje completamente nuevo (Dart). El peso del ejecutable base también es mayor al nativo. |  |

---

## 3. Recomendación Final y Justificación

**Tecnología Recomendada:** Opción 1 (React Native + Expo) combinada con el backend en FastAPI.

**Razones de la Elección:**

1. **Eficiencia en el Tiempo de Desarrollo:** Al tener conocimientos previos en arquitecturas web y desarrollo de componentes, la transición a React Native es orgánica. Permite iterar velozmente sobre la interfaz, ajustar los componentes visuales (como el modal de falsos positivos y los acordeones de recomendaciones) y lanzar el producto en menos tiempo.
2. **Superación de Barreras Históricas de Rendimiento:** La principal crítica a las tecnologías multiplataforma (la lentitud en tareas pesadas) ha sido resuelta gracias a la arquitectura JSI de `react-native-vision-camera`. El modelo EfficientNet-B0 correrá fluidamente en C++, logrando una experiencia indistinguible de una app nativa durante el momento crítico de la captura.
3. **Manejo de Datos Offline-First Integrado:** La dupla React Native + WatermelonDB simplifica enormemente la creación de colas de sincronización, manejando los estados de conexión intermitentes sin la complejidad de escribir *schedulers* de bajo nivel.
4. **Escalabilidad del Proyecto:** Si el proyecto crece o requiere distribución en dispositivos iOS para agrónomos supervisores, la base de código ya estará lista, duplicando el alcance con el mismo esfuerzo de desarrollo.

> **El Único Compromiso a Aceptar:** El instalador (APK) requerirá más megabytes de descarga inicial en comparación con Kotlin. Para mitigar esto, es crucial aplicar la cuantización INT8 al modelo EfficientNet-B0, reduciendo el peso del archivo `.tflite` al mínimo antes de empaquetar la aplicación.