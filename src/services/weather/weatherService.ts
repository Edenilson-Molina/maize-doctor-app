import * as SecureStore from 'expo-secure-store';
import { getLocationCoordinates, type Coordinates } from '@/utils/location';
import { logger } from '@/lib/logger';
import {
  type WeatherData,
  type SoilMoistureStatus,
  type AgroclimaticMetric,
  type MetricGuidance,
} from './weatherTypes';

const WEATHER_CACHE_KEY = 'doctor_maiz_weather_cache';

export const DEFAULT_OFFLINE_WEATHER: WeatherData = {
  temperature: 24,
  humidity: 65,
  windSpeed: 12,
  soilStatus: 'Adecuada',
  timestamp: 0,
  source: 'offline_default',
};

let inMemoryWeather: WeatherData = { ...DEFAULT_OFFLINE_WEATHER };

export function resetWeatherState(): void {
  inMemoryWeather = { ...DEFAULT_OFFLINE_WEATHER };
}

export function classifySoilMoisture(volumetricMoisture?: number | null): SoilMoistureStatus {
  if (volumetricMoisture === null || volumetricMoisture === undefined) {
    return 'Adecuada';
  }
  if (volumetricMoisture < 0.15) {
    return 'Seca';
  }
  if (volumetricMoisture > 0.38) {
    return 'Exceso de Agua';
  }
  return 'Adecuada';
}

export function getLatestWeather(): WeatherData {
  return inMemoryWeather;
}

export async function loadCachedWeather(): Promise<WeatherData | null> {
  try {
    const raw = await SecureStore.getItemAsync(WEATHER_CACHE_KEY);
    if (raw) {
      const parsed: WeatherData = JSON.parse(raw);
      parsed.source = 'cached';
      inMemoryWeather = parsed;
      return parsed;
    }
  } catch (error) {
    logger.warn('No se pudo leer la caché local del clima', error);
  }
  return null;
}

export async function fetchWeather(
  targetCoords?: Coordinates | null,
  timeoutMs = 3500
): Promise<WeatherData> {
  let coords = targetCoords;
  if (!coords) {
    try {
      coords = await getLocationCoordinates(1500);
    } catch {
      coords = null;
    }
  }

  // If no GPS coordinates, fallback to cached or default
  if (!coords) {
    const cached = await loadCachedWeather();
    if (cached) return cached;
    return inMemoryWeather;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude}&longitude=${coords.longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,soil_moisture_0_to_1cm&wind_speed_unit=kmh`;

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (response.ok) {
      const data = await response.json();
      if (data?.current) {
        const liveWeather: WeatherData = {
          temperature: Math.round(data.current.temperature_2m ?? 24),
          humidity: Math.round(data.current.relative_humidity_2m ?? 65),
          windSpeed: Math.round(data.current.wind_speed_10m ?? 12),
          soilStatus: classifySoilMoisture(data.current.soil_moisture_0_to_1cm),
          timestamp: Date.now(),
          source: 'live',
          latitude: coords.latitude,
          longitude: coords.longitude,
        };

        inMemoryWeather = liveWeather;
        try {
          await SecureStore.setItemAsync(WEATHER_CACHE_KEY, JSON.stringify(liveWeather));
        } catch (saveError) {
          logger.warn('No se pudo guardar la caché de clima', saveError);
        }

        return liveWeather;
      }
    }
  } catch (netError) {
    clearTimeout(timer);
    logger.warn('Fallo de red al consultar Open-Meteo, usando offline-first', netError);
  }

  // Offline Fallback: load cached from SecureStore
  const cached = await loadCachedWeather();
  if (cached) {
    return cached;
  }

  return inMemoryWeather;
}

export function getAgroclimaticGuidance(
  metric: AgroclimaticMetric,
  data: WeatherData
): MetricGuidance {
  switch (metric) {
    case 'temperature': {
      const val = data.temperature;
      const isRustRisk = val >= 20 && val <= 28;
      return {
        title: 'Temperatura Ambiental',
        metricLabel: 'Temperatura',
        currentValueDisplay: `${val} °C`,
        riskStatus: isRustRisk ? 'alert' : 'favorable',
        statusBadge: isRustRisk ? 'Riesgo Térmico para Roya (20–28 °C)' : 'Rango Favorable',
        agronomicDescription:
          'Calor actual en la zona. Temperaturas entre 20 y 28 °C combinadas con humedad foliar favorecen fuertemente la germinación de esporas de hongos patógenos como la roya (Puccinia sorghi) y el tizón foliar.',
        fieldRecommendation: isRustRisk
          ? 'Revisa el envés de las hojas intermedias. Si notas pústulas aisladas, es el momento idóneo para aplicar preventivos biológicos (Bacillus subtilis) o silicio antes de que se extienda.'
          : 'La temperatura no se encuentra en el rango de máxima proliferación fúngica. Continúa con monitoreo rutinario semanal.',
      };
    }
    case 'humidity': {
      const val = data.humidity;
      const isHighHumidity = val > 80;
      return {
        title: 'Humedad Relativa',
        metricLabel: 'Humedad',
        currentValueDisplay: `${val} %`,
        riskStatus: isHighHumidity ? 'alert' : 'favorable',
        statusBadge: isHighHumidity ? 'Humedad Crítica (>80 %)' : 'Humedad Estable',
        agronomicDescription:
          'Porcentaje de vapor de agua en el aire. Si supera el 80 % de manera prolongada (con rocío foliar por más de 6 a 8 horas), se activa un riesgo elevado de ataque por hongos y bacterias foliares.',
        fieldRecommendation: isHighHumidity
          ? 'Evita aplicar productos sistémicos sobre follaje mojado por rocío; el agua lavará el producto. Espera a que el sol y el aire sequen la hoja.'
          : 'Humedad en rango moderado. Facilita el secado oportuno del follaje matutino y disminuye la ventana de infección.',
      };
    }
    case 'soil': {
      const status = data.soilStatus;
      const isAlert = status === 'Exceso de Agua';
      const isWarning = status === 'Seca';
      return {
        title: 'Humedad del Suelo',
        metricLabel: 'Hum. Suelo',
        currentValueDisplay: status,
        riskStatus: isAlert ? 'alert' : isWarning ? 'warning' : 'favorable',
        statusBadge: isAlert
          ? 'Suelo Encharcado / Anoxia'
          : isWarning
            ? 'Déficit Hídrico'
            : 'Capacidad de Campo Adecuada',
        agronomicDescription:
          'Te indica el estado hídrico en la zona radicular activa del maíz. Ayuda a regular los turnos de riego o identificar necesidad de drenaje en el lote.',
        fieldRecommendation: isAlert
          ? 'Suspende turnos de riego y abre zanjas de desagüe para evitar asfixia radicular y amarillamiento por lavado de nutrientes.'
          : isWarning
            ? 'La planta experimenta estrés hídrico, haciéndola más vulnerable al gusano cogollero. Programa un turno de riego o mantén cobertura de rastrojo.'
            : 'Nivel hídrico óptimo para absorción de nutrientes y desarrollo foliar. Mantén el esquema habitual.',
      };
    }
    case 'wind': {
      const val = data.windSpeed;
      const isHighWind = val > 15;
      return {
        title: 'Velocidad del Viento',
        metricLabel: 'Viento',
        currentValueDisplay: `${val} km/h`,
        riskStatus: isHighWind ? 'alert' : 'favorable',
        statusBadge: isHighWind ? 'Viento No Apto (>15 km/h)' : 'Apto para Aspersión (<15 km/h)',
        agronomicDescription:
          'Velocidad del aire en la zona. Vientos mayores a 15 km/h desaconsejan las aplicaciones foliares porque el viento desvía la gota (deriva) y acelera la dispersión de esporas entre parcelas.',
        fieldRecommendation: isHighWind
          ? 'No realices aspersiones foliares ahora. El viento arrastrará el producto fuera de la planta por deriva. Espera a las primeras horas de la mañana o al atardecer.'
          : 'Condición excelente para aplicar biopreparados o nutrientes foliares con mínima deriva.',
      };
    }
  }
}
