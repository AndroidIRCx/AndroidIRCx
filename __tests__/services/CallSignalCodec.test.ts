import { callSignalCodec } from '../../src/services/CallSignalCodec';

describe('CallSignalCodec', () => {
  it('encodes and decodes short signals', () => {
    const signal = {
      type: 'invite' as const,
      sessionId: 'session-1',
      mediaType: 'audio' as const,
      quality: '720p' as const,
    };

    const encoded = callSignalCodec.encode(signal);
    expect(callSignalCodec.decode(encoded)).toEqual(signal);
  });

  it('chunks and reassembles long signals', () => {
    const signal = {
      type: 'offer' as const,
      sessionId: 'session-2',
      mediaType: 'video' as const,
      sdp: 'v=0\r\n'.repeat(300),
      quality: '1080p' as const,
    };

    const chunks = callSignalCodec.encodeChunked(signal, 'transfer-1');
    expect(chunks.length).toBeGreaterThan(1);

    let buffer: any;
    for (const raw of chunks) {
      const chunk = callSignalCodec.decodeChunk(raw);
      expect(chunk).not.toBeNull();
      buffer = callSignalCodec.appendChunk(buffer, chunk as any);
    }

    expect(callSignalCodec.tryAssemble(buffer)).toEqual(signal);
  });

  it('returns null for invalid raw signal/chunk payloads', () => {
    expect(callSignalCodec.decode('PRIVMSG #chan :hello')).toBeNull();
    expect(callSignalCodec.decode('!webrtc {bad-json')).toBeNull();
    expect(callSignalCodec.decodeChunk('!other-chunk {"a":1}')).toBeNull();
    expect(callSignalCodec.decodeChunk('!webrtc-chunk {bad-json')).toBeNull();
  });

  it('tracks chunk progress and missing indexes', () => {
    const signal = {
      type: 'answer' as const,
      sessionId: 'session-3',
      mediaType: 'video' as const,
      sdp: 'v=0\r\n'.repeat(150),
      quality: '720p' as const,
    };

    const chunks = callSignalCodec
      .encodeChunked(signal, 'transfer-2')
      .map(raw => {
        const parsed = callSignalCodec.decodeChunk(raw);
        expect(parsed).not.toBeNull();
        return parsed as any;
      });
    expect(chunks.length).toBeGreaterThan(2);

    let buffer: any;
    buffer = callSignalCodec.appendChunk(buffer, chunks[0]);
    buffer = callSignalCodec.appendChunk(buffer, chunks[2]);

    const progress = callSignalCodec.getChunkProgress(buffer);
    expect(progress.total).toBe(chunks.length);
    expect(progress.received).toBe(2);
    expect(progress.missing).toContain(1);
    expect(callSignalCodec.tryAssemble(buffer)).toBeNull();
  });

  it('returns null when assembled payload cannot be parsed', () => {
    const buffer = {
      total: 1,
      parts: new Map<number, string>([[0, '!!!not-base64!!!']]),
      startedAt: Date.now(),
      updatedAt: Date.now(),
    };

    expect(callSignalCodec.tryAssemble(buffer as any)).toBeNull();
  });
});
