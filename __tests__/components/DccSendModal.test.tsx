import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import { DccSendModal } from '../../src/components/DccSendModal';

const mockPick = jest.fn();
const mockIsErrorWithCode = jest.fn();
const mockExists = jest.fn();
const mockStat = jest.fn();
const mockUnlink = jest.fn();
const mockCopyFile = jest.fn();
const mockReadFile = jest.fn();
const mockWriteFile = jest.fn();

jest.mock('@react-native-documents/picker', () => ({
  pick: (...args: unknown[]) => mockPick(...args),
  isErrorWithCode: (...args: unknown[]) => mockIsErrorWithCode(...args),
  errorCodes: { OPERATION_CANCELED: 'OPERATION_CANCELED' },
}));

jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/doc',
  CachesDirectoryPath: '/cache',
  exists: (...args: unknown[]) => mockExists(...args),
  stat: (...args: unknown[]) => mockStat(...args),
  unlink: (...args: unknown[]) => mockUnlink(...args),
  copyFile: (...args: unknown[]) => mockCopyFile(...args),
  readFile: (...args: unknown[]) => mockReadFile(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
}));

const styles = {
  modalOverlay: {},
  modalContent: {},
  modalTitle: {},
  modalButtons: {},
  modalButton: {},
  modalButtonCancel: {},
  modalButtonJoin: {},
  modalButtonText: {},
  modalButtonTextPrimary: {},
  modalInput: {},
};

describe('DccSendModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    mockExists.mockResolvedValue(true);
    mockStat.mockResolvedValue({ size: 100 });
  });

  it('renders selected file state from manual input and sends', async () => {
    const onSend = jest.fn().mockResolvedValue(undefined);
    const onChangeFilePath = jest.fn();

    const { getByPlaceholderText, getByText } = render(
      <DccSendModal
        visible
        onClose={jest.fn()}
        targetNick="alice"
        filePath="/tmp/a.txt"
        onChangeFilePath={onChangeFilePath}
        onSend={onSend}
        styles={styles}
      />,
    );

    fireEvent.changeText(
      getByPlaceholderText('Or enter file path manually'),
      '/tmp/manual.zip',
    );
    await act(async () => {
      fireEvent.press(getByText('Send'));
    });

    expect(onChangeFilePath).toHaveBeenCalledWith('/tmp/manual.zip');
    expect(onSend).toHaveBeenCalled();
  });

  it('keeps send disabled when no file is selected', async () => {
    const onSend = jest.fn();
    const { getByText } = render(
      <DccSendModal
        visible
        onClose={jest.fn()}
        targetNick="alice"
        filePath=""
        onChangeFilePath={jest.fn()}
        onSend={onSend}
        styles={styles}
      />,
    );

    await act(async () => {
      fireEvent.press(getByText('Send'));
    });

    expect(onSend).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalledWith(
      'No file selected',
      'Please select a file to send',
    );
  });

  it('handles browse success via fileCopyUri', async () => {
    const onChangeFilePath = jest.fn();
    mockPick.mockResolvedValue([
      {
        uri: 'content://provider/file',
        fileCopyUri: 'file:///doc/file%20copy.txt',
        name: 'file copy.txt',
      },
    ]);

    const { getByText, getByText: getText } = render(
      <DccSendModal
        visible
        onClose={jest.fn()}
        targetNick="alice"
        filePath=""
        onChangeFilePath={onChangeFilePath}
        onSend={jest.fn().mockResolvedValue(undefined)}
        styles={styles}
      />,
    );

    await act(async () => {
      fireEvent.press(getByText('Browse Files'));
    });

    expect(onChangeFilePath).toHaveBeenCalledWith('/doc/file copy.txt');
    expect(getText('Selected:')).toBeTruthy();
    expect(getText('file copy.txt')).toBeTruthy();
  });

  it('closes modal and cleans copied file path', async () => {
    const onClose = jest.fn();
    const onChangeFilePath = jest.fn();

    const { getByText } = render(
      <DccSendModal
        visible
        onClose={onClose}
        targetNick="alice"
        filePath="/doc/file.txt"
        onChangeFilePath={onChangeFilePath}
        onSend={jest.fn().mockResolvedValue(undefined)}
        styles={styles}
      />,
    );

    await act(async () => {
      fireEvent.press(getByText('Cancel'));
    });

    expect(mockExists).toHaveBeenCalledWith('/doc/file.txt');
    expect(mockUnlink).toHaveBeenCalledWith('/doc/file.txt');
    expect(onChangeFilePath).toHaveBeenCalledWith('');
    expect(onClose).toHaveBeenCalled();
  });

  it('handles content uri by copying file manually', async () => {
    const onChangeFilePath = jest.fn();
    mockPick.mockResolvedValue([
      {
        uri: 'content://provider/file2',
        name: 'copy-target.txt',
      },
    ]);
    mockCopyFile.mockResolvedValue(undefined);

    const { getByText } = render(
      <DccSendModal
        visible
        onClose={jest.fn()}
        targetNick="alice"
        filePath=""
        onChangeFilePath={onChangeFilePath}
        onSend={jest.fn().mockResolvedValue(undefined)}
        styles={styles}
      />,
    );

    await act(async () => {
      fireEvent.press(getByText('Browse Files'));
    });

    expect(mockCopyFile).toHaveBeenCalledWith(
      'content://provider/file2',
      '/doc/copy-target.txt',
    );
    expect(onChangeFilePath).toHaveBeenCalledWith('/doc/copy-target.txt');
  });

  it('falls back to read/write when copyFile fails', async () => {
    const onChangeFilePath = jest.fn();
    mockPick.mockResolvedValue([
      {
        uri: 'content://provider/file3',
        name: 'fallback.txt',
      },
    ]);
    mockCopyFile.mockRejectedValue(new Error('copy fail'));
    mockReadFile.mockResolvedValue('YmFzZTY0');
    mockWriteFile.mockResolvedValue(undefined);

    const { getByText } = render(
      <DccSendModal
        visible
        onClose={jest.fn()}
        targetNick="alice"
        filePath=""
        onChangeFilePath={onChangeFilePath}
        onSend={jest.fn().mockResolvedValue(undefined)}
        styles={styles}
      />,
    );

    await act(async () => {
      fireEvent.press(getByText('Browse Files'));
    });

    expect(mockReadFile).toHaveBeenCalledWith(
      'content://provider/file3',
      'base64',
    );
    expect(mockWriteFile).toHaveBeenCalledWith(
      '/doc/fallback.txt',
      'YmFzZTY0',
      'base64',
    );
    expect(onChangeFilePath).toHaveBeenCalledWith('/doc/fallback.txt');
  });

  it('alerts when copy and fallback both fail', async () => {
    mockPick.mockResolvedValue([
      {
        uri: 'content://provider/file4',
        name: 'broken.txt',
      },
    ]);
    mockCopyFile.mockRejectedValue(new Error('copy fail'));
    mockReadFile.mockRejectedValue(new Error('read fail'));

    const { getByText } = render(
      <DccSendModal
        visible
        onClose={jest.fn()}
        targetNick="alice"
        filePath=""
        onChangeFilePath={jest.fn()}
        onSend={jest.fn().mockResolvedValue(undefined)}
        styles={styles}
      />,
    );

    await act(async () => {
      fireEvent.press(getByText('Browse Files'));
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Could not access the selected file. Please try a different file.',
    );
  });

  it('alerts when selected file cannot be verified', async () => {
    const onChangeFilePath = jest.fn();
    mockPick.mockResolvedValue([
      {
        uri: 'file:///doc/verify.txt',
        name: 'verify.txt',
      },
    ]);
    mockExists.mockResolvedValue(false);

    const { getByText } = render(
      <DccSendModal
        visible
        onClose={jest.fn()}
        targetNick="alice"
        filePath=""
        onChangeFilePath={onChangeFilePath}
        onSend={jest.fn().mockResolvedValue(undefined)}
        styles={styles}
      />,
    );

    await act(async () => {
      fireEvent.press(getByText('Browse Files'));
    });

    expect(onChangeFilePath).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Could not access the selected file. Please try again.',
    );
  });

  it('alerts when file stat verification throws', async () => {
    mockPick.mockResolvedValue([
      {
        uri: 'file:///doc/bad-stat.txt',
        name: 'bad-stat.txt',
      },
    ]);
    mockExists.mockResolvedValue(true);
    mockStat.mockRejectedValue(new Error('stat failed'));

    const { getByText } = render(
      <DccSendModal
        visible
        onClose={jest.fn()}
        targetNick="alice"
        filePath=""
        onChangeFilePath={jest.fn()}
        onSend={jest.fn().mockResolvedValue(undefined)}
        styles={styles}
      />,
    );

    await act(async () => {
      fireEvent.press(getByText('Browse Files'));
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Could not verify file access: stat failed',
    );
  });

  it('shows no-file alert when send handler is invoked without a path', async () => {
    const { UNSAFE_root } = render(
      <DccSendModal
        visible
        onClose={jest.fn()}
        targetNick="alice"
        filePath=""
        onChangeFilePath={jest.fn()}
        onSend={jest.fn().mockResolvedValue(undefined)}
        styles={styles}
      />,
    );

    const disabledSendButton = UNSAFE_root.findAll(
      node => node.props?.disabled === true,
    )[0];
    await act(async () => {
      await disabledSendButton.props.onPress();
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'No file selected',
      'Please select a file to send',
    );
  });

  it('prevents duplicate browse actions while a pick is already in progress', async () => {
    let resolvePick: ((value: any[]) => void) | undefined;
    mockPick.mockImplementation(
      () =>
        new Promise<any[]>(resolve => {
          resolvePick = resolve;
        }),
    );

    const { getByText } = render(
      <DccSendModal
        visible
        onClose={jest.fn()}
        targetNick="alice"
        filePath=""
        onChangeFilePath={jest.fn()}
        onSend={jest.fn().mockResolvedValue(undefined)}
        styles={styles}
      />,
    );

    fireEvent.press(getByText('Browse Files'));
    fireEvent.press(getByText('Selecting...'));
    expect(mockPick).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolvePick?.([]);
    });
  });

  it('warns but still closes when cleanup fails', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockExists.mockResolvedValue(true);
    mockUnlink.mockRejectedValue(new Error('unlink failed'));

    const { getByText } = render(
      <DccSendModal
        visible
        onClose={jest.fn()}
        targetNick="alice"
        filePath="/cache/file.txt"
        onChangeFilePath={jest.fn()}
        onSend={jest.fn().mockResolvedValue(undefined)}
        styles={styles}
      />,
    );

    await act(async () => {
      fireEvent.press(getByText('Cancel'));
    });

    expect(warnSpy).toHaveBeenCalledWith(
      '[DccSendModal] Failed to clean up copied file:',
      expect.any(Error),
    );
    warnSpy.mockRestore();
  });

  it('ignores picker cancellation and alerts on picker errors', async () => {
    mockPick.mockRejectedValueOnce({ code: 'OPERATION_CANCELED' });
    mockIsErrorWithCode.mockReturnValueOnce(true);

    const { getByText, rerender } = render(
      <DccSendModal
        visible
        onClose={jest.fn()}
        targetNick="alice"
        filePath=""
        onChangeFilePath={jest.fn()}
        onSend={jest.fn().mockResolvedValue(undefined)}
        styles={styles}
      />,
    );

    await act(async () => {
      fireEvent.press(getByText('Browse Files'));
    });
    expect(Alert.alert).not.toHaveBeenCalled();

    mockPick.mockRejectedValueOnce(new Error('picker failed'));
    mockIsErrorWithCode.mockReturnValueOnce(false);
    rerender(
      <DccSendModal
        visible
        onClose={jest.fn()}
        targetNick="alice"
        filePath=""
        onChangeFilePath={jest.fn()}
        onSend={jest.fn().mockResolvedValue(undefined)}
        styles={styles}
      />,
    );
    await act(async () => {
      fireEvent.press(getByText('Browse Files'));
    });
    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Failed to select file: picker failed',
    );
  });
});
