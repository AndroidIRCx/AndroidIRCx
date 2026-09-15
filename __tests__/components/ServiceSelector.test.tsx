import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ServiceSelector } from '../../src/components/ServiceSelector';

jest.mock('../../src/i18n/localization', () => ({
  useT: () => (key: string, params?: Record<string, string>) => {
    if (key === 'Detected: {service}' && params?.service) {
      return `Detected: ${params.service}`;
    }
    return key;
  },
}));

const colors = {
  text: '#111111',
  textSecondary: '#666666',
  primary: '#2A7FFF',
  surface: '#FFFFFF',
  border: '#DDDDDD',
  background: '#F5F5F5',
};

describe('ServiceSelector', () => {
  it('renders detected service for auto mode', async () => {
    const { getByText } = await render(
      <ServiceSelector
        value="auto"
        onChange={jest.fn()}
        detectedType="anope"
        colors={colors}
      />,
    );

    expect(getByText('Auto (anope)')).toBeTruthy();
  });

  it('opens modal and selects a concrete service', async () => {
    const onChange = jest.fn();
    const { getByText, queryByText } = await render(
      <ServiceSelector
        value="auto"
        onChange={onChange}
        detectedType={null}
        colors={colors}
      />,
    );

    await fireEvent.press(getByText('IRC Service Type'));
    expect(getByText('Select IRC Service')).toBeTruthy();

    await fireEvent.press(getByText('Anope'));

    expect(onChange).toHaveBeenCalledWith('anope');
    expect(queryByText('Select IRC Service')).toBeNull();
  });

  it('does not open modal when disabled', async () => {
    const { getByText, queryByText } = await render(
      <ServiceSelector
        value="generic"
        onChange={jest.fn()}
        detectedType={null}
        colors={colors}
        disabled
      />,
    );

    await fireEvent.press(getByText('IRC Service Type'));
    expect(queryByText('Select IRC Service')).toBeNull();
  });

  it('renders current non-auto selection label', async () => {
    const { getByText } = await render(
      <ServiceSelector
        value="quakenet"
        onChange={jest.fn()}
        detectedType="anope"
        colors={colors}
      />,
    );

    expect(getByText('QuakeNet Q')).toBeTruthy();
  });
});
