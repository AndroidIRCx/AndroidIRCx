/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

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

// react-native-iap 15.6.x (src/kit-api.ts) is type-checked from source via its
// `react-native` export condition and references the DOM global `HeadersInit`.
// React Native's fetch typings expose the same shape under `HeadersInit_`, so
// alias it. Type-only shim — the compiled runtime (lib/module) is unaffected.
declare type HeadersInit = HeadersInit_;

// RN 0.87 made TextStyle/ViewStyle/ImageStyle properties `readonly`. Style objects
// that are assembled by in-place mutation need a writable view of the type; this
// mapped type strips `readonly`. Assignable back to the readonly style on return.
declare type Writable<T> = { -readonly [P in keyof T]: T[P] };

// InteractionManager was removed in RN 0.87. `requestIdleCallback` /
// `cancelIdleCallback` remain runtime globals but are no longer in RN's type
// surface (and DOM lib is not included). Declare them. Type-only shim.
declare function requestIdleCallback(
  callback: (deadline: {
    didTimeout: boolean;
    timeRemaining: () => number;
  }) => void,
  options?: { timeout: number },
): number;
declare function cancelIdleCallback(handle: number): void;
