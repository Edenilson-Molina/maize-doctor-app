import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DIAGNOSIS_CLASSES, DIAGNOSIS_MAP, type DiagnosisClass } from '@/content/diagnosis';
import { ChipPicker } from '@/components/ChipPicker';
import { Icon } from '@/components/Icon';
import { savePhotoFile } from '@/data/scanStorage';
import {
  createDatasetContribution,
  getContributionCount,
} from '@/data/queries/datasetContributionQueries';
import { trySyncNow } from '@/api/syncQueue';
import { describeSyncOutcome } from '@/api/syncMessages';
import type { HomeStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<HomeStackParamList, 'Contribute'>;

const LABEL_OPTIONS = DIAGNOSIS_CLASSES.map((c) => ({ key: c, label: DIAGNOSIS_MAP[c].label }));

export function Contribute({ navigation }: Props) {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [label, setLabel] = useState<DiagnosisClass | null>(null);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [contributionCount, setContributionCount] = useState(0);

  useEffect(() => {
    getContributionCount().then(setContributionCount);
  }, []);

  async function handleTakePhoto() {
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  }

  async function handlePickFromGallery() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  }

  async function handleSubmit() {
    if (!imageUri || !label || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const finalUri = await savePhotoFile(imageUri, 'contributions', 'contribution');
      await createDatasetContribution({ imageUri: finalUri, label, note: note.trim() || null });

      let message = describeSyncOutcome({ status: 'nothing-pending', synced: 0, failed: 0 });
      try {
        message = describeSyncOutcome(await trySyncNow());
      } catch {
        message = describeSyncOutcome({ status: 'partial', synced: 0, failed: 1 });
      }

      Alert.alert(message.title, message.body);
      navigation.goBack();
    } finally {
      setIsSubmitting(false);
    }
  }

  const canSubmit = !!imageUri && !!label && !isSubmitting;

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="px-container-padding pb-6"
    >
      <View className="mt-stack-sm">
        <Text className="font-hanken-bold text-headline-md text-primary">
          Impulsa la Agricultura del Futuro
        </Text>
        <Text className="font-inter text-body-md text-on-surface-variant mt-2">
          Tus imágenes ayudan a mejorar el diagnóstico automático para todos los agricultores.
        </Text>
      </View>

      <Pressable
        onPress={handleTakePhoto}
        accessibilityLabel="Tomar foto"
        className="mt-stack-md rounded-xl border-2 border-dashed border-outline-variant bg-surface-container-lowest items-center justify-center overflow-hidden"
        style={{ height: 240 }}
      >
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
        ) : (
          <View className="items-center px-6">
            <View className="w-16 h-16 rounded-full bg-primary-container items-center justify-center mb-3">
              <Icon name="camera-plus-outline" size={28} color="#86af99" />
            </View>
            <Text className="font-hanken-semibold text-headline-sm text-primary">
              Sube tu evidencia
            </Text>
            <Text className="font-inter text-body-md text-on-surface-variant text-center mt-1">
              Toca para abrir la cámara o elige desde tu galería
            </Text>
          </View>
        )}
      </Pressable>

      <Pressable
        onPress={handlePickFromGallery}
        accessibilityLabel="Elegir de galería"
        className="mt-2 items-center py-2"
      >
        <Text className="font-jetbrains text-label-md text-primary">Elegir de galería</Text>
      </Pressable>

      <View className="bg-surface-container rounded-xl p-stack-sm border border-outline-variant/30 mt-stack-md gap-stack-sm">
        <Text className="font-jetbrains text-label-md text-secondary uppercase tracking-widest">
          Metadata Requerida
        </Text>
        <Text className="font-jetbrains text-label-md text-on-surface-variant">
          Etiqueta de Diagnóstico
        </Text>
        <ChipPicker
          options={LABEL_OPTIONS}
          selectedKey={label}
          onSelect={(key) => setLabel(key as DiagnosisClass)}
        />
        <Text className="font-jetbrains text-label-md text-on-surface-variant mt-2">
          Observaciones (Opcional)
        </Text>
        <TextInput
          className="bg-surface-container-lowest border border-outline-variant rounded-lg p-3 font-inter text-body-md text-on-surface"
          placeholder="Ej. Clima húmedo, variedad H502..."
          placeholderTextColor="#717973"
          value={note}
          onChangeText={setNote}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>

      <View className="bg-tertiary-container rounded-xl p-stack-sm flex-row items-center gap-4 mt-stack-md">
        <View className="bg-black/10 p-3 rounded-lg">
          <Icon name="account-group-outline" size={28} color="#95d4b3" />
        </View>
        <View className="flex-1">
          <Text className="font-hanken-semibold text-headline-sm text-on-tertiary-container">
            Impacto Colectivo
          </Text>
          <Text className="font-inter text-body-md text-on-tertiary-container/80">
            {contributionCount === 0
              ? 'Sé el primero en contribuir desde este dispositivo.'
              : `Ya contribuiste ${contributionCount} ${contributionCount === 1 ? 'imagen' : 'imágenes'} desde este dispositivo.`}
          </Text>
        </View>
      </View>

      <Pressable
        onPress={handleSubmit}
        disabled={!canSubmit}
        accessibilityLabel="Contribuir al Dataset"
        className="bg-primary rounded-full h-touch-target items-center justify-center flex-row gap-2 mt-stack-md"
        style={{ opacity: canSubmit ? 1 : 0.5 }}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <>
            <Icon name="cloud-upload-outline" size={20} color="#ffffff" />
            <Text className="font-jetbrains text-label-md text-on-primary">
              Contribuir al Dataset
            </Text>
          </>
        )}
      </Pressable>
      <Text className="text-xs text-center text-on-surface-variant font-inter mt-2">
        Tu contribución será validada por expertos agrónomos.
      </Text>
    </ScrollView>
  );
}
