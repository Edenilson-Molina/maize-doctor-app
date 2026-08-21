import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, type CameraType, type FlashMode } from 'expo-camera';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { Icon } from '@/components/Icon';
import { LeafOverlay } from './LeafOverlay';
import { savePhotoFile } from '@/data/scanStorage';
import { createScan, updateScanResult, updateScanImageUri } from '@/data/queries/scanQueries';
import { getInferenceEngine } from '@/ml';
import { dumpMetrics, measure } from '@/lib/metrics';
import { logger } from '@/lib/logger';
import type { ScanStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<ScanStackParamList, 'ScanCamera'>;

export function ScanScreen({ navigation }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [isSaving, setIsSaving] = useState(false);
  const [scanError, setScanError] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  async function persistScan(imageUri: string) {
    setIsSaving(true);
    setScanError(false);
    try {
      await measure('pipeline', () => runScanPipeline(imageUri));
    } catch {
      // runScanPipeline already surfaced the error; measure only re-throws it.
    } finally {
      // Emits the running summary after every scan so a device test run can be read
      // straight off `adb logcat` without instrumenting anything else.
      dumpMetrics();
      setIsSaving(false);
    }
  }

  /**
   * Saves the photo, runs inference and stores the result.
   *
   * Split out of `persistScan` so the whole capture-to-stored-result path can be
   * timed as one 'pipeline' measurement.
   *
   * @param {string} imageUri Source image to analyse.
   * @returns {Promise<void>} Resolves once the scan is stored and navigation happened.
   */
  async function runScanPipeline(imageUri: string) {
    const scan = await createScan({ imageUri, label: null });

    // Storing the photo re-encodes a full-resolution JPEG and dominated the pipeline,
    // yet the model never reads that file - it works from the camera's own capture. So
    // it runs in the background and the record is repointed once it lands; until then
    // the scan stays usable from the camera URI.
    const storedImage = savePhotoFile(imageUri)
      .then((storedUri) => updateScanImageUri(scan, storedUri))
      .catch((error) => {
        logger.error(`No se pudo guardar la imagen del escaneo ${scan.id}`, error);
      });

    try {
      const result = await getInferenceEngine().predict(imageUri);

      navigation.navigate('ScanResult', {
        imageUri,
        label: result.label,
        confidence: result.confidence,
        distribution: result.distribution,
        temperature: null,
        humidity: null,
        createdAt: Date.now(),
      });

      // Navigating first means this write no longer delays the result screen.
      await updateScanResult(scan, result);
    } catch (error) {
      logger.error(`No se pudo analizar el escaneo ${scan.id}`, error);
      setScanError(true);
      throw error;
    } finally {
      await storedImage;
    }
  }

  async function handleCapture() {
    if (!cameraRef.current || isSaving) return;
    const photo = await cameraRef.current.takePictureAsync();
    if (photo?.uri) {
      await persistScan(photo.uri);
    }
  }

  async function handlePickFromGallery() {
    if (isSaving) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      await persistScan(result.assets[0].uri);
    }
  }

  if (!permission) {
    return <View className="flex-1 bg-black" />;
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-container-padding">
        <Icon name="camera-off" size={48} color="#717973" />
        <Text className="font-hanken-semibold text-headline-md text-on-surface mt-stack-sm text-center">
          Acceso a la cámara requerido
        </Text>
        <Text className="font-inter text-body-md text-on-surface-variant mt-2 text-center">
          DoctorMaiz necesita la cámara para escanear hojas de maíz.
        </Text>
        <Pressable
          onPress={requestPermission}
          className="bg-primary-container rounded-full px-8 py-3 mt-stack-md"
        >
          <Text className="font-inter font-medium text-on-primary-container">
            Permitir acceso a la cámara
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <CameraView ref={cameraRef} style={{ flex: 1 }} facing={facing} flash={flash}>
        <View className="flex-1 items-center justify-center">
          <LeafOverlay />
        </View>

        <View className="absolute top-6 right-container-padding gap-stack-sm">
          <Pressable
            onPress={() => setFlash((current) => (current === 'off' ? 'on' : 'off'))}
            className="w-12 h-12 rounded-full bg-black/30 border border-white/20 items-center justify-center"
          >
            <Icon name={flash === 'off' ? 'flash-off' : 'flash'} size={22} color="#ffffff" />
          </Pressable>
          <Pressable
            onPress={() => setFacing((current) => (current === 'back' ? 'front' : 'back'))}
            className="w-12 h-12 rounded-full bg-black/30 border border-white/20 items-center justify-center"
          >
            <Icon name="camera-flip" size={22} color="#ffffff" />
          </Pressable>
        </View>

        <View className="absolute bottom-32 left-0 right-0 items-center">
          <View className="bg-black/60 px-6 py-2 rounded-full border border-white/10">
            <Text className="font-label-md text-label-md text-white">
              {isSaving
                ? 'Analizando hoja…'
                : scanError
                  ? 'No se pudo analizar la foto. Intente de nuevo.'
                  : 'Coloque la hoja en el centro'}
            </Text>
          </View>
        </View>

        <View className="absolute bottom-0 left-0 right-0 h-32 flex-row items-center justify-around px-container-padding">
          <Pressable
            onPress={handlePickFromGallery}
            disabled={isSaving}
            accessibilityLabel="Elegir de galería"
            className="items-center gap-1"
          >
            <View className="w-12 h-12 rounded-xl border border-white/40 items-center justify-center">
              <Icon name="image-multiple" size={22} color="#ffffff" />
            </View>
            <Text className="font-label-md text-[10px] uppercase tracking-widest text-white/80">
              Galería
            </Text>
          </Pressable>

          <Pressable
            onPress={handleCapture}
            disabled={isSaving}
            accessibilityLabel="Tomar foto"
            className="w-20 h-20 rounded-full border-4 border-white items-center justify-center"
          >
            {isSaving ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <View className="w-full h-full bg-white rounded-full" />
            )}
          </Pressable>

          <View className="w-12 h-12" />
        </View>
      </CameraView>
    </View>
  );
}
