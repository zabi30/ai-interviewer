import React from 'react';
import { View, Text, StyleSheet, Image, Platform, Dimensions, ScrollView } from 'react-native';
import { PrimaryButton } from '../../../components/PrimaryButton';
import { useTheme } from '../../../context/ThemeContext';          // ✅ 1. Import theme hook
import { themeColors } from '../../../context/themeColors';        // ✅ 2. Import centralized colors
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams } from 'expo-router';

interface EndScreenProps {
  navigation: any;
}

const { width } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const badgeSize = isWeb ? 130 : 174;
const imageSize = isWeb ? 110 : 150;

export const EndScreen: React.FC<EndScreenProps> = ({ navigation }) => {
  const handleFinish = () => {
    navigation.navigate('WelcomeScreen'); // Reset to start or navigate elsewhere
  };

  const { theme } = useTheme();           // ✅ 3. Get current theme
  const colors = themeColors[theme];      // ✅ 4. Load theme colors
  const wideWeb = isWeb && width >= 900;
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [transcripts, setTranscripts] = React.useState<string[] | null>(null);

  React.useEffect(() => {
    (async () => {
      if (!id) return;
      try {
        const raw = await AsyncStorage.getItem(`transcripts:${id}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) setTranscripts(parsed);
        }
      } catch (e) {
        console.log('Load transcripts error', e);
      }
    })();
  }, [id]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <LinearGradient
            colors={[colors.primary, colors.secondary]}
            style={[styles.imageBadge, { width: badgeSize, height: badgeSize, borderRadius: badgeSize / 2 }]}
          >
            <Image
              source={{ uri: 'https://cdn-icons-png.flaticon.com/512/4313/4313072.png' }}
              style={[styles.image, { width: imageSize, height: imageSize }]}
              resizeMode="contain"
              accessibilityLabel="Success badge"
            />
          </LinearGradient>

          <Text style={[styles.title, { color: colors.text }]}>Interview Completed!</Text>
          <Text style={[styles.subtitle, { color: (colors as any).subtitle }]}>
            Here’s your performance summary:
          </Text>

          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.card,
                shadowColor: colors.primary,
                ...(isWeb
                  ? { boxShadow: '0 6px 22px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.08)' }
                  : {}),
              },
              wideWeb && styles.cardWide,
            ]}
          >
            <Text style={[styles.scoreLabel, { color: colors.cardText }]}>Overall Score</Text>
            <Text style={styles.score}>8.5 / 10</Text>

            <View style={[wideWeb ? styles.sectionsRow : undefined]}>
              <View style={[styles.section, wideWeb && styles.sectionHalf]}>
                <Text style={[styles.sectionTitle, { color: (colors as any).subtitle }]}>Strengths</Text>
                <Text style={[styles.sectionText, { color: colors.cardText }]}>• Good communication skills</Text>
                <Text style={[styles.sectionText, { color: colors.cardText }]}>• Strong problem-solving approach</Text>
              </View>

              <View style={[styles.section, wideWeb && styles.sectionHalf]}>
                <Text style={[styles.sectionTitle, { color: (colors as any).subtitle }]}>Areas to Improve</Text>
                <Text style={[styles.sectionText, { color: colors.cardText }]}>• Provide more real-world examples</Text>
                <Text style={[styles.sectionText, { color: colors.cardText }]}>• Answer technical questions faster</Text>
              </View>
            </View>
          </View>

          {transcripts && (
            <View style={styles.transcriptCard}>
              <Text style={[styles.transcriptTitle, { color: colors.text }]}>Answer Transcripts</Text>
              {transcripts.map((t, i) => (
                <View key={i} style={styles.transcriptItem}>
                  <Text style={[styles.transcriptQ, { color: (colors as any).subtitle }]}>Q{i + 1}</Text>
                  <Text style={[styles.transcriptText, { color: colors.cardText }]}>{t || '—'}</Text>
                </View>
              ))}
            </View>
          )}

          <PrimaryButton title="Finish" onPress={handleFinish} />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  // NEW root + scroll wrappers (do not disturb native appearance)
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: isWeb ? 40 : 0,
  },
  // modify (was container) -> renamed root above; keep original container props in content
  content: {
    width: '100%',
    maxWidth: 760,              // slightly wider for large web
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: 16,
  },
  image: {
    // dimensions overridden dynamically
    marginBottom: 0,
  },
  imageBadge: {
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  title: {
    fontSize: isWeb ? 30 : 28,
    fontWeight: 'bold',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 22,
    textAlign: 'center',
    maxWidth: 520,
  },
  card: {
    borderRadius: 20,
    padding: 24,
    width: '100%',
    marginBottom: 24,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: Platform.OS === 'web' ? 0 : 0.18,
    shadowRadius: 12,
    elevation: Platform.OS === 'web' ? 0 : 5,
  },
  cardWide: {
    paddingHorizontal: 40,
  },
  scoreLabel: { fontSize: 16, textAlign: 'center' },
  score: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#10B981',
    textAlign: 'center',
    marginBottom: 22,
  },
  sectionsRow: {
    flexDirection: 'row',
    gap: 40,
    width: '100%',
    justifyContent: 'space-between',
  },
  section: { 
    marginBottom: 16,
    width: '100%',
    alignItems: isWeb ? 'center' : 'flex-start',
  },
  sectionHalf: {
    flex: 1,
    maxWidth: '50%',
    alignItems: 'flex-start',
  },
  sectionTitle: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    marginBottom: 6,
    textAlign: isWeb ? 'center' : 'left',
    width: '100%',
  },
  sectionText: { 
    fontSize: 14, 
    marginLeft: isWeb ? 0 : 10,
    lineHeight: 20,
    textAlign: isWeb ? 'center' : 'left',
    width: '100%',
  },
  transcriptCard: {
    width: '100%',
    maxWidth: 760,
    padding: 18,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 28,
  },
  transcriptTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
    textAlign: 'center',
  },
  transcriptItem: {
    marginBottom: 10,
  },
  transcriptQ: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  transcriptText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
  },
});

export default EndScreen;
