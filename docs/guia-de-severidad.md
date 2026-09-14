# Guía de severidad

## El vacío que cubre

El modelo embarcado responde **qué** tiene la hoja, no **cuánto**. Sus salidas son un vector de 9 logits y las features pooled: una clase y una confianza. Nada en esa salida mide área foliar afectada, número de lesiones ni grado de defoliación.

No se entrenó un modelo capaz de distinguir niveles de daño porque las 31 623 imágenes consolidadas en `data/clean/` traen una sola etiqueta por imagen —la clase— y ninguna anotación de severidad. Producir esa anotación no es un trabajo de limpieza: cada patógeno se califica con su propia escala diagramática validada (Cobb modificada para roya, Vieira et al. para NCLB, Brito et al. para GLS, CIMMYT 1-5 para MLN, Davis et al. 1-9 para cogollero), y aplicarlas exige un fitopatólogo calificando imagen por imagen. Con clases minoritarias que rondan las 300 imágenes, partir cada una en tres grados habría dejado celdas de dos dígitos, insuficientes para entrenar y para evaluar.

La consecuencia práctica es que dos hojas con tres pústulas y con la lámina entera destruida reciben el mismo diagnóstico y una confianza parecida. Un agricultor que actúa solo sobre la etiqueta no sabe si le urge intervenir hoy o si le basta con volver a revisar en tres días.

## Qué hace la guía

Debajo de cada resultado de inferencia, la app despliega los niveles de severidad de la clase diagnosticada, traducidos a lenguaje llano, y deja que la persona compare su hoja contra las descripciones. La app nunca afirma un nivel: lo declara explícitamente en la cabecera del bloque.

> La app no mide qué tan avanzado está el daño. Compare su hoja con estas descripciones y elija la que más se le parezca.

Es una ayuda de decisión, no una segunda predicción. El nivel que el usuario elija no se guarda, no se sincroniza y no alimenta al modelo: es una lectura, no un dato.

Cada nivel muestra cuatro cosas:

| Campo | Qué responde |
|---|---|
| `title` | En qué fase está, en una frase: "Apenas empieza", "Ya se está extendiendo", "Daño grave" |
| `extent` | Cuánta hoja está comprometida, en porcentaje o en grado de la escala |
| `signs` | Qué se ve, sin nomenclatura binomial ni jerga patométrica |
| `actions` | Qué hacer en ese nivel, con manejo integrado y sin agroquímicos de síntesis |
| `scientificScale` | La escala homologada de la que sale el nivel, en letra chica, para trazabilidad |

Las ocho clases de daño usan tres niveles ascendentes (`mild`, `moderate`, `critical`) con acento verde, ámbar y rojo. La clase `healthy` no tiene grados de daño: usa los dos estados de monitoreo del catálogo (`optimal` y `watch`), porque una hoja sana bajo humedad persistente o con focos en parcelas vecinas amerita una conducta distinta a una hoja sana en condiciones tranquilas.

## De dónde sale el contenido

Todo el texto es una reescritura en lenguaje llano del [Catálogo Científico de Escalas de Severidad y Manejo Integrado (MIP) en Cultivo de Maíz](https://github.com/daiv05/maize-doctor-classifier), que vive en el repositorio del clasificador y homologa las escalas de CIMMYT, Embrapa, Iowa State University Extension, IPNI y USDA-ARS, con sus 16 referencias bibliográficas.

La reescritura conserva los umbrales numéricos y los nombres de los bioinsumos —*Bacillus subtilis*, *Trichoderma harzianum*, nim, tierra de diatomeas— porque son lo que el agricultor va a pedir en la agroservicio. Lo que se quitó es la nomenclatura binomial de los patógenos, las siglas patométricas (AFA, SAR, UAE), los estadios fenológicos en código (V10, R1, R4-R5) y los verbos de laboratorio ("coalescen", "esporulación conidial"). Un test en `src/content/severity.test.ts` verifica que esos términos no reaparezcan en los campos de lectura.

El catálogo prescinde deliberadamente de agroquímicos de síntesis, y la guía hereda esa decisión: las acciones son de manejo cultural, control biológico y bioinsumos.

## Dónde vive

| Archivo | Rol |
|---|---|
| `src/content/severity.ts` | `SEVERITY_GUIDE`, un registro de las 9 clases con sus niveles, y `SEVERITY_DISCLAIMER` |
| `src/components/SeverityGuide.tsx` | El acordeón: una fila por nivel, una sola abierta a la vez, ninguna abierta al entrar |
| `src/screens/scan/ScanResult.tsx` | Resultado recién escaneado; se omite cuando `isUnrecognized` es verdadero |
| `src/screens/history/ScanDetail.tsx` | Detalle de un escaneo guardado, sobre la etiqueta persistida |

Cuando el detector fuera de dominio marca la imagen como no reconocida no hay clase que graduar, así que la guía no se renderiza.

## Cómo editarla

El contenido es estático: se cambia editando `SEVERITY_GUIDE` y se despliega con el siguiente build. No hay endpoint, no hay caché y no depende de `maize-doctor-api`.

Agregar una clase nueva al clasificador obliga a agregar su entrada aquí: `SEVERITY_GUIDE` está tipado como `Record<DiagnosisClass, SeverityGuide>`, así que `tsc --noEmit` falla si falta, y los tests parametrizados sobre `DIAGNOSIS_CLASSES` fallan si los niveles quedan incompletos, desordenados o con los acentos fuera de la progresión verde → ámbar → rojo.

## Lo que no resuelve

La guía traslada el juicio de severidad a la persona. Eso es honesto pero tiene un costo: la calidad del nivel depende de qué tan bien compare el usuario, y dos personas frente a la misma hoja pueden elegir distinto. No sustituye a un modelo de severidad ni a un agrónomo en campo, y el bloque de recomendaciones del diagnóstico sigue remitiendo a un especialista en las clases con menos datos de entrenamiento.

Si en algún ciclo se consigue un conjunto anotado por grado, el reemplazo natural es predecir el nivel y usar esta guía como explicación de la predicción, no como sustituto.
