import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';
import type { DiagnosisClass } from '@/content/diagnosis';

export class DatasetContribution extends Model {
  static table = 'dataset_contributions';

  @field('image_uri') imageUri: string;
  @field('label') label: DiagnosisClass;
  @field('note') note: string | null;
  @field('synced') synced: boolean;
  @readonly @date('created_at') createdAt: Date;
}
