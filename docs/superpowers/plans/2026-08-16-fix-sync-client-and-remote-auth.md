# Fix Sync Client and Remote Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app's sync-to-backend feature actually work against the real `maize-doctor-api`, and stop the app from being able to silently ship without real on-device inference. A cross-repo audit found the sync feature is currently 100% non-functional: `FastApiSyncClient` posts to `/scans`, a route the API doesn't have; it never attaches an auth token, while `/corrections` and `/dataset-contributions` require one; the app's auth (`LocalAuthService`) never talks to the API at all, so no token ever exists to attach; and `syncContribution` sends JSON with a local file path instead of the `multipart/form-data` file upload the endpoint actually expects. Separately, the audit found that `EXPO_PUBLIC_USE_MOCK_MODEL` defaults to the mock predictor, and nothing stops a production build from shipping that way despite `model-ml.md`'s "fully offline inference" claim.

Separately again, the app currently *requires* an account before it will show anything: `RootNavigator` renders the login stack whenever there is no session, walling a first-run user off from the camera even though on-device inference needs no account at all. Task 8 inverts that gate.

**Architecture:** Keep `LocalAuthService` as the primary, offline-first account system (unchanged) — don't replace it or require server connectivity to use the app. Treat the account as a *sync credential*, not an entry ticket: the app opens straight into the tabs, and login/register are reachable on demand from Profile (Task 8). Add a second, best-effort `RemoteSessionService` that mirrors local login/register to the backend when reachable, storing the resulting JWT pair via `expo-secure-store`. `FastApiSyncClient` reads that token to authenticate sync calls and refreshes it once on a 401. Remove the `/scans` sync call entirely (the API's README states scan telemetry is deliberately not collected — this isn't a missing endpoint to add, it's a stale client call to delete). Fix `syncContribution` to build a real `multipart/form-data` request.

**Tech Stack:** TypeScript, React Native (Expo), Jest + `@testing-library/react-native`, `expo-secure-store`, WatermelonDB (unrelated to this plan except as the source of records being synced).

**Spec:** `maize-doctor-api/docs/superpowers/specs/2026-08-16-maize-doctor-api-design.md` (the API's contract — `POST /auth/{register,login,refresh,logout}` return `{user, accessToken, refreshToken}` / `{accessToken, refreshToken}` with camelCase JSON; `POST /corrections` and `POST /dataset-contributions` require `Authorization: Bearer <accessToken>`; `POST /dataset-contributions` is `multipart/form-data` with fields `clientId`, `label`, `createdAt`, optional `note`, and a file field `image`). Companion plans (independent, not a dependency): `maize-doctor-classifier/docs/superpowers/plans/2026-08-16-mobile-handoff-hardening.md`, `maize-doctor-api/docs/superpowers/plans/2026-08-16-taxonomy-validation-and-docs.md`.

## Global Constraints

- Never block or fail local login/register/logout on network/backend state — this app is offline-first by explicit design (`model-ml.md`'s "inferencia completamente offline" claim, and the API's own README: "Optional sync when online"). All calls into `RemoteSessionService` from `AuthContext` are fire-and-forget (`.catch(() => {})`), never awaited into the local auth result.
- The API's Pydantic schemas use `CamelModel` (`alias_generator=to_camel`), so JSON request/response bodies for `/auth/*` use `accessToken`/`refreshToken`/`name`/`email`/`password`, matching what's already used in `maize-doctor-api`'s own tests (`response.json()["accessToken"]`).
- `syncQueue.ts` already catches and logs (`logger.warn`) any error from a `SyncClient` method per-record, leaving the record unsynced for the next connectivity event — new failure modes introduced here (401 with no valid refresh, network error) must keep propagating as thrown errors so that existing catch-and-retry-later behavior keeps working. Do not swallow errors inside `FastApiSyncClient`/`RemoteSessionService` methods that are supposed to signal failure.
- `EXPO_PUBLIC_API_URL` unset means "no backend configured" — `getSyncClient()` already falls back to `MockSyncClient` in that case (`src/api/index.ts:8`); `RemoteSessionService` must apply the same guard (no-op, not a thrown error) so `AuthContext` never has to special-case "is a backend even configured."
- Do not touch `TFLiteInferenceEngine` / `MockInferenceEngine` internals or the preprocessing pipeline — those already work correctly per the audit. The only on-device-inference change in this plan (Task 7) is a guard around *which* engine `getInferenceEngine()` is allowed to return in a production build, not how either engine behaves.
- `src/lib/logger.ts`'s `warn`/`error` are both gated on `__DEV__` and are no-ops in production — never use `logger` for something that must be visible/enforced specifically in a production build (Task 7); use a thrown error instead.
- No account is ever required to scan, view history, or read a diagnosis. Nothing in this plan may add an auth check in front of those flows — signing in only enables *sync* of what the device already holds. The WatermelonDB schema is device-scoped (no `user_id` on any table), so records created while signed out remain valid and syncable after a later login, with no reassignment.

---

### Task 1: Remove the `/scans` sync call

**Files:**
- Modify: `src/api/SyncClient.ts`
- Modify: `src/api/MockSyncClient.ts`
- Modify: `src/api/FastApiSyncClient.ts`
- Modify: `src/api/syncQueue.ts`
- Modify: `src/data/queries/scanQueries.ts`
- Modify: `src/api/MockSyncClient.test.ts`
- Modify: `src/api/FastApiSyncClient.test.ts`
- Modify: `src/api/syncQueue.test.ts`
- Modify: `src/data/queries/scanQueries.test.ts`

**Interfaces:**
- Produces: `SyncClient` interface now has exactly two methods, `syncCorrection` and `syncContribution` — no `syncScan`. Every later task in this plan builds on this narrower interface.

- [ ] **Step 1: Update the failing/changing tests first**

Replace the full contents of `src/api/MockSyncClient.test.ts`:

```typescript
import { MockSyncClient } from './MockSyncClient';
import type { Correction } from '@/data/models/Correction';
import type { DatasetContribution } from '@/data/models/DatasetContribution';

describe('MockSyncClient', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('resolves syncCorrection without making any real network call', async () => {
    const client = new MockSyncClient();
    const promise = client.syncCorrection({} as Correction);
    await jest.advanceTimersByTimeAsync(500);
    await expect(promise).resolves.toBeUndefined();
  });

  it('resolves syncContribution without making any real network call', async () => {
    const client = new MockSyncClient();
    const promise = client.syncContribution({} as DatasetContribution);
    await jest.advanceTimersByTimeAsync(500);
    await expect(promise).resolves.toBeUndefined();
  });
});
```

Replace the full contents of `src/api/FastApiSyncClient.test.ts`:

```typescript
import { FastApiSyncClient } from './FastApiSyncClient';
import type { Correction } from '@/data/models/Correction';
import type { DatasetContribution } from '@/data/models/DatasetContribution';

describe('FastApiSyncClient', () => {
  const originalApiUrl = process.env.EXPO_PUBLIC_API_URL;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_URL = 'https://api.doctormaiz.test';
    fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 201 });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_API_URL = originalApiUrl;
  });

  it('posts a correction to /corrections with the expected shape', async () => {
    const client = new FastApiSyncClient();
    const correction = {
      id: 'correction-1',
      scanId: 'scan-1',
      observedLabel: 'northern_corn_leaf_blight',
      note: 'Veo insectos',
      status: 'pending',
      createdAt: new Date('2026-08-12T10:05:00.000Z'),
    } as unknown as Correction;

    await client.syncCorrection(correction);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.doctormaiz.test/corrections',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('posts a contribution to /dataset-contributions with the expected shape', async () => {
    const client = new FastApiSyncClient();
    const contribution = {
      id: 'contribution-1',
      imageUri: 'file:///document/contributions/contribution_1.jpg',
      label: 'healthy',
      note: null,
      createdAt: new Date('2026-08-12T10:10:00.000Z'),
    } as unknown as DatasetContribution;

    await client.syncContribution(contribution);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.doctormaiz.test/dataset-contributions',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('throws when the server responds with a non-2xx status', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    const client = new FastApiSyncClient();

    await expect(
      client.syncCorrection({ id: 'correction-1', createdAt: new Date() } as Correction)
    ).rejects.toThrow('Sync request to /corrections failed with status 500');
  });

  it('propagates a network error so the sync queue can skip and retry later', async () => {
    fetchMock.mockRejectedValue(new Error('Network request failed'));
    const client = new FastApiSyncClient();

    await expect(
      client.syncCorrection({ id: 'correction-1', createdAt: new Date() } as Correction)
    ).rejects.toThrow('Network request failed');
  });
});
```

Replace the full contents of `src/api/syncQueue.test.ts`:

```typescript
const mockSyncCorrection = jest.fn();
const mockSyncContribution = jest.fn();
const mockGetSyncClient = jest.fn(() => ({
  syncCorrection: mockSyncCorrection,
  syncContribution: mockSyncContribution,
}));

const mockGetUnsyncedCorrections = jest.fn();
const mockMarkCorrectionSynced = jest.fn();
const mockGetUnsyncedContributions = jest.fn();
const mockMarkContributionSynced = jest.fn();
const mockAddEventListener = jest.fn();

jest.mock('./index', () => ({
  getSyncClient: () => mockGetSyncClient(),
}));

jest.mock('@/data/queries/correctionQueries', () => ({
  getUnsyncedCorrections: () => mockGetUnsyncedCorrections(),
  markCorrectionSynced: (correction: unknown) => mockMarkCorrectionSynced(correction),
}));

jest.mock('@/data/queries/datasetContributionQueries', () => ({
  getUnsyncedContributions: () => mockGetUnsyncedContributions(),
  markContributionSynced: (contribution: unknown) => mockMarkContributionSynced(contribution),
}));

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: (listener: unknown) => mockAddEventListener(listener),
  },
}));

import { flushPendingSync, startSyncListener } from './syncQueue';

describe('flushPendingSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUnsyncedCorrections.mockResolvedValue([]);
    mockGetUnsyncedContributions.mockResolvedValue([]);
    mockSyncCorrection.mockResolvedValue(undefined);
    mockSyncContribution.mockResolvedValue(undefined);
  });

  it('syncs and marks every unsynced record across the tracked tables', async () => {
    const correction = { id: 'correction-1' };
    const contribution = { id: 'contribution-1' };
    mockGetUnsyncedCorrections.mockResolvedValue([correction]);
    mockGetUnsyncedContributions.mockResolvedValue([contribution]);

    await flushPendingSync();

    expect(mockSyncCorrection).toHaveBeenCalledWith(correction);
    expect(mockMarkCorrectionSynced).toHaveBeenCalledWith(correction);
    expect(mockSyncContribution).toHaveBeenCalledWith(contribution);
    expect(mockMarkContributionSynced).toHaveBeenCalledWith(contribution);
  });

  it('does not mark a record as synced when the upload fails', async () => {
    const correction = { id: 'correction-1' };
    mockGetUnsyncedCorrections.mockResolvedValue([correction]);
    mockSyncCorrection.mockRejectedValue(new Error('Network request failed'));

    await flushPendingSync();

    expect(mockMarkCorrectionSynced).not.toHaveBeenCalled();
  });

  it('keeps processing remaining records after one fails', async () => {
    const correctionA = { id: 'correction-a' };
    const correctionB = { id: 'correction-b' };
    mockGetUnsyncedCorrections.mockResolvedValue([correctionA, correctionB]);
    mockSyncCorrection.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(undefined);

    await flushPendingSync();

    expect(mockMarkCorrectionSynced).not.toHaveBeenCalledWith(correctionA);
    expect(mockMarkCorrectionSynced).toHaveBeenCalledWith(correctionB);
  });
});

describe('startSyncListener', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUnsyncedCorrections.mockResolvedValue([]);
    mockGetUnsyncedContributions.mockResolvedValue([]);
  });

  it('does not flush on the first connectivity event even if connected', () => {
    let listener: (state: { isConnected: boolean }) => void = () => {};
    mockAddEventListener.mockImplementation((cb) => {
      listener = cb;
      return jest.fn();
    });

    startSyncListener();
    listener({ isConnected: true });

    expect(mockGetUnsyncedCorrections).not.toHaveBeenCalled();
  });

  it('flushes only when connectivity transitions from disconnected to connected', () => {
    let listener: (state: { isConnected: boolean }) => void = () => {};
    mockAddEventListener.mockImplementation((cb) => {
      listener = cb;
      return jest.fn();
    });

    startSyncListener();
    listener({ isConnected: false });
    expect(mockGetUnsyncedCorrections).not.toHaveBeenCalled();

    listener({ isConnected: true });
    expect(mockGetUnsyncedCorrections).toHaveBeenCalledTimes(1);

    listener({ isConnected: true });
    expect(mockGetUnsyncedCorrections).toHaveBeenCalledTimes(1);
  });

  it('returns the unsubscribe function from NetInfo', () => {
    const unsubscribe = jest.fn();
    mockAddEventListener.mockReturnValue(unsubscribe);

    const result = startSyncListener();

    expect(result).toBe(unsubscribe);
  });
});
```

Replace the full contents of `src/data/queries/scanQueries.test.ts`:

```typescript
const mockWrite = jest.fn((callback: () => Promise<void>) => callback());
const mockFind = jest.fn();

jest.mock('../database', () => ({
  database: {
    write: (callback: () => Promise<void>) => mockWrite(callback),
    collections: {
      get: jest.fn(() => ({
        find: (id: string) => mockFind(id),
      })),
    },
  },
}));

import { updateScanResult, getScanById } from './scanQueries';
import type { Scan } from '../models/Scan';

describe('updateScanResult', () => {
  beforeEach(() => {
    mockWrite.mockClear();
  });

  it('writes the label, confidence, and distribution onto the scan', async () => {
    const fakeScan = {
      update: jest.fn((updater: (scan: Scan) => void) => {
        updater(fakeScan as unknown as Scan);
      }),
    } as unknown as Scan;

    await updateScanResult(fakeScan, {
      label: 'common_rust',
      confidence: 0.82,
      distribution: { common_rust: 0.82, healthy: 0.18 },
    });

    expect(mockWrite).toHaveBeenCalledTimes(1);
    expect(fakeScan.update).toHaveBeenCalledTimes(1);
    expect(fakeScan.label).toBe('common_rust');
    expect(fakeScan.confidence).toBe(0.82);
    expect(fakeScan.distribution).toEqual({ common_rust: 0.82, healthy: 0.18 });
  });
});

describe('getScanById', () => {
  beforeEach(() => {
    mockFind.mockClear();
  });

  it('finds the scan by id in the scans collection', async () => {
    const fakeScan = { id: 'scan-1' } as Scan;
    mockFind.mockResolvedValue(fakeScan);

    const result = await getScanById('scan-1');

    expect(mockFind).toHaveBeenCalledWith('scan-1');
    expect(result).toBe(fakeScan);
  });
});
```

- [ ] **Step 2: Run the updated tests to verify they fail**

Run: `npx jest src/api/MockSyncClient.test.ts src/api/FastApiSyncClient.test.ts src/api/syncQueue.test.ts src/data/queries/scanQueries.test.ts`

Expected, per file — do not treat the two already-passing files as a problem:

- `src/api/syncQueue.test.ts` — **FAILS**. `syncQueue.ts` still calls `syncClient.syncScan(...)` and imports `getUnsyncedScans`/`markScanSynced`, but the rewritten mock client no longer provides `syncScan`.
- `src/api/FastApiSyncClient.test.ts` — **FAILS**. The new `'propagates a network error…'` test is new coverage the current `post()` does not yet satisfy in isolation; the file also no longer exercises `/scans`.
- `src/api/MockSyncClient.test.ts` — **PASSES already**. `MockSyncClient` implements `syncCorrection`/`syncContribution` today; this rewrite only *removes* the `syncScan` test.
- `src/data/queries/scanQueries.test.ts` — **PASSES already**. It only covers `updateScanResult` and `getScanById`, both unchanged.

Note: this project runs Jest through `jest-expo`/`babel-jest`, which strips types without typechecking. A mismatched `SyncClient` interface will **not** fail Jest on its own — only the runtime `syncScan is not a function` in `syncQueue` does. Interface drift is caught by `npx tsc --noEmit` in Step 9, not here.

- [ ] **Step 3: Update `SyncClient.ts`**

Replace the full contents of `src/api/SyncClient.ts`:

```typescript
import type { Correction } from '@/data/models/Correction';
import type { DatasetContribution } from '@/data/models/DatasetContribution';

export interface SyncClient {
  syncCorrection(correction: Correction): Promise<void>;
  syncContribution(contribution: DatasetContribution): Promise<void>;
}
```

- [ ] **Step 4: Update `MockSyncClient.ts`**

Replace the full contents of `src/api/MockSyncClient.ts`:

```typescript
import type { SyncClient } from './SyncClient';
import type { Correction } from '@/data/models/Correction';
import type { DatasetContribution } from '@/data/models/DatasetContribution';

const MIN_LATENCY_MS = 200;
const MAX_LATENCY_MS = 500;

function simulateLatency(): Promise<void> {
  const latency = MIN_LATENCY_MS + Math.random() * (MAX_LATENCY_MS - MIN_LATENCY_MS);
  return new Promise((resolve) => setTimeout(resolve, latency));
}

export class MockSyncClient implements SyncClient {
  async syncCorrection(_correction: Correction): Promise<void> {
    await simulateLatency();
  }

  async syncContribution(_contribution: DatasetContribution): Promise<void> {
    await simulateLatency();
  }
}
```

- [ ] **Step 5: Update `FastApiSyncClient.ts`**

Replace the full contents of `src/api/FastApiSyncClient.ts`:

```typescript
import type { SyncClient } from './SyncClient';
import type { Correction } from '@/data/models/Correction';
import type { DatasetContribution } from '@/data/models/DatasetContribution';

async function post(path: string, body: unknown): Promise<void> {
  const baseUrl = process.env.EXPO_PUBLIC_API_URL;
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Sync request to ${path} failed with status ${response.status}`);
  }
}

export class FastApiSyncClient implements SyncClient {
  async syncCorrection(correction: Correction): Promise<void> {
    await post('/corrections', {
      clientId: correction.id,
      scanId: correction.scanId,
      observedLabel: correction.observedLabel,
      note: correction.note,
      status: correction.status,
      createdAt: correction.createdAt.toISOString(),
    });
  }

  async syncContribution(contribution: DatasetContribution): Promise<void> {
    await post('/dataset-contributions', {
      clientId: contribution.id,
      imageUri: contribution.imageUri,
      label: contribution.label,
      note: contribution.note,
      createdAt: contribution.createdAt.toISOString(),
    });
  }
}
```

- [ ] **Step 6: Update `syncQueue.ts`**

Replace the full contents of `src/api/syncQueue.ts`:

```typescript
import NetInfo from '@react-native-community/netinfo';
import { getSyncClient } from './index';
import { getUnsyncedCorrections, markCorrectionSynced } from '@/data/queries/correctionQueries';
import {
  getUnsyncedContributions,
  markContributionSynced,
} from '@/data/queries/datasetContributionQueries';
import { logger } from '@/lib/logger';

export async function flushPendingSync(): Promise<void> {
  const syncClient = getSyncClient();

  const corrections = await getUnsyncedCorrections();
  for (const correction of corrections) {
    try {
      await syncClient.syncCorrection(correction);
      await markCorrectionSynced(correction);
    } catch (error) {
      logger.warn(`No se pudo sincronizar la corrección ${correction.id}`, error);
    }
  }

  const contributions = await getUnsyncedContributions();
  for (const contribution of contributions) {
    try {
      await syncClient.syncContribution(contribution);
      await markContributionSynced(contribution);
    } catch (error) {
      logger.warn(`No se pudo sincronizar la contribución ${contribution.id}`, error);
    }
  }
}

export function startSyncListener(): () => void {
  let wasConnected: boolean | null = null;

  return NetInfo.addEventListener((state) => {
    const isConnected = !!state.isConnected;
    if (isConnected && wasConnected === false) {
      flushPendingSync();
    }
    wasConnected = isConnected;
  });
}
```

- [ ] **Step 7: Remove the now-unused scan-sync query functions**

In `src/data/queries/scanQueries.ts`, delete the `getUnsyncedScans` and `markScanSynced` functions (currently lines 32-42, right before `createScan`):

```typescript
export async function getUnsyncedScans(): Promise<Scan[]> {
  return scansCollection.query(Q.where('synced', false)).fetch();
}

export async function markScanSynced(scan: Scan): Promise<void> {
  await database.write(async () => {
    await scan.update((s) => {
      s.synced = true;
    });
  });
}

```

The `synced` field itself stays on the `Scan` model/schema (it's still meaningful — scans genuinely are never synced to the backend by design, and dropping a WatermelonDB column is a separate, riskier migration concern out of this plan's scope).

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx jest src/api src/data/queries/scanQueries.test.ts`
Expected: all PASS.

- [ ] **Step 9: Typecheck and run the full test suite**

Run: `npx tsc --noEmit`
Expected: no errors (confirms no other file still references `syncScan`/`getUnsyncedScans`/`markScanSynced`).

Run: `npx jest`
Expected: all PASS, no regressions elsewhere.

- [ ] **Step 10: Commit**

```bash
git add src/api/SyncClient.ts src/api/MockSyncClient.ts src/api/MockSyncClient.test.ts src/api/FastApiSyncClient.ts src/api/FastApiSyncClient.test.ts src/api/syncQueue.ts src/api/syncQueue.test.ts src/data/queries/scanQueries.ts src/data/queries/scanQueries.test.ts
git commit -m "fix(sync): remove /scans sync call, which has no matching API route"
```

---

### Task 2: Document `EXPO_PUBLIC_API_URL` in `.env.example`

**Files:**
- Modify: `.env.example`

**Interfaces:**
- None (configuration documentation only).

- [ ] **Step 1: Edit `.env.example`**

Replace the full contents of `.env.example`:

```bash
# true (default) usa MockInferenceEngine; 'false' exactamente activa TFLiteInferenceEngine.
EXPO_PUBLIC_USE_MOCK_MODEL=true

# URL base de maize-doctor-api. Sin definir, getSyncClient() usa MockSyncClient (sin red)
# y RemoteSessionService no hace ningun intento de sesion remota. Ver
# maize-doctor-api/README.md -> "Pointing maize-doctor-app at this API" para el valor
# segun entorno (emulador Android, dispositivo fisico, simulador iOS).
EXPO_PUBLIC_API_URL=
```

- [ ] **Step 2: Verify**

Run: `git diff .env.example`
Expected: clean two-line addition (blank line + comment block + `EXPO_PUBLIC_API_URL=`), no unrelated changes.

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "docs: document EXPO_PUBLIC_API_URL in .env.example"
```

---

### Task 3: `RemoteSessionService` — backend JWT session, mirrored from local auth

**Files:**
- Create: `src/api/RemoteSessionService.ts`
- Test: `src/api/RemoteSessionService.test.ts`
- Modify: `src/auth/AuthContext.tsx`

**Interfaces:**
- Produces: `class RemoteSessionService` with `register(name: string, email: string, password: string): Promise<void>`, `login(email: string, password: string): Promise<void>`, `logout(): Promise<void>`, `getAccessToken(): Promise<string | null>`, `refreshAccessToken(): Promise<string | null>`. All methods no-op (resolve immediately, no network call) when `EXPO_PUBLIC_API_URL` is unset. `login`/`register` throw on a non-2xx response, except that `register` treats a **409 (email already registered) as a fallback to `login`** rather than an error — see the rationale below. `getAccessToken`/`refreshAccessToken` never throw (return `null` on any failure). A singleton instance is exported as `remoteSession`.

**Why `register` falls back to `login` on 409:** local and remote accounts are independent stores. `LocalAuthService` only knows about accounts registered on *this* device, so a user who already registered on another device — or who reinstalled the app, or registered before `EXPO_PUBLIC_API_URL` was configured — will pass local registration and then hit a remote 409. Because `AuthContext` calls `remoteSession.register(...)` fire-and-forget with `.catch(() => {})`, a thrown 409 would be swallowed silently and that user would **never** obtain a token, so their contributions would never sync — with no error surfaced anywhere. Since local registration already proved the user knows this email/password pair, retrying as a login is the correct recovery. If the password does not match the remote account, the resulting 401 propagates normally (and is swallowed by the same fire-and-forget `.catch`, leaving sync disabled until the user logs in explicitly from Profile — Task 8).
- Consumes (Task 4 of this plan): `remoteSession.getAccessToken()` and `remoteSession.refreshAccessToken()`.

- [ ] **Step 1: Write the failing tests**

Create `src/api/RemoteSessionService.test.ts`:

```typescript
import { RemoteSessionService } from './RemoteSessionService';

const store = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn((key: string, value: string) => {
    store.set(key, value);
    return Promise.resolve();
  }),
  getItemAsync: jest.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
  deleteItemAsync: jest.fn((key: string) => {
    store.delete(key);
    return Promise.resolve();
  }),
}));

describe('RemoteSessionService', () => {
  const originalApiUrl = process.env.EXPO_PUBLIC_API_URL;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    store.clear();
    process.env.EXPO_PUBLIC_API_URL = 'https://api.doctormaiz.test';
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_API_URL = originalApiUrl;
  });

  it('stores tokens returned by /auth/login', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ accessToken: 'access-1', refreshToken: 'refresh-1' }),
    });
    const service = new RemoteSessionService();

    await service.login('farmer@example.com', 'secret');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.doctormaiz.test/auth/login',
      expect.objectContaining({ method: 'POST' })
    );
    await expect(service.getAccessToken()).resolves.toBe('access-1');
  });

  it('stores tokens returned by /auth/register', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ accessToken: 'access-2', refreshToken: 'refresh-2' }),
    });
    const service = new RemoteSessionService();

    await service.register('Farmer', 'farmer2@example.com', 'secret');

    await expect(service.getAccessToken()).resolves.toBe('access-2');
  });

  it('falls back to login when the email is already registered (409)', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 409 })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ accessToken: 'access-409', refreshToken: 'refresh-409' }),
      });
    const service = new RemoteSessionService();

    await service.register('Farmer', 'farmer@example.com', 'secret');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://api.doctormaiz.test/auth/login',
      expect.objectContaining({ method: 'POST' })
    );
    await expect(service.getAccessToken()).resolves.toBe('access-409');
  });

  it('propagates the login failure when a 409 fallback has the wrong password', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 409 })
      .mockResolvedValueOnce({ ok: false, status: 401 });
    const service = new RemoteSessionService();

    await expect(service.register('Farmer', 'farmer@example.com', 'wrong')).rejects.toThrow(
      'Remote login failed with status 401'
    );
    await expect(service.getAccessToken()).resolves.toBeNull();
  });

  it('throws on a failed login without storing anything', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401 });
    const service = new RemoteSessionService();

    await expect(service.login('farmer@example.com', 'wrong')).rejects.toThrow(
      'Remote login failed with status 401'
    );
    await expect(service.getAccessToken()).resolves.toBeNull();
  });

  it('no-ops when EXPO_PUBLIC_API_URL is not set', async () => {
    process.env.EXPO_PUBLIC_API_URL = '';
    const service = new RemoteSessionService();

    await service.login('farmer@example.com', 'secret');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refreshes and stores a new token pair', async () => {
    store.set('doctormaiz_remote_refresh_token', 'refresh-1');
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ accessToken: 'access-new', refreshToken: 'refresh-new' }),
    });
    const service = new RemoteSessionService();

    const token = await service.refreshAccessToken();

    expect(token).toBe('access-new');
    await expect(service.getAccessToken()).resolves.toBe('access-new');
  });

  it('returns null from refreshAccessToken when there is no stored refresh token', async () => {
    const service = new RemoteSessionService();

    await expect(service.refreshAccessToken()).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('clears local tokens on logout even if the remote call fails', async () => {
    store.set('doctormaiz_remote_access_token', 'access-1');
    store.set('doctormaiz_remote_refresh_token', 'refresh-1');
    fetchMock.mockRejectedValue(new Error('Network request failed'));
    const service = new RemoteSessionService();

    await service.logout();

    await expect(service.getAccessToken()).resolves.toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/api/RemoteSessionService.test.ts`
Expected: `Cannot find module './RemoteSessionService'`.

- [ ] **Step 3: Implement `RemoteSessionService`**

Create `src/api/RemoteSessionService.ts`:

```typescript
import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'doctormaiz_remote_access_token';
const REFRESH_TOKEN_KEY = 'doctormaiz_remote_refresh_token';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

function apiUrl(path: string): string {
  return `${process.env.EXPO_PUBLIC_API_URL}${path}`;
}

async function storeTokens(tokens: TokenPair): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export class RemoteSessionService {
  async register(name: string, email: string, password: string): Promise<void> {
    if (!process.env.EXPO_PUBLIC_API_URL) return;
    const response = await fetch(apiUrl('/auth/register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });

    if (response.status === 409) {
      await this.login(email, password);
      return;
    }

    if (!response.ok) {
      throw new Error(`Remote register failed with status ${response.status}`);
    }
    const body = await response.json();
    await storeTokens({ accessToken: body.accessToken, refreshToken: body.refreshToken });
  }

  async login(email: string, password: string): Promise<void> {
    if (!process.env.EXPO_PUBLIC_API_URL) return;
    const response = await fetch(apiUrl('/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
      throw new Error(`Remote login failed with status ${response.status}`);
    }
    const body = await response.json();
    await storeTokens({ accessToken: body.accessToken, refreshToken: body.refreshToken });
  }

  async logout(): Promise<void> {
    if (!process.env.EXPO_PUBLIC_API_URL) return;

    const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    if (!refreshToken) return;
    try {
      await fetch(apiUrl('/auth/logout'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // Best-effort: local tokens are already cleared regardless of network state.
    }
  }

  async getAccessToken(): Promise<string | null> {
    return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  }

  async refreshAccessToken(): Promise<string | null> {
    const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    if (!refreshToken || !process.env.EXPO_PUBLIC_API_URL) return null;
    const response = await fetch(apiUrl('/auth/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) return null;
    const body = await response.json();
    await storeTokens({ accessToken: body.accessToken, refreshToken: body.refreshToken });
    return body.accessToken;
  }
}

export const remoteSession = new RemoteSessionService();
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/api/RemoteSessionService.test.ts`
Expected: all 10 tests PASS.

- [ ] **Step 5: Write the failing `AuthContext` wiring tests**

Create `src/auth/AuthContext.test.tsx`:

```tsx
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth } from './AuthContext';

const mockLocalLogin = jest.fn();
const mockLocalRegister = jest.fn();
const mockLocalLogout = jest.fn();
const mockGetStoredSession = jest.fn();

jest.mock('./LocalAuthService', () => ({
  LocalAuthService: jest.fn().mockImplementation(() => ({
    login: (...args: unknown[]) => mockLocalLogin(...args),
    register: (...args: unknown[]) => mockLocalRegister(...args),
    logout: (...args: unknown[]) => mockLocalLogout(...args),
    getStoredSession: () => mockGetStoredSession(),
  })),
}));

const mockRemoteLogin = jest.fn();
const mockRemoteRegister = jest.fn();
const mockRemoteLogout = jest.fn();

jest.mock('@/api/RemoteSessionService', () => ({
  remoteSession: {
    login: (...args: unknown[]) => mockRemoteLogin(...args),
    register: (...args: unknown[]) => mockRemoteRegister(...args),
    logout: (...args: unknown[]) => mockRemoteLogout(...args),
  },
}));

describe('AuthContext remote mirroring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetStoredSession.mockResolvedValue(null);
    mockRemoteLogin.mockResolvedValue(undefined);
    mockRemoteRegister.mockResolvedValue(undefined);
    mockRemoteLogout.mockResolvedValue(undefined);
  });

  it('mirrors a successful local login to the remote session', async () => {
    mockLocalLogin.mockResolvedValue({
      success: true,
      user: { id: 'u1', name: 'Farmer', email: 'farmer@example.com' },
    });
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.login('farmer@example.com', 'secret');
    });

    expect(mockRemoteLogin).toHaveBeenCalledWith('farmer@example.com', 'secret');
  });

  it('does not mirror to remote when local login fails', async () => {
    mockLocalLogin.mockResolvedValue({ success: false, error: 'Contraseña incorrecta.' });
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.login('farmer@example.com', 'wrong');
    });

    expect(mockRemoteLogin).not.toHaveBeenCalled();
  });

  it('does not reject login when the remote mirror call fails', async () => {
    mockLocalLogin.mockResolvedValue({
      success: true,
      user: { id: 'u1', name: 'Farmer', email: 'farmer@example.com' },
    });
    mockRemoteLogin.mockRejectedValue(new Error('Network request failed'));
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(
      act(async () => {
        await result.current.login('farmer@example.com', 'secret');
      })
    ).resolves.not.toThrow();
  });

  it('mirrors a successful local register to the remote session', async () => {
    mockLocalRegister.mockResolvedValue({
      success: true,
      user: { id: 'u1', name: 'Farmer', email: 'farmer@example.com' },
    });
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.register('Farmer', 'farmer@example.com', 'secret');
    });

    expect(mockRemoteRegister).toHaveBeenCalledWith('Farmer', 'farmer@example.com', 'secret');
  });

  it('mirrors logout to the remote session', async () => {
    mockGetStoredSession.mockResolvedValue({
      id: 'u1',
      name: 'Farmer',
      email: 'farmer@example.com',
    });
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.logout();
    });

    expect(mockRemoteLogout).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `npx jest src/auth/AuthContext.test.tsx`
Expected: failures — `mockRemoteLogin`/`mockRemoteRegister`/`mockRemoteLogout` never called, because `AuthContext.tsx` doesn't import `remoteSession` yet.

- [ ] **Step 7: Wire `remoteSession` into `AuthContext.tsx`**

In `src/auth/AuthContext.tsx`, add the import alongside the existing ones:

```typescript
import { remoteSession } from '@/api/RemoteSessionService';
```

Then change the `login` function body from:

```typescript
  const login = async (email: string, password: string): Promise<AuthResult> => {
    const result = await authService.login(email, password);
    if (result.success && result.user) {
      setUser(result.user);
    }
    return result;
  };
```

to:

```typescript
  const login = async (email: string, password: string): Promise<AuthResult> => {
    const result = await authService.login(email, password);
    if (result.success && result.user) {
      setUser(result.user);
      remoteSession.login(email, password).catch(() => {});
    }
    return result;
  };
```

Change the `register` function body from:

```typescript
  const register = async (
    name: string,
    email: string,
    password: string
  ): Promise<AuthResult> => {
    const result = await authService.register(name, email, password);
    if (result.success && result.user) {
      setUser(result.user);
    }
    return result;
  };
```

to:

```typescript
  const register = async (
    name: string,
    email: string,
    password: string
  ): Promise<AuthResult> => {
    const result = await authService.register(name, email, password);
    if (result.success && result.user) {
      setUser(result.user);
      remoteSession.register(name, email, password).catch(() => {});
    }
    return result;
  };
```

Change the `logout` function body from:

```typescript
  const logout = async (): Promise<void> => {
    await authService.logout();
    setUser(null);
  };
```

to:

```typescript
  const logout = async (): Promise<void> => {
    await authService.logout();
    remoteSession.logout().catch(() => {});
    setUser(null);
  };
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx jest src/auth`
Expected: all PASS, including the 5 new `AuthContext.test.tsx` tests and the pre-existing `validation.test.ts`.

- [ ] **Step 9: Typecheck and run the full test suite**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx jest`
Expected: all PASS.

- [ ] **Step 10: Commit**

```bash
git add src/api/RemoteSessionService.ts src/api/RemoteSessionService.test.ts src/auth/AuthContext.tsx src/auth/AuthContext.test.tsx
git commit -m "feat(auth): mirror local login/register/logout to a backend JWT session"
```

---

### Task 4: Attach the backend token to sync requests, with 401 refresh-and-retry

**Files:**
- Modify: `src/api/FastApiSyncClient.ts`
- Modify: `src/api/FastApiSyncClient.test.ts`

**Interfaces:**
- Consumes: `remoteSession.getAccessToken()` / `remoteSession.refreshAccessToken()` (Task 3).
- Produces: an internal `sendWithAuthRetry(request: (token: string | null) => Promise<Response>): Promise<Response>` helper, reused by Task 5's `postMultipart`.

- [ ] **Step 1: Write the failing tests**

In `src/api/FastApiSyncClient.test.ts`, add this mock block right after the existing imports at the top of the file:

```typescript
const mockGetAccessToken = jest.fn();
const mockRefreshAccessToken = jest.fn();

jest.mock('./RemoteSessionService', () => ({
  remoteSession: {
    getAccessToken: () => mockGetAccessToken(),
    refreshAccessToken: () => mockRefreshAccessToken(),
  },
}));
```

Then, inside the existing `beforeEach`, add a default so pre-existing tests (which don't care about auth) keep passing unmodified:

```typescript
  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_URL = 'https://api.doctormaiz.test';
    fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 201 });
    global.fetch = fetchMock as unknown as typeof fetch;
    mockGetAccessToken.mockReset().mockResolvedValue(null);
    mockRefreshAccessToken.mockReset().mockResolvedValue(null);
  });
```

Then add these three tests at the end of the `describe('FastApiSyncClient', ...)` block, before the closing `});`:

```typescript
  it('attaches an Authorization header when a token is available', async () => {
    mockGetAccessToken.mockResolvedValue('token-123');
    const client = new FastApiSyncClient();
    const correction = {
      id: 'correction-1',
      scanId: 'scan-1',
      observedLabel: 'healthy',
      note: null,
      status: 'pending',
      createdAt: new Date('2026-08-12T10:05:00.000Z'),
    } as unknown as Correction;

    await client.syncCorrection(correction);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.doctormaiz.test/corrections',
      expect.objectContaining({
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token-123' },
      })
    );
  });

  it('refreshes and retries once on a 401, then succeeds', async () => {
    mockGetAccessToken.mockResolvedValue('expired-token');
    mockRefreshAccessToken.mockResolvedValue('fresh-token');
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValueOnce({ ok: true, status: 201 });
    const client = new FastApiSyncClient();
    const correction = {
      id: 'correction-1',
      scanId: 'scan-1',
      observedLabel: 'healthy',
      note: null,
      status: 'pending',
      createdAt: new Date('2026-08-12T10:05:00.000Z'),
    } as unknown as Correction;

    await client.syncCorrection(correction);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://api.doctormaiz.test/corrections',
      expect.objectContaining({
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer fresh-token' },
      })
    );
  });

  it('refreshes on a 401 even when no access token was stored', async () => {
    mockGetAccessToken.mockResolvedValue(null);
    mockRefreshAccessToken.mockResolvedValue('fresh-token');
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValueOnce({ ok: true, status: 201 });
    const client = new FastApiSyncClient();
    const correction = {
      id: 'correction-1',
      scanId: 'scan-1',
      observedLabel: 'healthy',
      note: null,
      status: 'pending',
      createdAt: new Date('2026-08-12T10:05:00.000Z'),
    } as unknown as Correction;

    await client.syncCorrection(correction);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://api.doctormaiz.test/corrections',
      expect.objectContaining({
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer fresh-token' },
      })
    );
  });

  it('throws when a 401 cannot be refreshed, without retrying again', async () => {
    mockGetAccessToken.mockResolvedValue('expired-token');
    mockRefreshAccessToken.mockResolvedValue(null);
    fetchMock.mockResolvedValue({ ok: false, status: 401 });
    const client = new FastApiSyncClient();
    const correction = {
      id: 'correction-1',
      scanId: 'scan-1',
      observedLabel: 'healthy',
      note: null,
      status: 'pending',
      createdAt: new Date('2026-08-12T10:05:00.000Z'),
    } as unknown as Correction;

    await expect(client.syncCorrection(correction)).rejects.toThrow(
      'Sync request to /corrections failed with status 401'
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/api/FastApiSyncClient.test.ts`
Expected: the 3 new tests FAIL (no `Authorization` header is ever sent yet); pre-existing tests keep passing.

- [ ] **Step 3: Implement the auth-aware `post`**

In `src/api/FastApiSyncClient.ts`, add the import:

```typescript
import { remoteSession } from './RemoteSessionService';
```

Replace the `post` function:

```typescript
async function post(path: string, body: unknown): Promise<void> {
  const baseUrl = process.env.EXPO_PUBLIC_API_URL;
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Sync request to ${path} failed with status ${response.status}`);
  }
}
```

with:

```typescript
async function sendWithAuthRetry(
  request: (token: string | null) => Promise<Response>
): Promise<Response> {
  const accessToken = await remoteSession.getAccessToken();
  let response = await request(accessToken);

  if (response.status === 401) {
    const refreshedToken = await remoteSession.refreshAccessToken();
    if (refreshedToken) {
      response = await request(refreshedToken);
    }
  }

  return response;
}

async function post(path: string, body: unknown): Promise<void> {
  const baseUrl = process.env.EXPO_PUBLIC_API_URL;
  const response = await sendWithAuthRetry((token) =>
    fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    })
  );

  if (!response.ok) {
    throw new Error(`Sync request to ${path} failed with status ${response.status}`);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/api/FastApiSyncClient.test.ts`
Expected: all tests PASS, including the 3 new ones and every pre-existing test (the pre-existing ones default `mockGetAccessToken` to `null`, so their header assertions of `{ 'Content-Type': 'application/json' }` still match exactly, since `...(null ? ... : {})` spreads nothing).

- [ ] **Step 5: Run the full test suite**

Run: `npx jest`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/api/FastApiSyncClient.ts src/api/FastApiSyncClient.test.ts
git commit -m "feat(sync): attach bearer token to sync requests, refresh once on 401"
```

---

### Task 5: Fix `syncContribution` to send real `multipart/form-data`

**Files:**
- Modify: `src/api/FastApiSyncClient.ts`
- Modify: `src/api/FastApiSyncClient.test.ts`

**Interfaces:**
- Consumes: `sendWithAuthRetry` (Task 4).
- Produces: `postMultipart(path: string, formData: FormData): Promise<void>`, used only by `syncContribution`.

- [ ] **Step 1: Write the failing tests**

In `src/api/FastApiSyncClient.test.ts`, add this fake `FormData` near the top of the file, right after the mock block added in Task 4:

```typescript
class FakeFormData {
  parts: Array<[string, unknown]> = [];
  append(key: string, value: unknown) {
    this.parts.push([key, value]);
  }
}
```

In the `beforeEach`, add a line to install it as the global `FormData`:

```typescript
    global.FormData = FakeFormData as unknown as typeof FormData;
```

Replace the existing test `'posts a contribution to /dataset-contributions with the expected shape'` with:

```typescript
  it('posts a contribution as multipart/form-data with the image attached', async () => {
    const client = new FastApiSyncClient();
    const contribution = {
      id: 'contribution-1',
      imageUri: 'file:///document/contributions/contribution_1.jpg',
      label: 'healthy',
      note: null,
      createdAt: new Date('2026-08-12T10:10:00.000Z'),
    } as unknown as DatasetContribution;

    await client.syncContribution(contribution);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.doctormaiz.test/dataset-contributions');
    expect(options.method).toBe('POST');
    const body = options.body as FakeFormData;
    expect(body.parts).toContainEqual(['clientId', 'contribution-1']);
    expect(body.parts).toContainEqual(['label', 'healthy']);
    expect(body.parts).toContainEqual(['createdAt', '2026-08-12T10:10:00.000Z']);
    expect(body.parts).toContainEqual([
      'image',
      { uri: contribution.imageUri, name: 'contribution_1.jpg', type: 'image/jpeg' },
    ]);
  });

  it('includes note in the multipart body when the contribution has one', async () => {
    const client = new FastApiSyncClient();
    const contribution = {
      id: 'contribution-2',
      imageUri: 'file:///document/contributions/leaf.jpg',
      label: 'gray_leaf_spot',
      note: 'Se ve seca',
      createdAt: new Date('2026-08-12T10:10:00.000Z'),
    } as unknown as DatasetContribution;

    await client.syncContribution(contribution);

    const [, options] = fetchMock.mock.calls[0];
    const body = options.body as FakeFormData;
    expect(body.parts).toContainEqual(['note', 'Se ve seca']);
  });

  it('throws when the contribution upload responds with a non-2xx status', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 413 });
    const client = new FastApiSyncClient();
    const contribution = {
      id: 'contribution-3',
      imageUri: 'file:///document/contributions/leaf.jpg',
      label: 'healthy',
      note: null,
      createdAt: new Date('2026-08-12T10:10:00.000Z'),
    } as unknown as DatasetContribution;

    await expect(client.syncContribution(contribution)).rejects.toThrow(
      'Sync request to /dataset-contributions failed with status 413'
    );
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/api/FastApiSyncClient.test.ts`
Expected: the contribution-related tests FAIL — `syncContribution` still sends a JSON body, not a `FakeFormData` instance.

- [ ] **Step 3: Implement `postMultipart` and rewrite `syncContribution`**

In `src/api/FastApiSyncClient.ts`, add `postMultipart` right after `post`:

```typescript
async function postMultipart(path: string, formData: FormData): Promise<void> {
  const baseUrl = process.env.EXPO_PUBLIC_API_URL;
  const response = await sendWithAuthRetry((token) =>
    fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: formData,
    })
  );

  if (!response.ok) {
    throw new Error(`Sync request to ${path} failed with status ${response.status}`);
  }
}
```

Replace the `syncContribution` method:

```typescript
  async syncContribution(contribution: DatasetContribution): Promise<void> {
    await post('/dataset-contributions', {
      clientId: contribution.id,
      imageUri: contribution.imageUri,
      label: contribution.label,
      note: contribution.note,
      createdAt: contribution.createdAt.toISOString(),
    });
  }
```

with:

```typescript
  async syncContribution(contribution: DatasetContribution): Promise<void> {
    const formData = new FormData();
    formData.append('clientId', contribution.id);
    formData.append('label', contribution.label);
    formData.append('createdAt', contribution.createdAt.toISOString());
    if (contribution.note) {
      formData.append('note', contribution.note);
    }
    const filename = contribution.imageUri.split('/').pop() ?? 'contribution.jpg';
    formData.append('image', {
      uri: contribution.imageUri,
      name: filename,
      type: 'image/jpeg',
    } as unknown as Blob);

    await postMultipart('/dataset-contributions', formData);
  }
```

No `Content-Type` header is set for the multipart request — `fetch`'s React Native implementation sets the correct `multipart/form-data; boundary=...` header automatically when the body is a `FormData` instance; setting it manually would omit the boundary and break the API's multipart parsing.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/api/FastApiSyncClient.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Run the full test suite and typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx jest`
Expected: all PASS.

- [ ] **Step 6: Manually verify against a running API (optional but recommended before merging)**

With `maize-doctor-api` running locally (`docker compose up -d mysql && uvicorn app.main:app --reload`, per that repo's README) and this app's `.env` pointing `EXPO_PUBLIC_API_URL` at it, register a user, add a dataset contribution from the app's Contribute screen, and confirm in the API logs / DB that `POST /dataset-contributions` returns `201`, not `422`/`401`. This is the first time these two repos will have actually talked to each other successfully.

- [ ] **Step 7: Commit**

```bash
git add src/api/FastApiSyncClient.ts src/api/FastApiSyncClient.test.ts
git commit -m "fix(sync): send dataset contributions as multipart/form-data with the image attached"
```

---

### Task 6: Refresh the stale dataset stats in `model-ml.md`

**Files:**
- Modify: `model-ml.md`

**Interfaces:**
- None (documentation only).

**Context:** `model-ml.md` currently states the dataset totals **31,622 imágenes** (3,551 lab + 28,071 real) — a pre-expansion figure. `maize-doctor-classifier/CLAUDE.md` confirms the dataset grew to **33,438** images after an August 2026 expansion (up from 31,623 before). The per-class breakdown table in `model-ml.md` also predates that expansion and must be regenerated from the ML repo's real current data, not guessed — `make summary` in that repo is the existing, documented command for exactly this (`CLAUDE.md`: "conteo de imágenes por clase/entorno").

- [ ] **Step 1: Generate the current per-class/environment counts**

In `maize-doctor-classifier` (a sibling checkout, not this repo), run:

```bash
make summary
```

Expected: prints a per-class, per-environment (`lab`/`real`) image count table reflecting the current `clean/` dataset (33,438 total).

- [ ] **Step 2: Update the total-count line**

In `model-ml.md`, find the line (near the class table):

```markdown
> Conteos post-limpieza y deduplicación en `data/clean/` (junio 2026). Total consolidado: **31 622 imágenes** (3 551 lab + 28 071 campo real). Las marcas "(pocos datos)" señalan las clases con menor cantidad de imágenes disponibles. La clase `aphids_pest` (áfidos del maíz) fue evaluada pero descartada por escasez de datos (~77 imágenes); en su lugar se incorporó `lethal_necrosis`.
```

Replace `31 622 imágenes (3 551 lab + 28 071 campo real)` with the real total and lab/real breakdown from Step 1's `make summary` output, and update `(junio 2026)` to the correct month of that run. Keep the rest of the sentence (the `aphids_pest`/`lethal_necrosis` note) unchanged — that's historical context, not a count.

- [ ] **Step 3: Update the per-class table**

In `model-ml.md`, replace the `Lab`/`Real`/`Total` columns in both class tables (foliar diseases/pests, and nutritional deficiencies) with the real per-class counts from Step 1's `make summary` output. Do not recompute or estimate — copy the tool's actual output. If any class's "(pocos datos)" annotation no longer applies given the new counts, remove it for that class; if a previously-unflagged class now qualifies, add it.

- [ ] **Step 4: Verify the doc renders**

If this repo has a docs build script, run it (check `package.json` for a `docs:build`-style script) and confirm it exits cleanly. If none exists, visually diff the table for markdown table alignment (`|` columns must still line up / parse as a valid table).

- [ ] **Step 5: Commit**

```bash
git add model-ml.md
git commit -m "docs: refresh dataset stats in model-ml.md to the post-expansion counts"
```

---

### Task 7: Fail loudly if a production build still ships `MockInferenceEngine`

**Files:**
- Modify: `src/ml/index.ts`
- Modify: `src/ml/index.test.ts`

**Interfaces:**
- Modifies: `getInferenceEngine()`'s behavior — unchanged in dev builds; throws in production builds (`__DEV__ === false`) when `EXPO_PUBLIC_USE_MOCK_MODEL` isn't exactly `'false'`, instead of silently returning `MockInferenceEngine`.

**Context:** `model-ml.md`'s headline claim is fully-offline on-device inference, but `getInferenceEngine()` defaults to `MockInferenceEngine` (random fake predictions) unless `EXPO_PUBLIC_USE_MOCK_MODEL` is explicitly set to `'false'`. Nothing currently stops a production build from shipping with that flag unset. `src/lib/logger.ts`'s `warn`/`error` are gated on `__DEV__` and are silent no-ops in production, so a log-based warning would never actually be seen in the one build where it matters — the only reliable guard is to throw and make the app crash on launch, which any manual QA pass before a store submission would catch immediately.

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `src/ml/index.test.ts`:

```typescript
jest.mock('./MockInferenceEngine', () => ({ MockInferenceEngine: jest.fn() }));
jest.mock('./TFLiteInferenceEngine', () => ({ TFLiteInferenceEngine: jest.fn() }));

import { MockInferenceEngine } from './MockInferenceEngine';
import { TFLiteInferenceEngine } from './TFLiteInferenceEngine';
import { getInferenceEngine } from './index';

describe('getInferenceEngine', () => {
  const originalEnv = process.env.EXPO_PUBLIC_USE_MOCK_MODEL;
  const originalDev = (global as { __DEV__?: boolean }).__DEV__;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_USE_MOCK_MODEL = originalEnv;
    (global as { __DEV__?: boolean }).__DEV__ = originalDev;
  });

  it('devuelve TFLiteInferenceEngine cuando EXPO_PUBLIC_USE_MOCK_MODEL es exactamente "false"', () => {
    process.env.EXPO_PUBLIC_USE_MOCK_MODEL = 'false';
    (global as { __DEV__?: boolean }).__DEV__ = true;
    getInferenceEngine();
    expect(TFLiteInferenceEngine).toHaveBeenCalled();
    expect(MockInferenceEngine).not.toHaveBeenCalled();
  });

  it('devuelve MockInferenceEngine por defecto en desarrollo (variable sin definir)', () => {
    delete process.env.EXPO_PUBLIC_USE_MOCK_MODEL;
    (global as { __DEV__?: boolean }).__DEV__ = true;
    getInferenceEngine();
    expect(MockInferenceEngine).toHaveBeenCalled();
    expect(TFLiteInferenceEngine).not.toHaveBeenCalled();
  });

  it('lanza un error si un build de produccion sigue usando el modelo mock', () => {
    delete process.env.EXPO_PUBLIC_USE_MOCK_MODEL;
    (global as { __DEV__?: boolean }).__DEV__ = false;

    expect(() => getInferenceEngine()).toThrow(/EXPO_PUBLIC_USE_MOCK_MODEL/);
    expect(MockInferenceEngine).not.toHaveBeenCalled();
  });

  it('no lanza error en produccion cuando EXPO_PUBLIC_USE_MOCK_MODEL es "false"', () => {
    process.env.EXPO_PUBLIC_USE_MOCK_MODEL = 'false';
    (global as { __DEV__?: boolean }).__DEV__ = false;

    expect(() => getInferenceEngine()).not.toThrow();
    expect(TFLiteInferenceEngine).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/ml/index.test.ts`
Expected: the two new tests fail — `getInferenceEngine()` currently never throws and ignores `__DEV__` entirely.

- [ ] **Step 3: Implement the guard**

Replace the full contents of `src/ml/index.ts`:

```typescript
import type { InferenceEngine } from './InferenceEngine';
import { MockInferenceEngine } from './MockInferenceEngine';
import { TFLiteInferenceEngine } from './TFLiteInferenceEngine';

export type { InferenceEngine, InferenceResult } from './InferenceEngine';

export const getInferenceEngine = (): InferenceEngine => {
  const useMock = process.env.EXPO_PUBLIC_USE_MOCK_MODEL !== 'false';

  if (useMock && !__DEV__) {
    throw new Error(
      'EXPO_PUBLIC_USE_MOCK_MODEL must be "false" in a production build - refusing to ship ' +
        'MockInferenceEngine (random fake predictions) to end users.'
    );
  }

  return useMock ? new MockInferenceEngine() : new TFLiteInferenceEngine();
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/ml/index.test.ts`
Expected: all 4 tests PASS.

- [ ] **Step 5: Run the full test suite and typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx jest`
Expected: all PASS (in particular, confirm no other test imports `getInferenceEngine` without setting `__DEV__`/`EXPO_PUBLIC_USE_MOCK_MODEL` in a way that would now unexpectedly throw — `ScanScreen.test.tsx` and similar are the ones to check first since they exercise the scan flow).

- [ ] **Step 6: Commit**

```bash
git add src/ml/index.ts src/ml/index.test.ts
git commit -m "fix(ml): fail loudly instead of silently shipping MockInferenceEngine in production"
```

---

### Task 8: Make the account optional — open the app without logging in

**Files:**
- Modify: `src/auth/AuthContext.tsx`
- Modify: `src/auth/AuthContext.test.tsx`
- Modify: `src/navigation/RootNavigator.tsx`
- Modify: `src/navigation/RootNavigator.test.tsx`
- Modify: `src/navigation/types.ts`
- Modify: `src/screens/profile/ProfileScreen.tsx`

**Interfaces:**
- Produces: `AuthState` gains `isGuest: boolean`. `AppTabParamList` gains an `Auth` route so Profile can push login/register on demand.
- Modifies: `RootNavigator` always renders `AppTabsNavigator`; `AuthNavigator` becomes a pushed stack reachable from Profile instead of the app's entry gate.

**Context:** The app is offline-first by design, and `LocalAuthService` is a purely on-device store — the account is a *sync credential*, not an entry ticket. But `RootNavigator.tsx:132` currently reads `{isAuthenticated ? <AppTabsNavigator /> : <AuthNavigator />}`, with no third branch: a first-run user is walled behind Login/Register before they can reach the camera. That contradicts the offline-first, "no account required" product goal, and it gates the one feature (on-device inference) that provably needs no account at all.

This task inverts the gate rather than adding a "guest mode" flag, because the app is already almost compatible with a null user:

- **No data migration is needed.** The WatermelonDB schema has no `user_id`/`userId` on any table (verified: no matches under `src/data/`). Scans, corrections, and contributions are already device-scoped, not user-scoped, so a scan created before logging in needs no reassignment afterward — it simply syncs once a session exists.
- **The screens already tolerate a null user.** `HomeScreen.tsx:68` uses `user?.name?.split(' ')[0] ?? 'Agricultor'` and `ProfileScreen.tsx:11` uses `user?.name ?? 'Agricultor'`. Neither needs a null-guard added; the fallback copy is already written.

The only behavioral change beyond routing is in `ProfileScreen`, which must offer "Iniciar sesión" when signed out instead of "Cerrar Sesión".

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `src/navigation/RootNavigator.test.tsx`:

```tsx
jest.mock('@/data/database', () => ({
  database: {
    collections: {
      get: jest.fn().mockReturnValue({
        query: jest.fn().mockReturnValue({
          fetch: jest.fn().mockResolvedValue([]),
          fetchCount: jest.fn().mockResolvedValue(0),
          observe: jest.fn().mockReturnValue({ subscribe: jest.fn() }),
        }),
      }),
    },
  },
}));

jest.mock('@/data/seedDevData', () => ({
  seedDevData: jest.fn().mockResolvedValue(undefined),
}));

const mockGetStoredSession = jest.fn();

jest.mock('@/auth/LocalAuthService', () => ({
  LocalAuthService: jest.fn().mockImplementation(() => ({
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    getStoredSession: () => mockGetStoredSession(),
  })),
}));

jest.mock('@/api/RemoteSessionService', () => ({
  remoteSession: {
    login: jest.fn().mockResolvedValue(undefined),
    register: jest.fn().mockResolvedValue(undefined),
    logout: jest.fn().mockResolvedValue(undefined),
  },
}));

import { render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/auth/AuthContext';
import { RootNavigator } from './RootNavigator';

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function renderWithProviders() {
  return render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

describe('RootNavigator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lands on the app tabs without a session, not on the login screen', async () => {
    mockGetStoredSession.mockResolvedValue(null);

    const { queryByText, getByText } = renderWithProviders();

    await waitFor(() => expect(getByText('Hola, Agricultor')).toBeTruthy());
    expect(queryByText('Iniciar Sesion')).toBeNull();
  });

  it('lands on the app tabs when a stored session exists', async () => {
    mockGetStoredSession.mockResolvedValue({
      id: 'u1',
      name: 'Farmer Uno',
      email: 'farmer@example.com',
    });

    const { getByText } = renderWithProviders();

    await waitFor(() => expect(getByText('Hola, Farmer')).toBeTruthy());
  });
});
```

In `src/auth/AuthContext.test.tsx` (created in Task 3), add this test inside the existing `describe` block:

```tsx
  it('reports guest state when there is no stored session', async () => {
    mockGetStoredSession.mockResolvedValue(null);
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isGuest).toBe(true);
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('reports authenticated state once a session exists', async () => {
    mockGetStoredSession.mockResolvedValue({
      id: 'u1',
      name: 'Farmer',
      email: 'farmer@example.com',
    });
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isGuest).toBe(false);
    expect(result.current.isAuthenticated).toBe(true);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/navigation/RootNavigator.test.tsx src/auth/AuthContext.test.tsx`
Expected: the RootNavigator tests fail (a session-less render still shows `'Iniciar Sesion'`, never `'Hola, Agricultor'`), and the two `isGuest` tests fail (`AuthState` has no `isGuest` yet).

- [ ] **Step 3: Add `isGuest` to `AuthContext.tsx`**

In `src/auth/AuthContext.tsx`, add `isGuest` to the `AuthState` interface, right after `isAuthenticated`:

```typescript
  isAuthenticated: boolean;
  isGuest: boolean;
```

and to the provider's `value`, right after the existing `isAuthenticated` entry:

```typescript
        isAuthenticated: user !== null,
        isGuest: user === null,
```

- [ ] **Step 4: Add the `Auth` route to `types.ts`**

In `src/navigation/types.ts`, add an `Auth` entry to `AppTabParamList`:

```typescript
export type AppTabParamList = {
  Home: undefined;
  Scan: undefined;
  History: undefined;
  Profile: undefined;
  Auth: undefined;
};
```

- [ ] **Step 5: Invert the gate in `RootNavigator.tsx`**

Register `AuthNavigator` as a hidden tab screen so Profile can navigate to it. Inside `AppTabsNavigator`, add it after the existing `Profile` screen:

```tsx
      <AppTabs.Screen name="Profile" component={ProfileScreen} />
      <AppTabs.Screen
        name="Auth"
        component={AuthNavigator}
        options={{ tabBarButton: () => null, headerShown: false }}
      />
```

`tabBarButton: () => null` keeps it out of the bottom bar while leaving it reachable via `navigation.navigate('Auth')`.

Then replace the `RootNavigator` body:

```tsx
  return (
    <NavigationContainer>
      {isAuthenticated ? <AppTabsNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
```

with:

```tsx
  return (
    <NavigationContainer>
      <AppTabsNavigator />
    </NavigationContainer>
  );
```

`isAuthenticated` is now unused in this component — remove it from the `useAuth()` destructure, keeping `isLoading` (the splash spinner still waits on the stored-session read):

```tsx
  const { isLoading } = useAuth();
```

- [ ] **Step 6: Offer sign-in from `ProfileScreen`**

In `src/screens/profile/ProfileScreen.tsx`, take `isGuest` and the tab navigation:

```tsx
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { AppTabParamList } from '@/navigation/types';
```

```tsx
  const { user, logout, isGuest } = useAuth();
  const navigation = useNavigation<BottomTabNavigationProp<AppTabParamList>>();
```

Replace the logout `Pressable` at the bottom of the Configuración card with a branch on `isGuest`:

```tsx
          {isGuest ? (
            <Pressable
              className="flex-row items-center px-4"
              style={{ height: 48 }}
              onPress={() => navigation.navigate('Auth')}
            >
              <View className="flex-row items-center">
                <Icon name="login" size={22} color="#012d1d" />
                <Text
                  className="font-inter text-lg ml-4"
                  style={{ color: '#012d1d', fontWeight: '600' }}
                >
                  Iniciar Sesion
                </Text>
              </View>
            </Pressable>
          ) : (
            <Pressable className="flex-row items-center px-4" style={{ height: 48 }} onPress={logout}>
              <View className="flex-row items-center">
                <Icon name="logout" size={22} color="#ba1a1a" />
                <Text
                  className="font-inter text-lg ml-4"
                  style={{ color: '#ba1a1a', fontWeight: '600' }}
                >
                  Cerrar Sesion
                </Text>
              </View>
            </Pressable>
          )}
```

Add a line of guest-facing copy explaining what an account buys, directly above the Configuración card's closing `</View>`:

```tsx
      {isGuest ? (
        <Text className="font-inter text-body-md text-on-surface-variant px-1 mt-2">
          Tu cuenta solo sirve para sincronizar tus aportes cuando haya internet. Puedes escanear y
          revisar tu historial sin iniciar sesion.
        </Text>
      ) : null}
```

- [ ] **Step 7: Return to the app after a successful login**

`LoginScreen` and `RegisterScreen` previously relied on the root gate swapping the whole tree on success. Now that `AppTabsNavigator` is always mounted, a successful login inside the pushed `Auth` stack must pop back explicitly.

In `src/screens/auth/LoginScreen.tsx`, extend `handleLogin`'s success branch:

```tsx
    if (!result.success && result.error) {
      setServerError(result.error);
    }
```

to:

```tsx
    if (result.success) {
      navigation.getParent()?.navigate('Profile');
      return;
    }

    if (result.error) {
      setServerError(result.error);
    }
```

Apply the same change to `RegisterScreen.tsx`'s submit handler success branch.

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx jest src/navigation src/auth src/screens/auth src/screens/profile`
Expected: all PASS, including `LoginScreen.test.tsx`. If `LoginScreen.test.tsx` asserted anything about post-login navigation via the old root swap, update that assertion to the `getParent()?.navigate('Profile')` behavior rather than reverting Step 7.

- [ ] **Step 9: Typecheck and run the full test suite**

Run: `npx tsc --noEmit`
Expected: no errors (confirms the `Auth` route addition and the removed `isAuthenticated` destructure are consistent).

Run: `npx jest`
Expected: all PASS.

- [ ] **Step 10: Manually verify the offline-first guarantee end to end**

On a device or emulator with **airplane mode on** and no stored session:

1. Launch the app — it must land on Home ("Hola, Agricultor"), not on Login.
2. Run a scan and confirm a diagnosis is produced (on-device inference, no account, no network).
3. Open History and confirm the scan is listed.
4. Open Profile and confirm it offers "Iniciar Sesion", not "Cerrar Sesion".
5. Turn airplane mode off, sign in, and confirm the queued scan's correction/contribution syncs on the next connectivity transition.

- [ ] **Step 11: Commit**

```bash
git add src/auth/AuthContext.tsx src/auth/AuthContext.test.tsx src/navigation/RootNavigator.tsx src/navigation/RootNavigator.test.tsx src/navigation/types.ts src/screens/profile/ProfileScreen.tsx src/screens/auth/LoginScreen.tsx src/screens/auth/RegisterScreen.tsx
git commit -m "feat(auth): make the account optional so the app opens without logging in"
```
