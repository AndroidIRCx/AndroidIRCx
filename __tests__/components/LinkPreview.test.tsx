import React from 'react';
import { Alert, Linking, Image } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { LinkPreview } from '../../src/components/LinkPreview';

const mockDownloadFile = jest.fn();

jest.mock('../../src/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      surfaceVariant: '#222',
      border: '#333',
      text: '#fff',
      textSecondary: '#aaa',
      primary: '#08f',
      surface: '#111',
      buttonSecondary: '#444',
      buttonSecondaryText: '#fff',
    },
  }),
}));

jest.mock('../../src/i18n/transifex', () => ({
  useT: () => (key: string, params?: Record<string, string>) => {
    if (key === 'Saved to {path}' && params?.path)
      return `Saved to ${params.path}`;
    return key;
  },
}));

jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/doc',
  downloadFile: (...args: unknown[]) => mockDownloadFile(...args),
}));

class MockXHR {
  timeout = 0;
  status = 200;
  responseText =
    '<html><head><title>Example Page</title><meta property="og:description" content="Sample desc" /></head></html>';
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  open() {}
  send() {
    if (this.onload) this.onload();
  }
  abort() {}
}

class ErrorXHR extends MockXHR {
  send() {
    if (this.onerror) this.onerror();
  }
}

class TimeoutXHR extends MockXHR {
  send() {
    if (this.ontimeout) this.ontimeout();
  }
}

// Helper to build an XHR class serving a specific HTML body / status.
const makeHtmlXHR = (html: string | null, status = 200) =>
  class extends MockXHR {
    constructor() {
      super();
      this.status = status;
      // @ts-expect-error deliberate null to exercise parse-error branch
      this.responseText = html;
    }
  };

const imageUri = (utils: {
  UNSAFE_getByType: (t: unknown) => { props: { source: { uri: string } } };
}) => utils.UNSAFE_getByType(Image).props.source.uri;

describe('LinkPreview', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    (global as any).XMLHttpRequest = MockXHR as any;
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
    mockDownloadFile.mockReturnValue({ promise: Promise.resolve() });
  });

  it('renders metadata and handles custom press', async () => {
    const onPress = jest.fn();
    const { getByText } = await render(
      <LinkPreview url="https://example.com/path?q=1" onPress={onPress} />,
    );

    await waitFor(async () => {
      expect(getByText('example.com')).toBeTruthy();
      expect(getByText('Example Page')).toBeTruthy();
    });

    await fireEvent.press(getByText('Example Page'));
    expect(onPress).toHaveBeenCalled();
  });

  it('opens URL when no custom onPress is provided', async () => {
    const { getAllByText } = await render(
      <LinkPreview url="https://example.com" />,
    );

    await waitFor(async () => {
      expect(getAllByText('example.com').length).toBeGreaterThan(0);
    });

    await fireEvent.press(getAllByText('example.com')[0]);
    expect(Linking.openURL).toHaveBeenCalledWith('https://example.com');
  });

  it('downloads linked file and shows success alert', async () => {
    const { getByText } = await render(
      <LinkPreview url="https://example.com/files/report.pdf" />,
    );

    await waitFor(async () => {
      expect(getByText('Download')).toBeTruthy();
    });

    await fireEvent.press(getByText('Download'));

    await waitFor(async () => {
      expect(mockDownloadFile).toHaveBeenCalled();
      expect(Alert.alert).toHaveBeenCalledWith(
        'Download complete',
        'Saved to /doc/report.pdf',
      );
    });
  });

  it('reports download progress and ignores zero content length', async () => {
    mockDownloadFile.mockImplementation((opts: any) => {
      opts.progress({ bytesWritten: 50, contentLength: 100 });
      // contentLength <= 0 should be ignored (false branch)
      opts.progress({ bytesWritten: 10, contentLength: 0 });
      return { promise: Promise.resolve() };
    });

    const { getByText } = await render(
      <LinkPreview url="https://example.com/files/movie.mp4" />,
    );

    await waitFor(async () => {
      expect(getByText('Download')).toBeTruthy();
    });

    await fireEvent.press(getByText('Download'));

    await waitFor(async () => {
      expect(mockDownloadFile).toHaveBeenCalled();
      expect(Alert.alert).toHaveBeenCalledWith(
        'Download complete',
        'Saved to /doc/movie.mp4',
      );
    });
  });

  it('handles youtube oembed success and fallback branches', async () => {
    class YouTubeXHR extends MockXHR {
      send() {
        this.responseText = JSON.stringify({
          title: 'YT title',
          thumbnail_url: 'https://yt/thumb.jpg',
        });
        if (this.onload) this.onload();
      }
    }
    (global as any).XMLHttpRequest = YouTubeXHR as any;

    const { getByText, rerender } = await render(
      <LinkPreview url="https://www.youtube.com/watch?v=abc123" />,
    );

    await waitFor(async () => {
      expect(getByText('YouTube')).toBeTruthy();
      expect(getByText('YT title')).toBeTruthy();
    });

    class YouTubeStatusFailXHR extends MockXHR {
      status = 500;
      send() {
        if (this.onload) this.onload();
      }
    }
    (global as any).XMLHttpRequest = YouTubeStatusFailXHR as any;
    await rerender(<LinkPreview url="https://youtu.be/xyz987" />);

    await waitFor(async () => {
      expect(getByText('YouTube Video xyz987')).toBeTruthy();
    });
  });

  it('extracts youtube video id from embed and shorts paths', async () => {
    class YouTubeXHR extends MockXHR {
      send() {
        this.responseText = JSON.stringify({ title: 'Embedded Clip' });
        if (this.onload) this.onload();
      }
    }
    (global as any).XMLHttpRequest = YouTubeXHR as any;

    const { getByText, rerender } = await render(
      <LinkPreview url="https://www.youtube.com/embed/EMBED123" />,
    );

    await waitFor(async () => {
      expect(getByText('Embedded Clip')).toBeTruthy();
    });

    await rerender(<LinkPreview url="https://youtube.com/shorts/SHORT99" />);

    await waitFor(async () => {
      expect(getByText('Embedded Clip')).toBeTruthy();
      expect(getByText('YouTube')).toBeTruthy();
    });
  });

  it('falls back to default metadata for youtube url without a video id', async () => {
    const { getAllByText } = await render(
      <LinkPreview url="https://youtube.com/feed/subscriptions" />,
    );

    await waitFor(async () => {
      expect(
        getAllByText('youtube.com/feed/subscriptions').length,
      ).toBeGreaterThan(0);
    });
  });

  it('handles youtube oembed JSON parse error', async () => {
    class YouTubeBadJsonXHR extends MockXHR {
      send() {
        this.responseText = 'not-json{';
        if (this.onload) this.onload();
      }
    }
    (global as any).XMLHttpRequest = YouTubeBadJsonXHR as any;

    const { getByText } = await render(
      <LinkPreview url="https://www.youtube.com/watch?v=parseErr" />,
    );

    await waitFor(async () => {
      expect(getByText('YouTube Video parseErr')).toBeTruthy();
    });
  });

  it('handles youtube oembed network error', async () => {
    class YouTubeErrorXHR extends MockXHR {
      send() {
        if (this.onerror) this.onerror();
      }
    }
    (global as any).XMLHttpRequest = YouTubeErrorXHR as any;

    const { getByText } = await render(
      <LinkPreview url="https://www.youtube.com/watch?v=netErr" />,
    );

    await waitFor(async () => {
      expect(getByText('YouTube Video netErr')).toBeTruthy();
    });
  });

  it('handles youtube oembed timeout', async () => {
    class YouTubeTimeoutXHR extends MockXHR {
      send() {
        if (this.ontimeout) this.ontimeout();
      }
    }
    (global as any).XMLHttpRequest = YouTubeTimeoutXHR as any;

    const { getByText } = await render(
      <LinkPreview url="https://www.youtube.com/watch?v=timeOut" />,
    );

    await waitFor(async () => {
      expect(getByText('YouTube Video timeOut')).toBeTruthy();
    });
  });

  it('handles xhr network and timeout metadata failures', async () => {
    (global as any).XMLHttpRequest = ErrorXHR as any;
    const { getAllByText, rerender } = await render(
      <LinkPreview url="https://example.org/a" />,
    );

    await waitFor(async () => {
      expect(getAllByText('example.org/a').length).toBeGreaterThan(0);
    });

    (global as any).XMLHttpRequest = TimeoutXHR as any;
    await rerender(<LinkPreview url="https://example.org/b?x=1" />);

    await waitFor(async () => {
      expect(getAllByText('example.org/b?x=1').length).toBeGreaterThan(0);
    });
  });

  it('uses absolute og:image url as-is', async () => {
    (global as any).XMLHttpRequest = makeHtmlXHR(
      '<html><head><meta property="og:image" content="https://cdn.example.com/a.png" /></head></html>',
    ) as any;

    const utils = await render(
      <LinkPreview url="https://example.com/article" />,
    );

    await waitFor(async () => {
      expect(imageUri(utils as any)).toBe('https://cdn.example.com/a.png');
    });
  });

  it('resolves protocol-relative og:image url', async () => {
    (global as any).XMLHttpRequest = makeHtmlXHR(
      '<html><head><meta property="og:image" content="//cdn.example.com/b.png" /></head></html>',
    ) as any;

    const utils = await render(
      <LinkPreview url="https://example.com/article" />,
    );

    await waitFor(async () => {
      expect(imageUri(utils as any)).toBe('https://cdn.example.com/b.png');
    });
  });

  it('resolves root-relative og:image url against origin', async () => {
    (global as any).XMLHttpRequest = makeHtmlXHR(
      '<html><head><meta property="og:image" content="/imgs/c.png" /></head></html>',
    ) as any;

    const utils = await render(
      <LinkPreview url="https://example.com/article" />,
    );

    await waitFor(async () => {
      expect(imageUri(utils as any)).toBe('https://example.com/imgs/c.png');
    });
  });

  it('resolves relative og:image url without leading slash', async () => {
    (global as any).XMLHttpRequest = makeHtmlXHR(
      '<html><head><meta property="og:image" content="d.png" /></head></html>',
    ) as any;

    const utils = await render(
      <LinkPreview url="https://example.com/article" />,
    );

    await waitFor(async () => {
      expect(imageUri(utils as any)).toBe('https://example.com/d.png');
    });
  });

  it('returns relative og:image untouched when the page url is unparseable', async () => {
    (global as any).XMLHttpRequest = makeHtmlXHR(
      '<html><head><meta property="og:image" content="/x.png" /></head></html>',
    ) as any;

    const utils = await render(<LinkPreview url="http://" />);

    await waitFor(async () => {
      expect(imageUri(utils as any)).toBe('/x.png');
    });
  });

  it('falls back to parsed favicon when no og:image is present', async () => {
    (global as any).XMLHttpRequest = makeHtmlXHR(
      '<html><head><link rel="icon" href="/fav.ico" /></head></html>',
    ) as any;

    const utils = await render(<LinkPreview url="https://example.com/page" />);

    await waitFor(async () => {
      expect(imageUri(utils as any)).toBe('https://example.com/fav.ico');
    });
  });

  it('falls back to /favicon.ico when metadata has no image', async () => {
    (global as any).XMLHttpRequest = makeHtmlXHR(
      '<html><head><title>No Image Here</title></head></html>',
    ) as any;

    const utils = await render(<LinkPreview url="https://example.com/page" />);

    await waitFor(async () => {
      expect(imageUri(utils as any)).toBe('https://example.com/favicon.ico');
    });
  });

  it('resolves undefined metadata on non-2xx page fetch status', async () => {
    (global as any).XMLHttpRequest = makeHtmlXHR('<html></html>', 404) as any;

    const { getAllByText } = await render(
      <LinkPreview url="https://example.net/missing" />,
    );

    await waitFor(async () => {
      expect(getAllByText('example.net/missing').length).toBeGreaterThan(0);
    });
  });

  it('resolves undefined metadata when parsing the response throws', async () => {
    (global as any).XMLHttpRequest = makeHtmlXHR(null, 200) as any;

    const { getAllByText } = await render(
      <LinkPreview url="https://example.net/broken" />,
    );

    await waitFor(async () => {
      expect(getAllByText('example.net/broken').length).toBeGreaterThan(0);
    });
  });

  it('resolves undefined metadata when XHR construction throws', async () => {
    class ThrowingXHR {
      constructor() {
        throw new Error('cannot construct');
      }
    }
    (global as any).XMLHttpRequest = ThrowingXHR as any;

    const { getAllByText } = await render(
      <LinkPreview url="https://example.net/throws" />,
    );

    await waitFor(async () => {
      expect(getAllByText('example.net/throws').length).toBeGreaterThan(0);
    });
  });

  it('aborts the page fetch when the request times out', async () => {
    class PendingXHR extends MockXHR {
      send() {
        // never resolves; relies on the AbortController timeout firing
      }
    }
    (global as any).XMLHttpRequest = PendingXHR as any;

    const { getAllByText } = await render(
      <LinkPreview url="https://slow.example.com/x" />,
    );

    // The component aborts after 4s and then renders default metadata.
    await waitFor(
      async () => {
        expect(getAllByText('slow.example.com/x').length).toBeGreaterThan(0);
      },
      { timeout: 6000 },
    );
  });

  it('handles image error, openURL failure and download failure', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (global as any).XMLHttpRequest = makeHtmlXHR(
      '<html><head><title>Example Page</title><meta property="og:image" content="https://cdn.example.com/z.png" /></head></html>',
    ) as any;
    (Linking.openURL as jest.Mock).mockRejectedValueOnce(
      new Error('open-fail'),
    );
    const rejected = Promise.reject(new Error('net-down'));
    rejected.catch(() => {});
    mockDownloadFile.mockReturnValue({
      promise: rejected,
    });

    const { getByText, UNSAFE_getByType, UNSAFE_queryAllByType } = await render(
      <LinkPreview url="https://example.com/file.zip" />,
    );

    await waitFor(async () => {
      expect(getByText('Example Page')).toBeTruthy();
    });

    const image = UNSAFE_getByType(Image);
    await fireEvent(image, 'error');
    await waitFor(async () => {
      expect(UNSAFE_queryAllByType(Image)).toHaveLength(0);
    });

    await fireEvent.press(getByText('example.com'));
    await waitFor(async () => {
      expect(Linking.openURL).toHaveBeenCalledWith(
        'https://example.com/file.zip',
      );
    });

    await fireEvent.press(getByText('Download'));
    await waitFor(async () => {
      expect(Alert.alert).toHaveBeenCalledWith('Download failed', 'net-down');
    });

    errorSpy.mockRestore();
  });

  it('shows generic download failure message when error has no message', async () => {
    const rejected = Promise.reject({});
    rejected.catch(() => {});
    mockDownloadFile.mockReturnValue({ promise: rejected });

    const { getByText } = await render(
      <LinkPreview url="https://example.com/thing.bin" />,
    );

    await waitFor(async () => {
      expect(getByText('Download')).toBeTruthy();
    });

    await fireEvent.press(getByText('Download'));

    await waitFor(async () => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Download failed',
        'Unable to download file',
      );
    });
  });

  it('supports hiding download button and invalid url display fallback', async () => {
    const { queryByText, getAllByText } = await render(
      <LinkPreview url="not-a-valid-url" showDownloadButton={false} />,
    );

    await waitFor(async () => {
      expect(getAllByText('not-a-valid-url').length).toBeGreaterThan(0);
    });
    expect(queryByText('Download')).toBeNull();
  });
});
