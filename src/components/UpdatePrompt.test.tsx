import { Linking } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { UpdatePrompt } from './UpdatePrompt';

const info = {
  latestVersionCode: 9,
  latestVersionName: '1.2.0',
  minSupportedVersionCode: 4,
  forceUpdate: false,
  downloadUrl: 'https://releases.test/app-1.2.0.apk',
  releaseNotes: 'Se corrigieron errores de sincronización.',
};

describe('UpdatePrompt', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
  });

  it('renders nothing when there is no release to offer', async () => {
    const { toJSON } = await render(
      <UpdatePrompt visible info={null} required={false} onDismiss={jest.fn()} />
    );

    expect(toJSON()).toBeNull();
  });

  it('announces the available version and its notes', async () => {
    const { getByText } = await render(
      <UpdatePrompt visible info={info} required={false} onDismiss={jest.fn()} />
    );

    expect(getByText('Nueva versión disponible')).toBeTruthy();
    expect(getByText('Ya está disponible la versión 1.2.0.')).toBeTruthy();
    expect(getByText(info.releaseNotes)).toBeTruthy();
  });

  it('opens the download url when the user accepts', async () => {
    const { getByLabelText } = await render(
      <UpdatePrompt visible info={info} required={false} onDismiss={jest.fn()} />
    );

    fireEvent.press(getByLabelText('Descargar actualización'));

    expect(Linking.openURL).toHaveBeenCalledWith(info.downloadUrl);
  });

  it('lets the user postpone an optional update', async () => {
    const onDismiss = jest.fn();
    const { getByLabelText } = await render(
      <UpdatePrompt visible info={info} required={false} onDismiss={onDismiss} />
    );

    fireEvent.press(getByLabelText('Ahora no'));

    expect(onDismiss).toHaveBeenCalled();
  });

  it('offers no way out of a required update', async () => {
    const { queryByLabelText, getByText } = await render(
      <UpdatePrompt visible info={info} required onDismiss={jest.fn()} />
    );

    expect(getByText('Actualización requerida')).toBeTruthy();
    expect(queryByLabelText('Ahora no')).toBeNull();
  });

  it('omits the notes section when the release has none', async () => {
    const { queryByText } = await render(
      <UpdatePrompt
        visible
        info={{ ...info, releaseNotes: null }}
        required={false}
        onDismiss={jest.fn()}
      />
    );

    expect(queryByText(info.releaseNotes)).toBeNull();
  });
});
