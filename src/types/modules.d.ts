declare module 'prismjs';

declare module 'react-native-battery-optimization-check' {
  export function BatteryOptEnabled(): Promise<boolean>;
  export function OpenOptimizationSettings(): void;
}

declare module 'react-native-vector-icons/MaterialCommunityIcons' {
  const MaterialCommunityIcons: any;
  export default MaterialCommunityIcons;
}
