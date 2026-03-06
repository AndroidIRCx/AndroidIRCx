import React from 'react';
import { Alert, Linking } from 'react-native';
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
    if (key === 'Saved to {path}' && params?.path) return `Saved to ${params.path}`;
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
  responseText = '<html><head><title>Example Page</title><meta property="og:description" content="Sample desc" /></head></html>';
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  open() {}
  send() {
    if (this.onload) this.onload();
  }
  abort() {}
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
      <LinkPreview url="https://example.com/path?q=1" onPress={onPress} />
    );

    await waitFor(() => {
      expect(getByText('example.com')).toBeTruthy();
      expect(getByText('Example Page')).toBeTruthy();
    });

    fireEvent.press(getByText('Example Page'));
    expect(onPress).toHaveBeenCalled();
  });

  it('opens URL when no custom onPress is provided', async () => {
    const { getAllByText } = render(
      <LinkPreview url="https://example.com" />
    );

    await waitFor(() => {
      expect(getAllByText('example.com').length).toBeGreaterThan(0);
    });

    fireEvent.press(getAllByText('example.com')[0]);
    expect(Linking.openURL).toHaveBeenCalledWith('https://example.com');
  });

  it('downloads linked file and shows success alert', async () => {
    const { getByText } = render(
      <LinkPreview url="https://example.com/files/report.pdf" />
    );

    await waitFor(() => {
      expect(getByText('Download')).toBeTruthy();
    });

    fireEvent.press(getByText('Download'));

    await waitFor(() => {
      expect(mockDownloadFile).toHaveBeenCalled();
      expect(Alert.alert).toHaveBeenCalledWith('Download complete', 'Saved to /doc/report.pdf');
    });
  });
});
