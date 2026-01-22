// Declaration file for modules without TypeScript definitions

declare module 'react-native-vector-icons/FontAwesome5' {
  import { Component } from 'react';
  import { TextProps } from 'react-native';

  interface IconProps extends TextProps {
    name: string;
    size?: number;
    color?: string;
    solid?: boolean;
    brand?: boolean;
    light?: boolean;
  }

  export default class Icon extends Component<IconProps> {}
}

declare module 'text-encoding' {
  export class TextEncoder {
    encode(input?: string): Uint8Array;
  }
  export class TextDecoder {
    constructor(encoding?: string);
    decode(input?: ArrayBuffer | ArrayBufferView): string;
  }
}
