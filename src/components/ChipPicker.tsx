import { Pressable, Text, View } from 'react-native';

interface ChipOption {
  key: string;
  label: string;
}

interface ChipPickerProps {
  options: ChipOption[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
}

export function ChipPicker({ options, selectedKey, onSelect }: ChipPickerProps) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((option) => {
        const isActive = option.key === selectedKey;
        return (
          <Pressable
            key={option.key}
            onPress={() => onSelect(option.key)}
            accessibilityLabel={option.label}
            className="rounded-full px-4 justify-center"
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
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
