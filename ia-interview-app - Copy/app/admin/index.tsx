import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, Dimensions, Alert, Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as Clipboard from 'expo-clipboard';
import { PrimaryButton } from '../../components/PrimaryButton';
import { useTheme } from '../../context/ThemeContext';
import { themeColors } from '../../context/themeColors';
import { httpRequest } from '../../utils/http';

const roles = ['Web Developer', 'App Developer', 'Data Scientist', 'UI/UX Designer'];

const { width, height } = Dimensions.get('window');
interface FormErrors {
  candidateName?: string;
  candidateEmail?: string;
  jobTitle?: string;
  duration?: number | string;
}
interface FormData {
  candidateName: string;
  candidateEmail: string;
  jobTitle: string;
  duration: number;
}

export default function AdminDashboard() {
  const { theme } = useTheme();
  const colors = themeColors[theme];
  const [formData, setFormData] = useState<FormData>({
    candidateName: '',
    candidateEmail: '',
    jobTitle: '',
    duration: 15,
  });

  const [generatedLink, setGeneratedLink] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [customDurationMode, setCustomDurationMode] = useState(false);
  const [showModal, setShowModal] = useState(false); // New state for modal
  const [isLoading, setIsLoading] = useState(false);

  const presetDurations = [5, 10, 15];
  const [errors, setErrors] = useState<FormErrors>({});

  // Specific handler for duration
  const handleDurationChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      duration: Number(value) || 0
    }));
  };

  // General handler for other fields
  const handleInputChange = (field: Exclude<keyof FormData, 'duration'>, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const validateForm = () => {
    const newErrors: FormErrors = {};
    
    if (!formData.candidateName.trim()) {
      newErrors.candidateName = 'Candidate name is required';
    }
    
    if (!formData.candidateEmail.trim()) {
      newErrors.candidateEmail = 'Email is required';
    } else if (!formData.candidateEmail.includes('@')) {
      newErrors.candidateEmail = 'Please enter a valid email';
    }
    
    if (!formData.jobTitle) {
      newErrors.jobTitle = 'Please select a job role';
    }
    
    if (isNaN(formData.duration) || formData.duration <= 0) {
      newErrors.duration = 'Please enter a valid duration';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const generateInterviewLink = async () => {
    if (!validateForm()) return;

    try {
      setIsLoading(true);
      setCopiedLink(false);
      setCopiedCode(false);
      const dataOrText = await httpRequest<any>({
        method: 'POST',
        path: '/webhook/generate-interview-link',
        body: formData,
      });
      const isString = typeof dataOrText === 'string';
      const data = isString ? null : dataOrText;
      const rawText = isString ? (dataOrText as string) : '';

      console.log('Link generator response:', data ?? rawText);

      // Try to pick a link from common fields or fall back to regex from text
      const candidate = (data && (data.link || data.url || data.invite || data.generatedLink || data.result?.link || data.result)) || rawText;
      const urlMatch = typeof candidate === 'string' ? candidate.match(/https?:\/\/[^\s'"<>]+/) : null;
      const finalLink = typeof candidate === 'string' && candidate.startsWith('http') ? candidate : (urlMatch ? urlMatch[0] : null);

      // Try to also get a code value explicitly
      const explicitCodeCandidate = data && (data.code || data.interviewCode || data.id || data.slug || data.token || (typeof data === 'string' ? data : null));
      let code = typeof explicitCodeCandidate === 'string' ? explicitCodeCandidate.trim() : '';
      if (!code && finalLink) {
        const codeFromLink = finalLink.match(/\/interview\/([^/]+)/i);
        if (codeFromLink && codeFromLink[1]) {
          code = codeFromLink[1];
        }
      }

      if (finalLink) {
        setGeneratedLink(finalLink);
        setGeneratedCode(code || '');
        setErrors({});
        setShowModal(true); // Show modal when link is generated
      } else if (code) {
        // Fallback: if server returned an interview code, construct a deep link
        const deepLink = Linking.createURL(`/interview/${code}/interview`);
        setGeneratedLink(deepLink);
        setGeneratedCode(code);
        setErrors({});
        setShowModal(true);
      } else {
        console.warn("No link returned from n8n");
        Alert.alert('No Link Returned', 'The server did not return a link. Please try again later.');
      }

    } catch (error) {
      console.error("Failed to generate interview link:", error);
      Alert.alert(
        'Request Failed',
        'We could not generate the link. If you are on web, this might be due to CORS. Try running on a device/emulator or contact support.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const copyLinkToClipboard = async () => {
    await Clipboard.setStringAsync(generatedLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const copyCodeToClipboard = async () => {
    await Clipboard.setStringAsync(generatedCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const closeModal = () => {
    setShowModal(false);
    setCopiedLink(false);
    setCopiedCode(false);
  };

  return (
    <View style={[styles.outerContainer, { backgroundColor: colors.background }]}>
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.mainCard, { backgroundColor: colors.card, shadowColor: colors.primary }]}>
          {/* Header Section */}
          <View style={styles.headerSection}>
            <Text style={[styles.header, { color: colors.text }]}>✨ Interview Link Generator</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Create personalized interview links with ease</Text>
          </View>

          {/* Form Container */}
          <View style={styles.formContainer}>
            {/* Input Fields */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>👤 Candidate Information</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }, errors.candidateName && styles.inputError]}
                placeholder="Enter candidate's full name *"
                placeholderTextColor={colors.textTertiary}
                value={formData.candidateName}
                onChangeText={(value) => handleInputChange('candidateName', value)}
              />
              {errors.candidateName && <Text style={styles.errorText}>{errors.candidateName}</Text>}
              
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }, errors.candidateEmail && styles.inputError]}
                placeholder="candidate@email.com *"
                placeholderTextColor={colors.textTertiary}
                keyboardType="email-address"
                value={formData.candidateEmail}
                onChangeText={(value) => handleInputChange('candidateEmail', value)}
              />
              {errors.candidateEmail && <Text style={styles.errorText}>{errors.candidateEmail}</Text>}
            </View>

            {/* Duration Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>⏰ Interview Duration</Text>
              <View style={styles.durationGrid}>
                {presetDurations.map((dur) => (
                  <TouchableOpacity
                    key={dur}
                    style={[
                      styles.durationButton,
                      formData.duration === dur && !customDurationMode && styles.durationButtonSelected
                    ]}
                    onPress={() => {
                      setFormData({ ...formData, duration: dur });
                      setCustomDurationMode(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.durationText,
                        formData.duration === dur && !customDurationMode && styles.durationTextSelected
                      ]}
                    >
                      {dur} mins
                    </Text>
                  </TouchableOpacity>
                ))}
                
                <TouchableOpacity
                  style={[
                    styles.durationButton,
                    customDurationMode && styles.durationButtonSelected
                  ]}
                  onPress={() => {
                    setCustomDurationMode(true);
                    setFormData({ ...formData, duration: 0 });
                  }}
                >
                  <Text
                    style={[
                      styles.durationText,
                      customDurationMode && styles.durationTextSelected
                    ]}
                  >
                    Custom
                  </Text>
                </TouchableOpacity>
              </View>

              {/* If custom selected, show input */}
              {customDurationMode && (
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }, Boolean(errors.duration) && styles.inputError]}
                  placeholder="Enter custom duration (e.g., 45)"
                  keyboardType="numeric"
                  placeholderTextColor={colors.textTertiary}
                  value={formData.duration.toString()}
                  onChangeText={handleDurationChange}
                />
              )}

              {errors.duration && <Text style={styles.errorText}>{errors.duration}</Text>}
            </View>

            {/* Job Role Selector */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }, errors.jobTitle && styles.labelError]}>💼 Select Job Role *</Text>
              <View style={styles.roleGrid}>
                {roles.map((role) => (
                  <TouchableOpacity
                    key={role}
                    style={[
                      styles.roleButton,
                      formData.jobTitle === role && styles.roleButtonSelected,
                      errors.jobTitle && styles.roleButtonError,
                    ]}
                    onPress={() => handleInputChange('jobTitle', role)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.roleButtonText,
                        formData.jobTitle === role && styles.roleButtonTextSelected,
                      ]}
                    >
                      {role}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {errors.jobTitle && <Text style={styles.errorText}>{errors.jobTitle}</Text>}
            </View>

            {/* Generate Button */}
            <View style={styles.buttonContainer}>
              <PrimaryButton 
                title={isLoading ? 'Generating…' : '🚀 Generate Interview Link'} 
                onPress={generateInterviewLink}
                disabled={isLoading}
              />
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Custom Modal Alternative */}
        {showModal && (
        <View style={styles.customModalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, shadowColor: colors.shadow }] }>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.success }]}>🎉 Interview Link Created!</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={closeModal}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Link Section */}
            <View style={styles.modalLinkSection}>
              <Text style={[styles.modalLinkLabel, { color: colors.text }]}>🔗 Your Interview Link</Text>
              <View style={styles.linkContainer}>
                <Text style={[styles.linkText, { color: colors.primary }]} numberOfLines={2} ellipsizeMode="middle">
                  {generatedLink}
                </Text>
                <TouchableOpacity 
                  style={styles.copyButton} 
                  onPress={copyLinkToClipboard}
                  activeOpacity={0.8}
                >
                  <Text style={styles.copyText}>
                    {copiedLink ? '✅ Copied!' : '📋 Copy Link'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {Boolean(generatedCode) && (
              <View style={styles.modalLinkSection}>
                <Text style={[styles.modalLinkLabel, { color: colors.text }]}>🔐 Interview Code</Text>
                <View style={styles.linkContainer}>
                  <Text style={[styles.linkText, { color: colors.primary }]} numberOfLines={1} ellipsizeMode="middle">
                    {generatedCode}
                  </Text>
                  <TouchableOpacity 
                    style={styles.copyButton} 
                    onPress={copyCodeToClipboard}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.copyText}>
                      {copiedCode ? '✅ Copied!' : '📋 Copy Code'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Interview Summary */}
            <View style={[styles.modalSummaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.modalSummaryTitle, { color: colors.text }]}>📝 Interview Details</Text>
              <View style={styles.summaryGrid}>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>👤 Candidate</Text>
                  <Text style={[styles.summaryValue, { color: colors.text }]}>{formData.candidateName}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>📧 Email</Text>
                  <Text style={[styles.summaryValue, { color: colors.text }]}>{formData.candidateEmail}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>💼 Role</Text>
                  <Text style={[styles.summaryValue, { color: colors.text }]}>{formData.jobTitle}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>⏱️ Duration</Text>
                  <Text style={[styles.summaryValue, { color: colors.text }]}>{formData.duration} minutes</Text>
                </View>
              </View>
            </View>

            {/* Modal Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.doneButton}
                onPress={closeModal}
              >
                <Text style={styles.doneButtonText}>✅ Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
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
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    minHeight: height,
  },
  mainCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 28,
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: Platform.OS === 'web' ? 8 : 20 },
    shadowOpacity: Platform.OS === 'web' ? 0.08 : 0.15,
    shadowRadius: Platform.OS === 'web' ? 12 : 30,
    elevation: Platform.OS === 'web' ? 0 : 20,
    marginHorizontal: 4,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  header: {
    fontSize: 32,
    fontWeight: '900',
    color: '#1e293b',
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  formContainer: {
    gap: 24,
  },
  inputGroup: {
    gap: 12,
  },
  inputLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  labelError: {
    color: '#dc2626',
  },
  inputError: {
    borderColor: '#dc2626',
    borderWidth: 2,
  },
  roleButtonError: {
    borderColor: '#dc2626',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
    marginLeft: 4,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderWidth: 2,
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    color: '#1e293b',
    fontWeight: '500',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  roleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  roleButton: {
    flex: 1,
    minWidth: '45%',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#f1f5f9',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: Platform.OS === 'web' ? 1 : 2 },
    shadowOpacity: Platform.OS === 'web' ? 0.02 : 0.05,
    shadowRadius: Platform.OS === 'web' ? 2 : 4,
    elevation: Platform.OS === 'web' ? 0 : 2,
  },
  roleButtonSelected: {
    backgroundColor: '#4f46e5',
    borderColor: '#4f46e5',
    shadowColor: '#4f46e5',
    shadowOpacity: 0.3,
    elevation: 8,
  },
  roleButtonText: {
    color: '#475569',
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
  },
  roleButtonTextSelected: {
    color: '#ffffff',
    fontWeight: '700',
  },
  durationGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  durationButton: {
    flexGrow: 1,
    minWidth: '22%',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
  },
  durationButtonSelected: {
    backgroundColor: '#4f46e5',
    borderColor: '#4f46e5',
  },
  durationText: {
    color: '#1e293b',
    fontWeight: '600',
  },
  durationTextSelected: {
    color: '#ffffff',
  },
  buttonContainer: {
    marginTop: 8,
    alignItems: 'center',
  },

  // Modal Styles
  customModalOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    elevation: 9999,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 380,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#16a34a',
    flex: 1,
    textAlign: 'center',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#64748b',
  },
  modalLinkSection: {
    marginBottom: 24,
  },
  modalLinkLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 12,
  },
  linkContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  linkText: {
    color: '#4f46e5',
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 20,
  },
  copyButton: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#4f46e5',
    borderRadius: 10,
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  copyText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  modalSummaryCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modalSummaryTitle: {
    fontWeight: '800',
    fontSize: 18,
    color: '#1e293b',
    marginBottom: 16,
    textAlign: 'center',
  },
  summaryGrid: {
    gap: 12,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    flex: 1,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
    flex: 2,
    textAlign: 'right',
  },
  modalActions: {
    alignItems: 'center',
  },
  doneButton: {
    backgroundColor: '#16a34a',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 16,
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  doneButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});