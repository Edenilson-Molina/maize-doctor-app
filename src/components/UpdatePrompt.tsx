import { Linking, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Icon } from './Icon';
import type { AppUpdateInfo } from '@/api/AppUpdateService';
import { logger } from '@/lib/logger';

interface UpdatePromptProps {
  visible: boolean;
  info: AppUpdateInfo | null;
  required: boolean;
  onDismiss: () => void;
}

/**
 * Prompts the user to install a newer release.
 *
 * A required update offers no way out: it renders without a dismiss affordance
 * and ignores the Android back button, since the backend has declared the
 * installed build unsupported.
 *
 * @param {UpdatePromptProps} props Release details and dismissal handler.
 * @returns {JSX.Element|null} The prompt, or null when there is nothing to offer.
 */
export function UpdatePrompt({ visible, info, required, onDismiss }: UpdatePromptProps) {
  if (!visible || !info) return null;

  const openDownload = async () => {
    try {
      await Linking.openURL(info.downloadUrl);
    } catch (error) {
      logger.warn('No se pudo abrir el enlace de descarga', error);
    }
  };

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={required ? () => {} : onDismiss}
    >
      <View
        className="flex-1 items-center justify-center px-container-padding"
        style={{ backgroundColor: 'rgba(1, 45, 29, 0.45)' }}
      >
        <View
          className="w-full rounded-2xl bg-surface-container-lowest p-6"
          style={{ maxWidth: 420 }}
        >
          <View className="flex-row items-center mb-3">
            <View
              className="w-11 h-11 rounded-full items-center justify-center"
              style={{ backgroundColor: '#edeeef' }}
              accessibilityLabel={required ? 'Actualización requerida' : 'Actualización disponible'}
            >
              <Icon name="cloud-download-outline" size={24} color="#1b4332" />
            </View>
            <Text className="font-hanken-semibold text-headline-sm text-on-surface ml-3 flex-1">
              {required ? 'Actualización requerida' : 'Nueva versión disponible'}
            </Text>
          </View>

          <Text className="font-inter text-body-md text-on-surface-variant">
            {required
              ? `Tu versión ya no es compatible. Instala la ${info.latestVersionName} para seguir usando DoctorMaiz.`
              : `Ya está disponible la versión ${info.latestVersionName}.`}
          </Text>

          {info.releaseNotes ? (
            <ScrollView style={{ maxHeight: 140 }} className="mt-3">
              <Text className="font-inter text-body-md text-on-surface-variant">
                {info.releaseNotes}
              </Text>
            </ScrollView>
          ) : null}

          <Pressable
            className="mt-6 rounded-xl items-center justify-center"
            style={{ height: 48, backgroundColor: '#012d1d' }}
            onPress={openDownload}
            accessibilityRole="button"
            accessibilityLabel="Descargar actualización"
          >
            <Text className="font-inter text-body-md" style={{ color: '#ffffff' }}>
              Descargar
            </Text>
          </Pressable>

          {required ? null : (
            <Pressable
              className="mt-2 rounded-xl items-center justify-center"
              style={{ height: 48 }}
              onPress={onDismiss}
              accessibilityRole="button"
              accessibilityLabel="Ahora no"
            >
              <Text className="font-inter text-body-md text-on-surface-variant">Ahora no</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}
