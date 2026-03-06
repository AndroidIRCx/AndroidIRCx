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
      <ImagePreview url="https://example.com/pic.jpg" />
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
      <ImagePreview url="https://example.com/broken.jpg" />
    );

    const img = UNSAFE_getByType(Image);
    fireEvent(img, 'error');

    expect(getByText('Failed to load image')).toBeTruthy();
  });

  it('handles non-thumbnail mode', () => {
    const { UNSAFE_getByType } = render(
      <ImagePreview url="https://example.com/full.jpg" thumbnail={false} />
    );

    const img = UNSAFE_getByType(Image);
    expect(img.props.resizeMode).toBe('contain');
  });
});
