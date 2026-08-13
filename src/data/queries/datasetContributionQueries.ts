import { Q } from '@nozbe/watermelondb';
import { database } from '../database';
import { DatasetContribution } from '../models/DatasetContribution';
import type { DiagnosisClass } from '@/content/diagnosis';

const contributionsCollection =
  database.collections.get<DatasetContribution>('dataset_contributions');

export async function getContributionCount(): Promise<number> {
  return contributionsCollection.query().fetchCount();
}

export async function getUnsyncedContributions(): Promise<DatasetContribution[]> {
  return contributionsCollection.query(Q.where('synced', false)).fetch();
}

export async function markContributionSynced(contribution: DatasetContribution): Promise<void> {
  await database.write(async () => {
    await contribution.update((c) => {
      c.synced = true;
    });
  });
}

export async function createDatasetContribution(data: {
  imageUri: string;
  label: DiagnosisClass;
  note?: string | null;
}): Promise<DatasetContribution> {
  return database.write(async () => {
    return contributionsCollection.create((contribution) => {
      contribution.imageUri = data.imageUri;
      contribution.label = data.label;
      contribution.note = data.note ?? null;
      contribution.synced = false;
    });
  });
}
