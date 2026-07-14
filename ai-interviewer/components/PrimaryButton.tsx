import React, { useState } from 'react';
import { Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { themeColors } from '../context/themeColors';

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({ title, onPress, disabled = false }) => {
  const { theme } = useTheme();
  const colors = themeColors[theme];
  const scale = useSharedValue(1);
  const [pressed, setPressed] = useState(false);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (disabled) return;
    scale.value = withSpring(0.95, { damping: 5 });
    setPressed(true);
  };

  const handlePressOut = () => {
    if (disabled) return;
    scale.value = withSpring(1, { damping: 5 });
    setPressed(false);
  };

  const handlePress = () => {
    if (disabled) return;
    onPress();
  };

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      style={[
        styles.shadowWrapper,
        { shadowColor: colors.primary },
        disabled && styles.disabledShadow,
      ]}
      disabled={disabled}
    >
      <Animated.View style={[animatedStyle]}>
        <LinearGradient
          colors={
            disabled
              ? ['#9ca3af', '#6b7280']
              : pressed
              ? [colors.primary, colors.secondary]
              : [colors.secondary, colors.primary]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.button, disabled && styles.disabledButton]}
        >
          <Text style={[styles.text, disabled && styles.disabledText]}>{title}</Text>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  shadowWrapper: {
    shadowColor: '#3b82f6',
    shadowOpacity: 0.6,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 6,
  },
  disabledShadow: {
    shadowOpacity: 0.2,
    elevation: 2,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 30,
  },
  disabledButton: {
    opacity: 0.6,
  },
  text: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  disabledText: {
    opacity: 0.8,
  },
});
