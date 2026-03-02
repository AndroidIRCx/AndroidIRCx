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
});
