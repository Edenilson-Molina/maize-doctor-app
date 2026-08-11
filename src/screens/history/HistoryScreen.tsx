import { useEffect, useState, useMemo } from 'react';
import { View, Text, FlatList, TextInput, Pressable, SectionList } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { database, hasNativeModule } from '@/data/database';
import { Q } from '@nozbe/watermelondb';
import { DIAGNOSIS_MAP, DIAGNOSIS_CLASSES, type DiagnosisClass } from '@/content/diagnosis';
import { Icon } from '@/components/Icon';
import { getMockScans } from '@/data/mockData';
import type { HistoryStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<HistoryStackParamList, 'HistoryList'>;

interface ScanRow {
  id: string;
  label: DiagnosisClass;
  confidence: number;
  lat: number | null;
  lon: number | null;
  createdAt: number;
  imageUri: string | null;
}

interface ScanSection {
  title: string;
  data: ScanRow[];
}

function groupByDate(scans: ScanRow[]): ScanSection[] {
  const now = Date.now();
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

  const recent: ScanRow[] = [];
  const lastWeek: ScanRow[] = [];
  const older: ScanRow[] = [];

  for (const scan of scans) {
    if (scan.createdAt >= todayStart) {
      recent.push(scan);
    } else if (scan.createdAt >= weekAgo) {
      lastWeek.push(scan);
    } else {
      older.push(scan);
    }
  }

  const sections: ScanSection[] = [];
  if (recent.length > 0) sections.push({ title: 'Actividad Reciente', data: recent });
  if (lastWeek.length > 0) sections.push({ title: 'Semana Pasada', data: lastWeek });
  if (older.length > 0) sections.push({ title: 'Anteriores', data: older });
  return sections;
}

export function HistoryScreen({ navigation }: Props) {
  const [scans, setScans] = useState<ScanRow[]>([]);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  useEffect(() => {
    if (!hasNativeModule) {
      setScans(
        getMockScans().map((s) => ({
          id: s.id,
          label: s.label,
          confidence: s.confidence,
          lat: s.lat,
          lon: s.lon,
          createdAt: s.createdAt,
          imageUri: null,
        })),
      );
      return;
    }

    const col = database!.collections.get('scans');
    const sub = col
      .query(Q.sortBy('created_at', Q.desc))
      .observe()
      .subscribe((results: any[]) => {
        setScans(
          results
            .filter((s) => s.label !== null)
            .map((s) => ({
              id: s.id,
              label: s.label as DiagnosisClass,
              confidence: s.confidence ?? 0,
              lat: s.lat,
              lon: s.lon,
              createdAt: (s._raw as any).created_at as number,
              imageUri: s.imageUri?.startsWith('dev://') ? null : s.imageUri,
            })),
        );
      });
    return () => sub.unsubscribe();
  }, []);

  const filtered = useMemo(() => {
    let result = scans;

    if (activeFilter && activeFilter !== 'all') {
      result = result.filter((s) => s.label === activeFilter);
    }

    if (search.trim()) {
      const term = search.toLowerCase();
      result = result.filter((s) => DIAGNOSIS_MAP[s.label].label.toLowerCase().includes(term));
    }

    return result;
  }, [scans, activeFilter, search]);

  const sections = useMemo(() => groupByDate(filtered), [filtered]);

  const filterChips = [
    { key: 'all', label: 'Todos' },
    ...DIAGNOSIS_CLASSES.map((c) => ({ key: c, label: DIAGNOSIS_MAP[c].label })),
  ];

  return (
    <View className="flex-1 bg-background">
      {/* Search & Filters */}
      <View className="px-container-padding pt-3 bg-background">
        {/* Search bar */}
        <View className="flex-row items-center bg-surface-container-low rounded-lg border border-outline-variant px-4 h-12 shadow-sm">
          <Icon name="magnify" size={20} color="#717973" />
          <TextInput
            className="flex-1 ml-3 font-inter text-body-md text-on-surface"
            placeholder="Buscar escaneos pasados..."
            placeholderTextColor="#717973"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <Icon name="close-circle" size={18} color="#717973" />
            </Pressable>
          )}
        </View>

        {/* Filter chips */}
        <FlatList
          horizontal
          data={filterChips}
          keyExtractor={(item) => item.key}
          showsHorizontalScrollIndicator={false}
          className="mt-3 mb-2"
          renderItem={({ item }) => {
            const isActive = activeFilter === item.key || (!activeFilter && item.key === 'all');
            return (
              <Pressable
                onPress={() => setActiveFilter(item.key === 'all' ? null : item.key)}
                className="mr-3 rounded-full px-5 justify-center"
                style={{
                  height: 40,
                  backgroundColor: isActive ? '#012d1d' : '#e1e3e4',
                  borderWidth: isActive ? 0 : 1,
                  borderColor: '#c1c8c2',
                }}
              >
                <Text
                  className="font-jetbrains text-label-md"
                  style={{ color: isActive ? '#ffffff' : '#414844' }}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>

      {/* Scan List */}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16, paddingTop: 8 }}
        renderSectionHeader={({ section: { title } }) => (
          <Text className="font-hanken-semibold text-headline-sm text-on-background mb-3 mt-4">
            {title}
          </Text>
        )}
        ListEmptyComponent={
          <View className="items-center py-16">
            <Icon name="clipboard-text-outline" size={48} color="#717973" />
            <Text className="font-inter text-body-md text-on-surface-variant mt-3">
              No se encontraron escaneos
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => navigation.navigate('ScanDetail', { scanId: item.id })}>
            <HistoryScanCard scan={item} />
          </Pressable>
        )}
      />
    </View>
  );
}

function HistoryScanCard({ scan }: { scan: ScanRow }) {
  const info = DIAGNOSIS_MAP[scan.label];
  const dateStr = new Date(scan.createdAt).toLocaleDateString('es-SV', {
    day: 'numeric',
    month: 'short',
  });
  const timeStr = new Date(scan.createdAt).toLocaleTimeString('es-SV', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const confPercent = `${(scan.confidence * 100).toFixed(0)}% Conf.`;

  const badgeStyle = getBadgeStyle(scan.label, info);
  const recommendation = getRecommendation(scan.label);

  return (
    <View
      className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden flex-row mb-3 relative"
      style={{ height: 120 }}
    >
      {/* Left color strip */}
      <View
        className="absolute top-0 left-0 w-1 h-full"
        style={{ backgroundColor: info.statusColor }}
      />

      {/* Image thumbnail placeholder */}
      <View className="w-[100px] h-full bg-surface-container items-center justify-center">
        <Icon name="leaf" size={36} color="#c1c8c2" />
      </View>

      {/* Content */}
      <View className="flex-1 p-3 justify-between">
        <View>
          <View className="flex-row justify-between items-start">
            <View className="flex-1 mr-2">
              <Text className="font-hanken-semibold text-[18px] leading-tight text-on-surface">
                {info.label}
              </Text>
              <Text className="font-inter text-sm text-on-surface-variant mt-0.5">
                {dateStr} • {timeStr}
              </Text>
            </View>
            <View className="rounded-md px-2 py-1" style={{ backgroundColor: badgeStyle.bg }}>
              <Text className="font-jetbrains text-[11px]" style={{ color: badgeStyle.text }}>
                {confPercent}
              </Text>
            </View>
          </View>
        </View>

        {/* Recommendation */}
        <View className="flex-row items-center mt-1">
          <Icon name={recommendation.icon as never} size={16} color={info.statusColor} />
          <Text
            className="font-inter text-sm ml-1"
            style={{ color: info.statusColor, fontWeight: '500' }}
            numberOfLines={1}
          >
            {recommendation.text}
          </Text>
        </View>
      </View>
    </View>
  );
}

function getBadgeStyle(label: DiagnosisClass, info: { severity: string }) {
  if (label === 'healthy') {
    return { bg: '#1b4332', text: '#86af99' };
  }
  if (info.severity === 'critical' || info.severity === 'high') {
    return { bg: '#ffdad6', text: '#93000a' };
  }
  return { bg: '#ffca98', text: '#7a532a' };
}

function getRecommendation(label: DiagnosisClass): { icon: string; text: string } {
  if (label === 'healthy') {
    return { icon: 'check-circle-outline', text: 'Desarrollo óptimo del cultivo' };
  }
  const info = DIAGNOSIS_MAP[label];
  if (info.severity === 'critical' || info.severity === 'high') {
    return { icon: 'alert-circle-outline', text: 'Requiere atención inmediata' };
  }
  return {
    icon: 'alert-outline',
    text: info.recommendations[0] ?? 'Aplicar tratamiento preventivo',
  };
}
