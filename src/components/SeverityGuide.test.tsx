import { fireEvent, render } from '@testing-library/react-native';
import { SeverityGuide } from './SeverityGuide';
import { SEVERITY_DISCLAIMER, SEVERITY_GUIDE } from '@/content/severity';

describe('SeverityGuide', () => {
  it('renders every level title collapsed by default', async () => {
    const guide = SEVERITY_GUIDE.common_rust;
    const { findByText, queryByText } = await render(<SeverityGuide label="common_rust" />);

    for (const level of guide.levels) {
      expect(await findByText(level.title)).toBeTruthy();
      expect(await findByText(level.extent)).toBeTruthy();
    }
    expect(queryByText(guide.levels[0].signs[0])).toBeNull();
  });

  it('shows the disclaimer that the model does not measure the level', async () => {
    const { findByText } = await render(<SeverityGuide label="common_rust" />);

    expect(await findByText(SEVERITY_DISCLAIMER)).toBeTruthy();
  });

  it('expands signs and actions when a level is pressed', async () => {
    const level = SEVERITY_GUIDE.common_rust.levels[1];
    const { findByText, getByLabelText } = await render(<SeverityGuide label="common_rust" />);

    await fireEvent.press(getByLabelText(`Nivel 2: ${level.title}`));

    expect(await findByText(level.signs[0])).toBeTruthy();
    expect(await findByText(level.actions[0])).toBeTruthy();
    expect(await findByText(level.scientificScale)).toBeTruthy();
  });

  it('collapses a level when it is pressed twice', async () => {
    const level = SEVERITY_GUIDE.common_rust.levels[0];
    const { getByLabelText, queryByText } = await render(<SeverityGuide label="common_rust" />);

    await fireEvent.press(getByLabelText(`Nivel 1: ${level.title}`));
    await fireEvent.press(getByLabelText(`Nivel 1: ${level.title}`));

    expect(queryByText(level.signs[0])).toBeNull();
  });

  it('keeps only one level expanded at a time', async () => {
    const [first, second] = SEVERITY_GUIDE.common_rust.levels;
    const { findByText, getByLabelText, queryByText } = await render(
      <SeverityGuide label="common_rust" />,
    );

    await fireEvent.press(getByLabelText(`Nivel 1: ${first.title}`));
    await fireEvent.press(getByLabelText(`Nivel 2: ${second.title}`));

    expect(queryByText(first.signs[0])).toBeNull();
    expect(await findByText(second.signs[0])).toBeTruthy();
  });

  it('renders the two monitoring states for a healthy leaf', async () => {
    const { findByText } = await render(<SeverityGuide label="healthy" />);

    for (const level of SEVERITY_GUIDE.healthy.levels) {
      expect(await findByText(level.title)).toBeTruthy();
    }
  });
});
