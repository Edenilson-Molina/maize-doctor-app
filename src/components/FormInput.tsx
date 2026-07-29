import { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { Icon } from './Icon';
import type { ComponentProps } from 'react';

type IconName = ComponentProps<typeof Icon>['name'];

interface FormInputProps {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  icon?: IconName;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'sentences' | 'words';
}

export function FormInput({
  label,
  placeholder,
  value,
  onChangeText,
  error,
  icon,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
}: FormInputProps) {
  const [isSecureVisible, setIsSecureVisible] = useState(false);

  return (
    <View className="mb-4">
      <View className="flex-row items-center mb-1.5">
        {icon && <Icon name={icon} size={18} color="#414844" />}
        <Text className="font-jetbrains-medium text-label-md text-on-surface-variant ml-1.5">
          {label}
        </Text>
      </View>
      <View
        className={`flex-row items-center border rounded-lg px-4 min-h-touch-target ${
          error ? 'border-error' : 'border-outline-variant'
        } bg-surface-container-lowest`}
      >
        <TextInput
          className="flex-1 font-inter text-body-md text-on-surface py-3"
          placeholder={placeholder}
          placeholderTextColor="#717973"
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry && !isSecureVisible}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
        />
        {secureTextEntry && (
          <Pressable onPress={() => setIsSecureVisible(!isSecureVisible)} hitSlop={8}>
            <Icon
              name={isSecureVisible ? 'eye-off-outline' : 'eye-outline'}
              size={22}
              color="#717973"
            />
          </Pressable>
        )}
      </View>
      {error && (
        <Text className="font-inter text-xs text-error mt-1 ml-1">{error}</Text>
      )}
    </View>
  );
}
