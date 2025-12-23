/**
 * Example usage of IRCFormatter
 * 
 * This file demonstrates how to use the IRC formatting utilities
 * to display IRC-formatted text in React Native components.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatIRCTextAsComponent, stripIRCFormatting } from './IRCFormatter';

/**
 * Example: Displaying formatted IRC text in a message
 */
export const FormattedMessageExample: React.FC<{ message: string }> = ({ message }) => {
  return (
    <View style={styles.container}>
      {/* Display with IRC formatting */}
      <Text style={styles.messageText}>
        {formatIRCTextAsComponent(message, styles.baseText)}
      </Text>
      
      {/* Or display without formatting */}
      <Text style={styles.plainText}>
        {stripIRCFormatting(message)}
      </Text>
    </View>
  );
};

/**
 * Example: Using in MessageArea component
 * 
 * Replace the plain Text component with:
 * 
 * import { formatIRCTextAsComponent } from '../utils/IRCFormatter';
 * 
 * // In your message rendering:
 * {message.type === 'message' ? (
 *   <View style={styles.messageContent}>
 *     <Text style={styles.nick}>{message.from}</Text>
 *     {formatIRCTextAsComponent(message.text, styles.messageText)}
 *   </View>
 * ) : (
 *   // ... other message types
 * )}
 */

const styles = StyleSheet.create({
  container: {
    padding: 10,
  },
  messageText: {
    fontSize: 14,
    marginBottom: 5,
  },
  baseText: {
    fontSize: 14,
    color: '#212121',
  },
  plainText: {
    fontSize: 12,
    color: '#757575',
    fontStyle: 'italic',
  },
});

/**
 * IRC Format Codes Examples:
 * 
 * Bold: \x02text\x02 or \x02text\x0F
 * Color: \x03colorcode or \x03foreground,background
 * Underline: \x1Ftext\x1F
 * Italic: \x1Dtext\x1D
 * Strikethrough: \x1Etext\x1E
 * Reverse: \x16text\x16
 * Reset: \x0F
 * 
 * Color codes:
 * - 0-15: Standard IRC colors
 * - 16-98: Extended RGB colors
 * 
 * Example formatted messages:
 * - "\x034Hello \x038world\x03" - Red "Hello" and Yellow "world"
 * - "\x02Bold \x034Red\x03 \x02Bold\x02" - Bold text with red word
 * - "\x031,4Red on Green\x03" - Red text on green background
 */

