import { useState, useMemo, useRef, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import MapView, { Marker, Callout, type Region } from 'react-native-maps';
import { DIAGNOSIS_MAP, type DiagnosisClass } from '@/content/diagnosis';
import { Icon } from '@/components/Icon';

export interface MapScan {
  id: string;
  label: DiagnosisClass;
  confidence: number;
  createdAt: number;
  lat: number;
  lon: number;
  imageUri?: string | null;
}

export interface FieldCoverageMapProps {
  scans: MapScan[];
  onSelectScan?: (scanId: string) => void;
  height?: number;
}

const DEFAULT_REGION: Region = {
  latitude: 13.6929,
  longitude: -89.2182,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

function computeRegion(scans: MapScan[]): Region {
  if (!scans || scans.length === 0) {
    return DEFAULT_REGION;
  }

  let minLat = scans[0].lat;
  let maxLat = scans[0].lat;
  let minLon = scans[0].lon;
  let maxLon = scans[0].lon;

  for (const s of scans) {
    if (s.lat < minLat) minLat = s.lat;
    if (s.lat > maxLat) maxLat = s.lat;
    if (s.lon < minLon) minLon = s.lon;
    if (s.lon > maxLon) maxLon = s.lon;
  }

  const midLat = (minLat + maxLat) / 2;
  const midLon = (minLon + maxLon) / 2;
  const deltaLat = Math.max(0.008, (maxLat - minLat) * 1.6);
  const deltaLon = Math.max(0.008, (maxLon - minLon) * 1.6);

  return {
    latitude: midLat,
    longitude: midLon,
    latitudeDelta: deltaLat,
    longitudeDelta: deltaLon,
  };
}

export function FieldCoverageMap({
  scans,
  onSelectScan,
  height = 240,
}: FieldCoverageMapProps) {
  const [mapType, setMapType] = useState<'satellite' | 'standard'>('satellite');
  const mapRef = useRef<MapView>(null);

  const region = useMemo(() => computeRegion(scans), [scans]);

  useEffect(() => {
    if (scans.length > 0) {
      mapRef.current?.animateToRegion?.(region, 500);
    }
  }, [region, scans.length]);

  const sortedScans = useMemo(() => {
    return [...scans].sort((a, b) => b.createdAt - a.createdAt);
  }, [scans]);

  const latestScanId = sortedScans[0]?.id;

  return (
    <View style={[styles.container, { height }]}>
      <MapView
        ref={mapRef}
        testID="field-coverage-map"
        style={styles.map}
        initialRegion={region}
        mapType={mapType}
        showsUserLocation
        showsCompass={false}
      >
        {sortedScans.map((scan) => {
          const info = DIAGNOSIS_MAP[scan.label] ?? DIAGNOSIS_MAP.healthy;
          const isLatest = scan.id === latestScanId;

          return (
            <Marker
              key={scan.id}
              testID={`map-marker-${scan.id}`}
              coordinate={{ latitude: scan.lat, longitude: scan.lon }}
              pinColor={info.statusColor}
              title={info.label}
              description={`${Math.round(scan.confidence * 100)}% certeza`}
              onCalloutPress={() => onSelectScan?.(scan.id)}
              onPress={() => onSelectScan?.(scan.id)}
            >
              <View style={[styles.markerWrapper, isLatest && styles.markerWrapperLatest]}>
                <View style={[styles.markerPin, { backgroundColor: info.statusColor }]}>
                  <View style={styles.markerInnerDot} />
                </View>
              </View>

              <Callout tooltip onPress={() => onSelectScan?.(scan.id)}>
                <View style={styles.calloutCard}>
                  <View style={[styles.calloutAccentStrip, { backgroundColor: info.statusColor }]} />
                  <View style={styles.calloutBody}>
                    <Text style={styles.calloutTitle} numberOfLines={1}>
                      {info.label}
                    </Text>
                    <Text style={styles.calloutConfidence}>
                      {Math.round(scan.confidence * 100)}% certeza
                    </Text>
                    <Text style={styles.calloutAction}>Tocar para ver detalle ›</Text>
                  </View>
                </View>
              </Callout>
            </Marker>
          );
        })}
      </MapView>

      {/* Empty State Overlay */}
      {scans.length === 0 && (
        <View style={styles.emptyOverlay} pointerEvents="box-none">
          <Icon name="map-marker-off" size={28} color="#717973" />
          <Text style={styles.emptyTitle}>Sin escaneos geolocalizados</Text>
          <Text style={styles.emptySubtitle}>
            Toma fotos con GPS activo para visualizar la salud de tu campo
          </Text>
        </View>
      )}

      {/* Floating Map Type Switcher */}
      <View style={styles.topControls}>
        <Pressable
          accessibilityLabel="Cambiar tipo de mapa"
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          onPress={() => {
            setMapType((prev) => {
              const next = prev === 'satellite' ? 'standard' : 'satellite';
              console.log('[MAP_TOGGLE] Switching to:', next);
              return next;
            });
          }}
          style={styles.mapTypeButton}
        >
          <Icon
            name={mapType === 'satellite' ? 'layers-outline' : 'satellite-variant'}
            size={18}
            color="#1b4332"
          />
          <Text style={styles.mapTypeText}>
            {mapType === 'satellite' ? 'Satelital' : 'Estándar'}
          </Text>
        </Pressable>
      </View>

      {/* Bottom Status Badge */}
      <View style={styles.bottomBadge}>
        <View style={styles.badgeDot} />
        <Text style={styles.badgeText}>
          {scans.length} {scans.length === 1 ? 'escaneo geolocalizado' : 'escaneos geolocalizados'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#c1c8c2',
    backgroundColor: '#f1f5f2',
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFill,
  },
  topControls: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 99,
    elevation: 99,
  },
  mapTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  mapTypeText: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: 11,
    color: '#1b4332',
  },
  markerWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
  },
  markerWrapperLatest: {
    borderWidth: 2,
    borderColor: '#ffffff',
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  markerPin: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  markerInnerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ffffff',
  },
  calloutCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e1e5e2',
    minWidth: 160,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  calloutAccentStrip: {
    height: 4,
    width: '100%',
  },
  calloutBody: {
    padding: 10,
  },
  calloutTitle: {
    fontFamily: 'HankenGrotesk_700Bold',
    fontSize: 13,
    color: '#191c1a',
  },
  calloutConfidence: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 11,
    color: '#414942',
    marginTop: 2,
  },
  calloutAction: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    color: '#2d6a4f',
    marginTop: 4,
  },
  bottomBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2d6a4f',
  },
  badgeText: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 10,
    color: '#414942',
  },
  emptyOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  emptyTitle: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: 14,
    color: '#191c1a',
    marginTop: 6,
  },
  emptySubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: '#717973',
    textAlign: 'center',
    marginTop: 2,
    maxWidth: 220,
  },
});
