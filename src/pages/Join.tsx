import React, { useState, useEffect } from 'react';
import { httpRequest } from '../utils/http';

interface JoinPageProps {
  initialCode: string;
  navigateTo: (path: string) => void;
}

export default function JoinPage({ initialCode, navigateTo }: JoinPageProps) {
  const [code, setCode] = useState(initialCode);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (initialCode) {
      setCode(initialCode);
    }
  }, [initialCode]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setErrorMsg('Please enter a valid interview code.');
      return;
    }
    setErrorMsg('');
    setLoading(true);

    try {
      const data = await httpRequest<{ valid?: boolean }>({
        method: 'POST',
        path: '/api/interview/validate',
        body: { code: code.trim() },
      });

      if (data.valid) {
        navigateTo(`#/interview/${code.trim()}/welcome`);
      } else {
        setErrorMsg((data as any).error || 'Invalid code. Please check and try again.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Validation failed. Please verify your connection.');
    } finally {
      setLoading(false);
    }
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
        padding: '36px',
        width: '100%',
        maxWidth: '440px',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
        textAlign: 'center'
      }}>
        {/* Header */}
        <div style={{
          fontSize: '28px',
          fontWeight: '700',
          color: '#ffffff',
          marginBottom: '8px'
        }}>
          Join AI Technical Interview
        </div>
        <div style={{
          fontSize: '14px',
          color: '#9ca3af',
          marginBottom: '28px'
        }}>
          Enter the invitation code sent to your email to begin.
        </div>

        <form onSubmit={handleJoin}>
          {/* Input Box */}
          <div style={{ marginBottom: '20px', textAlign: 'left' }}>
            <label style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: '600',
              color: '#9ca3af',
              textTransform: 'uppercase',
              marginBottom: '6px'
            }}>
              Interview Code
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. INT-FDMK3"
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '8px',
                border: errorMsg ? '2px solid #ef4444' : '1px solid #4b5563',
                backgroundColor: '#111827',
                color: '#ffffff',
                fontSize: '16px',
                outline: 'none',
                transition: 'all 0.2s'
              }}
            />
          </div>

          {errorMsg && (
            <div style={{
              color: '#f87171',
              fontSize: '14px',
              fontWeight: '500',
              marginBottom: '20px',
              textAlign: 'left'
            }}>
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Action button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#4f46e5',
              color: '#ffffff',
              fontSize: '16px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'background-color 0.2s',
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
            }}
          >
            {loading ? 'Verifying Code...' : 'Enter Interview'}
          </button>
        </form>
      </div>
    </div>
  );
}
