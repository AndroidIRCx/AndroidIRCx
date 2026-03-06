import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import { CameraScreen } from '../../src/components/CameraScreen';

const mockReadFile = jest.fn();
const mockWriteFile = jest.fn();

let mockHasPermission = true;
let mockDevice: any = { id: 'back' };
const mockRequestPermission = jest.fn();
const mockTakePhoto = jest.fn();

jest.mock('react-native-fs', () => ({
  CachesDirectoryPath: '/cache',
  readFile: (...args: unknown[]) => mockReadFile(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
}));

jest.mock('react-native-vision-camera', () => {
  const React = require('react');
  return {
    Camera: React.forwardRef((props: any, ref: any) => {
      React.useImperativeHandle(ref, () => ({
        takePhoto: (...args: unknown[]) => mockTakePhoto(...args),
      }));
      return React.createElement('Camera', props, props.children);
    }),
    useCameraDevice: () => mockDevice,
    useCameraPermission: () => ({
      hasPermission: mockHasPermission,
      requestPermission: mockRequestPermission,
    }),
  };
});

jest.mock('../../src/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      surface: '#111',
      text: '#fff',
      textSecondary: '#aaa',
      accent: '#08f',
      border: '#333',
      error: '#f33',
    },
  }),
}));

jest.mock('../../src/i18n/transifex', () => ({
  useT: () => (key: string) => key,
}));

describe('CameraScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    mockHasPermission = true;
    mockDevice = { id: 'back' };
    mockRequestPermission.mockResolvedValue(true);
    mockTakePhoto.mockResolvedValue({ path: '/tmp/cam.jpg' });
    mockReadFile.mockResolvedValue('base64data');
    mockWriteFile.mockResolvedValue(undefined);
  });

  it('returns null when not visible', () => {
    const { toJSON } = render(
      <CameraScreen visible={false} onClose={jest.fn()} onPhotoTaken={jest.fn()} />
    );
    expect(toJSON()).toBeNull();
  });

  it('shows permission UI and handles denied permission', async () => {
    mockHasPermission = false;
    mockRequestPermission.mockResolvedValue(false);

    const { getByText } = render(
      <CameraScreen visible onClose={jest.fn()} onPhotoTaken={jest.fn()} />
    );

    await act(async () => {
      fireEvent.press(getByText('Grant Permission'));
    });

    expect(mockRequestPermission).toHaveBeenCalled();
  });

  it('captures photo and returns saved file URI', async () => {
    const onPhotoTaken = jest.fn();
    const onClose = jest.fn();

    const { UNSAFE_getAllByType } = render(
      <CameraScreen visible onClose={onClose} onPhotoTaken={onPhotoTaken} />
    );

    const buttons = UNSAFE_getAllByType(require('react-native').TouchableOpacity);
    const captureButton = buttons[1];

    await act(async () => {
      fireEvent.press(captureButton);
    });

    expect(mockTakePhoto).toHaveBeenCalled();
    expect(mockReadFile).toHaveBeenCalledWith('/tmp/cam.jpg', 'base64');
    expect(mockWriteFile).toHaveBeenCalled();
    expect(onPhotoTaken).toHaveBeenCalledWith(expect.stringContaining('/cache/photo_'));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows camera unavailable state when no device is found', () => {
    const onClose = jest.fn();
    mockDevice = null;

    const { getByText } = render(
      <CameraScreen visible onClose={onClose} onPhotoTaken={jest.fn()} />
    );

    expect(getByText('Camera not available')).toBeTruthy();
    fireEvent.press(getByText('Close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows capture error when takePhoto throws', async () => {
    const onPhotoTaken = jest.fn();
    const onClose = jest.fn();
    mockTakePhoto.mockRejectedValue(new Error('boom'));

    const { UNSAFE_getAllByType, getByText } = render(
      <CameraScreen visible onClose={onClose} onPhotoTaken={onPhotoTaken} />
    );

    const buttons = UNSAFE_getAllByType(require('react-native').TouchableOpacity);
    const captureButton = buttons[1];

    await act(async () => {
      fireEvent.press(captureButton);
    });

    expect(getByText('boom')).toBeTruthy();
    expect(onPhotoTaken).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
