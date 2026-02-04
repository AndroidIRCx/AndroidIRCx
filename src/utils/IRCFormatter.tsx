/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { Text, TextStyle, Linking, View } from 'react-native';

/**
 * IRC color codes mapping (0-15)
 * According to modern.ircdocs.horse specification
 */
export const IRC_STANDARD_COLOR_MAP: { [key: number]: string } = {
  0: '#FFFFFF', // white
  1: '#000000', // black
  2: '#00007F', // blue
  3: '#009300', // green
  4: '#FF0000', // red
  5: '#7F0000', // brown/maroon
  6: '#9C009C', // purple
  7: '#FC7F00', // orange
  8: '#FFFF00', // yellow
  9: '#00FC00', // light green
  10: '#009393', // cyan
  11: '#00FFFF', // light cyan
  12: '#0000FC', // light blue
  13: '#FF00FF', // pink/magenta
  14: '#7F7F7F', // grey
  15: '#D2D2D2', // light grey
};

/**
 * Extended color codes (16-98) RGB mapping
 * According to modern.ircdocs.horse specification
 */
export const IRC_EXTENDED_COLOR_MAP: { [key: number]: string } = {
  16: '#470000', 17: '#472100', 18: '#474700', 19: '#324700', 20: '#004700',
  21: '#00472c', 22: '#004747', 23: '#002747', 24: '#000047', 25: '#2e0047',
  26: '#470047', 27: '#47002a', 28: '#740000', 29: '#743a00', 30: '#747400',
  31: '#517400', 32: '#007400', 33: '#007449', 34: '#007474', 35: '#004074',
  36: '#000074', 37: '#4b0074', 38: '#740074', 39: '#740045', 40: '#b50000',
  41: '#b56300', 42: '#b5b500', 43: '#7db500', 44: '#00b500', 45: '#00b571',
  46: '#00b5b5', 47: '#0063b5', 48: '#0000b5', 49: '#7500b5', 50: '#b500b5',
  51: '#b5006b', 52: '#ff0000', 53: '#ff8c00', 54: '#ffff00', 55: '#b2ff00',
  56: '#00ff00', 57: '#00ffa0', 58: '#00ffff', 59: '#008cff', 60: '#0000ff',
  61: '#a500ff', 62: '#ff00ff', 63: '#ff0098', 64: '#ff5959', 65: '#ffb459',
  66: '#ffff71', 67: '#cfff60', 68: '#6fff6f', 69: '#65ffc9', 70: '#6dffff',
  71: '#59b4ff', 72: '#5959ff', 73: '#c459ff', 74: '#ff66ff', 75: '#ff59bc',
  76: '#ff9c9c', 77: '#ffd39c', 78: '#ffff9c', 79: '#e2ff9c', 80: '#9cff9c',
  81: '#9cffdb', 82: '#9cffff', 83: '#9cd3ff', 84: '#9c9cff', 85: '#dc9cff',
  86: '#ff9cff', 87: '#ff94d3', 88: '#000000', 89: '#131313', 90: '#282828',
  91: '#363636', 92: '#4d4d4d', 93: '#656565', 94: '#818181', 95: '#9f9f9f',
  96: '#bcbcbc', 97: '#e2e2e2', 98: '#ffffff',
};

/**
 * Get color for extended color codes (16-98)
 */
function getExtendedColor(code: number): string {
  return IRC_EXTENDED_COLOR_MAP[code] || '#000000';
}

/**
 * Style state for IRC formatting
 */
interface FormatStyle {
  bold: boolean;
  underline: boolean;
  italic: boolean;
  strikethrough: boolean;
  reverse: boolean;
  color: number | null;
  background: number | null;
}

/**
 * Text segment with styling
 */
interface TextSegment {
  text: string;
  style: FormatStyle;
}

/**
 * IRC Format Codes
 */
export const IRC_FORMAT_CODES = {
  BOLD: 0x02,           // Ctrl+B
  COLOR: 0x03,          // Ctrl+C
  RESET: 0x0F,          // Ctrl+O
  REVERSE: 0x16,        // Ctrl+V
  ITALIC: 0x1D,         // Ctrl+]
  STRIKETHROUGH: 0x1E,  // Ctrl+^
  UNDERLINE: 0x1F,      // Ctrl+_
};

/**
 * Parse IRC formatted text into segments with styling information
 */
function parseIRCText(text: string): TextSegment[] {
  if (!text) {
    return [];
  }

  const segments: TextSegment[] = [];
  const length = text.length;
  let i = 0;
  let currentStyle: FormatStyle = {
    bold: false,
    underline: false,
    italic: false,
    strikethrough: false,
    reverse: false,
    color: null,
    background: null,
  };

  let currentText = '';

  const flushText = () => {
    if (currentText) {
      segments.push({
        text: currentText,
        style: { ...currentStyle },
      });
      currentText = '';
    }
  };

  while (i < length) {
    const char = text[i];
    const charCode = char.charCodeAt(0);

    // Handle IRC format codes
    switch (charCode) {
      case IRC_FORMAT_CODES.BOLD: // Ctrl+B - Bold
        flushText();
        currentStyle.bold = !currentStyle.bold;
        i++;
        continue;

      case IRC_FORMAT_CODES.COLOR: // Ctrl+C - Color
        flushText();
        
        let fgColor: number | null = null;
        let bgColor: number | null = null;

        // Check for foreground color (1-2 digits)
        // According to spec: "If there are two ASCII digits available where a <COLOR> is allowed,
        // then two characters MUST always be read for it"
        if (i + 1 < length && /\d/.test(text[i + 1])) {
          const firstDigit = parseInt(text[i + 1], 10);

          // Check if second digit exists BEFORE consuming first digit
          if (i + 2 < length && /\d/.test(text[i + 2])) {
            // Two digits available - MUST read both
            const secondDigit = parseInt(text[i + 2], 10);
            fgColor = firstDigit * 10 + secondDigit;
            i += 3; // consume \x03 (1) + first digit (1) + second digit (1) = 3 positions
          } else {
            // Only one digit available
            fgColor = firstDigit;
            i += 2; // consume \x03 (1) + first digit (1) = 2 positions
          }

          // Check for background color (comma + 1-2 digits)
          if (i < length && text[i] === ',') {
            i++; // skip comma
            if (i < length && /\d/.test(text[i])) {
              const firstBgDigit = parseInt(text[i], 10);

              // Check if second bg digit exists
              if (i + 1 < length && /\d/.test(text[i + 1])) {
                // Two digits available - MUST read both
                const secondBgDigit = parseInt(text[i + 1], 10);
                bgColor = firstBgDigit * 10 + secondBgDigit;
                i += 2; // consume both bg digits
              } else {
                // Only one digit available
                bgColor = firstBgDigit;
                i++; // consume first bg digit
              }
            }
          }
        } else {
          // No color digits - just consume \x03
          i++;
        }

        // Apply color if specified
        if (fgColor === null && bgColor === null) {
          // Reset all colors
          currentStyle.color = null;
          currentStyle.background = null;
        } else {
          // If only foreground is specified, keep previous background
          if (fgColor !== null && bgColor === null) {
            bgColor = currentStyle.background;
          }

          // If only background is specified, keep previous foreground
          if (fgColor === null && bgColor !== null) {
            fgColor = currentStyle.color;
          }

          if (fgColor !== null) {
            currentStyle.color = fgColor;
          }
          if (bgColor !== null) {
            currentStyle.background = bgColor;
          }
        }
        continue;

      case IRC_FORMAT_CODES.RESET: // Ctrl+O - Reset all formatting
        flushText();
        currentStyle = {
          bold: false,
          underline: false,
          italic: false,
          strikethrough: false,
          reverse: false,
          color: null,
          background: null,
        };
        i++;
        continue;

      case IRC_FORMAT_CODES.UNDERLINE: // Ctrl+_ - Underline
        flushText();
        currentStyle.underline = !currentStyle.underline;
        i++;
        continue;

      case IRC_FORMAT_CODES.ITALIC: // Ctrl+] - Italic
        flushText();
        currentStyle.italic = !currentStyle.italic;
        i++;
        continue;

      case IRC_FORMAT_CODES.STRIKETHROUGH: // Ctrl+^ - Strikethrough
        flushText();
        currentStyle.strikethrough = !currentStyle.strikethrough;
        i++;
        continue;

      case IRC_FORMAT_CODES.REVERSE: // Ctrl+V - Reverse (swap fg/bg)
        flushText();
        currentStyle.reverse = !currentStyle.reverse;
        i++;
        continue;

      default:
        // Regular character
        currentText += char;
        i++;
        break;
    }
  }

  // Flush remaining text
  flushText();

  return segments;
}

/**
 * Convert format style to React Native TextStyle
 */
function styleToTextStyle(style: FormatStyle, baseStyle?: TextStyle): TextStyle {
  const textStyle: TextStyle = baseStyle ? { ...baseStyle } : {};

  // Handle reverse (swap foreground and background)
  let fgColor = style.color;
  let bgColor = style.background;

  if (style.reverse && fgColor !== null && bgColor !== null) {
    // Swap colors
    [fgColor, bgColor] = [bgColor, fgColor];
  } else if (style.reverse && fgColor !== null) {
    // Only foreground set - swap with background
    bgColor = fgColor;
    fgColor = null;
  } else if (style.reverse && bgColor !== null) {
    // Only background set - swap with foreground
    fgColor = bgColor;
    bgColor = null;
  }

  // Apply foreground color
  if (fgColor !== null) {
    if (fgColor >= 16 && fgColor <= 98) {
      textStyle.color = getExtendedColor(fgColor);
    } else if (IRC_STANDARD_COLOR_MAP[fgColor]) {
      textStyle.color = IRC_STANDARD_COLOR_MAP[fgColor];
    }
  }

  // Apply background color
  if (bgColor !== null) {
    if (bgColor >= 16 && bgColor <= 98) {
      textStyle.backgroundColor = getExtendedColor(bgColor);
    } else if (IRC_STANDARD_COLOR_MAP[bgColor]) {
      textStyle.backgroundColor = IRC_STANDARD_COLOR_MAP[bgColor];
    }
  }

  // Apply text styles
  if (style.bold) {
    textStyle.fontWeight = 'bold';
  }
  if (style.underline) {
    textStyle.textDecorationLine = 'underline';
  }
  if (style.italic) {
    textStyle.fontStyle = 'italic';
  }
  if (style.strikethrough) {
    textStyle.textDecorationLine = textStyle.textDecorationLine
      ? `${textStyle.textDecorationLine} line-through`
      : 'line-through';
  }

  return textStyle;
}

/**
 * Convert IRC formatted text to React Native Text components
 * Returns an array of Text components that can be used directly in JSX
 */
export function formatIRCText(
  text: string,
  baseStyle?: TextStyle
): React.ReactElement[] {
  if (!text) {
    return [<Text key="empty" style={baseStyle} />];
  }

  const segments = parseIRCText(text);
  const nbsp = String.fromCharCode(0xa0);
  const preserveTrailingSpaces = (value: string) =>
    value.replace(/(\s+)$/g, (spaces) => spaces.replace(/ /g, nbsp));

  if (segments.length === 0) {
    return [<Text key="plain" style={baseStyle}>{text}</Text>];
  }

  // Build nested Text components properly
  // React Native Text components must be nested correctly
  return segments.map((segment, index) => {
    const segmentStyle = styleToTextStyle(segment.style, baseStyle);
    return (
      <Text key={`segment-${index}`} style={segmentStyle}>
        {preserveTrailingSpaces(segment.text)}
      </Text>
    );
  });
}

/**
 * Convert IRC formatted text to a single React Native Text component with nested styling
 * This is a convenience wrapper that wraps all segments in a parent Text component
 * Handles multiline text by splitting on newlines and rendering each line separately
 */
export function formatIRCTextAsComponent(
    text: string,
    baseStyle?: TextStyle
  ): React.ReactElement {
  if (!text) {
    return <Text style={baseStyle} />;
  }

  // Split text by newlines to handle multiline messages
  const lines = text.split('\n');
  const nbsp = String.fromCharCode(0xa0);
  const preserveTrailingSpaces = (value: string) =>
    value.replace(/(\s+)$/g, (spaces) => spaces.replace(/ /g, nbsp));

  // If single line, use original logic
  if (lines.length === 1) {
    const segments = parseIRCText(text);
    
    if (segments.length === 0) {
      return <Text style={baseStyle}>{text}</Text>;
    }

    return (
      <Text style={baseStyle}>
        {segments.map((segment, index) => {
          const segmentStyle = styleToTextStyle(segment.style);
          return (
            <Text key={`segment-${index}`} style={segmentStyle}>
              {preserveTrailingSpaces(segment.text)}
            </Text>
          );
        })}
      </Text>
    );
  }

    // Multiline: render inside a single Text to preserve inline flow and lineHeight
    return (
      <Text style={baseStyle}>
        {lines.map((line, lineIndex) => {
          const segments = parseIRCText(line);
          const lineContent = segments.length === 0
            ? line
            : segments.map((segment, segmentIndex) => {
              const segmentStyle = styleToTextStyle(segment.style);
              return (
                <Text key={`segment-${lineIndex}-${segmentIndex}`} style={segmentStyle}>
                  {preserveTrailingSpaces(segment.text)}
                </Text>
              );
            });
          return (
            <Text key={`line-${lineIndex}`}>
              {lineContent}
              {lineIndex < lines.length - 1 ? '\n' : null}
            </Text>
          );
        })}
      </Text>
    );
  }

/**
 * Convert IRC formatted text to plain text (remove all formatting)
 */
export function stripIRCFormatting(text: string): string {
  if (!text) {
    return '';
  }

  let plain = '';
  const length = text.length;
  let i = 0;

  while (i < length) {
    const char = text[i];
    const charCode = char.charCodeAt(0);

    // Handle IRC format codes - skip them
    switch (charCode) {
      case IRC_FORMAT_CODES.BOLD:
      case IRC_FORMAT_CODES.RESET:
      case IRC_FORMAT_CODES.UNDERLINE:
      case IRC_FORMAT_CODES.ITALIC:
      case IRC_FORMAT_CODES.STRIKETHROUGH:
      case IRC_FORMAT_CODES.REVERSE:
        i++;
        continue;

      case IRC_FORMAT_CODES.COLOR:
        // Skip color codes
        if (i + 1 < length && /\d/.test(text[i + 1])) {
          i++;
          if (i + 1 < length && /\d/.test(text[i + 1])) {
            i++;
          }
          // Check for background color
          if (i + 1 < length && text[i + 1] === ',') {
            i++; // skip comma
            if (i + 1 < length && /\d/.test(text[i + 1])) {
              i++;
              if (i + 1 < length && /\d/.test(text[i + 1])) {
                i++;
              }
            }
          }
        }
        i++;
        continue;

      default:
        plain += char;
        i++;
        break;
    }
  }

  return plain;
}

/**
 * Get a readable representation of IRC format codes (for debugging)
 */
export function formatIRCDebug(text: string): string {
  if (!text) {
    return '';
  }

  let result = '';
  const length = text.length;
  let i = 0;

  while (i < length) {
    const char = text[i];
    const charCode = char.charCodeAt(0);

    switch (charCode) {
      case IRC_FORMAT_CODES.BOLD:
        result += '[B]';
        break;
      case IRC_FORMAT_CODES.COLOR:
        let colorStr = '[C';
        i++;
        if (i < length && /\d/.test(text[i])) {
          colorStr += text[i];
          i++;
          if (i < length && /\d/.test(text[i])) {
            colorStr += text[i];
            i++;
          }
          if (i < length && text[i] === ',') {
            colorStr += ',';
            i++;
            if (i < length && /\d/.test(text[i])) {
              colorStr += text[i];
              i++;
              if (i < length && /\d/.test(text[i])) {
                colorStr += text[i];
                i++;
              }
            }
          }
        }
        colorStr += ']';
        result += colorStr;
        i--;
        break;
      case IRC_FORMAT_CODES.RESET:
        result += '[R]';
        break;
      case IRC_FORMAT_CODES.UNDERLINE:
        result += '[U]';
        break;
      case IRC_FORMAT_CODES.ITALIC:
        result += '[I]';
        break;
      case IRC_FORMAT_CODES.STRIKETHROUGH:
        result += '[S]';
        break;
      case IRC_FORMAT_CODES.REVERSE:
        result += '[REV]';
        break;
      default:
        result += char;
        break;
    }
    i++;
  }

  return result;
}

/**
 * URL regex pattern for detecting links
 */
const URL_PATTERN = /(https?:\/\/[^\s<>"{}|\\^`\[\]]+|ftp:\/\/[^\s<>"{}|\\^`\[\]]+|www\.[^\s<>"{}|\\^`\[\]]+)/gi;

/**
 * Format IRC text with clickable URLs (plain links, no preview)
 * Used for topic messages and system messages where we want links clickable
 * but without loading previews/images
 */
export function formatIRCTextWithLinks(
  text: string,
  baseStyle?: TextStyle,
  linkColor?: string
): React.ReactElement {
  if (!text) {
    return <Text style={baseStyle} />;
  }

  // First parse IRC formatting
  const segments = parseIRCText(text);
  const nbsp = String.fromCharCode(0xa0);
  const preserveTrailingSpaces = (value: string) =>
    value.replace(/(\s+)$/g, (spaces) => spaces.replace(/ /g, nbsp));

  if (segments.length === 0) {
    return <Text style={baseStyle}>{text}</Text>;
  }

  // Now for each segment, find URLs and make them clickable
  const renderSegmentWithLinks = (segmentText: string, segmentStyle: TextStyle, segmentIndex: number) => {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    const urlRegex = new RegExp(URL_PATTERN.source, 'gi');
    let match;

    while ((match = urlRegex.exec(segmentText)) !== null) {
      // Add text before the URL
      if (match.index > lastIndex) {
        parts.push(
          <Text key={`text-${segmentIndex}-${lastIndex}`} style={segmentStyle}>
            {preserveTrailingSpaces(segmentText.substring(lastIndex, match.index))}
          </Text>
        );
      }

      // Add the URL as a clickable link
      const url = match[0];
      const fullUrl = url.startsWith('www.') ? `https://${url}` : url;
      parts.push(
        <Text
          key={`link-${segmentIndex}-${match.index}`}
          style={[segmentStyle, { color: linkColor || '#2196F3', textDecorationLine: 'underline' }]}
          onPress={() => Linking.openURL(fullUrl).catch(() => {})}
        >
          {url}
        </Text>
      );

      lastIndex = match.index + url.length;
    }

    // Add remaining text after the last URL
    if (lastIndex < segmentText.length) {
      parts.push(
        <Text key={`text-${segmentIndex}-${lastIndex}`} style={segmentStyle}>
          {preserveTrailingSpaces(segmentText.substring(lastIndex))}
        </Text>
      );
    }

    // If no URLs found, just return the text
    if (parts.length === 0) {
      return (
        <Text key={`segment-${segmentIndex}`} style={segmentStyle}>
          {preserveTrailingSpaces(segmentText)}
        </Text>
      );
    }

    return parts;
  };

  return (
    <Text style={baseStyle}>
      {segments.map((segment, index) => {
        const segmentStyle = styleToTextStyle(segment.style);
        return renderSegmentWithLinks(segment.text, segmentStyle, index);
      })}
    </Text>
  );
}

