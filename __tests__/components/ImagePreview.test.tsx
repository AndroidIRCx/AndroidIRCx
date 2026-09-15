import React from 'react';
import { TouchableOpacity } from 'react-native';
import { render, fireEvent, cleanup } from '@testing-library/react-native';
import { ImagePreview } from '../../src/components/ImagePreview';

afterEach(() => {
  cleanup();
});

jest.mock('../../src/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      primary: '#08f',
      surfaceVariant: '#222',
      error: '#f33',
    },
  }),
}));

jest.mock('../../src/i18n/localization', () => ({
  useT: () => (key: string) => key,
}));

describe('ImagePreview', () => {
  it('renders thumbnail image and opens/closes modal', async () => {
    const { UNSAFE_getAllByType, getByText } = await render(
      <ImagePreview url="https://example.com/pic.jpg" />,
    );

    const images = UNSAFE_getAllByType('Image');
    const touchables = UNSAFE_getAllByType(TouchableOpacity);
    await fireEvent(images[0], 'load');
    await fireEvent.press(touchables[0]);

    expect(getByText('Close')).toBeTruthy();

    await fireEvent.press(getByText('Close'));
  });

  it('shows error state when thumbnail fails', async () => {
    const { UNSAFE_getByType, getByText } = await render(
      <ImagePreview url="https://example.com/broken.jpg" />,
    );

    const img = UNSAFE_getByType('Image');
    await fireEvent(img, 'error');

    expect(getByText('Failed to load image')).toBeTruthy();
  });

  it('handles non-thumbnail mode', async () => {
    const { UNSAFE_getByType } = await render(
      <ImagePreview url="https://example.com/full.jpg" thumbnail={false} />,
    );

    const img = UNSAFE_getByType('Image');
    expect(img.props.resizeMode).toBe('contain');
  });

  it('shows modal loading text and clears it when modal image loads', async () => {
    const { UNSAFE_getAllByType, getByText, queryByText } = await render(
      <ImagePreview url="https://example.com/pic.jpg" />,
    );

    await fireEvent.press(UNSAFE_getAllByType(TouchableOpacity)[0]);
    expect(getByText('Loading image...')).toBeTruthy();

    await fireEvent(UNSAFE_getAllByType('Image')[1], 'load');
    expect(queryByText('Loading image...')).toBeNull();
  });

  it('hides modal loader when modal image errors and supports request-close', async () => {
    const { UNSAFE_getAllByType, UNSAFE_getByType, queryByText } = await render(
      <ImagePreview url="https://example.com/pic.jpg" />,
    );

    await fireEvent.press(UNSAFE_getAllByType(TouchableOpacity)[0]);
    await fireEvent(UNSAFE_getAllByType('Image')[1], 'error');
    expect(queryByText('Loading image...')).toBeNull();

    const modal = UNSAFE_getByType('Modal');
    await fireEvent(modal, 'requestClose');
    expect(queryByText('Close')).toBeNull();
  });
});
