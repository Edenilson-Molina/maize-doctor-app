import { Modal, Pressable, Text, View } from 'react-native';
import { Icon } from './Icon';

export type DialogTone = 'success' | 'warning' | 'info';

interface AppDialogProps {
  visible: boolean;
  title: string;
  body: string;
  tone?: DialogTone;
  confirmLabel?: string;
  onDismiss: () => void;
}

const TONE_STYLE: Record<DialogTone, { icon: 'check-decagram' | 'cloud-upload-outline' | 'information-outline'; color: string; a11y: string }> = {
  success: { icon: 'check-decagram', color: '#1b4332', a11y: 'Operación exitosa' },
  warning: { icon: 'cloud-upload-outline', color: '#7d562d', a11y: 'Advertencia' },
  info: { icon: 'information-outline', color: '#414844', a11y: 'Información' },
};

/**
 * In-app dialog used instead of the OS alert, so messages follow the app's own
 * typography and palette.
 *
 * @param {AppDialogProps} props Dialog content and dismissal handler.
 * @returns {JSX.Element|null} The dialog, or null while hidden.
 */
export function AppDialog({
  visible,
  title,
  body,
  tone = 'info',
  confirmLabel = 'Entendido',
  onDismiss,
}: AppDialogProps) {
  if (!visible) return null;

  const toneStyle = TONE_STYLE[tone];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable
        className="flex-1 items-center justify-center px-container-padding"
        style={{ backgroundColor: 'rgba(1, 45, 29, 0.45)' }}
        onPress={onDismiss}
        accessibilityLabel="Cerrar diálogo"
      >
        <Pressable
          className="w-full rounded-2xl bg-surface-container-lowest p-6"
          style={{ maxWidth: 420 }}
          onPress={() => {}}
        >
          <View className="flex-row items-center mb-3">
            <View
              className="w-11 h-11 rounded-full items-center justify-center"
              style={{ backgroundColor: '#edeeef' }}
              accessibilityLabel={toneStyle.a11y}
            >
              <Icon name={toneStyle.icon} size={24} color={toneStyle.color} />
            </View>
            <Text className="font-hanken-semibold text-headline-sm text-on-surface ml-3 flex-1">
              {title}
            </Text>
          </View>

          <Text className="font-inter text-body-md text-on-surface-variant">{body}</Text>

          <Pressable
            className="mt-6 rounded-xl items-center justify-center"
            style={{ height: 48, backgroundColor: '#012d1d' }}
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel={confirmLabel}
          >
            <Text className="font-inter text-body-md" style={{ color: '#ffffff' }}>
              {confirmLabel}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
