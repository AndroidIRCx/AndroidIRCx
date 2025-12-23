type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  tag: string;
  message: string;
  timestamp: number;
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
    const entry: LogEntry = {
      level,
      tag,
      message,
      timestamp: Date.now(),
    };
    this.buffer.push(entry);
    this.trim();

    if (this.echoToConsole) {
      const prefix = `[${level.toUpperCase()}][${tag}]`;
      const line = `${prefix} ${message}`;
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
