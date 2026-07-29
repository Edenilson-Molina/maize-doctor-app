import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { hasNativeModule, database } from '@/data/database';
import { Q } from '@nozbe/watermelondb';
import { DIAGNOSIS_MAP, type DiagnosisClass } from '@/content/diagnosis';
import { Icon } from '@/components/Icon';
import { getMockScans } from '@/data/mockData';
import { useAuth } from '@/auth/AuthContext';

interface ScanSummary {
  id: string;
  label: DiagnosisClass;
  confidence: number;
  createdAt: number;
  imageUri: string | null;
}

export function HomeScreen() {
  const { user } = useAuth();
  const [recentScans, setRecentScans] = useState<ScanSummary[]>([]);
  const [totalScans, setTotalScans] = useState(0);

  useEffect(() => {
    if (!hasNativeModule) {
      const mocks = getMockScans();
      setTotalScans(mocks.length);
      setRecentScans(
        mocks.slice(0, 4).map((s) => ({
          id: s.id,
          label: s.label,
          confidence: s.confidence,
          createdAt: s.createdAt,
          imageUri: null,
        }))
      );
      return;
    }

    async function loadFromDb() {
      const { seedDevData } = require('@/data/seedDevData');
      if (__DEV__) await seedDevData();

      const col = database!.collections.get('scans');
      const all = await col.query().fetch();
      setTotalScans(all.length);

      const recent = await col
        .query(Q.sortBy('created_at', Q.desc), Q.take(4))
        .fetch();
      setRecentScans(
        recent
          .filter((s: any) => s.label !== null)
          .map((s: any) => ({
            id: s.id,
            label: s.label as DiagnosisClass,
            confidence: s.confidence ?? 0,
            createdAt: (s._raw as any).created_at as number,
            imageUri: s.imageUri?.startsWith('dev://') ? null : s.imageUri,
          }))
      );
    }
    loadFromDb();
  }, []);

  const userName = user?.name?.split(' ')[0] ?? 'Agricultor';

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="px-container-padding pb-6">
      {/* Greeting */}
      <View className="mt-4 mb-2">
        <Text className="font-hanken-bold text-[28px] leading-9 text-primary">
          Hola, {userName}
        </Text>
        <View className="flex-row items-center mt-1">
          <Icon name="map-marker" size={18} color="#717973" />
          <Text className="font-inter text-body-md text-on-surface-variant ml-1">
            Campo Norte, Sector B
          </Text>
        </View>
      </View>

      {/* FAB - Iniciar Nuevo Escaneo */}
      <Pressable className="bg-primary-container rounded-3xl p-8 items-center my-4 shadow-lg">
        <Icon name="scan-helper" size={48} color="#86af99" />
        <Text className="font-hanken-semibold text-headline-md text-on-primary-container mt-3">
          Iniciar Nuevo Escaneo
        </Text>
        <Text className="font-jetbrains text-label-md text-on-primary-container/80 text-center mt-1">
          Detección de plagas y enfermedades asistida por IA
        </Text>
      </Pressable>

      {/* Environmental Metrics 2x2 */}
      <View className="flex-row mb-4">
        <EnvironmentCard icon="thermometer" value="24°C" label="Temperatura" color="#7d562d" />
        <View className="w-gutter" />
        <EnvironmentCard icon="water-outline" value="65%" label="Humedad" color="#3f6653" />
      </View>
      <View className="flex-row mb-6">
        <EnvironmentCard icon="grass" value="Adecuada" label="Hum. Suelo" color="#ffca98" />
        <View className="w-gutter" />
        <EnvironmentCard icon="weather-windy" value="12 km/h" label="Viento" color="#717973" />
      </View>

      {/* Science Banner */}
      <Pressable
        className="flex-row items-center rounded-xl p-5 mb-6"
        style={{ backgroundColor: '#00452e' }}
      >
        <View
          className="rounded-full p-3 mr-4"
          style={{ backgroundColor: '#95d4b3' }}
        >
          <Icon name="database-outline" size={28} color="#002d1c" />
        </View>
        <View className="flex-1">
          <Text className="font-hanken-semibold text-headline-sm" style={{ color: '#75b393' }}>
            ¡Sé parte de la Ciencia!
          </Text>
          <Text className="font-inter text-body-md mt-0.5" style={{ color: 'rgba(117,179,147,0.9)' }}>
            Contribuye con tus fotos al Dataset Nacional y ayuda a mejorar nuestra IA.
          </Text>
        </View>
        <Icon name="chevron-right" size={24} color="#75b393" />
      </Pressable>

      {/* Recent Scans */}
      <View className="flex-row justify-between items-end mb-3">
        <Text className="font-hanken-semibold text-headline-sm text-primary">
          Escaneos Recientes
        </Text>
        <Text className="font-jetbrains text-label-md text-surface-tint">
          Ver todo
        </Text>
      </View>

      {recentScans.length === 0 ? (
        <View className="bg-surface-container-lowest rounded-xl p-6 items-center border border-surface-variant">
          <Text className="font-inter text-body-md text-on-surface-variant">
            No hay escaneos registrados aun.
          </Text>
        </View>
      ) : (
        <View className="flex flex-col w-full" style={{ gap: 16 }}>
          {recentScans.map((scan) => (
            <ScanCard key={scan.id} scan={scan} />
          ))}
        </View>
      )}

      {/* Field Map */}
      <View className="mt-6 mb-2">
        <Text className="font-hanken-semibold text-headline-sm text-primary mb-3">
          Cobertura del Campo
        </Text>
        <View className="bg-surface-container-lowest rounded-xl border border-surface-variant h-40 items-center justify-center overflow-hidden">
          <Icon name="map-outline" size={48} color="#c1c8c2" />
          <Text className="font-inter text-sm text-outline mt-2">
            Mapa satelital — disponible en version futura
          </Text>
          <View className="absolute bottom-2 right-2 bg-surface/90 px-2 py-1 rounded border border-outline-variant">
            <Text className="font-jetbrains text-[10px] text-on-surface-variant">
              Sector B: {totalScans} escaneos
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

function EnvironmentCard({
  icon,
  value,
  label,
  color,
}: {
  icon: string;
  value: string;
  label: string;
  color: string;
}) {
  return (
    <View className="flex-1 bg-surface-container-lowest rounded-xl border border-surface-variant p-4 items-center justify-center shadow-sm">
      <Icon name={icon as never} size={28} color={color} />
      <Text className="font-hanken-semibold text-headline-sm text-on-surface mt-2">
        {value}
      </Text>
      <Text className="font-jetbrains text-label-md text-on-surface-variant mt-0.5">
        {label}
      </Text>
    </View>
  );
}

function ScanCard({ scan }: { scan: ScanSummary }) {
  const info = DIAGNOSIS_MAP[scan.label];
  const timeAgo = getTimeAgo(scan.createdAt);
  const confPercent = `${(scan.confidence * 100).toFixed(0)}%`;

  const badgeColor =
    scan.label === 'healthy'
      ? { bg: 'rgba(177,240,206,0.3)', text: '#3f6653' }
      : info.severity === 'critical' || info.severity === 'high'
        ? { bg: 'rgba(255,218,214,0.5)', text: '#ba1a1a' }
        : { bg: 'rgba(255,202,152,0.3)', text: '#7d562d' };

  return (
    <View
      className="bg-surface-container-lowest rounded-xl border border-surface-variant overflow-hidden shadow-sm"
      style={{ width: '100%' }}
    >
      {/* Image placeholder */}
      <View className="h-28 bg-surface-container items-center justify-center relative">
        <Icon name="leaf" size={40} color="#c1c8c2" />
        {/* Status strip top */}
        <View
          className="absolute top-0 left-0 right-0 h-1"
          style={{ backgroundColor: info.statusColor }}
        />
      </View>
      {/* Info */}
      <View className="p-3">
        <View className="flex-row justify-between items-center">
          <Text className="font-jetbrains text-label-md text-on-surface" numberOfLines={1}>
            {info.label}
          </Text>
          <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: badgeColor.bg }}>
            <Text className="font-jetbrains text-[11px]" style={{ color: badgeColor.text }}>
              {confPercent}
            </Text>
          </View>
        </View>
        <Text className="font-inter text-sm text-on-surface-variant mt-0.5">
          {timeAgo}
        </Text>
      </View>
    </View>
  );
}

function getTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return 'Hace unos minutos';
  if (hours < 24) return `Hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Ayer';
  if (days < 7) return `Hace ${days} días`;
  return new Date(timestamp).toLocaleDateString('es-SV', { day: 'numeric', month: 'short' });
}
