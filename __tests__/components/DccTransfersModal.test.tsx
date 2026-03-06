import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import { DccTransfersModal, DccTransfer } from '../../src/components/DccTransfersModal';

const mockShareOpen = jest.fn();
const mockExists = jest.fn();

jest.mock('react-native-share', () => ({
  open: (...args: unknown[]) => mockShareOpen(...args),
}));

jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/doc',
  exists: (...args: unknown[]) => mockExists(...args),
}));

const styles = {
  modalOverlay: {},
  modalContent: {},
  modalTitle: {},
  optionText: {},
  destructiveOption: {},
};

const mk = (overrides: Partial<DccTransfer>): DccTransfer => ({
  id: '1',
  direction: 'incoming',
  status: 'pending',
  offer: { filename: 'file.txt' },
  bytesReceived: 0,
  ...overrides,
});

describe('DccTransfersModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    mockExists.mockResolvedValue(true);
    mockShareOpen.mockResolvedValue(undefined);
  });

  it('renders empty state', () => {
    const { getByText } = render(
      <DccTransfersModal
        visible
        onClose={jest.fn()}
        transfers={[]}
        onAccept={jest.fn()}
        onCancel={jest.fn()}
        styles={styles}
      />
    );

    expect(getByText('No transfers')).toBeTruthy();
  });

  it('accepts pending incoming transfer', async () => {
    const onAccept = jest.fn().mockResolvedValue(undefined);

    const { getByText } = render(
      <DccTransfersModal
        visible
        onClose={jest.fn()}
        transfers={[mk({ id: 'p1', offer: { filename: 'song.mp3' } })]}
        onAccept={onAccept}
        onCancel={jest.fn()}
        styles={styles}
      />
    );

    await act(async () => {
      fireEvent.press(getByText('Accept'));
    });

    expect(onAccept).toHaveBeenCalledWith('p1', '/doc/song.mp3');
  });

  it('handles resume and cancel actions', async () => {
    const onAccept = jest.fn().mockResolvedValue(undefined);
    const onCancel = jest.fn();

    const { getByText } = render(
      <DccTransfersModal
        visible
        onClose={jest.fn()}
        transfers={[
          mk({ id: 'f1', status: 'failed', filePath: '/x/old.txt' }),
          mk({ id: 'd1', status: 'downloading' }),
        ]}
        onAccept={onAccept}
        onCancel={onCancel}
        styles={styles}
      />
    );

    await act(async () => {
      fireEvent.press(getByText('Resume'));
    });
    fireEvent.press(getByText('Cancel'));

    expect(onAccept).toHaveBeenCalledWith('f1', '/x/old.txt');
    expect(onCancel).toHaveBeenCalledWith('d1');
  });

  it('opens completed incoming file through share', async () => {
    const transfer = mk({
      id: 'c1',
      status: 'completed',
      filePath: '/storage/emulated/0/Download/file.pdf',
      offer: { filename: 'file.pdf' },
    });

    const { getByText } = render(
      <DccTransfersModal
        visible
        onClose={jest.fn()}
        transfers={[transfer]}
        onAccept={jest.fn()}
        onCancel={jest.fn()}
        styles={styles}
      />
    );

    await act(async () => {
      fireEvent.press(getByText('Open File'));
    });

    expect(mockExists).toHaveBeenCalledWith('/storage/emulated/0/Download/file.pdf');
    expect(mockShareOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'file:///storage/emulated/0/Download/file.pdf',
        type: 'application/pdf',
      })
    );
  });

  it('shows alert when completed file path is missing', async () => {
    const transfer = mk({ id: 'c2', status: 'completed', filePath: undefined });

    const { queryByText } = render(
      <DccTransfersModal
        visible
        onClose={jest.fn()}
        transfers={[transfer]}
        onAccept={jest.fn()}
        onCancel={jest.fn()}
        styles={styles}
      />
    );

    expect(queryByText('Open File')).toBeNull();
  });
});
