import type { DiagnosisClass } from './diagnosis';

export type SeverityLevelKey = 'mild' | 'moderate' | 'critical' | 'optimal' | 'watch';

export interface SeverityLevel {
  key: SeverityLevelKey;
  title: string;
  extent: string;
  signs: string[];
  actions: string[];
  accentColor: string;
  scientificScale: string;
}

export interface SeverityGuide {
  levels: SeverityLevel[];
}

export const SEVERITY_DISCLAIMER =
  'La app no mide qué tan avanzado está el daño. Compare su hoja con estas descripciones y elija la que más se le parezca.';

const MILD_COLOR = '#2d6a4f';
const MODERATE_COLOR = '#d4a373';
const CRITICAL_COLOR = '#ba1a1a';

export const SEVERITY_GUIDE: Record<DiagnosisClass, SeverityGuide> = {
  healthy: {
    levels: [
      {
        key: 'optimal',
        title: 'Todo en orden',
        extent: 'Sin señales de enfermedad ni de falta de nutrientes',
        accentColor: MILD_COLOR,
        scientificScale:
          'Estado Óptimo: Vigor Pleno — 0 % de síntomas patológicos o estrés nutricional.',
        signs: [
          'Hoja de un verde parejo y fuerte, firme al tacto.',
          'La vena del medio se ve entera, sin manchas ni puntos amarillos.',
          'No hay mordidas de insectos ni orillas quemadas.',
        ],
        actions: [
          'Seguir recorriendo el lote una vez por semana, caminando en zigzag o en X.',
          'Mantener el riego parejo, sin sequías ni encharcamientos.',
          'Dejar la vegetación de las orillas: ahí viven los insectos que controlan las plagas.',
        ],
      },
      {
        key: 'watch',
        title: 'Sana, pero con riesgo alrededor',
        extent: 'La hoja está bien, pero el clima o los lotes vecinos son un riesgo',
        accentColor: MODERATE_COLOR,
        scientificScale:
          'Estado Preventivo: Alerta Agroclimática — tejido asintomático bajo condiciones de alto riesgo microclimático.',
        signs: [
          'La hoja no tiene ningún síntoma.',
          'Pero hay humedad arriba del 90 %, lloviznas seguidas o rocío que dura toda la mañana.',
          'O ya hay focos de enfermedad en parcelas cercanas.',
        ],
        actions: [
          'Aplicar bioestimulante de algas o silicio foliar para engrosar la piel de la hoja.',
          'Subir el recorrido a dos veces por semana y revisar el envés de las hojas de abajo.',
          'Revisar las trampas de colores para detectar temprano la entrada de insectos.',
        ],
      },
    ],
  },

  common_rust: {
    levels: [
      {
        key: 'mild',
        title: 'Apenas empieza',
        extent: 'Menos del 2 % de la hoja con manchas',
        accentColor: MILD_COLOR,
        scientificScale:
          'Escala Cobb modificada (Peterson et al., 1948): < 1 % a 2 % del área foliar afectada.',
        signs: [
          'Puntitos café o color herrumbre, del tamaño de una cabeza de alfiler.',
          'Aparecen sueltos y en las dos caras de las hojas de abajo.',
          'La piel de la hoja todavía se ve casi entera.',
        ],
        actions: [
          'Revisar el lote cada 3 a 5 días, fijándose en las hojas de en medio.',
          'Arreglar el drenaje para que no se quede agua empozada.',
          'No regar por aspersión en la tarde: la hoja pasa mojada toda la noche y eso ayuda al hongo.',
        ],
      },
      {
        key: 'moderate',
        title: 'Ya se está extendiendo',
        extent: 'Entre el 3 % y el 15 % de la hoja de la mazorca y las de al lado',
        accentColor: MODERATE_COLOR,
        scientificScale:
          'Escala Cobb modificada: 3 % a 15 % del área foliar afectada en la hoja de la mazorca.',
        signs: [
          'Muchas manchitas polvosas que se juntan y forman bandas atravesadas.',
          'Alrededor de las manchas se ve un halo amarillo.',
          'El daño ya subió a las hojas de en medio, cerca de la mazorca.',
        ],
        actions: [
          'Aplicar biofungicida a base de Bacillus subtilis o Trichoderma harzianum.',
          'Aplicar foliar con fosfito o silicio para que la planta refuerce sus propias defensas.',
          'Si la milpa está por florear, consultar con un agrónomo antes de gastar en otra aplicación.',
        ],
      },
      {
        key: 'critical',
        title: 'Daño grave',
        extent: 'Más del 15 %, y puede pasar del 35 % de la hoja',
        accentColor: CRITICAL_COLOR,
        scientificScale: 'Escala Cobb modificada: > 15 % a 35 %+ del área foliar afectada.',
        signs: [
          'La piel de la hoja se rompe y suelta un polvo oscuro.',
          'Las hojas se secan antes de tiempo, incluida la bandera y la de la mazorca.',
        ],
        actions: [
          'Si el grano ya está pastoso o dentado, no vale la pena gastar en aplicaciones de rescate.',
          'Después de cosechar, picar e incorporar el rastrojo para que se descomponga rápido.',
          'El próximo ciclo, sembrar frijol o soya en ese lote en lugar de maíz.',
        ],
      },
    ],
  },

  northern_corn_leaf_blight: {
    levels: [
      {
        key: 'mild',
        title: 'Apenas empieza',
        extent: 'Entre el 0.5 % y el 5 % de la hoja',
        accentColor: MILD_COLOR,
        scientificScale: 'Escala Vieira et al. (2014): 0.5 % a 5.0 % del área foliar afectada.',
        signs: [
          'Manchas alargadas en forma de puro, de 2.5 a 5 cm de largo.',
          'De color verde grisáceo o pajizo.',
          'Solo en las hojas de más abajo.',
        ],
        actions: [
          'Marcar dónde están los primeros focos y ver de qué lado sopla el viento.',
          'No sembrar demasiado junto, para que corra el aire entre las plantas.',
          'No cargar la mano con nitrógeno sin acompañarlo de potasio.',
        ],
      },
      {
        key: 'moderate',
        title: 'Ya se está extendiendo',
        extent: 'Entre el 5 % y el 25 % de la hoja',
        accentColor: MODERATE_COLOR,
        scientificScale: 'Escala Vieira et al. (2014): 5.1 % a 25.0 % del área foliar afectada.',
        signs: [
          'Manchas de 5 a 15 cm que se van uniendo entre sí.',
          'El centro de la mancha se pone oscuro por el moho.',
          'Ya hay daño en las hojas pegadas a la mazorca.',
        ],
        actions: [
          'Aplicar biofungicida de Trichoderma harzianum o extracto de gobernadora o de cítricos.',
          'Si la milpa va entre rodilla alta y floración, pedir asistencia técnica para medir el riesgo.',
          'No entrar a trabajar el lote con las hojas mojadas: las esporas se pegan y se riegan.',
        ],
      },
      {
        key: 'critical',
        title: 'Daño grave',
        extent: 'Más del 25 %, y puede pasar del 66 % de la hoja',
        accentColor: CRITICAL_COLOR,
        scientificScale: 'Escala Vieira et al. (2014): > 25.0 % a 66 %+ del área foliar afectada.',
        signs: [
          'Las manchas se juntan todas y la hoja queda seca por completo.',
          'Hojas enrolladas y quebradizas, incluida la de la mazorca y la bandera.',
        ],
        actions: [
          'Suspender las aplicaciones foliares: la hoja ya no tiene con qué recuperarse.',
          'Cosechar a tiempo para que el tallo no se pudra ni se doble.',
          'Para el siguiente ciclo, comprar semilla certificada con resistencia al tizón.',
        ],
      },
    ],
  },

  gray_leaf_spot: {
    levels: [
      {
        key: 'mild',
        title: 'Apenas empieza',
        extent: 'Menos del 2.5 % de la hoja',
        accentColor: MILD_COLOR,
        scientificScale: 'Escala Brito et al. (2007): < 2.5 % del área foliar afectada.',
        signs: [
          'Manchitas café o amarillas, angostas, de 1 a 2 cm de largo.',
          'Van encajonadas entre las venas de la hoja.',
          'Solo en las hojas viejas de abajo.',
        ],
        actions: [
          'Fijarse si en los lotes vecinos quedó rastrojo de maíz sin incorporar.',
          'Limpiar las malezas de hoja angosta para que corra el aire entre las plantas.',
          'Mantener la fertilización pareja, con silicio y micronutrientes.',
        ],
      },
      {
        key: 'moderate',
        title: 'Ya se está extendiendo',
        extent: 'Entre el 2.6 % y el 15 % de la hoja',
        accentColor: MODERATE_COLOR,
        scientificScale: 'Escala Brito et al. (2007): 2.6 % a 15.0 % del área foliar afectada.',
        signs: [
          'Manchas claramente rectangulares de 2 a 6 cm, con los bordes rectos pegados a las venas.',
          'Con el rocío se ven grises y opacas.',
          'Ya hay daño en las hojas de en medio.',
        ],
        actions: [
          'Aplicar caldo bordelés al 1 % o caldo sulfocálcico diluido, si la normativa local lo permite.',
          'Usar biofungicida de Bacillus amyloliquefaciens o extracto de árbol de té.',
          'Preguntar a un técnico si el avance diario amenaza la hoja de la mazorca.',
        ],
      },
      {
        key: 'critical',
        title: 'Daño grave',
        extent: 'Más del 15 %, y puede pasar del 40 % de la hoja',
        accentColor: CRITICAL_COLOR,
        scientificScale: 'Escala Brito et al. (2007): > 15.0 % a 40 %+ del área foliar afectada.',
        signs: [
          'Las manchas rectangulares se juntan y la hoja de la mazorca queda inservible.',
          'El cultivo se seca antes de tiempo y los tallos quedan débiles.',
        ],
        actions: [
          'Cosechar apenas el grano llegue a madurez, antes de que las plantas se vuelquen.',
          'Dejar ese lote sin maíz al menos dos años: sembrar soya, caupí o cultivo de cobertura.',
          'Compostar o enterrar el rastrojo para cortar el ciclo del hongo.',
        ],
      },
    ],
  },

  lethal_necrosis: {
    levels: [
      {
        key: 'mild',
        title: 'Apenas empieza',
        extent: 'Grado 2 de 5 en la escala internacional',
        accentColor: MILD_COLOR,
        scientificScale:
          'Escala CIMMYT (Wangai et al., 2012): grado 2 — moteado suave, estrías finas.',
        signs: [
          'Moteado amarillo fino o rayado en las hojas nuevas del cogollo.',
          'Rayas verde pálido cortadas, a lo largo de las venas.',
          'La planta todavía no se ve enana.',
        ],
        actions: [
          'Arrancar de raíz las plantas con síntomas y enterrarlas fuera del lote.',
          'Poner trampas pegajosas amarillas y azules en las orillas para ver qué insectos entran.',
          'Quitar las malezas de hoja angosta, que es donde se guarda el virus.',
        ],
      },
      {
        key: 'moderate',
        title: 'Ya se está extendiendo',
        extent: 'Grados 3 y 4 de 5 en la escala internacional',
        accentColor: MODERATE_COLOR,
        scientificScale: 'Escala CIMMYT: grados 3 a 4 — clorosis severa y necrosis marginal.',
        signs: [
          'Amarillamiento parejo que sube desde abajo hacia la punta.',
          'Hojas de arriba casi blancas y planta achaparrada, con entrenudos cortos.',
          'Los bordes de las hojas empiezan a secarse.',
        ],
        actions: [
          'Controlar los insectos con aceite de nim o jabón potásico en las parcelas de al lado.',
          'Sembrar franjas de flores para atraer chinches y crisopas, que se comen a los trips.',
          'Avisar a la oficina de extensión agrícola: esto se maneja por zona, no por parcela.',
        ],
      },
      {
        key: 'critical',
        title: 'Daño grave',
        extent: 'Grado 5 de 5: la planta se muere',
        accentColor: CRITICAL_COLOR,
        scientificScale: 'Escala CIMMYT: grado 5 — necrosis apical total y muerte de la planta.',
        signs: [
          'El cogollo se seca completo, lo que se conoce como corazón muerto.',
          'Hojas enrolladas y muertas; mazorcas vanas, torcidas o que nunca salen.',
        ],
        actions: [
          'Si casi todo el lote está infectado, destruirlo para que no contagie a los vecinos.',
          'Dejar la zona sin maíz al menos 90 días.',
          'Comprar solo semilla certificada y tratada contra insectos.',
        ],
      },
    ],
  },

  fall_armyworm: {
    levels: [
      {
        key: 'mild',
        title: 'Apenas empieza',
        extent: 'Grados 1 a 3 de 9 en la escala internacional',
        accentColor: MILD_COLOR,
        scientificScale:
          'Escala Davis et al. (1992): grados 1 a 3 — raspado y perforaciones menores a 1.3 cm.',
        signs: [
          'Ventanitas transparentes donde el gusanito raspó la hoja sin atravesarla.',
          'Agujeritos del tamaño de un perdigón.',
          'Casi no se ve excremento.',
        ],
        actions: [
          'Este es el mejor momento para controlar: aplicar Bacillus thuringiensis directo al cogollo.',
          'Aplicar nim disuelto en agua temprano en la mañana, antes de que el gusano se esconda.',
          'Buscar las masas de huevos algodonosas y soltar avispitas Trichogramma.',
        ],
      },
      {
        key: 'moderate',
        title: 'Ya se está extendiendo',
        extent: 'Grados 4 a 6 de 9 en la escala internacional',
        accentColor: MODERATE_COLOR,
        scientificScale:
          'Escala Davis et al. (1992): grados 4 a 6 — lesiones mayores a 2.5 cm y excremento abundante.',
        signs: [
          'Agujeros grandes e irregulares en las hojas que salen del cogollo.',
          'Excremento húmedo parecido a aserrín dentro del cogollo.',
          'Gusanos ya medianos, fáciles de ver.',
        ],
        actions: [
          'Echar al cogollo arena fina cernida, tierra de diatomeas o ceniza seca para deshidratar al gusano.',
          'Cuidar a las tijeretas y chinches asesinas que ya están en el lote.',
          'Si más de 2 de cada 10 plantas tienen daño fresco, buscar asistencia técnica.',
        ],
      },
      {
        key: 'critical',
        title: 'Daño grave',
        extent: 'Grados 7 a 9 de 9: el cogollo está destruido',
        accentColor: CRITICAL_COLOR,
        scientificScale:
          'Escala Davis et al. (1992): grados 7 a 9 — desgarro total del cogollo y meristemo devorado.',
        signs: [
          'Cogollo deshilachado, molido y con pudrición húmeda.',
          'Gusanos grandes de más de 3 cm barrenando el tallo.',
          'La planta perdió su eje central.',
        ],
        actions: [
          'Revisar si el punto de crecimiento está comido: si lo está, esa planta ya no dará mazorca.',
          'Poner trampas de feromonas para bajar la población de palomillas adultas.',
          'Para el próximo ciclo, considerar híbridos certificados o criollos tolerantes de hoja peluda.',
        ],
      },
    ],
  },

  nitrogen_deficiency: {
    levels: [
      {
        key: 'mild',
        title: 'Apenas empieza',
        extent: 'Menos del 15 % del follaje amarillento',
        accentColor: MILD_COLOR,
        scientificScale:
          'Guía Iowa State University Extension: clorosis basal < 15 % del dosel foliar.',
        signs: [
          'Las hojas de abajo pierden el verde y se ven verde pálido.',
          'Empieza por la punta de la primera o segunda hoja de abajo.',
        ],
        actions: [
          'Aplicar biol o purín fermentado con suero y estiércol maduro, en foliar.',
          'Revisar si el suelo está encharcado: con exceso de agua el nitrógeno se lava.',
          'Repartir la fertilización en varias pasadas en vez de una sola.',
        ],
      },
      {
        key: 'moderate',
        title: 'Ya se está extendiendo',
        extent: 'Entre el 15 % y el 40 % del follaje',
        accentColor: MODERATE_COLOR,
        scientificScale:
          'Guía Iowa State University Extension: amarillamiento en "V" en 15 % a 40 % del dosel.',
        signs: [
          'Amarillo en forma de V al revés, que empieza en la punta y baja por la vena del medio.',
          'Los bordes de la hoja todavía se ven verdes.',
          'Tallos delgados y entrenudos cortos.',
        ],
        actions: [
          'Reabonar al suelo antes de que la milpa pase la rodilla, con una fuente que la planta tome rápido.',
          'Echar bocashi u otra enmienda orgánica al pie de la planta.',
          'Medir el pH del suelo: fuera del rango 6.0 a 6.8 la materia orgánica no libera nitrógeno.',
        ],
      },
      {
        key: 'critical',
        title: 'Daño grave',
        extent: 'Más del 40 % del follaje, con las hojas de abajo secas',
        accentColor: CRITICAL_COLOR,
        scientificScale:
          'Guía Iowa State University Extension: > 40 % del dosel con desecación total de hojas inferiores.',
        signs: [
          'Hojas de abajo y de en medio quemadas por completo.',
          'El amarillo ya llegó a la hoja de la mazorca.',
          'Tallo débil que se dobla y granos abortados en la punta de la mazorca.',
        ],
        actions: [
          'Ya no aplicar nitrógeno después de la floración: no recupera los granos perdidos.',
          'Mandar a hacer un análisis de suelo antes de la próxima siembra.',
          'Sembrar frijol terciopelo, mucuna o crotalaria en el descanso para que fijen nitrógeno.',
        ],
      },
    ],
  },

  phosphorus_deficiency: {
    levels: [
      {
        key: 'mild',
        title: 'Apenas empieza',
        extent: 'Puntas moradas en las hojas de abajo, con la planta todavía chica',
        accentColor: MILD_COLOR,
        scientificScale:
          'Guía Iowa State University Extension: pigmentación en puntas de hojas basales en estadios V2-V4.',
        signs: [
          'Hojas de abajo verde oscuro opaco, con puntas y bordes morados o rojizos.',
          'La raíz va un poco atrasada.',
        ],
        actions: [
          'Medir la temperatura del suelo: abajo de 15 °C la raíz no alcanza el fósforo aunque esté ahí.',
          'No aporcar muy hondo, para no cortar las raíces de arriba.',
          'Aplicar foliar de biofertilizante fosforado o extracto de algas.',
        ],
      },
      {
        key: 'moderate',
        title: 'Ya se está extendiendo',
        extent: 'Morado en el tallo y en varias hojas de abajo y de en medio',
        accentColor: MODERATE_COLOR,
        scientificScale:
          'Guía Iowa State University Extension: coloración violácea en tallo y hojas basales o medias.',
        signs: [
          'Color morado fuerte en las vainas, las venas y los bordes de varias hojas.',
          'La planta crece notablemente más despacio.',
        ],
        actions: [
          'Inocular bacterias solubilizadoras de fósforo, como Pseudomonas putida o Bacillus megaterium.',
          'Aplicar micorrizas para que la raíz explore más volumen de suelo.',
          'Revisar el pH: abajo de 5.5 el fósforo queda pegado al hierro y al aluminio.',
        ],
      },
      {
        key: 'critical',
        title: 'Daño grave',
        extent: 'Plantas raquíticas y floración despareja',
        accentColor: CRITICAL_COLOR,
        scientificScale:
          'Guía Iowa State University Extension: plantas raquíticas con asincronía floral pronunciada.',
        signs: [
          'Plantas enanas y achaparradas en todo el lote.',
          'Tallos delgados y quebradizos.',
          'Los pelos de la mazorca salen tarde, y quedan mazorcas chiquitas, torcidas o sin grano.',
        ],
        actions: [
          'La cosecha de este ciclo ya no se recupera: enfocar el trabajo en preparar el siguiente.',
          'Encalar antes de la próxima siembra si el suelo está muy ácido.',
          'Meter compost maduro con roca fosfórica en el fondo del surco al sembrar.',
        ],
      },
    ],
  },

  potassium_deficiency: {
    levels: [
      {
        key: 'mild',
        title: 'Apenas empieza',
        extent: 'Bordes amarillos en las hojas de más abajo',
        accentColor: MILD_COLOR,
        scientificScale: 'Guía IPNI: clorosis marginal en hojas basales inferiores.',
        signs: [
          'Amarillo corrido por la orilla de las hojas de abajo, empezando en la punta.',
          'La vena del medio sigue bien verde.',
        ],
        actions: [
          'Aplicar sales potásicas quelatadas o sulfato de potasio en dosis baja, con la milpa chica.',
          'Revisar si el suelo está compactado: así el potasio no llega a la raíz.',
          'Mantener cobertura de rastrojo para conservar la humedad de la capa de arriba.',
        ],
      },
      {
        key: 'moderate',
        title: 'Ya se está extendiendo',
        extent: 'Bordes quemados en las hojas de abajo y de en medio',
        accentColor: MODERATE_COLOR,
        scientificScale:
          'Guía IPNI: necrosis de bordes foliares en hojas del tercio basal y medio.',
        signs: [
          'Los bordes amarillos se ponen café y se secan, como quemados.',
          'Las orillas se ven deshilachadas o rasgadas.',
          'El centro de la hoja sigue verde.',
        ],
        actions: [
          'Incorporar ceniza de leña limpia y cernida al momento del aporque.',
          'Revisar el balance de calcio y magnesio: en exceso le quitan el lugar al potasio.',
          'Regar parejo: con sequía el potasio deja de moverse hacia la raíz.',
        ],
      },
      {
        key: 'critical',
        title: 'Daño grave',
        extent: 'El quemado avanza al centro de la hoja y los tallos se doblan',
        accentColor: CRITICAL_COLOR,
        scientificScale:
          'Guía IPNI: necrosis que avanza al centro foliar, con tallos de médula hueca y acame.',
        signs: [
          'La quemadura avanza desde la orilla hacia el centro de la hoja.',
          'Hay daño en varios pisos de la planta.',
          'Tallos huecos por dentro, que se acaman con viento moderado.',
        ],
        actions: [
          'Cosechar rápido apenas madure el grano, antes de que se vuelque el lote.',
          'Hacer análisis de suelo para conocer la capacidad de intercambio y reponer el potasio.',
          'Dejar el rastrojo en el lote: más del 70 % del potasio de la planta se queda en tallos y hojas.',
        ],
      },
    ],
  },
};
