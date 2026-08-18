import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { ScanDetail } from './ScanDetail';

const mockGetScanById = jest.fn();
const mockCreateCorrection = jest.fn().mockResolvedValue(undefined);
let correctionsSubscriber: ((corrections: unknown[]) => void) | null = null;

const mockTrySyncNow = jest.fn();
const mockAlert = jest.fn();

jest.mock('@/api/syncQueue', () => ({
  trySyncNow: () => mockTrySyncNow(),
}));

jest.mock('@/data/queries/scanQueries', () => ({
  getScanById: (id: string) => mockGetScanById(id),
}));

jest.mock('@/data/queries/correctionQueries', () => ({
  createCorrection: (data: unknown) => mockCreateCorrection(data),
  observeCorrectionsForScan: () => ({
    subscribe: (callback: (corrections: unknown[]) => void) => {
      correctionsSubscriber = callback;
      callback([]);
      return { unsubscribe: jest.fn() };
    },
  }),
}));

const fakeScan = {
  id: 'scan-1',
  imageUri: 'file:///document/scans/scan_1.jpg',
  label: 'common_rust',
  confidence: 0.82,
  lat: null,
  lon: null,
  temperature: null,
  humidity: null,
  createdAt: new Date('2026-08-10T08:30:00'),
};

function renderScanDetail() {
  const navigation = { goBack: jest.fn() };
  const route = { key: 'ScanDetail', name: 'ScanDetail' as const, params: { scanId: 'scan-1' } };
  return render(<ScanDetail route={route} navigation={navigation as never} />);
}

describe('ScanDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation((...args) => mockAlert(...args));
    mockTrySyncNow.mockResolvedValue({ status: 'synced', synced: 1, failed: 0 });
    correctionsSubscriber = null;
    mockGetScanById.mockResolvedValue(fakeScan);
  });

  it('shows the diagnosis and N/D for missing environmental readings', async () => {
    const { findByText, findAllByText } = await renderScanDetail();

    expect(
      await findByText(
        'Puccinia sorghi — pustulas pequenas de color marron-rojizo en ambas caras de la hoja.',
      ),
    ).toBeTruthy();
    expect(await findAllByText('N/D')).toHaveLength(2);
  });

  it('submits feedback with the selected observed label and note', async () => {
    const { findByText, getByPlaceholderText, getByLabelText } = await renderScanDetail();
    await findByText('¿Dudas con el resultado?');

    await fireEvent.press(getByLabelText('Tizon Foliar del Norte'));
    await fireEvent.changeText(
      getByPlaceholderText(/pústulas parecen diferentes/),
      'Veo insectos, no manchas',
    );
    await fireEvent.press(getByLabelText('Enviar Retroalimentación'));

    await waitFor(() =>
      expect(mockCreateCorrection).toHaveBeenCalledWith({
        scanId: 'scan-1',
        observedLabel: 'northern_corn_leaf_blight',
        note: 'Veo insectos, no manchas',
      }),
    );
  });

  it('hides the form and shows a pending badge once a correction exists', async () => {
    const { findByText, queryByText } = await renderScanDetail();
    await findByText('¿Dudas con el resultado?');

    await act(() => {
      correctionsSubscriber?.([
        {
          id: 'correction-1',
          status: 'pending',
          createdAt: new Date('2026-08-10T08:35:00'),
        },
      ]);
    });

    expect(await findByText('Estado de Validación')).toBeTruthy();
    expect(await findByText('Pendiente')).toBeTruthy();
    expect(await findByText('Esperando revisión de experto')).toBeTruthy();
    expect(queryByText('¿Dudas con el resultado?')).toBeNull();
  });

  it('shows a reviewed timeline event when the correction status is reviewed', async () => {
    const { findByText } = await renderScanDetail();
    await findByText('¿Dudas con el resultado?');

    await act(() => {
      correctionsSubscriber?.([
        {
          id: 'correction-1',
          status: 'reviewed',
          createdAt: new Date('2026-08-10T08:35:00'),
        },
      ]);
    });

    expect(await findByText('Revisado')).toBeTruthy();
    expect(await findByText('Revisado por un experto')).toBeTruthy();
  });
});

describe('ScanDetail sync feedback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation((...args) => mockAlert(...args));
    mockTrySyncNow.mockResolvedValue({ status: 'synced', synced: 1, failed: 0 });
    correctionsSubscriber = null;
    mockGetScanById.mockResolvedValue(fakeScan);
  });

  it('triggers a sync attempt after saving the correction', async () => {
    const { findByLabelText, getByLabelText } = await renderScanDetail();

    await fireEvent.press(getByLabelText('Roya Comun'));
    await fireEvent.press(await findByLabelText('Enviar Retroalimentación'));

    await waitFor(() => expect(mockCreateCorrection).toHaveBeenCalled());
    await waitFor(() => expect(mockTrySyncNow).toHaveBeenCalledTimes(1));
  });

  it('tells the user to sign in when there is no session', async () => {
    mockTrySyncNow.mockResolvedValue({ status: 'unauthenticated', synced: 0, failed: 0 });
    const { findByLabelText, getByLabelText } = await renderScanDetail();

    await fireEvent.press(getByLabelText('Roya Comun'));
    await fireEvent.press(await findByLabelText('Enviar Retroalimentación'));

    await waitFor(() => expect(mockAlert).toHaveBeenCalled());
    expect(mockAlert.mock.calls[0][1]).toContain('Inicia sesión');
  });
});
