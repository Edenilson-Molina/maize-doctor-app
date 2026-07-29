import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, json } from '@nozbe/watermelondb/decorators';
import type { DiagnosisClass } from '@/content/diagnosis';

const sanitizeDistribution = (raw: unknown) => raw as Record<string, number> | null;

export class Scan extends Model {
  static table = 'scans';

  @field('image_uri') imageUri: string;
  @field('label') label: DiagnosisClass | null;
  @field('confidence') confidence: number | null;
  @json('distribution_json', sanitizeDistribution) distribution: Record<string, number> | null;
  @field('lat') lat: number | null;
  @field('lon') lon: number | null;
  @field('temperature') temperature: number | null;
  @field('humidity') humidity: number | null;
  @field('synced') synced: boolean;
  @readonly @date('created_at') createdAt: Date;
}
