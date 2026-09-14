/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Shared NFC key-exchange helpers used by QueryEncryptionMenu, MessageArea and
 * UserList so the share/receive flows stay identical everywhere.
 *
 * Two transports are supported for the "share" role:
 *   - HCE (Host Card Emulation): true phone-to-phone. The sharing phone
 *     emulates a Type 4 NDEF tag (NdefHostApduService) that the receiving phone
 *     reads in normal reader mode. This is what makes "two phones back-to-back"
 *     work, since Android Beam was removed in Android 10.
 *   - Tag write: fallback on devices without HCE - writes the key onto a
 *     physical NFC tag that the other phone then reads.
 *
 * The "receive" role always uses reader mode (requestTechnology + getTag),
 * which reads either an emulated or a physical Type 4 tag transparently.
 *
 * All flows first ensure NFC is supported AND enabled, opening system NFC
 * settings when it is off (previously this surfaced as an instant "failed").
 */

import { NativeModules, DeviceEventEmitter } from 'react-native';
import NfcManager, { Ndef, NfcTech } from 'react-native-nfc-manager';

const { NfcHce } = NativeModules as {
  NfcHce?: {
    isSupported: () => Promise<boolean>;
    startSharing: (text: string) => Promise<boolean>;
    stopSharing: () => Promise<boolean>;
  };
};

const HCE_READ_EVENT = 'NfcHceReadComplete';
// Keep the sharing window open long enough for the user to physically bring
// the two phones together after tapping the button.
const SHARE_TIMEOUT_MS = 60000;

export interface NfcExchangeResult {
  ok: boolean;
  /** Decoded key payload (receive role only). */
  payload?: string;
  /** Translated, user-facing status message. Empty when there is nothing to show. */
  message: string;
  /** True when the user cancelled - callers should stay silent. */
  cancelled?: boolean;
}

type StatusFn = (message: string) => void;
type TFn = (key: string) => string;

type NfcWriter = typeof NfcManager & {
  writeNdefMessage: (message: number[]) => Promise<void>;
};

function isCancellation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /cancel/i.test(message);
}

/**
 * Verify NFC is supported and switched on. Returns a failure result when it is
 * not (and opens NFC settings when off), or null when NFC is ready to use.
 */
async function ensureNfcReady(
  t: TFn,
  onStatus?: StatusFn,
): Promise<NfcExchangeResult | null> {
  const supported = await NfcManager.isSupported();
  if (!supported) {
    return { ok: false, message: t('NFC not supported') };
  }
  await NfcManager.start();
  const enabled = await NfcManager.isEnabled();
  if (!enabled) {
    const message = t('NFC is off. Enable it in settings, then try again.');
    onStatus?.(message);
    try {
      await NfcManager.goToNfcSetting();
    } catch {
      // Opening settings is best-effort.
    }
    return { ok: false, message };
  }
  return null;
}

async function shareViaHce(
  payload: string,
  t: TFn,
  onStatus?: StatusFn,
): Promise<NfcExchangeResult> {
  onStatus?.(
    t('Keep the phones together. Tap Receive via NFC on the other phone.'),
  );
  return new Promise<NfcExchangeResult>(resolve => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout>;

    const finish = (result: NfcExchangeResult) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      subscription.remove();
      NfcHce?.stopSharing().catch(() => {});
      resolve(result);
    };

    const subscription = DeviceEventEmitter.addListener(HCE_READ_EVENT, () => {
      finish({ ok: true, message: t('Key sent via NFC') });
    });

    timer = setTimeout(() => {
      finish({
        ok: false,
        message: t('NFC timed out. Try again, holding the phones together.'),
      });
    }, SHARE_TIMEOUT_MS);

    NfcHce?.startSharing(payload).catch(() => {
      finish({ ok: false, message: t('Failed to share via NFC') });
    });
  });
}

async function shareViaTagWrite(
  payload: string,
  t: TFn,
  onStatus?: StatusFn,
): Promise<NfcExchangeResult> {
  try {
    onStatus?.(t('Hold the phone against the NFC tag...'));
    await NfcManager.requestTechnology(NfcTech.Ndef);
    const bytes = Ndef.encodeMessage([Ndef.textRecord(payload)]);
    if (bytes) {
      await (NfcManager as NfcWriter).writeNdefMessage(bytes);
    }
    return { ok: true, message: t('Key written to NFC tag') };
  } catch (error) {
    if (isCancellation(error)) {
      return { ok: false, cancelled: true, message: '' };
    }
    return { ok: false, message: t('Failed to share via NFC') };
  } finally {
    try {
      await NfcManager.cancelTechnologyRequest();
    } catch {
      // Ignore - nothing was pending.
    }
  }
}

/**
 * Share an encryption key over NFC. Uses phone-to-phone HCE when available and
 * falls back to writing a physical NFC tag otherwise.
 */
export async function shareKeyViaNfc(
  payload: string,
  t: TFn,
  onStatus?: StatusFn,
): Promise<NfcExchangeResult> {
  const notReady = await ensureNfcReady(t, onStatus);
  if (notReady) {
    return notReady;
  }

  let hceSupported = false;
  if (NfcHce) {
    try {
      hceSupported = await NfcHce.isSupported();
    } catch {
      hceSupported = false;
    }
  }

  return hceSupported
    ? shareViaHce(payload, t, onStatus)
    : shareViaTagWrite(payload, t, onStatus);
}

/**
 * Receive an encryption key over NFC by reading the peer device (or a tag).
 * Returns the decoded payload in `payload` on success.
 */
export async function receiveKeyViaNfc(
  t: TFn,
  onStatus?: StatusFn,
): Promise<NfcExchangeResult> {
  const notReady = await ensureNfcReady(t, onStatus);
  if (notReady) {
    return notReady;
  }

  try {
    onStatus?.(
      t('Keep the phones together. Tap Share via NFC on the other phone.'),
    );
    await NfcManager.requestTechnology(NfcTech.Ndef);
    const tag = await NfcManager.getTag();
    const ndefMessage = tag?.ndefMessage?.[0];
    const payload = ndefMessage
      ? Ndef.text.decodePayload(new Uint8Array(ndefMessage.payload as number[]))
      : null;
    if (!payload) {
      return { ok: false, message: t('No NFC payload') };
    }
    return { ok: true, payload, message: '' };
  } catch (error) {
    if (isCancellation(error)) {
      return { ok: false, cancelled: true, message: '' };
    }
    return { ok: false, message: t('Failed to read NFC') };
  } finally {
    try {
      await NfcManager.cancelTechnologyRequest();
    } catch {
      // Ignore - nothing was pending.
    }
  }
}
