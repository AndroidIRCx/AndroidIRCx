type Listener = (...args: any[]) => void;

export class FakeSocket {
  public connected = false;
  public destroyed = false;
  public writes: string[] = [];

  private listeners: Record<string, Listener[]> = {};

  connect = jest.fn((port: number, host: string, cb?: () => void) => {
    this.connected = true;
    cb && cb();
  });

  once(event: string, cb: Listener) {
    this.on(event, (...args: any[]) => {
      this.off(event, cb);
      cb(...args);
    });
  }

  on(event: string, cb: Listener) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(cb);
  }

  off(event: string, cb: Listener) {
    const arr = this.listeners[event];
    if (!arr) return;
    this.listeners[event] = arr.filter(l => l !== cb);
  }

  write = jest.fn((data: string) => {
    this.writes.push(data);
  });

  destroy = jest.fn(() => {
    this.destroyed = true;
  });

  emit(event: string, ...args: any[]) {
    this.listeners[event]?.forEach(cb => cb(...args));
  }
}
