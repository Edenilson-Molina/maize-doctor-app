const mockWrite = jest.fn((callback: () => Promise<void>) => callback());
const mockFetchCount = jest.fn();
const mockFetch = jest.fn();
const mockCreate = jest.fn();

jest.mock('../database', () => ({
  database: {
    write: (callback: () => Promise<void>) => mockWrite(callback),
    collections: {
      get: jest.fn(() => ({
        query: (...args: unknown[]) => ({
          fetchCount: () => mockFetchCount(...args),
          fetch: () => mockFetch(...args),
        }),
        create: (updater: (contribution: unknown) => void) => mockCreate(updater),
      })),
    },
  },
}));

import {
  createDatasetContribution,
  getContributionCount,
  getUnsyncedContributions,
  markContributionSynced,
} from './datasetContributionQueries';
import type { DatasetContribution } from '../models/DatasetContribution';

describe('getContributionCount', () => {
  beforeEach(() => {
    mockFetchCount.mockClear();
  });

  it('returns the count from the dataset_contributions collection', async () => {
    mockFetchCount.mockResolvedValue(3);

    const count = await getContributionCount();

    expect(count).toBe(3);
  });
});

describe('createDatasetContribution', () => {
  beforeEach(() => {
    mockWrite.mockClear();
    mockCreate.mockClear();
  });

  it('creates a contribution with the given image, label, and note', async () => {
    const fakeContribution: Record<string, unknown> = {};
    mockCreate.mockImplementation((updater: (c: Record<string, unknown>) => void) => {
      updater(fakeContribution);
      return fakeContribution;
    });

    await createDatasetContribution({
      imageUri: 'file:///document/contributions/contribution_abc.jpg',
      label: 'common_rust',
      note: 'Hojas con manchas amarillas',
    });

    expect(mockWrite).toHaveBeenCalledTimes(1);
    expect(fakeContribution.imageUri).toBe('file:///document/contributions/contribution_abc.jpg');
    expect(fakeContribution.label).toBe('common_rust');
    expect(fakeContribution.note).toBe('Hojas con manchas amarillas');
    expect(fakeContribution.synced).toBe(false);
  });

  it('defaults note to null when not provided', async () => {
    const fakeContribution: Record<string, unknown> = {};
    mockCreate.mockImplementation((updater: (c: Record<string, unknown>) => void) => {
      updater(fakeContribution);
      return fakeContribution;
    });

    await createDatasetContribution({
      imageUri: 'file:///document/contributions/contribution_abc.jpg',
      label: 'healthy',
    });

    expect(fakeContribution.note).toBeNull();
  });
});

describe('getUnsyncedContributions', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it('queries contributions filtered by synced = false', async () => {
    const fakeContributions = [{ id: 'contribution-1' }] as DatasetContribution[];
    mockFetch.mockResolvedValue(fakeContributions);

    const result = await getUnsyncedContributions();

    expect(result).toBe(fakeContributions);
  });
});

describe('markContributionSynced', () => {
  beforeEach(() => {
    mockWrite.mockClear();
  });

  it('sets synced to true on the contribution', async () => {
    const fakeContribution = {
      update: jest.fn((updater: (contribution: DatasetContribution) => void) => {
        updater(fakeContribution as unknown as DatasetContribution);
      }),
    } as unknown as DatasetContribution;

    await markContributionSynced(fakeContribution);

    expect(fakeContribution.synced).toBe(true);
  });
});
