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

describe('LinkPreview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).XMLHttpRequest = MockXHR as any;
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
    mockDownloadFile.mockReturnValue({ promise: Promise.resolve() });
  });

  it('renders metadata and handles custom press', async () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <LinkPreview url="https://example.com/path?q=1" onPress={onPress} />,
    );

    await waitFor(() => {
      expect(getByText('example.com')).toBeTruthy();
      expect(getByText('Example Page')).toBeTruthy();
    });

    fireEvent.press(getByText('Example Page'));
    expect(onPress).toHaveBeenCalled();
  });

  it('opens URL when no custom onPress is provided', async () => {
    const { getAllByText } = render(<LinkPreview url="https://example.com" />);

    await waitFor(() => {
      expect(getAllByText('example.com').length).toBeGreaterThan(0);
    });

    fireEvent.press(getAllByText('example.com')[0]);
    expect(Linking.openURL).toHaveBeenCalledWith('https://example.com');
  });

  it('downloads linked file and shows success alert', async () => {
    const { getByText } = render(
      <LinkPreview url="https://example.com/files/report.pdf" />,
    );

    await waitFor(() => {
      expect(getByText('Download')).toBeTruthy();
    });

    fireEvent.press(getByText('Download'));

    await waitFor(() => {
      expect(mockDownloadFile).toHaveBeenCalled();
      expect(Alert.alert).toHaveBeenCalledWith(
        'Download complete',
        'Saved to /doc/report.pdf',
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

    const { getByText, rerender } = render(
      <LinkPreview url="https://www.youtube.com/watch?v=abc123" />,
    );

    await waitFor(() => {
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
    rerender(<LinkPreview url="https://youtu.be/xyz987" />);

    await waitFor(() => {
      expect(getByText('YouTube Video xyz987')).toBeTruthy();
    });
  });

  it('handles xhr network and timeout metadata failures', async () => {
    (global as any).XMLHttpRequest = ErrorXHR as any;
    const { getAllByText, rerender } = render(
      <LinkPreview url="https://example.org/a" />,
    );

    await waitFor(() => {
      expect(getAllByText('example.org/a').length).toBeGreaterThan(0);
    });

    (global as any).XMLHttpRequest = TimeoutXHR as any;
    rerender(<LinkPreview url="https://example.org/b?x=1" />);

    await waitFor(() => {
      expect(getAllByText('example.org/b?x=1').length).toBeGreaterThan(0);
    });
  });

  it('handles image error, openURL failure and download failure', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (Linking.openURL as jest.Mock).mockRejectedValueOnce(
      new Error('open-fail'),
    );
    const rejected = Promise.reject(new Error('net-down'));
    rejected.catch(() => {});
    mockDownloadFile.mockReturnValue({
      promise: rejected,
    });

    const { getByText, UNSAFE_getByType, UNSAFE_queryAllByType } = render(
      <LinkPreview url="https://example.com/file.zip" />,
    );

    await waitFor(() => {
      expect(getByText('Example Page')).toBeTruthy();
    });

    const image = UNSAFE_getByType(Image);
    fireEvent(image, 'error');
    await waitFor(() => {
      expect(UNSAFE_queryAllByType(Image)).toHaveLength(0);
    });

    fireEvent.press(getByText('example.com'));
    await waitFor(() => {
      expect(Linking.openURL).toHaveBeenCalledWith(
        'https://example.com/file.zip',
      );
    });

    fireEvent.press(getByText('Download'));
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Download failed', 'net-down');
    });

    errorSpy.mockRestore();
  });

  it('supports hiding download button and invalid url display fallback', async () => {
    const { queryByText, getByText } = render(
      <LinkPreview url="not-a-valid-url" showDownloadButton={false} />,
    );

    await waitFor(() => {
      expect(getByText('not-a-valid-url')).toBeTruthy();
    });
    expect(queryByText('Download')).toBeNull();
  });
});
