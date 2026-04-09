import React from 'react';
import { Image, TouchableOpacity } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { ImagePreview } from '../../src/components/ImagePreview';

jest.mock('../../src/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      primary: '#08f',
      surfaceVariant: '#222',
      error: '#f33',
    },
  }),
}));

jest.mock('../../src/i18n/transifex', () => ({
  useT: () => (key: string) => key,
}));

describe('ImagePreview', () => {
  it('renders thumbnail image and opens/closes modal', () => {
    const { UNSAFE_getAllByType, getByText } = render(
      <ImagePreview url="https://example.com/pic.jpg" />,
    );

    const images = UNSAFE_getAllByType(Image);
    const touchables = UNSAFE_getAllByType(TouchableOpacity);
    fireEvent(images[0], 'load');
    fireEvent.press(touchables[0]);

    expect(getByText('Close')).toBeTruthy();

    fireEvent.press(getByText('Close'));
  });

  it('shows error state when thumbnail fails', () => {
    const { UNSAFE_getByType, getByText } = render(
      <ImagePreview url="https://example.com/broken.jpg" />,
    );

    const img = UNSAFE_getByType(Image);
    fireEvent(img, 'error');

    expect(getByText('Failed to load image')).toBeTruthy();
  });

  it('handles non-thumbnail mode', () => {
    const { UNSAFE_getByType } = render(
      <ImagePreview url="https://example.com/full.jpg" thumbnail={false} />,
    );

    const img = UNSAFE_getByType(Image);
    expect(img.props.resizeMode).toBe('contain');
  });

  it('shows modal loading text and clears it when modal image loads', () => {
    const { UNSAFE_getAllByType, getByText, queryByText } = render(
      <ImagePreview url="https://example.com/pic.jpg" />,
    );

    fireEvent.press(UNSAFE_getAllByType(TouchableOpacity)[0]);
    expect(getByText('Loading image...')).toBeTruthy();

    fireEvent(UNSAFE_getAllByType(Image)[1], 'load');
    expect(queryByText('Loading image...')).toBeNull();
  });

  it('hides modal loader when modal image errors and supports request-close', () => {
    const { UNSAFE_getAllByType, UNSAFE_getByType, queryByText } = render(
      <ImagePreview url="https://example.com/pic.jpg" />,
    );

    fireEvent.press(UNSAFE_getAllByType(TouchableOpacity)[0]);
    fireEvent(UNSAFE_getAllByType(Image)[1], 'error');
    expect(queryByText('Loading image...')).toBeNull();

    const modal = UNSAFE_getByType('Modal');
    fireEvent(modal, 'requestClose');
    expect(queryByText('Close')).toBeNull();
  });
});
