import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DIAGNOSIS_MAP, type DiagnosisClass } from '@/content/diagnosis';
import { ConfidenceDonut } from '@/components/ConfidenceDonut';
import { Icon } from '@/components/Icon';
import type { ScanStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<ScanStackParamList, 'ScanResult'>;

const LOW_CONFIDENCE_THRESHOLD = 0.7;

function getPriorityBadge(info: (typeof DIAGNOSIS_MAP)[DiagnosisClass]) {
  if (info.severity === 'critical' || info.severity === 'high') {
    return { label: 'Prioridad Alta', icon: 'alert' as const };
  }
  if (info.severity === 'medium' || info.severity === 'low') {
    return { label: 'Atención', icon: 'alert-circle-outline' as const };
  }
  return { label: 'Saludable', icon: 'check-circle' as const };
}

function getSecondLikelyClass(
  distribution: Record<DiagnosisClass, number>,
  topLabel: DiagnosisClass,
) {
  const [second] = Object.entries(distribution)
    .filter(([label]) => label !== topLabel)
    .sort((a, b) => b[1] - a[1]);
  return second ? { label: second[0] as DiagnosisClass, probability: second[1] } : null;
}

export function ScanResult({ route, navigation }: Props) {
  const { imageUri, label, confidence, distribution, temperature, humidity, createdAt } =
    route.params;
  const info = DIAGNOSIS_MAP[label];
  const badge = getPriorityBadge(info);
  const secondLikely =
    confidence < LOW_CONFIDENCE_THRESHOLD ? getSecondLikelyClass(distribution, label) : null;

  const dateLabel = new Date(createdAt).toLocaleDateString('es-SV', {
    day: 'numeric',
    month: 'short',
  });
  const timeLabel = new Date(createdAt).toLocaleTimeString('es-SV', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="px-container-padding pb-6"
    >
      <View className="mt-stack-sm rounded-xl overflow-hidden border border-surface-variant shadow-sm">
        <Image
          source={{ uri: imageUri }}
          style={{ width: '100%', height: 256 }}
          resizeMode="cover"
        />
        <View
          className="absolute top-4 left-4 px-3 py-1 rounded-full flex-row items-center gap-1"
          style={{ backgroundColor: info.statusColor }}
        >
          <Icon name={badge.icon} size={16} color="#ffffff" />
          <Text className="font-jetbrains text-label-md text-white">{badge.label}</Text>
        </View>
        <View className="absolute bottom-0 left-0 right-0 bg-black/60 px-4 py-3">
          <Text className="font-jetbrains text-label-md text-white/90">
            {dateLabel} • {timeLabel}
          </Text>
        </View>
      </View>

      <View className="flex-row gap-base mt-stack-md">
        <View
          className="flex-2 bg-surface-container-lowest rounded-xl p-stack-md border border-surface-variant shadow-sm"
          style={{ flex: 2, borderTopWidth: 4, borderTopColor: info.statusColor }}
        >
          <Text className="font-jetbrains text-label-md text-on-surface-variant uppercase tracking-wider mb-2">
            Diagnóstico
          </Text>
          <Text
            className="font-hanken-bold text-headline-md mb-1"
            style={{ color: info.statusColor }}
          >
            {info.label}
          </Text>
          <Text className="font-inter text-body-md text-on-surface-variant">
            {info.description}
          </Text>
          {secondLikely ? (
            <Text className="font-inter text-sm text-on-surface-variant italic mt-2">
              Podría tratarse también de: {DIAGNOSIS_MAP[secondLikely.label].label} (
              {Math.round(secondLikely.probability * 100)}%)
            </Text>
          ) : null}
        </View>

        <View
          className="bg-primary-container rounded-xl p-stack-md border items-center justify-center"
          style={{ flex: 1, borderColor: '#a5d0b9' }}
        >
          <Text className="font-jetbrains text-label-md text-on-primary-container uppercase tracking-wider mb-2 opacity-90">
            Confianza
          </Text>
          <ConfidenceDonut confidence={confidence} />
        </View>
      </View>

      <View className="flex-row gap-base mt-stack-md">
        <EnvironmentTile icon="thermometer" label="Temperatura" value={temperature} unit="°C" />
        <EnvironmentTile icon="water-percent" label="Humedad" value={humidity} unit="%" />
      </View>

      <View
        className="bg-surface-container-lowest rounded-xl p-stack-md border border-surface-variant shadow-sm mt-stack-md"
        style={{ borderLeftWidth: 4, borderLeftColor: '#7d562d' }}
      >
        <View className="flex-row items-center gap-2 mb-3">
          <Icon name="clipboard-check-outline" size={22} color="#7d562d" />
          <Text className="font-hanken-semibold text-headline-sm text-on-surface">
            Recomendaciones
          </Text>
        </View>
        {info.recommendations.map((recommendation) => (
          <View key={recommendation} className="flex-row gap-3 mb-3 items-start">
            <Icon name="check-circle-outline" size={20} color="#012d1d" />
            <Text className="flex-1 font-inter text-body-md text-on-surface-variant">
              {recommendation}
            </Text>
          </View>
        ))}
      </View>

      <Pressable
        onPress={() => navigation.goBack()}
        className="bg-primary rounded-full h-touch-target items-center justify-center flex-row gap-2 mt-stack-md"
      >
        <Icon name="camera" size={20} color="#ffffff" />
        <Text className="font-jetbrains text-label-md text-on-primary">Volver a Escanear</Text>
      </Pressable>
    </ScrollView>
  );
}

function EnvironmentTile({
  icon,
  label,
  value,
  unit,
}: {
  icon: string;
  label: string;
  value: number | null;
  unit: string;
}) {
  return (
    <View className="flex-1 bg-surface-container-lowest rounded-xl p-4 border border-surface-variant flex-row items-center gap-3 shadow-sm">
      <Icon name={icon as never} size={22} color="#3f6653" />
      <View>
        <Text className="font-jetbrains text-[11px] text-on-surface-variant">{label}</Text>
        <Text className="font-hanken-semibold text-headline-sm text-on-surface">
          {value === null ? 'N/D' : `${value}${unit}`}
        </Text>
      </View>
    </View>
  );
}
