/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import QRCode from 'react-native-qrcode-svg';
import SafeQRCode, {
  fitsInQRCode,
  utf8ByteLength,
} from '../../src/components/SafeQRCode';

// The shared jest.setup mock renders a raw "QRCode" string, which the test
// renderer rejects outside <Text>; a null-rendering spy is enough here.
jest.mock('react-native-qrcode-svg', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

const mockQRCode = QRCode as unknown as jest.Mock;

describe('utf8ByteLength', () => {
  it('counts 1-, 2-, 3- and 4-byte characters', () => {
    expect(utf8ByteLength('')).toBe(0);
    expect(utf8ByteLength('abc')).toBe(3);
    expect(utf8ByteLength('š')).toBe(2);
    expect(utf8ByteLength('漢')).toBe(3);
    expect(utf8ByteLength('😀')).toBe(4);
    expect(utf8ByteLength('a😀b')).toBe(6);
  });
});

describe('fitsInQRCode', () => {
  it('uses the version-40 byte capacity of each error correction level', () => {
    expect(fitsInQRCode('x'.repeat(2331))).toBe(true);
    expect(fitsInQRCode('x'.repeat(2332))).toBe(false);
    expect(fitsInQRCode('x'.repeat(1273), 'H')).toBe(true);
    expect(fitsInQRCode('x'.repeat(1274), 'H')).toBe(false);
    expect(fitsInQRCode('x'.repeat(2953), 'L')).toBe(true);
    expect(fitsInQRCode('x'.repeat(1664), 'Q')).toBe(false);
  });

  it('measures multi-byte text in bytes, not characters', () => {
    // 700 Cyrillic letters = 1400 bytes: fits M, not H.
    expect(fitsInQRCode('ж'.repeat(700))).toBe(true);
    expect(fitsInQRCode('ж'.repeat(700), 'H')).toBe(false);
  });
});

describe('SafeQRCode', () => {
  beforeEach(() => {
    mockQRCode.mockClear();
  });

  it('renders the QR code with its props when the value fits', async () => {
    const { queryByTestId } = await render(
      <SafeQRCode
        value="encdm-bundle"
        size={200}
        ecl="H"
        tooLargeMessage="too large"
      />,
    );
    expect(queryByTestId('safe-qr-too-large')).toBeNull();
    const props = mockQRCode.mock.calls[0][0];
    expect(props).toMatchObject({ value: 'encdm-bundle', size: 200, ecl: 'H' });
    // A default onError keeps any encoder error from escaping render.
    expect(typeof props.onError).toBe('function');
    expect(() => props.onError(new Error('boom'))).not.toThrow();
    expect(props.tooLargeMessage).toBeUndefined();
  });

  it('passes a caller onError through', async () => {
    const onError = jest.fn();
    await render(
      <SafeQRCode value="x" size={100} onError={onError} tooLargeMessage="t" />,
    );
    expect(mockQRCode.mock.calls[0][0].onError).toBe(onError);
  });

  it('shows the message instead of crashing when the value is too large', async () => {
    const { getByTestId } = await render(
      <SafeQRCode
        value={'x'.repeat(1274)}
        size={200}
        ecl="H"
        tooLargeMessage="Your key is too large for a QR code."
        tooLargeTextStyle={{ color: '#123456' }}
      />,
    );
    const message = getByTestId('safe-qr-too-large');
    expect(message.props.children).toBe('Your key is too large for a QR code.');
    expect(message.props.style).toEqual(
      expect.arrayContaining([{ color: '#123456' }]),
    );
    expect(mockQRCode).not.toHaveBeenCalled();
  });
});
