/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import {
  errorCodes,
  isErrorWithCode,
  keepLocalCopy,
  pick,
  types,
} from '@react-native-documents/picker';
import RNFS from 'react-native-fs';
import { ADDON_PACKAGE_LIMITS } from './AddonPackagePolicy';

export class AddonImportCancelledError extends Error {
  constructor() {
    super('Addon import was cancelled.');
    this.name = 'AddonImportCancelledError';
  }
}

export class AddonImportFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AddonImportFileError';
  }
}

/** Copies the user-selected document into app cache, then reads bounded bytes. */
export async function pickAddonPackageBytes(): Promise<Uint8Array> {
  try {
    const [selected] = await pick({
      type: [types.allFiles],
      mode: 'import',
      allowMultiSelection: false,
      allowVirtualFiles: false,
    });
    if (
      !selected.name ||
      selected.name.length > 160 ||
      /[\\/\0]/.test(selected.name) ||
      !selected.name.toLocaleLowerCase('en-US').endsWith('.ircx-addon')
    )
      throw new AddonImportFileError('Select a .ircx-addon package.');
    if (
      selected.size !== null &&
      selected.size > ADDON_PACKAGE_LIMITS.maxCompressedBytes
    )
      throw new AddonImportFileError('Addon package is too large.');

    const [copy] = await keepLocalCopy({
      files: [{ uri: selected.uri, fileName: selected.name }],
      destination: 'cachesDirectory',
    });
    if (copy.status !== 'success')
      throw new AddonImportFileError('Could not copy the selected package.');

    const encoded = await RNFS.readFile(
      normalizeFileUri(copy.localUri),
      'base64',
    );
    const bytes = decodeBase64(encoded);
    if (bytes.length > ADDON_PACKAGE_LIMITS.maxCompressedBytes)
      throw new AddonImportFileError('Addon package is too large.');
    return bytes;
  } catch (error) {
    if (isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED)
      throw new AddonImportCancelledError();
    throw error;
  }
}

const normalizeFileUri = (uri: string): string =>
  uri.startsWith('file://') ? decodeURIComponent(uri.slice(7)) : uri;

function decodeBase64(value: string): Uint8Array {
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = value.replace(/\s/g, '');
  if (
    clean.length === 0 ||
    clean.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      clean,
    )
  )
    throw new AddonImportFileError('Selected package could not be read.');
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const output = new Uint8Array((clean.length / 4) * 3 - padding);
  let offset = 0;
  for (let index = 0; index < clean.length; index += 4) {
    const a = alphabet.indexOf(clean[index]);
    const b = alphabet.indexOf(clean[index + 1]);
    const c = clean[index + 2] === '=' ? 0 : alphabet.indexOf(clean[index + 2]);
    const d = clean[index + 3] === '=' ? 0 : alphabet.indexOf(clean[index + 3]);
    if (offset < output.length) output[offset++] = a * 4 + Math.floor(b / 16);
    if (offset < output.length)
      output[offset++] = (b % 16) * 16 + Math.floor(c / 4);
    if (offset < output.length) output[offset++] = (c % 4) * 64 + d;
  }
  return output;
}
