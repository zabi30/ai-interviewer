import React, { useState, useEffect } from 'react';
import { httpRequest } from '../utils/http';

interface EndPageProps {
  id: string;
  navigateTo: (path: string) => void;
}

export default function EndPage({ id, navigateTo }: EndPageProps) {
  const [loading, setLoading] = useState(true);
  const [score, setScore] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [pdfDownloadUrl, setPdfDownloadUrl] = useState('');

  useEffect(() => {
    (async () => {
      if (!id) return;
      try {
        const res = await httpRequest<any>({
          method: 'POST',
          path: '/api/interview/finish',
          body: { interviewId: id }
        });

        if (res) {
          setScore(res.overallScore);
          setFeedback(res.overallFeedback);
          setPdfDownloadUrl(res.pdfDownloadUrl);
        }
      } catch (err) {
        console.error('Error completing interview:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: '#0b0f19',
        color: '#9ca3af'
      }}>
        <div style={{
          border: '4px solid #1f2937',
          borderTop: '4px solid #10b981',
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          animation: 'spin 1s linear infinite',
          marginBottom: '16px'
        }} />
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        <div style={{ fontSize: '16px', fontWeight: '600' }}>Evaluating answers and compiling final PDF report...</div>
      </div>
    );
  }

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
        {/* Success Icon */}
        <div style={{
          display: 'inline-flex',
          justifyContent: 'center',
          alignItems: 'center',
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          backgroundColor: '#10b98115',
          border: '2px solid #10b981',
          color: '#10b981',
          fontSize: '36px',
          marginBottom: '24px'
        }}>
          ✓
        </div>

        {/* Title */}
        <div style={{
          fontSize: '28px',
          fontWeight: '700',
          color: '#ffffff',
          marginBottom: '16px'
        }}>
          Interview Completed!
        </div>
        
        {/* Completion details */}
        <div style={{
          fontSize: '15px',
          color: '#d1d5db',
          lineHeight: '1.6',
          marginBottom: '36px',
          textAlign: 'center'
        }}>
          Thank you! Your interview has been successfully completed. Our team will review your application assessment and share our decision with you via email.
        </div>

        {/* Action Button */}
        <button
          onClick={() => navigateTo('#/join')}
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
          Return to Login
        </button>
      </div>
    </div>
  );
}
