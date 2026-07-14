import React, { useState, useCallback } from 'react';
import { Platform, View, StyleSheet, ViewStyle } from 'react-native';
import LottieView, { AnimationObject } from 'lottie-react-native';

interface SafeLottieProps {
  // lottie-react-native allows require(number) or a JSON object or a uri object
  source: AnimationObject | { uri: string } | string | number;
  autoPlay?: boolean;
  loop?: boolean;
  size?: number; // convenience for square animations
  style?: ViewStyle | ViewStyle[];
  resizeMode?: any;
}

/**
 * SafeLottie delays mounting the underlying LottieView on web until it has a non-zero layout size.
 * This avoids the "Failed to construct 'ImageData': The source width is zero" error produced by
 * @lottiefiles/dotlottie-react when canvas width/height are 0 at first render.
 */
export const SafeLottie: React.FC<SafeLottieProps> = ({
  source,
  autoPlay = true,
  loop = true,
  size,
  style,
  resizeMode = 'contain',
}) => {
  const [ready, setReady] = useState(Platform.OS !== 'web');
  const [dims, setDims] = useState<{ w: number; h: number } | null>(
    Platform.OS === 'web' ? null : (size ? { w: size, h: size } : null)
  );

  const onLayout = useCallback((e: any) => {
    if (Platform.OS !== 'web') return; // native already ready
    if (dims && ready) return; // already set
    const { width, height } = e.nativeEvent.layout;
    // Guard: only proceed when both > 0
    if (width > 0 && height > 0) {
      setDims({ w: width, h: height });
      // Defer mounting one frame to ensure layout is committed
      requestAnimationFrame(() => setReady(true));
    }
  }, [dims, ready]);

  const resolvedStyle = Array.isArray(style) ? Object.assign({}, ...style) : style || {};
  const finalWidth = (dims?.w as number) || (typeof resolvedStyle?.width === 'number' ? resolvedStyle.width : size) || 200;
  const finalHeight = (dims?.h as number) || (typeof resolvedStyle?.height === 'number' ? resolvedStyle.height : size) || 200;

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.container,
        { width: finalWidth, height: finalHeight },
        // Ensure a minimum size placeholder so layout recalculates
        resolvedStyle,
      ]}
    >
      {ready && (
        <LottieView
          // Cast to any because type defs exclude numeric require() signature
          source={source as any}
            /* Intentionally apply explicit numeric width/height */
          style={{ width: finalWidth, height: finalHeight }}
          autoPlay={autoPlay}
          loop={loop}
          resizeMode={resizeMode}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});

export default SafeLottie;
