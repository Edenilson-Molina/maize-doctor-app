import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useAuth } from '@/auth/AuthContext';
import { AppDialog, type DialogTone } from '@/components/AppDialog';
import { Icon } from '@/components/Icon';
import { getImpactStats } from '@/data/queries/impactQueries';
import { getPendingSyncCount } from '@/data/queries/pendingSyncQueries';
import { trySyncNow } from '@/api/syncQueue';
import { hasCredentialMismatch } from '@/api/remoteAuthStatus';
import { describeSyncOutcome, toneForOutcome } from '@/api/syncMessages';
import { computeRankProgress, type RankProgress } from '@/lib/rank';
import type { AppTabParamList } from '@/navigation/types';

const INITIAL_RANK_PROGRESS: RankProgress = computeRankProgress(0);

export function ProfileScreen() {
  const { user, logout, isGuest } = useAuth();
  const navigation = useNavigation<BottomTabNavigationProp<AppTabParamList>>();
  const userName = user?.name ?? 'Agricultor';
  const [totalScans, setTotalScans] = useState(0);
  const [rank, setRank] = useState<RankProgress>(INITIAL_RANK_PROGRESS);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [dialog, setDialog] = useState<{ title: string; body: string; tone: DialogTone } | null>(
    null
  );
  const [credentialMismatch, setCredentialMismatch] = useState(false);

  useEffect(() => {
    getImpactStats().then((stats) => {
      setTotalScans(stats.totalScans);
      setRank(computeRankProgress(stats.totalActivity));
    });
    getPendingSyncCount().then(setPendingCount);
    hasCredentialMismatch().then(setCredentialMismatch);
  }, []);

  async function handleSyncNow() {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const outcome = await trySyncNow();
      const message = describeSyncOutcome(outcome);
      setDialog({ title: message.title, body: message.body, tone: toneForOutcome(outcome) });
    } catch {
      setDialog({
        title: 'Sincronización fallida',
        body: 'Tus aportes siguen guardados en este dispositivo.',
        tone: 'warning',
      });
    } finally {
      setPendingCount(await getPendingSyncCount());
      setIsSyncing(false);
    }
  }

  const nextRankCopy = rank.nextRank
    ? `Faltan ${rank.remainingToNextRank} escaneos o contribuciones para el rango '${rank.nextRank}'.`
    : '¡Alcanzaste el rango máximo! Gracias por tu aporte a la ciencia.';

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="px-container-padding pt-6 pb-16"
    >
      {/* Avatar + Name */}
      <View className="items-center mb-6">
        <View className="relative">
          <View
            className="w-24 h-24 rounded-full border-4 items-center justify-center overflow-hidden shadow-lg"
            style={{ borderColor: '#a5d0b9', backgroundColor: '#edeeef' }}
          >
            <Icon name="account" size={56} color="#717973" />
          </View>
          <View
            className="absolute bottom-0 right-0 rounded-full p-1 border-2 border-surface items-center justify-center"
            style={{ backgroundColor: '#012d1d' }}
          >
            <Icon name="check-decagram" size={14} color="#ffffff" />
          </View>
        </View>
        <Text className="font-hanken-bold text-[28px] leading-9 text-on-surface mt-4 tracking-tight">
          {userName}
        </Text>
        <View className="flex-row items-center mt-1">
          <Icon name="map-marker" size={16} color="#717973" />
          <Text className="font-inter text-body-md text-on-surface-variant ml-1">El Salvador</Text>
        </View>
      </View>

      {/* Impacto Colectivo */}
      <View className="mb-6">
        <View className="flex-row items-center mb-4">
          <Icon name="account-group" size={22} color="#012d1d" />
          <Text className="font-hanken-semibold text-headline-sm text-primary ml-2">
            Impacto Colectivo
          </Text>
        </View>

        <View className="flex-row mb-4">
          {/* Metric 1 */}
          <View
            className="flex-1 bg-surface-container-low rounded-xl border border-outline-variant p-4 shadow-sm justify-between"
            style={{ height: 120 }}
          >
            <Icon name="check-all" size={24} color="#012d1d" />
            <View>
              <Text className="font-jetbrains text-label-md text-on-surface-variant">
                Imágenes Validadas
              </Text>
              <Text className="font-hanken-semibold text-xl text-primary">
                {totalScans}
              </Text>
            </View>
          </View>
          <View className="w-gutter" />
          {/* Metric 2 */}
          <View
            className="flex-1 bg-surface-container-low rounded-xl border border-outline-variant p-4 shadow-sm justify-between"
            style={{ height: 120 }}
          >
            <Icon name="medal" size={24} color="#7d562d" />
            <View>
              <Text className="font-jetbrains text-label-md text-on-surface-variant">
                Nivel de Contribución
              </Text>
              <Text className="font-hanken-semibold text-xl text-secondary">
                {rank.currentRank}
              </Text>
            </View>
          </View>
        </View>

        {/* Progress Card */}
        <View className="rounded-xl p-5 overflow-hidden" style={{ backgroundColor: '#012d1d' }}>
          <View className="flex-row justify-between items-end mb-2">
            <Text className="font-hanken-semibold text-headline-sm" style={{ color: '#ffffff' }}>
              Próximo Rango
            </Text>
            <Text className="font-jetbrains text-label-md" style={{ color: '#a5d0b9' }}>
              {rank.progressPercent}%
            </Text>
          </View>
          <View
            className="w-full h-3 rounded-full overflow-hidden"
            style={{ backgroundColor: '#1b4332' }}
          >
            <View
              className="h-full rounded-full"
              style={{ width: `${rank.progressPercent}%`, backgroundColor: '#c1ecd4' }}
            />
          </View>
          <Text className="mt-3 font-inter text-body-md" style={{ color: '#86af99' }}>
            {nextRankCopy}
          </Text>
        </View>
      </View>

      {credentialMismatch ? (
        <View className="mb-6">
          <View
            className="rounded-2xl border p-4"
            style={{ backgroundColor: '#fdf3e7', borderColor: '#e0c9a6' }}
          >
            <View className="flex-row items-center mb-1">
              <Icon name="alert-outline" size={22} color="#7d562d" />
              <Text className="font-hanken-semibold text-body-lg ml-3" style={{ color: '#7d562d' }}>
                Revisa tu sesión
              </Text>
            </View>
            <Text className="font-inter text-body-md text-on-surface-variant">
              Tu contraseña de este dispositivo no coincide con la del servidor. Cierra sesión y
              vuelve a entrar para mantener la sincronización activa.
            </Text>
          </View>
        </View>
      ) : null}

      {pendingCount > 0 ? (
        <View className="mb-6">
          <View className="bg-surface-container-low rounded-2xl border border-outline-variant p-4">
            <View className="flex-row items-center">
              <Icon name="cloud-upload-outline" size={22} color="#7d562d" />
              <Text className="font-inter text-body-md text-on-surface ml-3 flex-1">
                {pendingCount === 1
                  ? '1 aporte sin sincronizar'
                  : `${pendingCount} aportes sin sincronizar`}
              </Text>
            </View>
            <Pressable
              className="mt-3 rounded-xl items-center justify-center"
              style={{ height: 44, backgroundColor: isSyncing ? '#86af99' : '#012d1d' }}
              onPress={handleSyncNow}
              disabled={isSyncing}
              accessibilityRole="button"
              accessibilityLabel="Sincronizar ahora"
              accessibilityState={{ disabled: isSyncing }}
            >
              <Text className="font-inter text-body-md" style={{ color: '#ffffff' }}>
                {isSyncing ? 'Sincronizando...' : 'Sincronizar ahora'}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* Configuración */}
      <View className="mb-6">
        <Text className="font-hanken-semibold text-headline-sm text-on-surface mb-2 px-1">
          Configuración
        </Text>
        <View className="bg-surface-container-low rounded-2xl border border-outline-variant overflow-hidden">
          <SettingsItem icon="account-cog" label="Configuración de Cuenta" disabled />
          <Divider />
          <SettingsItem icon="bell-outline" label="Preferencias de Notificaciones" disabled />
          <Divider />
          <SettingsItem icon="cloud-off-outline" label="Modo Offline" trailing="toggle" disabled />
          <Divider />
          <SettingsItem
            icon="face-agent"
            label="Soporte Técnico"
            trailingIcon="open-in-new"
            disabled
          />
          <Divider />
          {isGuest ? (
            <Pressable
              className="flex-row items-center px-4"
              style={{ height: 48 }}
              onPress={() => navigation.navigate('Auth')}
              accessibilityRole="button"
              accessibilityLabel="Iniciar Sesión"
            >
              <View className="flex-row items-center">
                <Icon name="login" size={22} color="#012d1d" />
                <Text
                  className="font-inter text-lg ml-4"
                  style={{ color: '#012d1d', fontWeight: '600' }}
                >
                  Iniciar Sesión
                </Text>
              </View>
            </Pressable>
          ) : (
            <Pressable
              className="flex-row items-center px-4"
              style={{ height: 48 }}
              onPress={logout}
              accessibilityRole="button"
              accessibilityLabel="Cerrar Sesión"
            >
              <View className="flex-row items-center">
                <Icon name="logout" size={22} color="#ba1a1a" />
                <Text
                  className="font-inter text-lg ml-4"
                  style={{ color: '#ba1a1a', fontWeight: '600' }}
                >
                  Cerrar Sesión
                </Text>
              </View>
            </Pressable>
          )}
        </View>
        {isGuest ? (
          <Text className="font-inter text-body-md text-on-surface-variant px-1 mt-2">
            Tu cuenta solo sirve para sincronizar tus aportes cuando haya internet. Puedes escanear y
            revisar tu historial sin iniciar sesión.
          </Text>
        ) : null}
      </View>

      {/* Version Info */}
      <View className="items-center pb-6">
        <Text className="font-jetbrains text-label-md text-outline">DoctorMaiz v1.0.0 (Dev)</Text>
        <Text className="font-jetbrains text-label-md text-outline-variant mt-0.5">
          Agri-Precision Engine 1.0.0
        </Text>
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

/**
 * Row in the settings card.
 *
 * Options with no behaviour yet render visibly disabled and non-interactive, so the
 * card never offers a control that silently does nothing when tapped.
 */
function SettingsItem({
  icon,
  label,
  trailing,
  trailingIcon,
  disabled = false,
}: {
  icon: string;
  label: string;
  trailing?: 'toggle';
  trailingIcon?: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      className="flex-row items-center justify-between px-4"
      style={{ height: 48, opacity: disabled ? 0.45 : 1 }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
    >
      <View className="flex-row items-center flex-1">
        <Icon name={icon as never} size={22} color="#717973" />
        <Text className="font-inter text-lg text-on-surface ml-4">{label}</Text>
        {disabled ? (
          <Text className="font-jetbrains text-label-md text-on-surface-variant ml-2">
            Próximamente
          </Text>
        ) : null}
      </View>
      {trailing === 'toggle' ? (
        <View
          className="w-11 h-6 rounded-full justify-center px-0.5"
          style={{
            alignItems: disabled ? 'flex-start' : 'flex-end',
            backgroundColor: disabled ? '#c1c8c2' : '#012d1d',
          }}
        >
          <View className="w-5 h-5 rounded-full bg-white" />
        </View>
      ) : (
        <Icon name={(trailingIcon ?? 'chevron-right') as never} size={20} color="#717973" />
      )}
    </Pressable>
  );
}

function Divider() {
  return <View className="h-[1px] bg-outline-variant mx-4" />;
}
