import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, relation } from '@nozbe/watermelondb/decorators';
import type { DiagnosisClass } from '@/content/diagnosis';

export type CorrectionStatus = 'pending' | 'reviewed';

export class Correction extends Model {
  static table = 'corrections';

  @field('scan_id') scanId!: string;
  @field('observed_label') observedLabel!: DiagnosisClass;
  @field('note') note!: string | null;
  @field('status') status!: CorrectionStatus;
  @field('synced') synced!: boolean;
  @readonly @date('created_at') createdAt!: Date;

  @relation('scans', 'scan_id') scan: unknown;
}
