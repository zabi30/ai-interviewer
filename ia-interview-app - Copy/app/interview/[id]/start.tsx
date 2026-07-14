import React, { useEffect, useRef, useState } from 'react';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import { Camera, CameraView } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import { router, useLocalSearchParams } from 'expo-router';
import { FFmpegKit } from 'ffmpeg-kit-react-native'; // ✅ FFmpeg for audio extract
import { Alert, Dimensions, Platform, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { PrimaryButton } from '../../../components/PrimaryButton';
import SafeLottie from '../../../components/SafeLottie';
import { useTheme } from '../../../context/ThemeContext'; // ✅ Theme hook
import { themeColors } from '../../../context/themeColors'; // ✅ Centralized colors

// 🔗 Your n8n STT webhook endpoint
const WEBHOOK_URL = 'https://zabi5545.app.n8n.cloud/webhook/stt';

const { width } = Dimensions.get('window');

const questions = [
  'Tell me about yourself.',
  'What is your biggest strength?',
  'Describe a challenge you faced at work and how you overcame it.',
  'Why do you want to join our company?',
  'Where do you see yourself in 5 years?',
];

function extractTranscriptString(payload: any): string {
  try {
    if (!payload) return 'No text';
    if (typeof payload === 'string') return payload;
    if (typeof payload.transcript === 'string') return payload.transcript;
    if (payload.transcripts && typeof payload.transcripts.text === 'string') return payload.transcripts.text; // 👈 handles { transcripts: { text: '...' } }
    if (payload.transcript && typeof payload.transcript.text === 'string') return payload.transcript.text;
    if (Array.isArray(payload.transcript) && typeof payload.transcript[0] === 'string') return payload.transcript[0];
    if (typeof payload.text === 'string') return payload.text;
    return JSON.stringify(payload);
  } catch {
    return 'No text';
  }
}

export default function InterviewScreen() {
  const params = useLocalSearchParams();
  const id = params.id; // <-- Interview code from the URL

  const [currentIndex, setCurrentIndex] = useState(0);
  const [timer, setTimer] = useState(30);
  const [showConfetti, setShowConfetti] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [containerSize, setContainerSize] = useState({ w: width, h: 0 });
  const [canRenderConfetti, setCanRenderConfetti] = useState(false);
  const [transcripts, setTranscripts] = useState<string[]>(() => questions.map(() => ''));
  const [audioUris, setAudioUris] = useState<string[]>(() => questions.map(() => ''));
  const [debugLines, setDebugLines] = useState<string[]>([]);

  const logDebug = (msg: string, ...rest: any[]) => {
    const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
    // Console for dev tools
    // eslint-disable-next-line no-console
    console.log(line, ...rest);
    // On-screen log (last 20 lines)
    setDebugLines(prev => {
      const next = [...prev, line];
      return next.length > 20 ? next.slice(next.length - 20) : next;
    });
  };

  const slideX = useSharedValue(width);
  const cameraRef = useRef<CameraView | null>(null);
  const recordingRef = useRef<Promise<any> | null>(null);

  const navigation = useNavigation();

  const { theme } = useTheme();
  const colors = themeColors[theme];

  // 📸 Request camera & microphone permissions
  useEffect(() => {
    (async () => {
      const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
      const { status: micStatus } = await Camera.requestMicrophonePermissionsAsync();
      const ok = cameraStatus === 'granted' && micStatus === 'granted';
      logDebug(`[Perm] camera: ${cameraStatus} mic: ${micStatus} hasPermission: ${ok}`);
      setHasPermission(ok);
    })();
  }, []);

  // 🎬 Animate card and start recording per question + countdown
  useEffect(() => {
    slideX.value = withTiming(0, { duration: 500 });

    const delay = setTimeout(() => startRecording(), 500);

    const interval = setInterval(async () => {
      setTimer((t) => {
        if (t === 1) {
          // Handle timer completion asynchronously
          (async () => {
            await handleNextQuestion();
          })();
          return 30;
        }
        return t - 1;
      });
    }, 1000);

    return () => {
      clearTimeout(delay);
      clearInterval(interval);
    };
  }, [currentIndex]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideX.value }],
  }));

  // 💾 Persistence helpers
  const persistTranscripts = async (next: string[]) => {
    try {
      await AsyncStorage.setItem(`transcripts:${id}`, JSON.stringify(next));
    } catch (e) {
      console.log('Persist transcripts error', e);
    }
  };

  const persistAudioUris = async (next: string[]) => {
    try {
      await AsyncStorage.setItem(`audioUris:${id}` as string, JSON.stringify(next));
    } catch (e) {
      console.log('Persist audio URIs error', e);
    }
  };

  const setTranscriptAt = (idx: number, text: string) => {
    setTranscripts(prev => {
      const copy = [...prev];
      copy[idx] = text;
      persistTranscripts(copy);
      return copy;
    });
  };

  const setAudioUriAt = (idx: number, uri: string) => {
    setAudioUris(prev => {
      const copy = [...prev];
      copy[idx] = uri;
      persistAudioUris(copy);
      return copy;
    });
  };

  // 🔁 Load any saved data for this interview id
  useEffect(() => {
    (async () => {
      if (!id) return;
      try {
        const raw = await AsyncStorage.getItem(`transcripts:${id}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length === questions.length) setTranscripts(parsed);
        }
        const rawAud = await AsyncStorage.getItem(`audioUris:${id}`);
        if (rawAud) {
          const parsedAud = JSON.parse(rawAud);
          if (Array.isArray(parsedAud) && parsedAud.length === questions.length) setAudioUris(parsedAud);
        }
      } catch {}
    })();
  }, [id]);

  // 🎤 Send audio to n8n STT webhook and save transcript
  const transcribeAudio = async (audioUri: string, questionIndex: number) => {
    try {
      const info = await FileSystem.getInfoAsync(audioUri);
      if (!info.exists) throw new Error('Audio file not found to upload');

      // Optional: show a temporary state while transcribing
      setTranscriptAt(questionIndex, 'Transcribing…');

      const form = new FormData();
      form.append('file', {
        uri: audioUri,
        name: `question_${questionIndex + 1}.ogg`,
        type: 'audio/ogg',
      } as any);
      form.append('questionIndex', String(questionIndex));
      if (id) form.append('interviewId', String(id));

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60_000);

      // ⚠️ Do NOT set Content-Type manually; let fetch define the multipart boundary
      const res = await fetch(WEBHOOK_URL, {
        method: 'POST',
        body: form,
        signal: controller.signal,
      } as RequestInit);

      clearTimeout(timeout);

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }

      const json = await res.json();
      const text = extractTranscriptString(json?.transcripts ?? json);

      if (typeof text === 'string' && text.trim().length > 0) {
        setTranscriptAt(questionIndex, text);
        console.log(`📝 Transcript saved for Q${questionIndex + 1}:`, text);
        return text;
      } else {
        setTranscriptAt(questionIndex, 'No text');
        return null;
      }
    } catch (e) {
      console.log('Transcription error:', e);
      setTranscriptAt(questionIndex, 'Transcription failed');
      return null;
    }
  };

  // 🧰 Extract OGG audio (Opus → Vorbis fallback)
  const saveAudioFromVideo = async (videoUri: string, questionIndex: number) => {
    logDebug('saveAudioFromVideo called');
    const base = `${FileSystem.documentDirectory}question_${questionIndex + 1}`;
    const oggUri = `${base}.ogg`;
    const vorbisOggUri = `${base}_vorbis.ogg`;

    try {
      logDebug('[FFmpeg] Start Opus extract from video');
      const opusCmd = `-y -i "${videoUri}" -vn -ac 1 -ar 16000 -c:a libopus -b:a 16k -vbr on -compression_level 10 "${oggUri}"`;
      await FFmpegKit.execute(opusCmd);

      const oggInfo = await FileSystem.getInfoAsync(oggUri);
      if (oggInfo.exists) {
        logDebug(`✅ Audio (Opus) saved size=${oggInfo.size ?? 'unknown'}`);
        return oggUri;
      }
      throw new Error('Opus output not found');
    } catch (e) {
      logDebug('⚠️ Opus encode failed or unavailable, trying Vorbis OGG');
      try {
        const vorbisCmd = `-y -i "${videoUri}" -vn -ac 1 -ar 16000 -c:a libvorbis -q:a 3 "${vorbisOggUri}"`;
        await FFmpegKit.execute(vorbisCmd);

        const vInfo = await FileSystem.getInfoAsync(vorbisOggUri);
        if (vInfo.exists) {
          logDebug(`✅ Audio (Vorbis OGG) saved size=${vInfo.size ?? 'unknown'}`);
          return vorbisOggUri;
        }
      } catch (e2) {
        logDebug('❌ Vorbis encode failed');
      }
      return null;
    }
  };

  // 🎥 Start a recording, then extract audio, then transcribe via webhook
  const startRecording = async () => {
    try {
      logDebug(`[Start] question=${currentIndex + 1} hasPermission=${hasPermission}`);
      if (cameraRef.current) {
        if (recordingRef.current) {
          cameraRef.current.stopRecording();
        }

        logDebug(`🎥 Recording started for question ${currentIndex + 1}`);
        const p = cameraRef.current.recordAsync({
          maxDuration: 30000,
        }).then(async (video) => {
          logDebug(`[Record done] uriPresent=${!!video?.uri}`);
          if (video?.uri) {
            logDebug(`✅ Video saved for Q${currentIndex + 1}`);
            const audioUri = await saveAudioFromVideo(video.uri, currentIndex);
            if (audioUri) {
              setAudioUriAt(currentIndex, audioUri);
              logDebug(`Audio saved for Q${currentIndex + 1}: ${audioUri}`);
              // 👉 Send to webhook for STT
              await transcribeAudio(audioUri, currentIndex);
            } else {
              logDebug(`Audio extraction failed for Q${currentIndex + 1}`);
              setTranscriptAt(currentIndex, 'Audio extraction failed');
            }
          } else {
            setTranscriptAt(currentIndex, 'No recording captured');
          }
        }).finally(() => {
          // Clear the ref when promise settles
          recordingRef.current = null;
        });

        recordingRef.current = p;
      } else {
        logDebug('[Start] cameraRef not ready');
      }
    } catch (e) {
      logDebug('Recording error (see console for details)');
      recordingRef.current = null;
    }
  };

  // ⏭️ Go to next question or finish interview
  const handleNextQuestion = async () => {
    logDebug(`[Next] stopping recording for Q${currentIndex + 1}`);
    if (cameraRef.current) {
      try { await cameraRef.current.stopRecording(); } catch {}
    }

    // Upload audio and get transcript before advancing
    const audioUri = audioUris[currentIndex];
    let transcript = transcripts[currentIndex];
    
    // If we have audio but no transcript yet, transcribe it
    if (audioUri && (!transcript || transcript === 'Transcribing…' || transcript === '')) {
      logDebug(`[Next] Transcribing audio for Q${currentIndex + 1}`);
      transcript = await transcribeAudio(audioUri, currentIndex) || '';
    }

    // Show alert with transcript before advancing
    return new Promise<void>((resolve) => {
      const msg = transcript && transcript !== 'Transcribing…' && transcript !== '' 
        ? transcript 
        : 'No transcript available for this question.';
      
      Alert.alert(
        'File Transcribed',
        msg,
        [
          {
            text: 'OK',
            onPress: () => {
              logDebug(`[Next] Alert closed, advancing from Q${currentIndex + 1}`);
              if (currentIndex < questions.length - 1) {
                slideX.value = width;
                setCurrentIndex((prev) => prev + 1);
                setTimer(30);
                setTimeout(() => {
                  slideX.value = withTiming(0, { duration: 500 });
                }, 50);
              } else {
                persistTranscripts(transcripts); // ensure final save
                setShowConfetti(true);
                setTimeout(() => {
                  setShowConfetti(false);
                  router.push(`/interview/${id}/end`);
                }, 4000);
              }
              resolve();
            },
          },
        ],
        { cancelable: false }
      );
    });
  };

  const renderDots = () => (
    <View style={styles.dotsContainer}>
      {questions.map((_, index) => {
        const isActive = index === currentIndex;
        const animatedStyleDot = useAnimatedStyle(() => ({
          width: withTiming(isActive ? 20 : 8, { duration: 300 }),
          backgroundColor: withTiming(isActive ? colors.accent : colors.subtitle, { duration: 300 }),
        }), [isActive]);

        return <Animated.View key={index} style={[styles.dot, animatedStyleDot]} />;
      })}
    </View>
  );

  const onContainerLayout = (e: any) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    if (w > 0 && h > 0) {
      setContainerSize({ w, h });
      requestAnimationFrame(() => setCanRenderConfetti(true));
    }
  };

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background }]}
      onLayout={onContainerLayout}
    >
      {Platform.OS !== 'web' && showConfetti && canRenderConfetti && (
        <SafeLottie
          source={require('../../../assets/animations/confetti.json')}
          loop={false}
          style={{ position: 'absolute', top: 0, left: 0, width: containerSize.w, height: containerSize.h, pointerEvents: 'none' }}
        />
      )}

      {/* Camera Preview */}
      {hasPermission && (
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="front"
          mode="video"
        />
      )}

      {/* Timer */}
      <Text style={[styles.timer, { color: colors.danger }]}>{timer}s</Text>
      {renderDots()}

      <Animated.View style={[styles.card, animatedStyle]}>
        <BlurView intensity={40} tint={theme === 'dark' ? 'dark' : 'light'} style={styles.blurCard}>
          <Text style={[styles.question, { color: colors.text }]}>{questions[currentIndex]}</Text>
        </BlurView>
      </Animated.View>

      <PrimaryButton
        title={currentIndex === questions.length - 1 ? 'Submit Interview' : 'Next Question'}
        onPress={() => handleNextQuestion()}
      />

      {__DEV__ && (
        <View style={{ marginTop: 12, maxWidth: '90%' }}>
          <Text style={{ fontSize: 12, opacity: 0.7, color: colors.text }}>Debug</Text>
          {debugLines.map((l, i) => (
            <Text key={i} style={{ fontSize: 12, color: colors.text, opacity: 0.8 }}>{l}</Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  camera: {
    width: Platform.OS === 'web' ? Math.min(width * 0.5, 720) : width * 0.9,
    height: Platform.OS === 'web' ? 340 : 200,
    minHeight: Platform.OS === 'web' ? 250 : 200,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: Platform.OS === 'web' ? 12 : 20,
    backgroundColor: '#000',
  },
  timer: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: Platform.OS === 'web' ? 8 : 20,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Platform.OS === 'web' ? 12 : 20,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  card: {
    width: Platform.OS === 'web' ? Math.min(width * 0.65, 720) : width * 0.9,
    minHeight: 100,
    borderRadius: 20,
    marginBottom: 30,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: Platform.OS === 'web' ? 0.12 : 0.3,
    shadowOffset: { width: 0, height: Platform.OS === 'web' ? 2 : 3 },
    shadowRadius: Platform.OS === 'web' ? 4 : 6,
    elevation: Platform.OS === 'web' ? 0 : 10,
  },
  blurCard: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  question: {
    fontSize: 22,
    textAlign: 'center',
    fontWeight: '600',
  },
});
