import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ServiceSelector } from '../../src/components/ServiceSelector';

jest.mock('../../src/i18n/transifex', () => ({
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
  it('renders detected service for auto mode', () => {
    const { getByText } = render(
      <ServiceSelector
        value="auto"
        onChange={jest.fn()}
        detectedType="anope"
        colors={colors}
      />
    );

    expect(getByText('Auto (anope)')).toBeTruthy();
  });

  it('opens modal and selects a concrete service', () => {
    const onChange = jest.fn();
    const { getByText, queryByText } = render(
      <ServiceSelector
        value="auto"
        onChange={onChange}
        detectedType={null}
        colors={colors}
      />
    );

    fireEvent.press(getByText('IRC Service Type'));
    expect(getByText('Select IRC Service')).toBeTruthy();

    fireEvent.press(getByText('Anope'));

    expect(onChange).toHaveBeenCalledWith('anope');
    expect(queryByText('Select IRC Service')).toBeNull();
  });

  it('does not open modal when disabled', () => {
    const { getByText, queryByText } = render(
      <ServiceSelector
        value="generic"
        onChange={jest.fn()}
        detectedType={null}
        colors={colors}
        disabled
      />
    );

    fireEvent.press(getByText('IRC Service Type'));
    expect(queryByText('Select IRC Service')).toBeNull();
  });

  it('renders current non-auto selection label', () => {
    const { getByText } = render(
      <ServiceSelector
        value="quakenet"
        onChange={jest.fn()}
        detectedType="anope"
        colors={colors}
      />
    );

    expect(getByText('QuakeNet Q')).toBeTruthy();
  });
});
