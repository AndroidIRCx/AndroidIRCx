/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { StyleProp, StyleSheet, Text, TextStyle } from 'react-native';
import QRCode, { QRCodeProps } from 'react-native-qrcode-svg';

type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

/**
 * Bytes the largest QR code (version 40) holds in byte mode, per error correction
 * level. Byte mode can encode any string, and the encoder never picks a larger
 * encoding than byte mode, so a value within this size always fits.
 */
const QR_BYTE_CAPACITY: Record<ErrorCorrectionLevel, number> = {
  L: 2953,
  M: 2331,
  Q: 1663,
  H: 1273,
};

export const utf8ByteLength = (value: string): number => {
  let bytes = 0;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x80) {
      bytes += 1;
    } else if (code < 0x800) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff) {
      // Surrogate pair: one 4-byte code point.
      bytes += 4;
      i++;
    } else {
      bytes += 3;
    }
  }
  return bytes;
};

export const fitsInQRCode = (
  value: string,
  ecl: ErrorCorrectionLevel = 'M',
): boolean => utf8ByteLength(value) <= QR_BYTE_CAPACITY[ecl];

interface SafeQRCodeProps extends QRCodeProps {
  value: string;
  /** Shown instead of the code when the value is too large for a QR code. */
  tooLargeMessage: string;
  tooLargeTextStyle?: StyleProp<TextStyle>;
}

/**
 * react-native-qrcode-svg throws from render ("The amount of data is too big to
 * be stored in a QR Code") when the value does not fit, which crashed the app
 * from the theme editor's share code. This checks the size first and shows a
 * message instead. The onError fallback keeps any other encoder error from
 * escaping render too (the library then draws nothing).
 */
const SafeQRCode: React.FC<SafeQRCodeProps> = ({
  tooLargeMessage,
  tooLargeTextStyle,
  onError,
  ...qrProps
}) => {
  if (!fitsInQRCode(qrProps.value, qrProps.ecl ?? 'M')) {
    return (
      <Text
        testID="safe-qr-too-large"
        style={[styles.tooLarge, tooLargeTextStyle]}
      >
        {tooLargeMessage}
      </Text>
    );
  }
  return <QRCode {...qrProps} onError={onError ?? ignoreEncodeError} />;
};

const ignoreEncodeError = () => {};

const styles = StyleSheet.create({
  tooLarge: {
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    lineHeight: 20,
  },
});

export default SafeQRCode;
