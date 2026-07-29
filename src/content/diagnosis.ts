export type DiagnosisClass =
  | 'healthy'
  | 'common_rust'
  | 'northern_leaf_blight'
  | 'gray_leaf_spot'
  | 'lethal_necrosis'
  | 'fall_armyworm'
  | 'nitrogen_deficiency'
  | 'phosphorus_deficiency'
  | 'potassium_deficiency';

export const DIAGNOSIS_CLASSES: DiagnosisClass[] = [
  'healthy',
  'common_rust',
  'northern_leaf_blight',
  'gray_leaf_spot',
  'lethal_necrosis',
  'fall_armyworm',
  'nitrogen_deficiency',
  'phosphorus_deficiency',
  'potassium_deficiency',
];

export interface DiagnosisInfo {
  label: string;
  description: string;
  severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
  statusColor: string;
  recommendations: string[];
}

export const DIAGNOSIS_MAP: Record<DiagnosisClass, DiagnosisInfo> = {
  healthy: {
    label: 'Sana',
    description: 'Hoja sin signos visibles de enfermedad o deficiencia.',
    severity: 'none',
    statusColor: '#2d6a4f',
    recommendations: [
      'Continuar con el plan de fertilizacion actual.',
      'Monitorear periodicamente para detectar cambios tempranos.',
    ],
  },
  common_rust: {
    label: 'Roya Comun',
    description: 'Puccinia sorghi — pustulas pequenas de color marron-rojizo en ambas caras de la hoja.',
    severity: 'medium',
    statusColor: '#d4a373',
    recommendations: [
      'Aplicar fungicida foliar a base de triazoles si la infeccion es temprana.',
      'Considerar variedades resistentes para la proxima siembra. Confirmar con un especialista.',
    ],
  },
  northern_leaf_blight: {
    label: 'Tizon Foliar del Norte',
    description: 'Exserohilum turcicum — lesiones alargadas de color gris-verdoso en las hojas.',
    severity: 'high',
    statusColor: '#ba1a1a',
    recommendations: [
      'Aplicar fungicida de amplio espectro (estrobilurina + triazol).',
      'Rotar cultivos y eliminar rastrojos infectados para reducir inoculo.',
    ],
  },
  gray_leaf_spot: {
    label: 'Mancha Gris de la Hoja',
    description: 'Cercospora zeae-maydis — lesiones rectangulares grisaceas delimitadas por las nervaduras.',
    severity: 'high',
    statusColor: '#ba1a1a',
    recommendations: [
      'Aplicar fungicida foliar preventivo en etapas tempranas.',
      'Mejorar el drenaje y espaciamiento entre plantas para reducir humedad foliar.',
    ],
  },
  lethal_necrosis: {
    label: 'Necrosis Letal del Maiz',
    description: 'MLN (MCMV + SCMV) — marchitez progresiva, necrosis desde el apice hacia la base.',
    severity: 'critical',
    statusColor: '#ba1a1a',
    recommendations: [
      'No existe tratamiento quimico efectivo. Eliminar plantas infectadas para evitar propagacion.',
      'Usar semilla certificada libre de virus y controlar vectores (trips, afidos). Consultar con autoridad fitosanitaria.',
    ],
  },
  fall_armyworm: {
    label: 'Gusano Cogollero',
    description: 'Spodoptera frugiperda — daño de alimentacion en el cogollo con presencia de excremento.',
    severity: 'high',
    statusColor: '#ba1a1a',
    recommendations: [
      'Aplicar insecticida biologico (Bacillus thuringiensis) o quimico selectivo en etapas larvales tempranas.',
      'Implementar monitoreo con trampas de feromonas para deteccion temprana.',
    ],
  },
  nitrogen_deficiency: {
    label: 'Deficiencia de Nitrogeno',
    description: 'Clorosis en forma de V desde la punta de las hojas inferiores.',
    severity: 'medium',
    statusColor: '#d4a373',
    recommendations: [
      'Aplicar fertilizante nitrogenado (urea o sulfato de amonio) en dosis fraccionada.',
      'Realizar analisis de suelo para ajustar el plan de fertilizacion. Confirmar con un especialista.',
    ],
  },
  phosphorus_deficiency: {
    label: 'Deficiencia de Fosforo',
    description: 'Coloracion purpura-rojiza en hojas inferiores y crecimiento lento.',
    severity: 'medium',
    statusColor: '#d4a373',
    recommendations: [
      'Aplicar fertilizante fosforado (superfosfato triple o DAP) cerca de la raiz.',
      'Verificar pH del suelo — la disponibilidad de fosforo se reduce en suelos muy acidos o alcalinos. Confirmar con un especialista.',
    ],
  },
  potassium_deficiency: {
    label: 'Deficiencia de Potasio',
    description: 'Clorosis y necrosis marginal en hojas inferiores, comenzando desde los bordes.',
    severity: 'medium',
    statusColor: '#d4a373',
    recommendations: [
      'Aplicar cloruro de potasio (KCl) o sulfato de potasio (K2SO4).',
      'Evitar exceso de nitrogeno sin potasio complementario para mantener el balance nutricional. Confirmar con un especialista.',
    ],
  },
};
