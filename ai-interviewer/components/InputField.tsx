import React from 'react';
import { TextInput, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { themeColors } from '../context/themeColors';

interface InputFieldProps {
  label: string;
  value: string;
  placeholder?: string;
  onChangeText: (text: string) => void;
}

export const InputField: React.FC<InputFieldProps> = ({ label, value, placeholder, onChangeText }) => {
  const { theme } = useTheme();
  const colors = themeColors[theme];
  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        value={value}
        onChangeText={onChangeText}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  label: { fontSize: 14, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
});
