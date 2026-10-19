import { Ionicons as BaseIonicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Text as NativeText, TextInput as NativeTextInput, useWindowDimensions, StyleSheet } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';

type NativeTextProps = ComponentProps<typeof NativeText>;
type NativeTextInputProps = ComponentProps<typeof NativeTextInput>;
type NativeIoniconsProps = ComponentProps<typeof BaseIonicons>;

function getDeviceScale(width: number) {
  return Math.min(1.08, Math.max(0.94, Math.pow(width / 390, 0.2)));
}

function readableTextStyle(style: StyleProp<TextStyle>, width: number): StyleProp<TextStyle> {
  const flattened = StyleSheet.flatten(style);
  const originalSize = typeof flattened?.fontSize === 'number' && flattened.fontSize > 0 ? flattened.fontSize : 14;

  const baseScale = originalSize < 10 ? 1.28 : originalSize < 16 ? 1.2 : originalSize < 22 ? 1.12 : 1.08;
  const fontSize = Math.max(originalSize < 10 ? 11 : originalSize, originalSize * baseScale * getDeviceScale(width));
  const lineRatio = fontSize / originalSize;

  return [style, {
    fontSize,
    lineHeight: flattened.lineHeight ? flattened.lineHeight * lineRatio : undefined,
  }];
}

export function ResponsiveText(props: NativeTextProps) {
  const { width } = useWindowDimensions();
  return <NativeText {...props} style={readableTextStyle(props.style, width)} />;
}

export function ResponsiveTextInput(props: NativeTextInputProps) {
  const { width } = useWindowDimensions();
  return <NativeTextInput {...props} style={readableTextStyle(props.style, width)} />;
}

export const ResponsiveIonicons = Object.assign(
  function ResponsiveIonicons(props: NativeIoniconsProps) {
    const { width } = useWindowDimensions();
    const size = typeof props.size === 'number' ? props.size : 24;
    return <BaseIonicons {...props} size={Math.round(size * 1.2 * getDeviceScale(width))} />;
  },
  { glyphMap: BaseIonicons.glyphMap },
);
