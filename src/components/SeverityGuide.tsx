import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Icon } from './Icon';
import { SEVERITY_DISCLAIMER, SEVERITY_GUIDE, type SeverityLevel } from '@/content/severity';
import type { DiagnosisClass } from '@/content/diagnosis';

interface SeverityGuideProps {
  label: DiagnosisClass;
}

export function SeverityGuide({ label }: SeverityGuideProps) {
  const { levels } = SEVERITY_GUIDE[label];
  const [openKey, setOpenKey] = useState<string | null>(null);

  return (
    <View
      className="bg-surface-container-lowest rounded-xl p-stack-md border border-surface-variant shadow-sm mt-stack-md"
      style={{ borderLeftWidth: 4, borderLeftColor: '#3f6653' }}
    >
      <View className="flex-row items-center gap-2">
        <Icon name="stairs" size={22} color="#3f6653" />
        <Text className="font-hanken-semibold text-headline-sm text-on-surface">
          ¿Qué tan avanzado está?
        </Text>
      </View>
      <Text className="font-inter text-body-md text-on-surface-variant mt-2 mb-stack-sm">
        {SEVERITY_DISCLAIMER}
      </Text>

      {levels.map((level, index) => (
        <SeverityRow
          key={level.key}
          level={level}
          position={index + 1}
          isOpen={openKey === level.key}
          onToggle={() => setOpenKey(openKey === level.key ? null : level.key)}
        />
      ))}
    </View>
  );
}

function SeverityRow({
  level,
  position,
  isOpen,
  onToggle,
}: {
  level: SeverityLevel;
  position: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <View
      className="rounded-lg border border-outline-variant mb-2 overflow-hidden"
      style={{ backgroundColor: isOpen ? '#f3f4f5' : '#ffffff' }}
    >
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        accessibilityLabel={`Nivel ${position}: ${level.title}`}
        className="flex-row items-center gap-3 p-3"
      >
        <View
          className="w-7 h-7 rounded-full items-center justify-center"
          style={{ backgroundColor: level.accentColor }}
        >
          <Text className="font-jetbrains text-label-md text-white">{position}</Text>
        </View>
        <View className="flex-1">
          <Text className="font-hanken-semibold text-body-md text-on-surface">{level.title}</Text>
          <Text className="font-inter text-sm text-on-surface-variant mt-0.5">{level.extent}</Text>
        </View>
        <Icon name={isOpen ? 'chevron-up' : 'chevron-down'} size={22} color="#414844" />
      </Pressable>

      {isOpen ? (
        <View className="px-3 pb-3 gap-stack-sm">
          <SeverityDetail title="Qué se ve" icon="eye-outline" items={level.signs} />
          <SeverityDetail title="Qué hacer" icon="hand-back-right-outline" items={level.actions} />
          <Text className="font-jetbrains text-[11px] text-on-surface-variant opacity-80">
            {level.scientificScale}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function SeverityDetail({ title, icon, items }: { title: string; icon: string; items: string[] }) {
  return (
    <View>
      <View className="flex-row items-center gap-2 mb-1">
        <Icon name={icon as never} size={16} color="#7d562d" />
        <Text className="font-jetbrains text-label-md text-on-surface uppercase tracking-wider">
          {title}
        </Text>
      </View>
      {items.map((item) => (
        <View key={item} className="flex-row gap-2 items-start mb-1">
          <Text className="font-inter text-body-md text-on-surface-variant">•</Text>
          <Text className="flex-1 font-inter text-body-md text-on-surface-variant">{item}</Text>
        </View>
      ))}
    </View>
  );
}
