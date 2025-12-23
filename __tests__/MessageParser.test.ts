import { isVideoUrl, isAudioUrl, isImageUrl, isDownloadableFileUrl } from '../src/utils/MessageParser';

describe('MessageParser media detection', () => {
  it('detects common video extensions', () => {
    expect(isVideoUrl('https://example.com/video.mp4')).toBe(true);
    expect(isVideoUrl('https://cdn.example.com/path/clip.MOV?token=1')).toBe(true);
    expect(isVideoUrl('https://example.com/file.txt')).toBe(false);
  });

  it('detects common audio extensions', () => {
    expect(isAudioUrl('https://example.com/audio.mp3')).toBe(true);
    expect(isAudioUrl('https://example.com/sound.WAV?dl=1')).toBe(true);
    expect(isAudioUrl('https://example.com/video.mp4')).toBe(false);
  });

  it('detects image extensions and urls', () => {
    expect(isImageUrl('https://example.com/pic.jpeg')).toBe(true);
    expect(isImageUrl('https://example.com/assets/icon.PNG?cache=1')).toBe(true);
    expect(isImageUrl('https://example.com/video.mp4')).toBe(false);
  });

  it('detects downloadable files by extension', () => {
    expect(isDownloadableFileUrl('https://example.com/report.pdf')).toBe(true);
    expect(isDownloadableFileUrl('https://example.com/archive.tar.gz')).toBe(true);
    expect(isDownloadableFileUrl('https://example.com/image.jpg')).toBe(false);
  });
});
