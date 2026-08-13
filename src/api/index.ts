import type { SyncClient } from './SyncClient';
import { MockSyncClient } from './MockSyncClient';
import { FastApiSyncClient } from './FastApiSyncClient';

export type { SyncClient } from './SyncClient';

export const getSyncClient = (): SyncClient => {
  return process.env.EXPO_PUBLIC_API_URL ? new FastApiSyncClient() : new MockSyncClient();
};
