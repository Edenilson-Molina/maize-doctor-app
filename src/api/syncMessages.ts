import type { SyncOutcome } from './syncQueue';

interface SyncMessage {
  title: string;
  body: string;
}

/**
 * Turns a sync outcome into the message shown to the user after saving a record.
 *
 * Every outcome makes clear that the record is already stored on the device, so a
 * failed upload never reads as lost data.
 *
 * @param {SyncOutcome} outcome Result returned by `trySyncNow`.
 * @returns {SyncMessage} Title and body to display.
 */
export function describeSyncOutcome(outcome: SyncOutcome): SyncMessage {
  switch (outcome.status) {
    case 'synced':
      return {
        title: 'Guardado y sincronizado',
        body:
          outcome.synced === 1
            ? 'Tu aporte se envió al servidor.'
            : `Se enviaron ${outcome.synced} aportes al servidor.`,
      };
    case 'partial':
      return {
        title: 'Guardado, sincronización incompleta',
        body: `Se enviaron ${outcome.synced}, pero ${outcome.failed} quedaron pendientes. Se reintentará más tarde.`,
      };
    case 'offline':
      return {
        title: 'Guardado sin conexión',
        body: 'Tu aporte quedó en este dispositivo y se enviará cuando vuelvas a tener internet.',
      };
    case 'unauthenticated':
      return {
        title: 'Guardado en el dispositivo',
        body: 'Inicia sesión desde tu perfil para enviar tus aportes al servidor.',
      };
    case 'no-backend':
      return {
        title: 'Guardado en el dispositivo',
        body: 'No hay un servidor configurado, así que tu aporte solo se guarda aquí.',
      };
    case 'nothing-pending':
      return {
        title: 'Guardado',
        body: 'Tu aporte quedó registrado en este dispositivo.',
      };
  }
}
