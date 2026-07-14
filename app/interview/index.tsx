import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
} from 'react-native';
import { useRouter } from 'expo-router';
import { PrimaryButton } from '../../components/PrimaryButton';
import { useTheme } from '../../context/ThemeContext';
import { themeColors } from '../../context/themeColors';
import { httpRequest } from '../../utils/http';

const { width, height } = Dimensions.get('window');

export default function JoinInterviewScreen() {
  const { theme } = useTheme();
  const colors = themeColors[theme];
  const [interviewId, setInterviewId] = useState('');
  const [isError, setIsError] = useState(false);
  const router = useRouter();

  // Animation for button
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const validateInterviewCode = async (code: string, retryCount = 0) => {
    console.log('validateInterviewCode function', code);
    try {
      const data = await httpRequest<{ valid?: boolean | string } | string>({
        method: 'POST',
        path: '/webhook/validate',
        body: { code },
      });
    
      console.log('validateInterviewCode data', data);
      if (typeof data === 'string') {
        // Try to parse a simple truthy string
        return /true|valid|ok|success/i.test(data);
      }
      return data.valid === true || data.valid === 'true';
    } catch (e) {
      if (retryCount < 2) {
        // Retry up to 2 times (total 3 attempts)
        return await validateInterviewCode(code, retryCount + 1);
      }
      return false;
    }
  };

  const handleStart = async () => {
    if (!interviewId.trim()) {
      setIsError(true);
      Alert.alert('⚠️ Missing Interview ID', 'Please enter a valid interview code or ID to continue.');
      return;
    }
    setIsError(false);

    // Validate code before navigating (with retry)
    const isValid = await validateInterviewCode(interviewId.trim());
    if (isValid) {
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 0.95,
          duration: 100,
          useNativeDriver: true,
          easing: Easing.out(Easing.quad),
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
          easing: Easing.out(Easing.quad),
        }),
      ]).start(() => {
        router.push(`/interview/${interviewId}/welcome`);
      });
    } else {
      setIsError(true);
      Alert.alert('❌ Invalid Code', 'The interview code you entered is not valid or could not be verified. Please check and try again.');
    }
  };

  const handleInputChange = (text: string) => {
    setInterviewId(text);
    if (isError && text.trim()) {
      setIsError(false);
    }
  };

  return (
    <View style={[styles.outerContainer, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Hero Section */}
          <View style={styles.heroSection}>
            <Text style={[styles.heading, { color: colors.text }]}>Ready to Shine?</Text>
            <Text style={[styles.subHeading, { color: colors.subtitle }]}>Join Your Interview Session</Text>
          </View>

          {/* Main Content Card */}
          <View style={[styles.contentCard, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.primary }]}>
            <View style={styles.instructionsContainer}>
              <Text style={[styles.instructions, { color: colors.text }] }>
                Enter the unique interview code shared with you
              </Text>
              <Text style={[styles.subInstructions, { color: colors.textSecondary }] }>
                This code was provided by your interviewer via email or message
              </Text>
            </View>

            {/* Input Section */}
            <View style={styles.inputSection}>
              <Text style={[styles.inputLabel, { color: colors.primary }]}>🔑 Interview Code</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  placeholder="Enter your code"
                  placeholderTextColor="black" // ✅ correct
                  style={[
                    styles.input,
                    { backgroundColor: colors.card, borderColor: colors.border, color: colors.text },
                    { fontSize: 15, textAlign: 'center' }, // smaller font size and center text (affects placeholder too)
                    isError && styles.inputError,
                  ]}
                  value={interviewId}
                  onChangeText={handleInputChange}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={12}
                  selectionColor={colors.secondary}
                />
                {interviewId.length > 0 && (
                  <TouchableOpacity
                    style={[styles.clearButton, { backgroundColor: colors.secondary }]}
                    onPress={() => setInterviewId('')}
                  >
                    <Text style={styles.clearButtonText}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
              {isError && (
                <Text style={[styles.errorText, { color: colors.error }]}>
                  ⚠️ Please enter a valid interview code
                </Text>
              )}
            </View>

            {/* Action Button */}
            <View style={styles.buttonSection}>
              <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                <PrimaryButton
                  title=" Start My Interview"
                  onPress={handleStart}
                />
              </Animated.View>
            </View>

            {/* Help Section */}
            <View style={[styles.helpSection, { backgroundColor: colors.surface, borderLeftColor: colors.secondary, shadowColor: colors.secondary }]}>
              <Text style={[styles.helpTitle, { color: colors.text }]}>Need Help?</Text>
              <Text style={[styles.helpText, { color: colors.textSecondary }]}>
                • Check your email for the interview code
              </Text>
              <Text style={[styles.helpText, { color: colors.textSecondary }]}>
                • Contact your interviewer if you can't find it
              </Text>
              <Text style={[styles.helpText, { color: colors.textSecondary }]}>
                • Make sure you're entering the complete code
              </Text>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.textSecondary }]}>
              🔒 Your interview session is secure and private
            </Text>
          </View>
        </KeyboardAvoidingView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollContainer: {
    flexGrow: 1,
    minHeight: height,
  },
  keyboardContainer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  heroSection: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 32,
  },
  heading: {
    fontSize: 34,
    fontWeight: '900',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: 0.5,
    textShadowColor: 'rgba(99,102,241,0.15)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  subHeading: {
    fontSize: 18,
    color: '#c7d2fe',
    textAlign: 'center',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  contentCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 32,
    padding: 36,
    marginHorizontal: 8,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: Platform.OS === 'web' ? 6 : 16 },
    shadowOpacity: Platform.OS === 'web' ? 0.08 : 0.18,
    shadowRadius: Platform.OS === 'web' ? 10 : 32,
    elevation: Platform.OS === 'web' ? 0 : 24,
    flex: 1,
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#e0e7ff',
  },
  instructionsContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  instructions: {
    fontSize: 21,
    color: '#1e293b',
    textAlign: 'center',
    fontWeight: '800',
    marginBottom: 6,
    lineHeight: 28,
    letterSpacing: 0.2,
  },
  subInstructions: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 22,
  },
  inputSection: {
    marginBottom: 28,
  },
  inputLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4f46e5',
    marginBottom: 10,
    letterSpacing: 0.1,
  },
  inputContainer: {
    position: 'relative',
  },
  input: {
    backgroundColor: '#fff',
    borderColor: '#a5b4fc',
    borderWidth: 2,
    borderRadius: 18,
    padding: 20,
    fontSize: 18,
    color: '#1e293b',
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 2,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 6,
    marginBottom: 2,
  },
  inputError: {
    borderColor: '#dc2626',
    backgroundColor: '#fef2f2',
  },
  clearButton: {
    position: 'absolute',
    right: 16,
    top: '50%',
    transform: [{ translateY: -12 }],
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#a5b4fc',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: Platform.OS === 'web' ? 1 : 2 },
    shadowOpacity: Platform.OS === 'web' ? 0.08 : 0.15,
    shadowRadius: Platform.OS === 'web' ? 3 : 6,
    elevation: Platform.OS === 'web' ? 0 : 4,
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
  },
  buttonSection: {
    marginBottom: 28,
    alignItems: 'center',
  },
  animatedButton: {
    // Optionally add custom styles for the animated button wrapper
  },
  helpSection: {
    backgroundColor: '#e0e7ff',
    borderRadius: 18,
    padding: 20,
    borderLeftWidth: 5,
    borderLeftColor: '#6366f1',
    marginTop: 10,
    marginBottom: 4,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#3730a3',
    marginBottom: 10,
  },
  helpText: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 5,
    fontWeight: '500',
    lineHeight: 20,
  },
  footer: {
    alignItems: 'center',
    marginTop: 24,
    paddingBottom: 20,
  },
  footerText: {
    fontSize: 14,
    color: '#a5b4fc',
    textAlign: 'center',
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});