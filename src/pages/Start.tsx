import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CodingPlayground } from '../components/CodingPlayground';
import { httpRequest } from '../utils/http';
import { API_BASE_URL } from '../utils/env';

interface StartPageProps {
  id: string;
  navigateTo: (path: string) => void;
}

export default function StartPage({ id, navigateTo }: StartPageProps) {
  const [questions, setQuestions] = useState<string[]>(['Loading interview questions...']);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timer, setTimer] = useState(30);
  const [transcripts, setTranscripts] = useState<string[]>([]);
  const [currentText, setCurrentText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<'speaking' | 'listening' | 'thinking'>('speaking');
  const [proctorWarningVisible, setProctorWarningVisible] = useState(false);
  const [proctorWarningCount, setProctorWarningCount] = useState(0);

  // Store the camera stream in a ref so we can attach it to any video element
  const cameraStreamRef = useRef<MediaStream | null>(null);
  // Stable ref to the video DOM element — avoids re-attachment on every re-render
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  // Stable callback ref: only called on actual mount/unmount, not on every re-render
  const videoCallbackRef = useCallback((el: HTMLVideoElement | null) => {
    videoElRef.current = el;
    // Only set srcObject if stream is already available
    if (el && cameraStreamRef.current) {
      el.srcObject = cameraStreamRef.current;
    }
  }, []); // empty deps = stable reference, never recreated
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);

  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const statusRef = useRef(status);
  // Guard: prevent double TTS calls (React StrictMode / re-render safety)
  const ttsCalledRef = useRef<number>(-1);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const logDebug = (msg: string) => {
    console.log(`[StartPage] ${msg}`);
  };

  // Helper: check if question involves coding
  const isCodingQuestion = (qText: string) => {
    if (!qText) return false;
    const words = [
      'code', 'function', 'write a program', 'algorithm', 'coding',
      'implement', 'programming', 'javascript', 'python', 'c++',
      'java', 'sql', 'array', 'string', 'variable', 'class', 'loop'
    ];
    const lower = qText.toLowerCase();
    return words.some(w => lower.includes(w));
  };



  // 1. Setup Camera — store stream in ref, attach via stable ref
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then(stream => {
        cameraStreamRef.current = stream;
        // If video element already mounted, attach stream now
        if (videoElRef.current) {
          videoElRef.current.srcObject = stream;
        }
      })
      .catch(err => {
        logDebug('Camera preview access denied or unavailable.');
        console.error(err);
      });

    return () => {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  // 1b. Vision Proctor: Capture webcam frame every 15s — fire & forget, zero latency
  useEffect(() => {
    if (!id) return;

    const INTERVAL_MS = 15_000;
    const FRAME_W = 320;
    const FRAME_H = 240;

    // Reuse a single off-screen canvas — never added to DOM
    const canvas = document.createElement('canvas');
    canvas.width = FRAME_W;
    canvas.height = FRAME_H;
    const ctx = canvas.getContext('2d');

    const captureAndSend = () => {
      const video = videoElRef.current;
      if (!video || video.readyState < 2 || !ctx) return;

      // Draw current video frame to hidden canvas
      ctx.drawImage(video, 0, 0, FRAME_W, FRAME_H);
      const frameBase64 = canvas.toDataURL('image/jpeg', 0.6); // ~10-15KB

      // Fire and forget — no await, no then, never blocks UI
      fetch('/api/interview/proctor-frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interviewId: id, frameBase64 }),
        keepalive: true, // ensures request completes even if page unloads
      }).catch(() => {}); // swallow any network errors silently
    };

    // Use requestIdleCallback so capture only runs when browser is idle
    let intervalHandle: ReturnType<typeof setInterval>;
    const scheduleCapture = () => {
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(() => captureAndSend(), { timeout: 3000 });
      } else {
        captureAndSend(); // fallback for browsers without requestIdleCallback
      }
    };

    // First capture after 10s (let interview settle), then every 15s
    const firstCapture = setTimeout(() => {
      scheduleCapture();
      intervalHandle = setInterval(scheduleCapture, INTERVAL_MS);
    }, 10_000);

    return () => {
      clearTimeout(firstCapture);
      clearInterval(intervalHandle);
    };
  }, [id]);

  // 2. Fetch Dynamic Questions — sort coding questions LAST
  useEffect(() => {
    (async () => {
      if (!id) return;
      try {
        const res = await httpRequest<{ questions: string[] }>({
          method: 'GET',
          path: `/api/interview/${id}/questions`,
        });
        if (res.questions && res.questions.length > 0) {
          // Sort: verbal questions first, coding questions last
          const sorted = [
            ...res.questions.filter(q => !isCodingQuestion(q)),
            ...res.questions.filter(q => isCodingQuestion(q)),
          ];
          setQuestions(sorted);
          setTranscripts(sorted.map(() => ''));
        }
      } catch (err) {
        logDebug('Error loading interview questions.');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [id]);

  const triggerProctorViolation = () => {
    setProctorWarningCount(c => {
      const next = c + 1;
      setProctorWarningVisible(true);
      httpRequest({
        method: 'POST',
        path: '/api/interview/proctor-warning',
        body: { interviewId: id }
      }).catch(err => console.error('Failed logging proctor warning:', err));
      return next;
    });
  };

  // 3. Proctor Monitoring
  useEffect(() => {
    if (!id) return;

    const handleVisibilityChange = () => {
      if (document.hidden) triggerProctorViolation();
    };
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) triggerProctorViolation();
    };
    const handleWindowBlur = () => triggerProctorViolation();

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [id]);

  // Browser TTS fallback
  const speakBrowserSpeech = (text: string, onEnd?: () => void) => {
    if (!window.speechSynthesis) { if (onEnd) onEnd(); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const indVoice = voices.find(v => v.lang.includes('IN') || v.name.toLowerCase().includes('india') || v.name.toLowerCase().includes('arjun'));
    if (indVoice) utterance.voice = indVoice;
    utterance.onend = () => { if (onEnd) onEnd(); };
    utterance.onerror = () => { if (onEnd) onEnd(); };
    window.speechSynthesis.speak(utterance);
  };

  // 4. TTS — Azure Arjun voice
  const playQuestionTTS = async (text: string, cancelToken: { cancelled: boolean }) => {
    // Cancel any previous audio/speech before starting
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (window.speechSynthesis) window.speechSynthesis.cancel();

    setStatus('speaking');
    try {
      const res = await httpRequest<{ audioUrl?: string }>({
        method: 'POST',
        path: '/api/interview/tts',
        body: { text }
      });

      // Effect was cleaned up while awaiting — abort
      if (cancelToken.cancelled) return;

      if (res.audioUrl) {
        const finalUrl = res.audioUrl.startsWith('http')
          ? res.audioUrl
          : `${API_BASE_URL.replace(/\/$/, '')}${res.audioUrl}`;
        logDebug('🔊 Play Arjun voice speech...');
        const audio = new window.Audio(finalUrl);
        audioRef.current = audio;

        audio.play().catch(() => {
          if (cancelToken.cancelled) return;
          speakBrowserSpeech(text, () => {
            if (cancelToken.cancelled) return;
            setStatus('listening');
            startSpeechRecognition();
          });
        });

        audio.onended = () => {
          if (cancelToken.cancelled) return;
          logDebug('🎙️ AI finished speaking. listening...');
          setStatus('listening');
          startSpeechRecognition();
        };
      } else {
        speakBrowserSpeech(text, () => {
          if (cancelToken.cancelled) return;
          setStatus('listening');
          startSpeechRecognition();
        });
      }
    } catch {
      if (cancelToken.cancelled) return;
      speakBrowserSpeech(text, () => {
        if (cancelToken.cancelled) return;
        setStatus('listening');
        startSpeechRecognition();
      });
    }
  };

  // 5. Speech recognition
  const startSpeechRecognition = () => {
    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) return;

      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }

      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onresult = (e: any) => {
        let finalTrans = '';
        for (let i = e.resultIndex; i < e.results.length; ++i) {
          if (e.results[i].isFinal) finalTrans += e.results[i][0].transcript + ' ';
        }
        if (finalTrans.trim()) {
          setCurrentText(prev => {
            const next = (prev + ' ' + finalTrans.trim()).trim();
            if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
            silenceTimeoutRef.current = setTimeout(() => {
              logDebug('🤫 Silence detected. Auto-submitting...');
              handleNextQuestion(next);
            }, 2500);
            return next;
          });
        }
      };

      rec.onerror = (event: any) => console.error('Speech recognition error:', event.error);

      rec.onend = () => {
        if (statusRef.current === 'listening' && recognitionRef.current === rec) {
          try { rec.start(); } catch (e) { console.error(e); }
        }
      };

      rec.start();
      recognitionRef.current = rec;
    } catch (e) {
      console.error(e);
    }
  };

  // 6. TTS trigger on question change
  useEffect(() => {
    if (isLoading) return;

    const q = questions[currentIndex];
    if (!q) return;

    const isCoding = isCodingQuestion(q);
    const cancelToken = { cancelled: false };

    // Only speak verbal questions, and only if not already called for this index
    if (!isCoding && ttsCalledRef.current !== currentIndex) {
      ttsCalledRef.current = currentIndex;
      playQuestionTTS(q, cancelToken);
    }

    // Timer: 30s verbal, 300s coding
    const timerDuration = isCoding ? 300 : 30;
    setTimer(timerDuration);

    const interval = setInterval(() => {
      setTimer(t => {
        if (t === 1) {
          handleNextQuestion(currentText);
          return timerDuration;
        }
        return t - 1;
      });
    }, 1000);

    return () => {
      // Mark cancel so any in-flight TTS/audio callbacks are suppressed
      cancelToken.cancelled = true;
      clearInterval(interval);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, [currentIndex, isLoading]);

  // 7. Submit answer & advance
  const handleNextQuestion = async (textToSubmit?: string) => {
    const finalAnswerText = textToSubmit !== undefined ? textToSubmit : currentText;
    setStatus('thinking');
    logDebug('Submitting response...');

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
    if (audioRef.current) audioRef.current.pause();

    // Filler only for verbal
    if (!isCodingQuestion(questions[currentIndex])) {
      if (finalAnswerText && finalAnswerText.trim() !== 'No response recorded.') {
        const fillers = [
          "Hmm, got it. Let me think...",
          "Interesting point. Let me analyze that...",
          "Okay, noted. Let me check the next detail...",
          "Alright, makes sense. Let me ask you this..."
        ];
        speakBrowserSpeech(fillers[Math.floor(Math.random() * fillers.length)]);
      }
    }

    try {
      const res = await httpRequest<any>({
        method: 'POST',
        path: '/api/interview/submit-answer',
        body: {
          questionIndex: currentIndex,
          interviewId: id,
          textAnswer: finalAnswerText || 'No response recorded.',
        }
      });

      if (window.speechSynthesis) window.speechSynthesis.cancel();

      if (res.nextQuestion) {
        setQuestions(prev => {
          const copy = [...prev];
          copy[currentIndex + 1] = res.nextQuestion;
          return copy;
        });
      }
    } catch {
      logDebug('Network error saving response.');
    }

    setCurrentText('');
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      navigateTo(`#/interview/${id}/end`);
    }
  };

  // ─── Render helpers ───────────────────────────────────────────────

  const KEYFRAMES = `
    @keyframes bar-pulse {
      0% { transform: scaleY(0.4); }
      100% { transform: scaleY(1.2); }
    }
    @keyframes pulse-grow {
      0% { transform: scale(0.8); opacity: 0.5; }
      50% { transform: scale(1.3); opacity: 1; }
      100% { transform: scale(0.8); opacity: 0.5; }
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;

  const renderStatusBadge = () => {
    const map = {
      speaking: { text: 'Speaking', color: '#3b82f6', bg: '#3b82f620', icon: '🔊' },
      listening: { text: 'Listening', color: '#10b981', bg: '#10b98120', icon: '🟢' },
      thinking:  { text: 'Thinking',  color: '#f59e0b', bg: '#f59e0b20', icon: '⚙️' },
    };
    const { text, color, bg, icon } = map[status];
    return (
      <div style={{
        position: 'absolute', top: '10px', right: '10px',
        backgroundColor: bg, border: `1px solid ${color}`,
        padding: '5px 12px', borderRadius: '20px',
        fontSize: '11px', fontWeight: '700', color,
        display: 'flex', alignItems: 'center', gap: '5px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)', zIndex: 2
      }}>
        <span>{icon}</span> {text}
      </div>
    );
  };

  const renderDots = () => (
    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
      {questions.map((_, idx) => (
        <div key={idx} style={{
          width: idx === currentIndex ? '24px' : '8px',
          height: '8px', borderRadius: '4px',
          backgroundColor: idx === currentIndex ? '#4f46e5' : '#4b5563',
          transition: 'all 0.3s'
        }} />
      ))}
    </div>
  );

  const renderInterviewerAvatar = (compact = false) => {
    const glowColor = status === 'listening' ? '#10b981' : status === 'thinking' ? '#f59e0b' : '#3b82f6';
    const size = compact ? '60px' : '80px';
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: '8px',
        padding: compact ? '12px' : '20px',
        backgroundColor: '#111827', borderRadius: '12px',
        border: '1px solid #374151', height: '100%',
        boxSizing: 'border-box'
      }}>
        <style>{KEYFRAMES}</style>
        {/* Animated avatar circle */}
        <div style={{
          width: size, height: size, borderRadius: '50%',
          backgroundColor: '#1f2937', display: 'flex',
          justifyContent: 'center', alignItems: 'center',
          border: `3px solid ${glowColor}`,
          boxShadow: `0 0 20px ${glowColor}40`,
          transition: 'all 0.3s ease', flexShrink: 0
        }}>
          {status === 'speaking' && (
            <div style={{ display: 'flex', gap: '3px', alignItems: 'center', height: '24px' }}>
              {[20, 12, 24, 16].map((h, i) => (
                <div key={i} style={{ width: '4px', height: `${h}px`, backgroundColor: '#3b82f6', borderRadius: '2px', animation: `bar-pulse ${0.5 + i * 0.1}s infinite alternate ${i * 0.1}s` }} />
              ))}
            </div>
          )}
          {status === 'listening' && (
            <div style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: '#10b981', animation: 'pulse-grow 1.5s infinite' }} />
          )}
          {status === 'thinking' && (
            <div style={{ border: '4px solid #374151', borderTop: '4px solid #f59e0b', borderRadius: '50%', width: '28px', height: '28px', animation: 'spin 1s linear infinite' }} />
          )}
        </div>
        <div style={{ fontSize: compact ? '12px' : '14px', fontWeight: '700', color: '#ffffff', textAlign: 'center' }}>Arjun</div>
        <div style={{ fontSize: '11px', color: '#9ca3af', textAlign: 'center' }}>AI Interviewer</div>
        {/* Status label */}
        <div style={{
          fontSize: '10px', fontWeight: '600', padding: '3px 10px', borderRadius: '12px',
          backgroundColor: `${glowColor}20`, color: glowColor, border: `1px solid ${glowColor}40`
        }}>
          {status === 'speaking' ? '🔊 Speaking' : status === 'listening' ? '🟢 Listening' : '⚙️ Thinking'}
        </div>
      </div>
    );
  };

  const renderWebcam = () => (
    <div style={{
      position: 'relative', width: '100%', height: '100%',
      backgroundColor: '#000', borderRadius: '12px',
      overflow: 'hidden', border: '1px solid #4b5563',
      minHeight: '180px', boxSizing: 'border-box'
    }}>
      <video
        ref={videoCallbackRef}
        autoPlay
        playsInline
        muted
        style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', display: 'block' }}
      />
      {/* You label */}
      <div style={{
        position: 'absolute', bottom: '10px', left: '10px',
        backgroundColor: 'rgba(0,0,0,0.6)', color: '#fff',
        fontSize: '11px', fontWeight: '600',
        padding: '3px 10px', borderRadius: '10px'
      }}>
        📷 You
      </div>
    </div>
  );

  const renderProctorWarningOverlay = () => {
    if (!proctorWarningVisible) return null;
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(11,15,25,0.85)', backdropFilter: 'blur(8px)',
        zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '24px'
      }}>
        <div style={{
          backgroundColor: '#1f2937', border: '2px solid #f59e0b', borderRadius: '16px',
          padding: '40px', width: '100%', maxWidth: '480px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.4)', textAlign: 'center',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px'
        }}>
          <div style={{ fontSize: '48px' }}>⚠️</div>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#fff' }}>Proctoring Warning</div>
          <div style={{ fontSize: '14px', color: '#d1d5db', lineHeight: '1.6' }}>
            You have navigated away from the interview screen. Switching browser tabs or applications is strictly prohibited and has been logged.
          </div>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#f59e0b', backgroundColor: '#f59e0b15', padding: '6px 12px', borderRadius: '20px' }}>
            Warning #{proctorWarningCount} logged
          </div>
          <button
            onClick={() => {
              try { document.documentElement.requestFullscreen?.().catch(() => {}); } catch {}
              setProctorWarningVisible(false);
            }}
            style={{
              width: '100%', padding: '12px', borderRadius: '8px', border: 'none',
              backgroundColor: '#f59e0b', color: '#111827', fontSize: '15px',
              fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 12px rgba(245,158,11,0.3)'
            }}
          >
            Re-enter Fullscreen & Resume
          </button>
        </div>
      </div>
    );
  };

  // ─── Loading Screen ───────────────────────────────────────────────
  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#0b0f19', color: '#9ca3af' }}>
        <div style={{ border: '4px solid #1f2937', borderTop: '4px solid #4f46e5', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite', marginBottom: '16px' }} />
        <style>{`@keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }`}</style>
        <div style={{ fontSize: '16px', fontWeight: '600' }}>Initializing interview room...</div>
      </div>
    );
  }

  const isCoding = isCodingQuestion(questions[currentIndex]);

  // ─── CODING QUESTION LAYOUT ───────────────────────────────────────
  if (isCoding) {
    return (
      <div style={{ display: 'flex', height: '100vh', backgroundColor: '#0b0f19', color: '#f3f4f6', overflow: 'hidden' }}>

        {/* Left panel: question + camera + timer + done btn */}
        <div style={{
          width: '360px', flexShrink: 0,
          display: 'flex', flexDirection: 'column', gap: '16px',
          padding: '24px', backgroundColor: '#111827',
          borderRight: '1px solid #374151', overflowY: 'auto'
        }}>
          {/* Progress */}
          {renderDots()}

          {/* Camera preview */}
          <div style={{ height: '180px', flexShrink: 0 }}>
            {renderWebcam()}
          </div>

          {/* Coding badge */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            backgroundColor: '#7c3aed20', border: '1px solid #7c3aed',
            padding: '8px 14px', borderRadius: '8px'
          }}>
            <span style={{ fontSize: '16px' }}>💻</span>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#a78bfa' }}>CODING CHALLENGE</span>
          </div>

          {/* Question */}
          <div style={{
            flex: 1, backgroundColor: '#1f2937', borderRadius: '12px',
            border: '1px solid #374151', padding: '20px',
            fontSize: '15px', fontWeight: '600', color: '#fff',
            lineHeight: '1.6', overflowY: 'auto'
          }}>
            {questions[currentIndex]}
          </div>

          {/* Timer bar */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px', color: '#9ca3af' }}>
              <span>⏱ Time Remaining</span>
              <span style={{ color: timer < 60 ? '#ef4444' : '#10b981', fontWeight: '700' }}>
                {Math.floor(timer / 60)}:{String(timer % 60).padStart(2, '0')}
              </span>
            </div>
            <div style={{ height: '6px', backgroundColor: '#374151', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${(timer / 300) * 100}%`,
                backgroundColor: timer < 60 ? '#ef4444' : '#10b981',
                transition: 'width 1s linear, background-color 0.3s',
                borderRadius: '3px'
              }} />
            </div>
          </div>

          {/* Done button */}
          <button
            onClick={() => handleNextQuestion()}
            style={{
              width: '100%', padding: '14px', borderRadius: '10px',
              border: 'none', backgroundColor: '#10b981',
              color: '#fff', fontSize: '16px', fontWeight: '700',
              cursor: 'pointer', boxShadow: '0 4px 16px rgba(16,185,129,0.4)',
              transition: 'transform 0.1s, box-shadow 0.1s'
            }}
            onMouseOver={e => (e.currentTarget.style.transform = 'scale(1.02)')}
            onMouseOut={e => (e.currentTarget.style.transform = 'scale(1)')}
          >
            ✅ I'm Done — Submit Code
          </button>
        </div>

        {/* Right panel: Monaco Code Playground */}
        <div style={{ flex: 1, minWidth: 0, height: '100vh' }}>
          <CodingPlayground />
        </div>

        {renderProctorWarningOverlay()}
      </div>
    );
  }

  // ─── VERBAL QUESTION LAYOUT ───────────────────────────────────────
  return (
    <div style={{
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      minHeight: '100vh', backgroundColor: '#0b0f19', color: '#f3f4f6', padding: '24px'
    }}>
      <div style={{
        backgroundColor: '#1f2937', border: '1px solid #374151',
        borderRadius: '20px', padding: '32px', width: '100%',
        maxWidth: '900px', boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
        display: 'flex', flexDirection: 'column', gap: '24px'
      }}>

        {/* ── Top bar: progress + timer ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {renderDots()}
          <div style={{
            fontSize: '13px', fontWeight: '700',
            color: timer <= 10 ? '#ef4444' : '#9ca3af',
            backgroundColor: timer <= 10 ? '#ef444420' : '#37415150',
            border: `1px solid ${timer <= 10 ? '#ef4444' : '#374151'}`,
            padding: '4px 14px', borderRadius: '20px', transition: 'all 0.3s'
          }}>
            ⏱ {timer}s
          </div>
        </div>

        {/* ── CENTER: User Webcam — full width ── */}
        <div style={{ width: '100%', height: '260px' }}>
          {renderWebcam()}
        </div>

        {/* ── BOTTOM ROW: Question Card (left) + Avatar (right) ── */}
        <div style={{
          display: 'flex', flexDirection: 'row', gap: '20px',
          alignItems: 'stretch', width: '100%'
        }}>
          {/* Question Card — LEFT */}
          <div style={{
            flex: 2, minWidth: 0,
            backgroundColor: '#111827', borderRadius: '14px',
            border: '1px solid #374151', padding: '24px',
            display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '12px'
          }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Question {currentIndex + 1} of {questions.length}
            </div>
            <div style={{ fontSize: '18px', fontWeight: '600', color: '#ffffff', lineHeight: '1.6' }}>
              {questions[currentIndex] || 'Loading question...'}
            </div>
            {currentText && (
              <div style={{
                fontSize: '13px', color: '#10b981', fontStyle: 'italic',
                backgroundColor: '#10b98110', border: '1px solid #10b98130',
                padding: '8px 14px', borderRadius: '8px'
              }}>
                🎙️ "{currentText}"
              </div>
            )}
          </div>

          {/* Interviewer Avatar — RIGHT (only one instance) */}
          <div style={{ flex: 1, minWidth: '160px', maxWidth: '220px' }}>
            {renderInterviewerAvatar()}
          </div>
        </div>

        {/* ── Skip link ── */}
        <div style={{ textAlign: 'center' }}>
          <span
            onClick={() => handleNextQuestion()}
            style={{ fontSize: '12px', color: '#6b7280', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Skip / Submit response manually
          </span>
        </div>

        {renderProctorWarningOverlay()}
      </div>
    </div>
  );
}
