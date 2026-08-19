import { describeSyncOutcome, toneForOutcome } from './syncMessages';

describe('describeSyncOutcome', () => {
  it('confirms the upload when everything synced', () => {
    const message = describeSyncOutcome({ status: 'synced', synced: 1, failed: 0 });
    expect(message.title).toBe('Guardado y sincronizado');
  });

  it('tells the user to sign in when there is no session', () => {
    const message = describeSyncOutcome({ status: 'unauthenticated', synced: 0, failed: 0 });
    expect(message.body).toContain('Inicia sesión');
  });

  it('makes clear the record is kept on device when offline', () => {
    const message = describeSyncOutcome({ status: 'offline', synced: 0, failed: 0 });
    expect(message.body).toContain('se enviará cuando vuelvas a tener internet');
  });

  it('reports both counts on a partial sync', () => {
    const message = describeSyncOutcome({ status: 'partial', synced: 2, failed: 1 });
    expect(message.body).toContain('2');
    expect(message.body).toContain('1');
  });

  it('never implies data loss for any outcome', () => {
    const outcomes = [
      { status: 'synced', synced: 1, failed: 0 },
      { status: 'partial', synced: 1, failed: 1 },
      { status: 'offline', synced: 0, failed: 0 },
      { status: 'unauthenticated', synced: 0, failed: 0 },
      { status: 'no-backend', synced: 0, failed: 0 },
      { status: 'nothing-pending', synced: 0, failed: 0 },
    ] as const;

    for (const outcome of outcomes) {
      const message = describeSyncOutcome(outcome);
      expect(message.title).toMatch(/Guardado/);
      expect(message.body.length).toBeGreaterThan(0);
    }
  });

  it('maps outcomes to the matching dialog tone', () => {
    expect(toneForOutcome({ status: 'synced', synced: 1, failed: 0 })).toBe('success');
    expect(toneForOutcome({ status: 'partial', synced: 1, failed: 1 })).toBe('warning');
    expect(toneForOutcome({ status: 'unauthenticated', synced: 0, failed: 0 })).toBe('warning');
    expect(toneForOutcome({ status: 'offline', synced: 0, failed: 0 })).toBe('info');
  });
});
