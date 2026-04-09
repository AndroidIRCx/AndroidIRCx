/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import {
  HelpScreenBase,
  HelpSection,
  HelpSubsection,
  HelpParagraph,
  HelpBullet,
  HelpCode,
  HelpInfoBox,
  HelpWarningBox,
  HelpSuccessBox,
} from '../../../src/screens/help/HelpScreenBase';

jest.mock('../../../src/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      surface: '#eee',
      text: '#111',
      border: '#ddd',
      primary: '#09f',
      messageBackground: '#f5f5f5',
    },
  }),
}));

jest.mock('../../../src/i18n/transifex', () => ({
  useT: () => (key: string) => key,
}));

describe('HelpScreenBase', () => {
  it('renders nothing when base screen is not visible', () => {
    const { queryByText } = render(
      <HelpScreenBase visible={false} onClose={jest.fn()} title="Help">
        <HelpParagraph>Hidden body</HelpParagraph>
      </HelpScreenBase>,
    );

    expect(queryByText('Help')).toBeNull();
  });

  it('renders base layout and content when visible', () => {
    const { getByText } = render(
      <HelpScreenBase visible onClose={jest.fn()} title="Help">
        <HelpSection title="Section title">
          <HelpSubsection title="Subsection title">
            <HelpParagraph>Paragraph text</HelpParagraph>
            <HelpBullet>Bullet text</HelpBullet>
            <HelpCode>Code text</HelpCode>
          </HelpSubsection>
        </HelpSection>
        <HelpInfoBox>Info text</HelpInfoBox>
        <HelpWarningBox>Warning text</HelpWarningBox>
        <HelpSuccessBox>Success text</HelpSuccessBox>
      </HelpScreenBase>,
    );

    expect(getByText('Help')).toBeTruthy();
    expect(getByText('Close')).toBeTruthy();
    expect(getByText('Section title')).toBeTruthy();
    expect(getByText('Subsection title')).toBeTruthy();
    expect(getByText('Paragraph text')).toBeTruthy();
    expect(getByText('• Bullet text')).toBeTruthy();
    expect(getByText('Code text')).toBeTruthy();
    expect(getByText('Info text')).toBeTruthy();
    expect(getByText('Warning text')).toBeTruthy();
    expect(getByText('Success text')).toBeTruthy();
  });

  it('calls onClose when base close button is pressed', () => {
    const onClose = jest.fn();
    const { getByLabelText } = render(
      <HelpScreenBase visible onClose={onClose} title="Help">
        <HelpParagraph>Body</HelpParagraph>
      </HelpScreenBase>,
    );

    fireEvent.press(getByLabelText('Close help screen'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
