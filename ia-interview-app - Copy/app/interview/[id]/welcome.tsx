import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions, Platform, Alert } from 'react-native';
import Animated, {
  useSharedValue,
  withSpring,
  withTiming,
  useAnimatedStyle,
} from 'react-native-reanimated';
import SafeLottie from '../../../components/SafeLottie';
import { Image } from 'react-native';
import { PrimaryButton } from '../../../components/PrimaryButton';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../../context/ThemeContext';      // ✅ 1. Import theme
import { themeColors } from '../../../context/themeColors';    // ✅ 2. Import centralized colors

const { width } = Dimensions.get('window');

// Responsive breakpoints
const breakpoints = {
  sm: 480,
  md: 768,
  lg: 1024,
  xl: 1440,
};

// Responsive utilities
const getResponsiveValue = (baseValue: number, factor = 1) => {
  if (Platform.OS !== 'web') return baseValue * factor;
  
  if (width >= breakpoints.xl) return baseValue * 1.2;
  if (width >= breakpoints.lg) return baseValue * 1.1;
  if (width >= breakpoints.md) return baseValue * 1.0;
  return baseValue * 0.9;
};

const getFontSize = (base: number) => {
  if (Platform.OS !== 'web') {
    if (width <= 360) return base * 0.85;
    if (width <= 400) return base * 0.9;
    return base;
  }
  return getResponsiveValue(base);
};

const getPadding = (base: number) => {
  if (Platform.OS !== 'web') {
    if (width <= 360) return base * 0.7;
    if (width <= 400) return base * 0.8;
    return base;
  }
  return getResponsiveValue(base);
};

export default function CandidateWelcome() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>(); // dynamic route param

  const { theme } = useTheme();            // ✅ 3. Get current theme
  const colors = themeColors[theme];       // ✅ 4. Load theme-based colors

  // Animation values
  const scale = useSharedValue(0.5);
  const opacity = useSharedValue(0);

  const [layoutWidth, setLayoutWidth] = useState<number>(width);
  const [canRenderLottie, setCanRenderLottie] = useState(false);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 800 });
    scale.value = withSpring(1, { damping: 5 });
  }, []);

  const onContainerLayout = useCallback((e: any) => {
    const w = e.nativeEvent.layout.width || width;
    if (w && w > 0) {
      setLayoutWidth(w);
      // small timeout lets layout settle on web
      requestAnimationFrame(() => setCanRenderLottie(true));
    }
  }, []);

  const lottieSize = Math.min(
    (layoutWidth || width) * (Platform.OS === 'web' ? 
      (width >= breakpoints.lg ? 0.3 : 0.35) : 
      (width <= 360 ? 0.6 : 0.7)
    ),
    Platform.OS === 'web' ? 
      (width >= breakpoints.xl ? 400 : 360) : 
      (width <= 360 ? 300 : 360)
  ) || 200; // fallback

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background }]}
      onLayout={onContainerLayout}
    >
      {/* Only render after we have a non-zero size */}
      {canRenderLottie && (
        <Animated.View
          style={[
            styles.animationContainer,
            { width: lottieSize, height: lottieSize },
            animatedStyle
          ]}
        >
          {Platform.OS === 'web' ? (
            <Image
              source={require('../../../assets/images/logo.png')}
              style={[styles.logoImage, { width: lottieSize, height: lottieSize }]}
              resizeMode="contain"
            />
          ) : (
            <SafeLottie
              source={require('../../../assets/animations/interview.json')}
              size={lottieSize}
              loop
            />
          )}
        </Animated.View>
      )}

      <Animated.View style={[styles.textContainer, animatedStyle]}>
        {/* ✅ 6. Use theme-based text colors */}
        <Text style={[styles.title, { color: colors.text }]}>
          Welcome to Your AI Interview
        </Text>
        <Text style={[styles.subtitle, { color: colors.subtitle }]}>
          Relax, be yourself, and let AI guide you through this interview.
        </Text>
        <PrimaryButton
          title="Start Interview"
          onPress={() => {
            if (!id) {
              Alert.alert('Missing ID', 'Interview id not found in route.');
              return;
            }
            router.push(`/interview/${id}/start`);
          }}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: getPadding(20),
  },
  animationContainer: {
    // width / height now injected dynamically
    marginBottom: Platform.OS === 'web' ? getPadding(10) : getPadding(4),
    alignItems: 'center',
    justifyContent: 'center',
  },
  lottie: {
    width: '100%',
    height: '100%',
  },
  logoImage: {
    marginBottom: getPadding(10),
    alignSelf: 'center',
    marginLeft: Platform.OS === 'web' ? 200 : (width <= 360 ? 150 : 200),
  },
  textContainer: {
    alignItems: 'center',
    marginTop: Platform.OS === 'web' ? 0 : getPadding(-30),
    maxWidth: getResponsiveValue(600),
    paddingHorizontal: getPadding(20),
  },
  title: {
    fontSize: getFontSize(26),
    fontWeight: '700',
    textAlign: 'center',
    justifyContent: 'center',
    marginBottom: getPadding(10),
  },
  subtitle: {
    fontSize: getFontSize(16),
    textAlign: 'center',
    marginBottom: getPadding(20),
    paddingHorizontal: getPadding(20),
    lineHeight: getFontSize(22),
  },
});
