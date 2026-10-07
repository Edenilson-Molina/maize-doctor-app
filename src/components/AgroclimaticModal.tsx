import { useState, useEffect } from 'react';
import { Modal, View, Text, Pressable, ScrollView } from 'react-native';
import { Icon } from '@/components/Icon';
import {
  type AgroclimaticMetric,
  type WeatherData,
} from '@/services/weather/weatherTypes';
import { getAgroclimaticGuidance } from '@/services/weather/weatherService';

interface AgroclimaticModalProps {
  visible: boolean;
  onClose: () => void;
  selectedMetric?: AgroclimaticMetric;
  weather: WeatherData;
}

const METRIC_TABS: Array<{ id: AgroclimaticMetric; label: string; icon: string }> = [
  { id: 'temperature', label: 'Temperatura', icon: 'thermometer' },
  { id: 'humidity', label: 'Humedad', icon: 'water-outline' },
  { id: 'soil', label: 'Suelo', icon: 'grass' },
  { id: 'wind', label: 'Viento', icon: 'weather-windy' },
];

export function AgroclimaticModal({
  visible,
  onClose,
  selectedMetric = 'temperature',
  weather,
}: AgroclimaticModalProps) {
  const [activeMetric, setActiveMetric] = useState<AgroclimaticMetric>(selectedMetric);

  useEffect(() => {
    if (visible && selectedMetric) {
      setActiveMetric(selectedMetric);
    }
  }, [visible, selectedMetric]);

  const guidance = getAgroclimaticGuidance(activeMetric, weather);

  const badgeTheme =
    guidance.riskStatus === 'alert'
      ? { bg: '#FFEBEE', border: '#FFCDD2', text: '#BA1A1A' }
      : guidance.riskStatus === 'warning'
        ? { bg: '#FFFBEB', border: '#FEF3C7', text: '#D97706' }
        : { bg: '#E8F5E9', border: '#C8E6C9', text: '#1B4332' };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      testID="agroclimatic-modal"
    >
      <View className="flex-1 justify-end bg-black/60">
        <View className="bg-surface rounded-t-3xl max-h-[85%] border-t border-surface-variant p-6">
          {/* Header */}
          <View className="flex-row items-center justify-between pb-3 border-b border-surface-variant/60">
            <View className="flex-row items-center flex-1">
              <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center mr-3">
                <Icon name="weather-partly-cloudy" size={24} color="#2D6A4F" />
              </View>
              <View className="flex-1">
                <Text className="font-hanken-semibold text-headline-sm text-primary">
                  Criterio Agroclimático
                </Text>
                <Text className="font-jetbrains text-label-sm text-on-surface-variant">
                  {weather.source === 'live'
                    ? 'Lectura en vivo vía GPS'
                    : weather.source === 'cached'
                      ? 'Lectura guardada (Modo sin conexión)'
                      : 'Valores agronómicos de referencia'}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={onClose}
              accessibilityLabel="Cerrar ventana de criterio climático"
              testID="close-agroclimatic-modal"
              className="p-2 rounded-full active:bg-surface-variant/40"
            >
              <Icon name="close" size={24} color="#717973" />
            </Pressable>
          </View>

          {/* Metric Selector Tabs */}
          <View className="flex-row my-4 bg-surface-container-lowest p-1 rounded-2xl border border-surface-variant/70">
            {METRIC_TABS.map((tab) => {
              const isSelected = activeMetric === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  onPress={() => setActiveMetric(tab.id)}
                  testID={`tab-${tab.id}`}
                  accessibilityLabel={`Ver criterio de ${tab.label}`}
                  className={`flex-1 py-2 px-1 items-center rounded-xl ${
                    isSelected ? 'bg-primary' : 'bg-transparent'
                  }`}
                >
                  <Icon
                    name={tab.icon as any}
                    size={20}
                    color={isSelected ? '#FFFFFF' : '#4A5568'}
                  />
                  <Text
                    className={`font-jetbrains text-[11px] mt-1 ${
                      isSelected ? 'text-white font-bold' : 'text-on-surface-variant'
                    }`}
                    numberOfLines={1}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <ScrollView showsVerticalScrollIndicator={false} className="mb-2">
            {/* Value & Badge Card */}
            <View
              className="p-4 rounded-2xl border mb-4"
              style={{ backgroundColor: badgeTheme.bg, borderColor: badgeTheme.border }}
            >
              <View className="flex-row justify-between items-center mb-1.5">
                <Text className="font-hanken-semibold text-headline-md text-on-surface">
                  {guidance.currentValueDisplay}
                </Text>
                <View
                  className="px-2.5 py-1 rounded-full border"
                  style={{ backgroundColor: badgeTheme.bg, borderColor: badgeTheme.border }}
                >
                  <Text
                    className="font-jetbrains text-label-sm font-semibold"
                    style={{ color: badgeTheme.text }}
                  >
                    {guidance.statusBadge}
                  </Text>
                </View>
              </View>
              <Text className="font-jetbrains text-label-sm text-on-surface-variant">
                Variable evaluada: {guidance.title}
              </Text>
            </View>

            {/* Agronomic Meaning (Section 4.1 from manual) */}
            <View className="bg-surface-container-lowest p-4 rounded-2xl border border-surface-variant mb-3">
              <View className="flex-row items-center mb-2">
                <Icon name="book-open-page-variant-outline" size={20} color="#2D6A4F" />
                <Text className="font-hanken-semibold text-body-lg text-primary ml-2">
                  Qué Significa en el Cultivo
                </Text>
              </View>
              <Text className="font-inter text-body-md text-on-surface leading-5">
                {guidance.agronomicDescription}
              </Text>
            </View>

            {/* Field Recommendation */}
            <View className="bg-surface-container-lowest p-4 rounded-2xl border border-surface-variant mb-4">
              <View className="flex-row items-center mb-2">
                <Icon name="shield-check-outline" size={20} color="#D4A373" />
                <Text className="font-hanken-semibold text-body-lg text-on-surface ml-2">
                  Recomendación Práctica en Lote
                </Text>
              </View>
              <Text className="font-inter text-body-md text-on-surface leading-5">
                {guidance.fieldRecommendation}
              </Text>
            </View>
          </ScrollView>

          {/* Action Button */}
          <Pressable
            onPress={onClose}
            className="bg-primary rounded-2xl py-3.5 items-center justify-center shadow-sm active:opacity-90"
          >
            <Text className="font-hanken-semibold text-body-lg text-white">
              Entendido
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
