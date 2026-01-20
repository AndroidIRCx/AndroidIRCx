type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  tag: string;
  message: string;
  timestamp: number;
}

// Patterns that may contain sensitive information
const SENSITIVE_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // Password patterns
  { pattern: /password[=:\s]+\S+/gi, replacement: 'password=[REDACTED]' },
  { pattern: /pass[=:\s]+\S+/gi, replacement: 'pass=[REDACTED]' },
  // SASL authentication
  { pattern: /AUTHENTICATE\s+\S+/gi, replacement: 'AUTHENTICATE [REDACTED]' },
  { pattern: /sasl[_-]?password[=:\s]+\S+/gi, replacement: 'sasl_password=[REDACTED]' },
  // NickServ/Auth commands
  { pattern: /IDENTIFY\s+\S+/gi, replacement: 'IDENTIFY [REDACTED]' },
  { pattern: /nickserv\s+identify\s+\S+/gi, replacement: 'nickserv identify [REDACTED]' },
  // OAuth/API tokens
  { pattern: /token[=:\s]+\S+/gi, replacement: 'token=[REDACTED]' },
  { pattern: /oauth[=:\s]+\S+/gi, replacement: 'oauth=[REDACTED]' },
  { pattern: /api[_-]?key[=:\s]+\S+/gi, replacement: 'api_key=[REDACTED]' },
  { pattern: /bearer\s+\S+/gi, replacement: 'Bearer [REDACTED]' },
  // Server password
  { pattern: /PASS\s+\S+/gi, replacement: 'PASS [REDACTED]' },
  // Certificate/key data
  { pattern: /-----BEGIN[^-]+-----[\s\S]*?-----END[^-]+-----/g, replacement: '[CERTIFICATE REDACTED]' },
  { pattern: /fingerprint[=:\s]+[a-fA-F0-9:]+/gi, replacement: 'fingerprint=[REDACTED]' },
  // Base64 encoded credentials (common in SASL)
  { pattern: /:[A-Za-z0-9+/=]{20,}/g, replacement: ':[REDACTED]' },
];

function sanitizeMessage(message: string): string {
  let sanitized = message;
  for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, replacement);
  }
  return sanitized;
}

class Logger {
  private buffer: LogEntry[] = [];
  private bufferLimit = 200;
  private enabled = false;
  private echoToConsole = true;

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  setConsoleEcho(enabled: boolean) {
    this.echoToConsole = enabled;
  }

  setBufferLimit(limit: number) {
    this.bufferLimit = Math.max(50, limit);
    this.trim();
  }

  getBuffer(): LogEntry[] {
    return [...this.buffer];
  }

  debug(tag: string, message: string) {
    this.add('debug', tag, message);
  }
  info(tag: string, message: string) {
    this.add('info', tag, message);
  }
  warn(tag: string, message: string) {
    this.add('warn', tag, message);
  }
  error(tag: string, message: string) {
    this.add('error', tag, message);
  }

  private add(level: LogLevel, tag: string, message: string) {
    if (!this.enabled) return;
    const sanitizedMessage = sanitizeMessage(message);
    const entry: LogEntry = {
      level,
      tag,
      message: sanitizedMessage,
      timestamp: Date.now(),
    };
    this.buffer.push(entry);
    this.trim();

    if (this.echoToConsole) {
      const prefix = `[${level.toUpperCase()}][${tag}]`;
      const line = `${prefix} ${sanitizedMessage}`;
      switch (level) {
        case 'debug':
          // eslint-disable-next-line no-console
          console.debug(line);
          break;
        case 'info':
          // eslint-disable-next-line no-console
          console.info(line);
          break;
        case 'warn':
          // eslint-disable-next-line no-console
          console.warn(line);
          break;
        case 'error':
          // eslint-disable-next-line no-console
          console.error(line);
          break;
        default:
          // eslint-disable-next-line no-console
          console.log(line);
      }
    }
  }

  private trim() {
    if (this.buffer.length > this.bufferLimit) {
      this.buffer = this.buffer.slice(-this.bufferLimit);
    }
  }
}

export const logger = new Logger();
