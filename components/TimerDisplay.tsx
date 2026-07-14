// components/TimerDisplay.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import { themeColors } from '../context/themeColors';

interface TimerDisplayProps {
  duration: number; // in seconds
  onComplete?: () => void;
}

export const TimerDisplay: React.FC<TimerDisplayProps> = ({ duration, onComplete }) => {
  const { theme } = useTheme();
  const colors = themeColors[theme];
  const [timeLeft, setTimeLeft] = useState(duration);
  const progress = useSharedValue(1);

  useEffect(() => {
    if (timeLeft === 0 && onComplete) onComplete();
    const timer = setInterval(() => {
      setTimeLeft((prev) => Math.max(prev - 1, 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    progress.value = withTiming(timeLeft / duration, { duration: 500 });
  }, [timeLeft]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: progress.value }],
  }));

  return (
    <View style={styles.container}>
      <Text style={[styles.timerText, { color: colors.primary }]}>{timeLeft}s</Text>
      <View style={[styles.progressBackground, { backgroundColor: colors.borderLight }]}>
        <Animated.View style={[styles.progressBar, { backgroundColor: colors.primary }, animatedStyle]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { width: '100%', alignItems: 'center', marginVertical: 20 },
  timerText: { fontSize: 22, fontWeight: 'bold', color: '#1E3A8A', marginBottom: 6 },
  progressBackground: {
    width: '80%',
    height: 8,
    backgroundColor: '#E0E7FF',
    borderRadius: 10,
    overflow: 'hidden',
  },
  progressBar: {
    flex: 1,
    backgroundColor: '#3B82F6',
    borderRadius: 10,
  },
});
