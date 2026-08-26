import { useCallback, useEffect, useState } from 'react';
import { checkForUpdate, type AppUpdateInfo } from '@/api/AppUpdateService';

interface AppUpdateState {
  info: AppUpdateInfo | null;
  required: boolean;
  visible: boolean;
  dismiss: () => void;
}

/**
 * Checks once per launch whether a newer release is available.
 *
 * A required update cannot be dismissed, so `dismiss` only hides an optional one.
 *
 * @returns {AppUpdateState} Release details and the prompt's visibility.
 */
export function useAppUpdate(): AppUpdateState {
  const [info, setInfo] = useState<AppUpdateInfo | null>(null);
  const [required, setRequired] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let active = true;

    checkForUpdate().then((result) => {
      if (!active) return;
      if (result.status === 'optional' || result.status === 'required') {
        setInfo(result.info);
        setRequired(result.status === 'required');
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const dismiss = useCallback(() => setDismissed(true), []);

  return {
    info,
    required,
    visible: info !== null && (required || !dismissed),
    dismiss,
  };
}
