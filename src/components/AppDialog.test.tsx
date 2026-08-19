import { render, fireEvent } from '@testing-library/react-native';
import { AppDialog } from './AppDialog';

describe('AppDialog', () => {
  it('renders the title and body when visible', async () => {
    const { findByText } = await render(
      <AppDialog visible title="Guardado" body="Tu aporte se envió." onDismiss={jest.fn()} />
    );

    expect(await findByText('Guardado')).toBeTruthy();
    expect(await findByText('Tu aporte se envió.')).toBeTruthy();
  });

  it('renders nothing when not visible', async () => {
    const { queryByText } = await render(
      <AppDialog visible={false} title="Guardado" body="Cuerpo" onDismiss={jest.fn()} />
    );

    expect(queryByText('Guardado')).toBeNull();
  });

  it('calls onDismiss when the confirm button is pressed', async () => {
    const onDismiss = jest.fn();
    const { getByLabelText } = await render(
      <AppDialog visible title="Guardado" body="Cuerpo" onDismiss={onDismiss} />
    );

    fireEvent.press(getByLabelText('Entendido'));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('shows the tone-specific icon for a success dialog', async () => {
    const { findByLabelText } = await render(
      <AppDialog visible tone="success" title="Listo" body="Cuerpo" onDismiss={jest.fn()} />
    );

    expect(await findByLabelText('Operación exitosa')).toBeTruthy();
  });

  it('shows the tone-specific icon for a warning dialog', async () => {
    const { findByLabelText } = await render(
      <AppDialog visible tone="warning" title="Atención" body="Cuerpo" onDismiss={jest.fn()} />
    );

    expect(await findByLabelText('Advertencia')).toBeTruthy();
  });
});
