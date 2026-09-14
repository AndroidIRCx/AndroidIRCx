/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NativeModules, DeviceEventEmitter } from 'react-native';

const mockNfc = {
  isSupported: jest.fn(),
  isEnabled: jest.fn(),
  start: jest.fn(),
  goToNfcSetting: jest.fn(),
  requestTechnology: jest.fn(),
  writeNdefMessage: jest.fn(),
  getTag: jest.fn(),
  cancelTechnologyRequest: jest.fn(),
};

jest.mock('react-native-nfc-manager', () => ({
  __esModule: true,
  default: mockNfc,
  NfcTech: { Ndef: 'Ndef' },
  Ndef: {
    encodeMessage: jest.fn(() => [1, 2, 3]),
    textRecord: jest.fn(() => ({})),
    text: { decodePayload: jest.fn(() => 'decoded-key') },
  },
}));

const t = (k: string) => k;

const hceMock = {
  isSupported: jest.fn(),
  startSharing: jest.fn(),
  stopSharing: jest.fn(),
};

function loadHelper(withHce: boolean) {
  let mod: typeof import('../../src/utils/nfcKeyExchange');
  jest.isolateModules(() => {
    if (withHce) {
      (NativeModules as Record<string, unknown>).NfcHce = hceMock;
    } else {
      delete (NativeModules as Record<string, unknown>).NfcHce;
    }
    mod = require('../../src/utils/nfcKeyExchange');
  });
  // @ts-expect-error assigned inside isolateModules
  return mod;
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

beforeEach(() => {
  jest.clearAllMocks();
  mockNfc.isSupported.mockResolvedValue(true);
  mockNfc.isEnabled.mockResolvedValue(true);
  mockNfc.start.mockResolvedValue(undefined);
  mockNfc.goToNfcSetting.mockResolvedValue(undefined);
  mockNfc.requestTechnology.mockResolvedValue(undefined);
  mockNfc.writeNdefMessage.mockResolvedValue(undefined);
  mockNfc.getTag.mockResolvedValue({ ndefMessage: [{ payload: [1, 2, 3] }] });
  mockNfc.cancelTechnologyRequest.mockResolvedValue(undefined);
  hceMock.isSupported.mockResolvedValue(true);
  hceMock.startSharing.mockResolvedValue(true);
  hceMock.stopSharing.mockResolvedValue(true);
});

describe('receiveKeyViaNfc', () => {
  it('reports when NFC is not supported', async () => {
    mockNfc.isSupported.mockResolvedValue(false);
    const { receiveKeyViaNfc } = loadHelper(false);
    const result = await receiveKeyViaNfc(t);
    expect(result).toEqual({ ok: false, message: 'NFC not supported' });
  });

  it('opens settings when NFC is off', async () => {
    mockNfc.isEnabled.mockResolvedValue(false);
    const { receiveKeyViaNfc } = loadHelper(false);
    const result = await receiveKeyViaNfc(t);
    expect(mockNfc.goToNfcSetting).toHaveBeenCalled();
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/NFC is off/);
  });

  it('returns the decoded payload on success', async () => {
    const { receiveKeyViaNfc } = loadHelper(false);
    const onStatus = jest.fn();
    const result = await receiveKeyViaNfc(t, onStatus);
    expect(result).toEqual({ ok: true, payload: 'decoded-key', message: '' });
    expect(onStatus).toHaveBeenCalled();
    expect(mockNfc.cancelTechnologyRequest).toHaveBeenCalled();
  });

  it('reports missing payload', async () => {
    mockNfc.getTag.mockResolvedValue({ ndefMessage: [] });
    const { receiveKeyViaNfc } = loadHelper(false);
    const result = await receiveKeyViaNfc(t);
    expect(result).toEqual({ ok: false, message: 'No NFC payload' });
  });

  it('reports a read failure', async () => {
    mockNfc.getTag.mockRejectedValue(new Error('read fail'));
    const { receiveKeyViaNfc } = loadHelper(false);
    const result = await receiveKeyViaNfc(t);
    expect(result).toEqual({ ok: false, message: 'Failed to read NFC' });
  });

  it('stays silent when cancelled', async () => {
    mockNfc.getTag.mockRejectedValue(new Error('Transaction cancelled'));
    const { receiveKeyViaNfc } = loadHelper(false);
    const result = await receiveKeyViaNfc(t);
    expect(result).toEqual({ ok: false, cancelled: true, message: '' });
  });
});

describe('shareKeyViaNfc (tag write fallback)', () => {
  it('writes the key to a tag when HCE is unavailable', async () => {
    const { shareKeyViaNfc } = loadHelper(false);
    const result = await shareKeyViaNfc('my-key', t);
    expect(mockNfc.writeNdefMessage).toHaveBeenCalledWith([1, 2, 3]);
    expect(result).toEqual({ ok: true, message: 'Key written to NFC tag' });
  });

  it('reports a share failure', async () => {
    mockNfc.requestTechnology.mockRejectedValue(new Error('tech fail'));
    const { shareKeyViaNfc } = loadHelper(false);
    const result = await shareKeyViaNfc('my-key', t);
    expect(result).toEqual({ ok: false, message: 'Failed to share via NFC' });
  });

  it('stays silent when cancelled', async () => {
    mockNfc.requestTechnology.mockRejectedValue(new Error('user cancelled'));
    const { shareKeyViaNfc } = loadHelper(false);
    const result = await shareKeyViaNfc('my-key', t);
    expect(result).toEqual({ ok: false, cancelled: true, message: '' });
  });
});

describe('shareKeyViaNfc (HCE phone-to-phone)', () => {
  it('completes when the peer reads the emulated tag', async () => {
    const { shareKeyViaNfc } = loadHelper(true);
    const promise = shareKeyViaNfc('my-key', t);
    await flush();
    DeviceEventEmitter.emit('NfcHceReadComplete');
    const result = await promise;
    expect(hceMock.startSharing).toHaveBeenCalledWith('my-key');
    expect(hceMock.stopSharing).toHaveBeenCalled();
    expect(result).toEqual({ ok: true, message: 'Key sent via NFC' });
  });

  it('falls back to a failure message when HCE start throws', async () => {
    hceMock.startSharing.mockRejectedValue(new Error('hce fail'));
    const { shareKeyViaNfc } = loadHelper(true);
    const result = await shareKeyViaNfc('my-key', t);
    expect(result).toEqual({ ok: false, message: 'Failed to share via NFC' });
  });
});
