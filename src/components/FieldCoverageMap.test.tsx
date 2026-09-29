import { render, fireEvent } from '@testing-library/react-native';
import { FieldCoverageMap, type MapScan } from './FieldCoverageMap';

const MOCK_SCANS: MapScan[] = [
  {
    id: 'scan-1',
    label: 'healthy',
    confidence: 0.95,
    createdAt: Date.now() - 10000,
    lat: 13.6923,
    lon: -89.1923,
  },
  {
    id: 'scan-2',
    label: 'fall_armyworm',
    confidence: 0.88,
    createdAt: Date.now(),
    lat: 13.7023,
    lon: -89.2023,
  },
];

describe('FieldCoverageMap', () => {
  it('renders MapView with markers for geolocalized scans', async () => {
    const { getByTestId } = await render(<FieldCoverageMap scans={MOCK_SCANS} />);

    expect(getByTestId('field-coverage-map')).toBeTruthy();
    expect(getByTestId('map-marker-scan-1')).toBeTruthy();
    expect(getByTestId('map-marker-scan-2')).toBeTruthy();
  });

  it('renders the badge count with the correct number of scans', async () => {
    const { getByText } = await render(<FieldCoverageMap scans={MOCK_SCANS} />);

    expect(getByText('2 escaneos geolocalizados')).toBeTruthy();
  });

  it('toggles map type between satellite and standard when button is pressed', async () => {
    const { getByLabelText, findByText, getByText } = await render(
      <FieldCoverageMap scans={MOCK_SCANS} />
    );

    expect(getByText('Satelital')).toBeTruthy();
    await fireEvent.press(getByLabelText('Cambiar tipo de mapa'));
    expect(await findByText('Estándar')).toBeTruthy();
  });

  it('shows empty state overlay when there are no scans', async () => {
    const { getByText, queryByTestId } = await render(<FieldCoverageMap scans={[]} />);

    expect(getByText('Sin escaneos geolocalizados')).toBeTruthy();
    expect(getByText('0 escaneos geolocalizados')).toBeTruthy();
    expect(queryByTestId('map-marker-scan-1')).toBeNull();
  });

  it('invokes onSelectScan when callout or marker is triggered', async () => {
    const onSelectScan = jest.fn();
    const { getByTestId } = await render(
      <FieldCoverageMap scans={MOCK_SCANS} onSelectScan={onSelectScan} />
    );

    // Callout press
    const marker = getByTestId('map-marker-scan-1');
    marker.props.onCalloutPress();
    expect(onSelectScan).toHaveBeenCalledWith('scan-1');
  });
});
