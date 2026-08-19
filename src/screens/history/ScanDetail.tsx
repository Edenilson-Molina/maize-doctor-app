import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DIAGNOSIS_CLASSES, DIAGNOSIS_MAP, type DiagnosisClass } from '@/content/diagnosis';
import { AppDialog, type DialogTone } from '@/components/AppDialog';
import { ChipPicker } from '@/components/ChipPicker';
import { Icon } from '@/components/Icon';
import { getScanById } from '@/data/queries/scanQueries';
import { createCorrection, observeCorrectionsForScan } from '@/data/queries/correctionQueries';
import { trySyncNow } from '@/api/syncQueue';
import { describeSyncOutcome, toneForOutcome } from '@/api/syncMessages';
import type { Scan } from '@/data/models/Scan';
import type { Correction } from '@/data/models/Correction';
import type { HistoryStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<HistoryStackParamList, 'ScanDetail'>;

const OBSERVED_LABEL_OPTIONS = DIAGNOSIS_CLASSES.map((c) => ({
  key: c,
  label: DIAGNOSIS_MAP[c].label,
}));

export function ScanDetail({ route }: Props) {
  const { scanId } = route.params;
  const [scan, setScan] = useState<Scan | null>(null);
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [note, setNote] = useState('');
  const [observedLabel, setObservedLabel] = useState<DiagnosisClass | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialog, setDialog] = useState<{ title: string; body: string; tone: DialogTone } | null>(
    null
  );

  useEffect(() => {
    getScanById(scanId).then(setScan);
    const subscription = observeCorrectionsForScan(scanId).subscribe(setCorrections);
    return () => subscription.unsubscribe();
  }, [scanId]);

  if (!scan) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color="#1b4332" />
      </View>
    );
  }

  const info = DIAGNOSIS_MAP[scan.label ?? 'healthy'];
  const latestCorrection = corrections[0] ?? null;

  async function handleSubmit() {
    if (!observedLabel || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await createCorrection({ scanId, observedLabel, note: note.trim() || null });

      let outcome = { status: 'nothing-pending', synced: 0, failed: 0 } as Awaited<
        ReturnType<typeof trySyncNow>
      >;
      try {
        outcome = await trySyncNow();
      } catch {
        outcome = { status: 'partial', synced: 0, failed: 1 };
      }

      const message = describeSyncOutcome(outcome);
      setDialog({ title: message.title, body: message.body, tone: toneForOutcome(outcome) });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="px-container-padding pb-6"
    >
      <View className="mt-stack-sm rounded-xl overflow-hidden border border-surface-variant shadow-sm">
        <Image
          source={{ uri: scan.imageUri }}
          style={{ width: '100%', height: 256 }}
          resizeMode="cover"
        />
        <View
          className="absolute top-0 left-0 right-0 h-1"
          style={{ backgroundColor: info.statusColor }}
        />
      </View>

      <View className="flex-row justify-between items-start mt-stack-sm">
        <View>
          <Text className="font-hanken-semibold text-headline-sm text-on-surface">
            {info.label}
          </Text>
          <Text className="font-inter text-body-md text-on-surface-variant">
            {info.description}
          </Text>
        </View>
        {scan.confidence !== null ? (
          <View className="bg-surface-container-high rounded-full px-3 py-1.5 flex-row items-center gap-1">
            <Icon name="memory" size={16} color="#012d1d" />
            <Text className="font-jetbrains text-label-md text-primary">
              {Math.round(scan.confidence * 100)}% Confianza
            </Text>
          </View>
        ) : null}
      </View>

      <View className="flex-row gap-base mt-stack-sm">
        <EnvironmentTile icon="water-percent" label="Humedad Lote" value={scan.humidity} unit="%" />
        <EnvironmentTile
          icon="thermometer"
          label="Temp. Media"
          value={scan.temperature}
          unit="°C"
        />
      </View>

      {!latestCorrection ? (
        <View className="bg-secondary-container/20 rounded-xl p-stack-sm border border-secondary-container mt-stack-md gap-stack-sm">
          <View className="flex-row items-center gap-2">
            <Icon name="comment-question-outline" size={22} color="#7d562d" />
            <Text className="font-hanken-semibold text-headline-sm text-on-surface">
              ¿Dudas con el resultado?
            </Text>
          </View>
          <Text className="font-inter text-body-md text-on-surface-variant">
            Si el diagnóstico automático no coincide con su observación en campo, reporte un posible
            falso positivo para mejorar la precisión del modelo.
          </Text>
          <TextInput
            className="bg-surface-container-lowest border border-outline-variant rounded-lg p-3 font-inter text-body-md text-on-surface"
            placeholder="Ej: Las pústulas parecen diferentes, o hay presencia de insectos no detectados..."
            placeholderTextColor="#717973"
            value={note}
            onChangeText={setNote}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
          <Text className="font-jetbrains text-label-md text-on-surface">
            ¿Qué observó en campo?
          </Text>
          <ChipPicker
            options={OBSERVED_LABEL_OPTIONS}
            selectedKey={observedLabel}
            onSelect={(key) => setObservedLabel(key as DiagnosisClass)}
          />
          <Pressable
            onPress={handleSubmit}
            disabled={!observedLabel || isSubmitting}
            accessibilityLabel="Enviar Retroalimentación"
            className="bg-primary rounded-full h-touch-target items-center justify-center flex-row gap-2 mt-2"
            style={{ opacity: !observedLabel || isSubmitting ? 0.5 : 1 }}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Icon name="send" size={18} color="#ffffff" />
                <Text className="font-jetbrains text-label-md text-on-primary">
                  Enviar Retroalimentación
                </Text>
              </>
            )}
          </Pressable>
          <Text className="text-xs text-center text-on-surface-variant font-inter">
            Un agrónomo humano revisará la imagen y enviará un veredicto final.
          </Text>
        </View>
      ) : (
        <View className="bg-surface-container rounded-lg p-3 border border-surface-dim mt-stack-md flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <Icon name="timer-sand" size={20} color="#7d562d" />
            <Text className="font-jetbrains text-label-md text-on-surface font-semibold">
              Estado de Validación
            </Text>
          </View>
          <Text className="bg-secondary-container text-xs font-jetbrains font-bold uppercase tracking-wider px-2 py-1 rounded text-on-secondary-container">
            {latestCorrection.status === 'pending' ? 'Pendiente' : 'Revisado'}
          </Text>
        </View>
      )}

      <View className="bg-surface-container-lowest rounded-xl p-stack-sm shadow-sm border border-surface-variant mt-stack-md">
        <Text className="font-hanken-semibold text-headline-sm text-on-surface mb-stack-sm">
          Historial del Registro
        </Text>
        <TimelineEvent
          icon="robot-outline"
          title={`IA diagnosticó ${info.label}`}
          time={formatDateTime(scan.createdAt)}
        />
        {latestCorrection ? (
          <TimelineEvent
            icon="flag"
            title="Agricultor reportó duda"
            time={formatDateTime(latestCorrection.createdAt)}
          />
        ) : null}
        {latestCorrection?.status === 'pending' ? (
          <TimelineEvent
            icon="timer-sand"
            title="Esperando revisión de experto"
            time="En proceso..."
            muted
            last
          />
        ) : null}
        {latestCorrection?.status === 'reviewed' ? (
          <TimelineEvent
            icon="check-decagram"
            title="Revisado por un experto"
            time="Completado"
            last
          />
        ) : null}
      </View>
      <AppDialog
        visible={dialog !== null}
        title={dialog?.title ?? ''}
        body={dialog?.body ?? ''}
        tone={dialog?.tone ?? 'info'}
        onDismiss={() => setDialog(null)}
      />
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
    <View className="flex-1 bg-surface-container-low rounded-lg p-3 flex-row items-center gap-3">
      <Icon name={icon as never} size={20} color="#7d562d" />
      <View>
        <Text className="font-jetbrains text-[11px] text-on-surface-variant">{label}</Text>
        <Text className="font-inter font-semibold text-body-md text-on-surface">
          {value === null ? 'N/D' : `${value}${unit}`}
        </Text>
      </View>
    </View>
  );
}

function TimelineEvent({
  icon,
  title,
  time,
  muted = false,
  last = false,
}: {
  icon: string;
  title: string;
  time: string;
  muted?: boolean;
  last?: boolean;
}) {
  return (
    <View
      className={`flex-row gap-3 items-start ${last ? '' : 'mb-4'}`}
      style={{ opacity: muted ? 0.6 : 1 }}
    >
      <View className="w-6 h-6 rounded-full bg-primary-container items-center justify-center">
        <Icon name={icon as never} size={14} color="#86af99" />
      </View>
      <View>
        <Text className="font-jetbrains text-label-md font-bold text-on-surface">{title}</Text>
        <Text className="text-xs text-on-surface-variant font-inter mt-0.5">{time}</Text>
      </View>
    </View>
  );
}

function formatDateTime(date: Date): string {
  const day = date.toLocaleDateString('es-SV', { day: 'numeric', month: 'short' });
  const time = date.toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' });
  return `${day}, ${time}`;
}
