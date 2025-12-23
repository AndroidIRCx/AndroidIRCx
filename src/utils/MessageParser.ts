/**
 * Message parsing utilities for detecting links, images, and emojis
 */

export interface ParsedMessagePart {
  type: 'text' | 'url' | 'image' | 'emoji';
  content: string;
  url?: string;
  emoji?: string;
}

/**
 * URL regex pattern - matches http, https, ftp, and common URL patterns
 */
const URL_PATTERN = /(https?:\/\/[^\s<>"{}|\\^`\[\]]+|ftp:\/\/[^\s<>"{}|\\^`\[\]]+|www\.[^\s<>"{}|\\^`\[\]]+)/gi;

/**
 * Image URL patterns - matches common image extensions
 */
const IMAGE_PATTERN = /(https?:\/\/[^\s<>"{}|\\^`\[\]]+\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)(\?[^\s<>"{}|\\^`\[\]]*)?)/gi;
const VIDEO_PATTERN = /(https?:\/\/[^\s<>"{}|\\^`\[\]]+\.(mp4|mov|webm|mkv|avi)(\?[^\s<>"{}|\\^`\[\]]*)?)/gi;
const AUDIO_PATTERN = /(https?:\/\/[^\s<>"{}|\\^`\[\]]+\.(mp3|ogg|wav|m4a|flac)(\?[^\s<>"{}|\\^`\[\]]*)?)/gi;
const DOWNLOADABLE_EXTENSIONS = [
  'pdf',
  'zip',
  'rar',
  '7z',
  'tar',
  'gz',
  'tgz',
  'bz2',
  'xz',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'csv',
  'txt',
  'json',
  'xml',
  'apk',
  'ipa',
  'exe',
  'msi',
  'dmg',
  'pkg',
  'iso',
  'psd',
  'ai',
  'sketch',
  'fig',
  'epub',
  'mobi',
];

/**
 * Emoji regex pattern - matches Unicode emoji ranges
 */
const EMOJI_PATTERN = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]/gu;

/**
 * Check if a URL is an image
 */
export function isImageUrl(url: string): boolean {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico'];
  const lowerUrl = url.toLowerCase();
  return imageExtensions.some(ext => lowerUrl.includes(ext)) ||
         IMAGE_PATTERN.test(url);
}

export function isVideoUrl(url: string): boolean {
  const videoExtensions = ['.mp4', '.mov', '.webm', '.mkv', '.avi'];
  const lowerUrl = url.toLowerCase();
  return videoExtensions.some(ext => lowerUrl.includes(ext)) || VIDEO_PATTERN.test(url);
}

export function isAudioUrl(url: string): boolean {
  const audioExtensions = ['.mp3', '.ogg', '.wav', '.m4a', '.flac'];
  const lowerUrl = url.toLowerCase();
  return audioExtensions.some(ext => lowerUrl.includes(ext)) || AUDIO_PATTERN.test(url);
}

export function getUrlExtension(url: string): string | null {
  try {
    const normalizedUrl = url.includes('://') ? url : `https://${url}`;
    const parsed = new URL(normalizedUrl);
    const pathname = parsed.pathname || '';
    const lastSegment = pathname.split('/').filter(Boolean).pop();
    if (!lastSegment || !lastSegment.includes('.')) {
      return null;
    }

    const baseName = lastSegment.split('?')[0].split('#')[0];
    const parts = baseName.split('.');
    const ext = parts.pop();
    if (!ext) {
      return null;
    }
    // Ignore obvious non-file extensions so normal pages don't get download buttons
    const nonFileExt = ['html', 'htm', 'php', 'asp', 'aspx', 'jsp', 'cfm'];
    if (nonFileExt.includes(ext.toLowerCase())) {
      return null;
    }
    return ext.toLowerCase();
  } catch {
    return null;
  }
}

export function isDownloadableFileUrl(url: string): boolean {
  const ext = getUrlExtension(url);
  if (!ext) {
    return false;
  }
  // Skip media handled elsewhere
  if (isImageUrl(url) || isVideoUrl(url) || isAudioUrl(url)) {
    return false;
  }
  return DOWNLOADABLE_EXTENSIONS.includes(ext) || /^[a-z0-9]{2,5}$/.test(ext);
}

/**
 * Extract URLs from text
 */
export function extractUrls(text: string): string[] {
  const matches = text.match(URL_PATTERN);
  return matches || [];
}

/**
 * Extract image URLs from text
 */
export function extractImageUrls(text: string): string[] {
  const matches = text.match(IMAGE_PATTERN);
  return matches || [];
}

/**
 * Extract emojis from text
 */
export function extractEmojis(text: string): string[] {
  const matches = text.match(EMOJI_PATTERN);
  return matches || [];
}

/**
 * Parse message text into parts (text, URLs, images, emojis)
 */
export function parseMessage(text: string): ParsedMessagePart[] {
  if (!text) {
    return [];
  }

  const parts: ParsedMessagePart[] = [];
  let lastIndex = 0;

  // Find all URLs and images
  const allMatches: Array<{ index: number; url: string; isImage: boolean }> = [];
  
  // Find image URLs first (they're also URLs)
  let imageMatch;
  const imageRegex = new RegExp(IMAGE_PATTERN.source, 'gi');
  while ((imageMatch = imageRegex.exec(text)) !== null) {
    allMatches.push({
      index: imageMatch.index,
      url: imageMatch[0],
      isImage: true,
    });
  }

  // Find regular URLs (excluding images)
  let urlMatch;
  const urlRegex = new RegExp(URL_PATTERN.source, 'gi');
  while ((urlMatch = urlRegex.exec(text)) !== null) {
    // Check if this URL is already captured as an image
    const isImage = isImageUrl(urlMatch[0]);
    const alreadyCaptured = allMatches.some(m => 
      m.index === urlMatch.index && m.url === urlMatch[0]
    );
    
    if (!alreadyCaptured) {
      allMatches.push({
        index: urlMatch.index,
        url: urlMatch[0],
        isImage,
      });
    }
  }

  // Sort matches by index
  allMatches.sort((a, b) => a.index - b.index);

  // Build parts array
  for (const match of allMatches) {
    // Add text before the match
    if (match.index > lastIndex) {
      const textBefore = text.substring(lastIndex, match.index);
      if (textBefore) {
        parts.push({
          type: 'text',
          content: textBefore,
        });
      }
    }

    // Add the URL/image
    parts.push({
      type: match.isImage ? 'image' : 'url',
      content: match.url,
      url: match.url,
    });

    lastIndex = match.index + match.url.length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    const remainingText = text.substring(lastIndex);
    if (remainingText) {
      parts.push({
        type: 'text',
        content: remainingText,
      });
    }
  }

  // If no URLs found, return the whole text as a single part
  if (parts.length === 0) {
    parts.push({
      type: 'text',
      content: text,
    });
  }

  return parts;
}

/**
 * Check if text contains any URLs
 */
export function hasUrls(text: string): boolean {
  return URL_PATTERN.test(text);
}

/**
 * Check if text contains any images
 */
export function hasImages(text: string): boolean {
  return IMAGE_PATTERN.test(text);
}

/**
 * Check if text contains any emojis
 */
export function hasEmojis(text: string): boolean {
  return EMOJI_PATTERN.test(text);
}

