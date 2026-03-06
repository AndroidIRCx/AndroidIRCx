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
      />
    );

    fireEvent.changeText(getByPlaceholderText('Or enter file path manually'), '/tmp/manual.zip');
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
      />
    );

    await act(async () => {
      fireEvent.press(getByText('Send'));
    });

    expect(onSend).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalledWith('No file selected', 'Please select a file to send');
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
      />
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
      />
    );

    await act(async () => {
      fireEvent.press(getByText('Cancel'));
    });

    expect(mockExists).toHaveBeenCalledWith('/doc/file.txt');
    expect(mockUnlink).toHaveBeenCalledWith('/doc/file.txt');
    expect(onChangeFilePath).toHaveBeenCalledWith('');
    expect(onClose).toHaveBeenCalled();
  });
});
