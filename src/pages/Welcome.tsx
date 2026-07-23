import React from 'react';

interface WelcomePageProps {
  id: string;
  navigateTo: (path: string) => void;
}

export default function WelcomePage({ id, navigateTo }: WelcomePageProps) {
  const handleStart = () => {
    try {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(err => {
          console.warn("Fullscreen request rejected by browser:", err);
        });
      }
    } catch (e) {
      console.warn("Fullscreen API not available:", e);
    }
    navigateTo(`#/interview/${id}/start`);
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      backgroundColor: '#0b0f19',
      padding: '24px'
    }}>
      <div style={{
        backgroundColor: '#1f2937',
        border: '1px solid #374151',
        borderRadius: '16px',
        padding: '48px',
        width: '100%',
        maxWidth: '560px',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
        textAlign: 'center'
      }}>
        {/* Animated Badge Icon */}
        <div style={{
          display: 'inline-flex',
          justifyContent: 'center',
          alignItems: 'center',
          width: '72px',
          height: '72px',
          borderRadius: '50%',
          backgroundColor: '#4f46e520',
          border: '2px dashed #4f46e5',
          color: '#818cf8',
          fontSize: '32px',
          marginBottom: '24px'
        }}>
          🎓
        </div>

        {/* Header */}
        <div style={{
          fontSize: '28px',
          fontWeight: '700',
          color: '#ffffff',
          marginBottom: '12px'
        }}>
          Welcome to Your AI Interview
        </div>
        <div style={{
          fontSize: '15px',
          color: '#9ca3af',
          lineHeight: '1.6',
          marginBottom: '32px'
        }}>
          This interview session consists of 5 technical evaluation questions. The AI interviewer will speak each question out loud and dynamically ask counter-questions based on your feedback.
        </div>

        {/* Instruction details */}
        <div style={{
          backgroundColor: '#111827',
          borderRadius: '8px',
          padding: '16px',
          textAlign: 'left',
          marginBottom: '32px',
          border: '1px solid #374151'
        }}>
          <div style={{ fontWeight: '600', color: '#ffffff', marginBottom: '8px', fontSize: '14px' }}>
            Before you begin, please ensure:
          </div>
          <ul style={{ margin: 0, paddingLeft: '20px', color: '#9ca3af', fontSize: '13px', lineHeight: '1.8' }}>
            <li>Your camera and microphone are connected and allowed.</li>
            <li>You are in a quiet, distraction-free environment.</li>
            <li>You avoid switching browser tabs during the test (monitored).</li>
            <li>You speak naturally; the interviewer detects silences.</li>
          </ul>
        </div>

        {/* Start button */}
        <button
          onClick={handleStart}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: '#4f46e5',
            color: '#ffffff',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
            boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
          }}
        >
          Start Interview Session
        </button>
      </div>
    </div>
  );
}
