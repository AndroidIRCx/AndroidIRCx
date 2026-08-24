/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * EncodingService.ts
 *
 * Character-encoding support for IRC traffic. IRC is a byte protocol with no
 * in-band charset negotiation, so different networks/users send text in
 * different legacy encodings (ISO-8859-*, Windows-125x, KOI8, Shift_JIS, ...).
 * This service decodes incoming line bytes and encodes outgoing lines using a
 * per-connection encoding, with an optional "prefer UTF-8, fall back to legacy"
 * mode for mixed channels.
 *
 * Backed by the already-bundled `text-encoding` polyfill, which supports the
 * full WHATWG decoder set and legacy encoding via NONSTANDARD_allowLegacyEncoding.
 * Decoding is done per complete IRC line (split on LF before decoding), so no
 * streaming state is needed and multi-byte characters never straddle a chunk
 * boundary — all supported encodings keep 0x0A/0x0D as ASCII control bytes.
 */

import { Buffer } from 'buffer';
import { TextDecoder, TextEncoder } from 'text-encoding';
import { logger } from './Logger';

// The `text-encoding` runtime supports constructor options that its bundled d.ts
// omits: TextDecoder(label, { fatal }) and the non-standard legacy encoder
// TextEncoder(label, { NONSTANDARD_allowLegacyEncoding }). Type the constructors
// to match the real API.
const TextDecoderCtor = TextDecoder as unknown as new (
  label?: string,
  options?: { fatal?: boolean },
) => TextDecoder;
const TextEncoderCtor = TextEncoder as unknown as new (
  label?: string,
  options?: { NONSTANDARD_allowLegacyEncoding?: boolean },
) => TextEncoder;

export const DEFAULT_ENCODING = 'utf-8';

export interface EncodingOption {
  /** WHATWG label understood by text-encoding (also what we persist). */
  label: string;
  /** Human-readable name shown in settings. */
  name: string;
}

/**
 * Curated list of encodings offered in the UI, ordered by how common they are
 * on IRC. `utf-8` is the modern default; the rest are legacy charsets still
 * used on older networks and by older clients.
 */
export const SUPPORTED_ENCODINGS: EncodingOption[] = [
  { label: 'utf-8', name: 'UTF-8 (Unicode)' },
  { label: 'iso-8859-1', name: 'Western (ISO-8859-1)' },
  { label: 'iso-8859-15', name: 'Western (ISO-8859-15)' },
  { label: 'windows-1252', name: 'Western (Windows-1252)' },
  { label: 'iso-8859-2', name: 'Central European (ISO-8859-2)' },
  { label: 'windows-1250', name: 'Central European (Windows-1250)' },
  { label: 'windows-1251', name: 'Cyrillic (Windows-1251)' },
  { label: 'koi8-r', name: 'Cyrillic (KOI8-R)' },
  { label: 'koi8-u', name: 'Cyrillic (KOI8-U)' },
  { label: 'iso-8859-5', name: 'Cyrillic (ISO-8859-5)' },
  { label: 'iso-8859-7', name: 'Greek (ISO-8859-7)' },
  { label: 'windows-1253', name: 'Greek (Windows-1253)' },
  { label: 'iso-8859-9', name: 'Turkish (ISO-8859-9)' },
  { label: 'windows-1254', name: 'Turkish (Windows-1254)' },
  { label: 'windows-1257', name: 'Baltic (Windows-1257)' },
  { label: 'shift_jis', name: 'Japanese (Shift_JIS)' },
  { label: 'euc-jp', name: 'Japanese (EUC-JP)' },
  { label: 'gbk', name: 'Chinese Simplified (GBK)' },
  { label: 'big5', name: 'Chinese Traditional (Big5)' },
  { label: 'euc-kr', name: 'Korean (EUC-KR)' },
];

const SUPPORTED_LABELS = new Set(SUPPORTED_ENCODINGS.map(e => e.label));

class EncodingService {
  // Cached decoder/encoder instances keyed by label (non-streaming, reusable).
  private decoders = new Map<string, TextDecoder>();
  private encoders = new Map<string, TextEncoder>();
  private utf8Fatal: TextDecoder | null = null;
  private utf8Loose: TextDecoder | null = null;

  /** Whether a label is one we offer / can handle. */
  isSupported(label: string): boolean {
    return SUPPORTED_LABELS.has((label || '').toLowerCase().trim());
  }

  /** Normalize a persisted label to a canonical, lower-case form. */
  normalize(label: string | undefined | null): string {
    const value = (label || DEFAULT_ENCODING).toLowerCase().trim();
    return SUPPORTED_LABELS.has(value) ? value : DEFAULT_ENCODING;
  }

  /** Display name for a label (falls back to the raw label). */
  getDisplayName(label: string): string {
    const normalized = this.normalize(label);
    return (
      SUPPORTED_ENCODINGS.find(e => e.label === normalized)?.name || normalized
    );
  }

  private getUtf8Loose(): TextDecoder {
    if (!this.utf8Loose) {
      this.utf8Loose = new TextDecoderCtor('utf-8', { fatal: false });
    }
    return this.utf8Loose;
  }

  private getUtf8Fatal(): TextDecoder {
    if (!this.utf8Fatal) {
      this.utf8Fatal = new TextDecoderCtor('utf-8', { fatal: true });
    }
    return this.utf8Fatal;
  }

  private getDecoder(label: string): TextDecoder {
    const normalized = this.normalize(label);
    let decoder = this.decoders.get(normalized);
    if (!decoder) {
      try {
        decoder = new TextDecoderCtor(normalized, { fatal: false });
      } catch (error) {
        logger.warn(
          'encoding',
          `Unknown decoder "${normalized}", using UTF-8: ${String(error)}`,
        );
        decoder = this.getUtf8Loose();
      }
      this.decoders.set(normalized, decoder);
    }
    return decoder;
  }

  private getLegacyEncoder(label: string): TextEncoder | null {
    const normalized = this.normalize(label);
    if (normalized === 'utf-8') {
      return null;
    }
    let encoder = this.encoders.get(normalized);
    if (!encoder) {
      try {
        encoder = new TextEncoderCtor(normalized, {
          NONSTANDARD_allowLegacyEncoding: true,
        });
      } catch (error) {
        logger.warn(
          'encoding',
          `Cannot build legacy encoder "${normalized}": ${String(error)}`,
        );
        return null;
      }
      this.encoders.set(normalized, encoder);
    }
    return encoder;
  }

  /**
   * Decode the bytes of a single IRC line to a string.
   *
   * @param bytes      the raw line bytes (without the trailing CRLF)
   * @param encoding   the connection encoding label
   * @param utf8Fallback when true and `encoding` is a legacy charset, decode as
   *                   UTF-8 first and only fall back to the legacy charset if the
   *                   bytes are not valid UTF-8 (per line). Ignored for utf-8.
   */
  decodeLine(
    bytes: Uint8Array,
    encoding: string,
    utf8Fallback: boolean = false,
  ): string {
    const normalized = this.normalize(encoding);
    if (normalized === 'utf-8') {
      return this.getUtf8Loose().decode(bytes);
    }
    if (utf8Fallback) {
      try {
        return this.getUtf8Fatal().decode(bytes);
      } catch {
        // Not valid UTF-8 — decode this line with the legacy charset instead.
      }
    }
    return this.getDecoder(normalized).decode(bytes);
  }

  /**
   * Encode an outgoing IRC line for the wire.
   *
   * Returns a Buffer of legacy bytes, or `null` when the caller should use the
   * plain UTF-8 string write path (encoding is utf-8, or utf8Fallback prefers
   * sending UTF-8). Returning null keeps the common UTF-8 path byte-identical
   * to the previous behavior.
   */
  encodeForSend(
    line: string,
    encoding: string,
    utf8Fallback: boolean = false,
  ): Buffer | null {
    const normalized = this.normalize(encoding);
    if (normalized === 'utf-8' || utf8Fallback) {
      return null;
    }
    const encoder = this.getLegacyEncoder(normalized);
    if (!encoder) {
      return null;
    }
    try {
      return Buffer.from(encoder.encode(line));
    } catch (error) {
      logger.warn(
        'encoding',
        `Failed to encode line as "${normalized}", sending UTF-8: ${String(error)}`,
      );
      return null;
    }
  }
}

export const encodingService = new EncodingService();
