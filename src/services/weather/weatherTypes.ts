export type SoilMoistureStatus = 'Seca' | 'Adecuada' | 'Exceso de Agua';

export type WeatherDataSource = 'live' | 'cached' | 'offline_default';

export interface WeatherData {
  temperature: number; // in °C
  humidity: number; // in %
  windSpeed: number; // in km/h
  soilStatus: SoilMoistureStatus;
  timestamp: number; // epoch ms
  source: WeatherDataSource;
  latitude?: number;
  longitude?: number;
}

export type AgroclimaticMetric = 'temperature' | 'humidity' | 'soil' | 'wind';

export interface MetricGuidance {
  title: string;
  metricLabel: string;
  currentValueDisplay: string;
  riskStatus: 'favorable' | 'warning' | 'alert';
  statusBadge: string;
  agronomicDescription: string;
  fieldRecommendation: string;
}
