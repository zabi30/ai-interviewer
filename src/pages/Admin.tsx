import React, { useState, useEffect } from 'react';
import { httpRequest } from '../utils/http';
import { API_BASE_URL } from '../utils/env';

interface AdminPageProps {
  navigateTo: (path: string) => void;
}

interface CandidateRow {
  interviewId: string;
  name: string;
  email: string;
  status: 'invited' | 'ongoing' | 'completed' | 'selected' | 'rejected';
  score: number;
  pdfDownloadUrl: string | null;
}

interface BatchStats {
  totalInvited: number;
  totalCompleted: number;
  totalPending: number;
  totalSelected: number;
  totalRejected: number;
  averageScore: number;
}

interface BatchItem {
  batchId: string;
  jobTitle: string;
  duration: number;
  deadline: string;
  passThreshold: number;
  limit: number;
  jobDescription?: string;
  candidatesCount: number;
  createdAt: string;
}

export default function AdminPage({ navigateTo }: AdminPageProps) {
  const [jobTitle, setJobTitle] = useState('');
  const [duration, setDuration] = useState(15);
  const [deadline, setDeadline] = useState('');
  const [passThreshold, setPassThreshold] = useState('7.0');
  const [shortlistLimit, setShortlistLimit] = useState('5');
  const [jobDescription, setJobDescription] = useState('');
  const [jsonInput, setJsonInput] = useState('');
  const [batchId, setBatchId] = useState('');

  const [authorized, setAuthorized] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');

  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [selectedBatchStats, setSelectedBatchStats] = useState<BatchStats | null>(null);
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'admin123') {
      setAuthorized(true);
      setAuthError('');
    } else {
      setAuthError('Incorrect password. Please try again.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      handleJsonPaste(text);
    };
    reader.readAsText(file);
  };



  const downloadSelectedCandidatesCSV = () => {
    const selected = candidates.filter(c => c.status === 'selected');
    if (selected.length === 0) {
      window.alert('No selected candidates found in this batch to export.');
      return;
    }
    
    const csvRows = [
      ['Name', 'Email', 'Status', 'Overall Score', 'PDF Report URL'],
      ...selected.map(c => [
        `"${c.name.replace(/"/g, '""')}"`,
        c.email,
        c.status,
        c.score,
        c.pdfDownloadUrl ? `${API_BASE_URL.replace(/\/$/, '')}${c.pdfDownloadUrl}` : ''
      ])
    ];
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + csvRows.map(e => e.join(",")).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `selected_candidates_batch_${selectedBatchId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteBatch = async () => {
    if (!selectedBatchId) return;
    const confirm = window.confirm(`Are you sure you want to delete batch ${selectedBatchId} and all associated candidate records? This action is irreversible.`);
    if (!confirm) return;

    try {
      await httpRequest({
        method: 'DELETE',
        path: `/api/batch/${selectedBatchId}`
      });

      window.alert(`Batch ${selectedBatchId} has been successfully deleted.`);
      
      // Clear states
      setSelectedBatchId(null);
      setSelectedBatchStats(null);
      setCandidates([]);
      
      // Refresh batches
      await fetchBatches();
    } catch (err) {
      console.error(err);
      window.alert('Failed to delete batch.');
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  useEffect(() => {
    if (selectedBatchId) {
      fetchBatchDetails(selectedBatchId);
    }
  }, [selectedBatchId]);

  const fetchBatches = async () => {
    try {
      const data = await httpRequest<BatchItem[]>({
        method: 'GET',
        path: '/api/batches'
      });
      setBatches(Array.isArray(data) ? data : []);
      if (data.length > 0 && !selectedBatchId) {
        setSelectedBatchId(data[0].batchId);
      }
    } catch (err) {
      console.error('Error fetching batches:', err);
    }
  };

  const fetchBatchDetails = async (batchId: string) => {
    setLoading(true);
    try {
      const data = await httpRequest<{ stats: BatchStats; candidates: CandidateRow[] }>({
        method: 'GET',
        path: `/api/batch/${batchId}/stats`
      });
      if (data) {
        setSelectedBatchStats(data.stats);
        setCandidates(data.candidates);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleJsonPaste = (text: string) => {
    setJsonInput(text);
    if (!text.trim()) return;

    try {
      const parsed = JSON.parse(text);
      
      // Auto-fill configuration properties if unified JSON format is present
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        if (parsed.jobTitle) setJobTitle(parsed.jobTitle);
        if (parsed.deadline) setDeadline(parsed.deadline);
        if (parsed.passThreshold) setPassThreshold(String(parsed.passThreshold));
        if (parsed.duration) setDuration(Number(parsed.duration));
        if (parsed.jobDescription) setJobDescription(parsed.jobDescription);
        
        const parsedBatchId = parsed.batchId || parsed.batchNumber || '';
        if (parsedBatchId) {
          const exists = batches.some(b => b.batchId === parsedBatchId);
          if (exists) {
            setBatchId(parsedBatchId);
          } else {
            console.log(`[Ingest] Parsed batch ID ${parsedBatchId} not found in database.`);
            setBatchId('');
          }
        } else {
          setBatchId('');
        }

        if (Array.isArray(parsed.candidates)) {
          // Normalize candidates to array string input
          setJsonInput(JSON.stringify(parsed.candidates, null, 2));
        }
      }
    } catch (err) {
      // Ignore parsing errors for standard text paste
    }
  };

  // Ingest batch
  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobTitle || !deadline || !jsonInput) {
      window.alert('Please complete all form fields and add candidate shortlist details.');
      return;
    }

    let parsedShortlist = [];
    try {
      parsedShortlist = JSON.parse(jsonInput);
      if (!Array.isArray(parsedShortlist)) {
        throw new Error('Must be a JSON Array list.');
      }
    } catch (err) {
      window.alert('Invalid candidate shortlist JSON. Please verify it is a valid JSON array format.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        batchId,
        jobTitle,
        duration: Number(duration),
        deadline,
        passThreshold: parseFloat(passThreshold),
        limit: parseInt(shortlistLimit, 10),
        jobDescription,
        candidates: parsedShortlist
      };

      const result = await httpRequest<{ batchId: string }>({
        method: 'POST',
        path: '/api/batch/create',
        body: payload
      });

      window.alert(`Batch Ingested Successfully\n\nBatch ID: ${result.batchId}`);
      
      // Reset form
      setJobTitle('');
      setJobDescription('');
      setJsonInput('');
      setDeadline('');
      setBatchId('');
      
      // Refetch
      await fetchBatches();
      setSelectedBatchId(result.batchId);
    } catch (err) {
      console.error(err);
      window.alert('Failed to ingest batch.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!authorized) {
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
          maxWidth: '400px',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: '24px',
            fontWeight: '700',
            color: '#ffffff',
            marginBottom: '8px'
          }}>
            Recruiter Login
          </div>
          <div style={{
            fontSize: '14px',
            color: '#9ca3af',
            marginBottom: '24px'
          }}>
            Enter your password to unlock the admin dashboard.
          </div>

          <form onSubmit={handleLogin}>
            <div style={{ position: 'relative', marginBottom: '20px', textAlign: 'left' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                style={{
                  width: '100%',
                  padding: '12px 48px 12px 16px',
                  borderRadius: '8px',
                  border: authError ? '2px solid #ef4444' : '1px solid #4b5563',
                  backgroundColor: '#111827',
                  color: '#ffffff',
                  fontSize: '16px',
                  outline: 'none'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '700',
                  padding: '4px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {showPassword ? 'HIDE' : 'SHOW'}
              </button>
            </div>

            {authError && (
              <div style={{
                color: '#f87171',
                fontSize: '13px',
                marginBottom: '20px',
                textAlign: 'left'
              }}>
                ⚠️ {authError}
              </div>
            )}

            <button
              type="submit"
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
                boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
              }}
            >
              Unlock Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      backgroundColor: '#0b0f19',
      color: '#f3f4f6'
    }}>
      {/* Top Header bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '20px 36px',
        borderBottom: '1px solid #1f2937',
        backgroundColor: '#111827'
      }}>
        <div style={{ fontSize: '22px', fontWeight: '700', color: '#ffffff' }}>
          Recruiter Control Center
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={async () => {
              await fetchBatches();
              if (selectedBatchId) {
                await fetchBatchDetails(selectedBatchId);
              }
            }}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid #4b5563',
              backgroundColor: '#1f2937',
              color: '#ffffff',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            🔄 Refresh Data
          </button>
          <button
            onClick={() => navigateTo('#/join')}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid #374151',
              backgroundColor: 'transparent',
              color: '#9ca3af',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            Candidate Login ➔
          </button>
        </div>
      </div>

      {/* Main Dual Panels Workspace */}
      <div style={{
        flex: 1,
        display: 'flex',
        padding: '36px',
        gap: '36px',
        minHeight: '0'
      }}>
        {/* LEFT PANEL: Batch Creator Form */}
        <div style={{
          flex: '1',
          backgroundColor: '#1f2937',
          borderRadius: '12px',
          border: '1px solid #374151',
          padding: '28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#ffffff', borderBottom: '1px solid #374151', paddingBottom: '10px' }}>
            Configure New Interview Batch
          </div>

          <form onSubmit={handleIngest} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '600' }}>
                Batch ID (Status)
              </label>
              <input
                type="text"
                value={batchId ? `${batchId} (Existing Batch)` : 'New Batch (Auto-generated)'}
                readOnly
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '6px',
                  border: '1px solid #4b5563',
                  backgroundColor: '#1f2937',
                  color: batchId ? '#10b981' : '#9ca3af',
                  fontWeight: batchId ? '700' : '400',
                  cursor: 'not-allowed'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '600' }}>Job Title</label>
              <input
                type="text"
                value={jobTitle}
                onChange={e => setJobTitle(e.target.value)}
                placeholder="e.g. Senior Frontend Engineer"
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #4b5563', backgroundColor: '#111827', color: '#fff' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '600' }}>Job Description</label>
              <textarea
                value={jobDescription}
                onChange={e => setJobDescription(e.target.value)}
                placeholder="Paste the core requirements or job scope here to help AI generate custom counter-questions..."
                rows={3}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #4b5563', backgroundColor: '#111827', color: '#fff', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '600' }}>Threshold (1-10)</label>
                <input
                  type="number"
                  step="0.1"
                  value={passThreshold}
                  onChange={e => setPassThreshold(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #4b5563', backgroundColor: '#111827', color: '#fff' }}
                />
              </div>

              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '600' }}>Deadline</label>
                <input
                  type="date"
                  value={deadline}
                  onChange={e => setDeadline(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #4b5563', backgroundColor: '#111827', color: '#fff' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '600' }}>
                Upload Shortlist JSON File
              </label>
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '6px',
                  border: '1px dashed #4b5563',
                  backgroundColor: '#111827',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  fontSize: '13px',
                  marginBottom: '12px'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '600' }}>Shortlisted Candidates JSON</label>
              <textarea
                value={jsonInput}
                onChange={e => handleJsonPaste(e.target.value)}
                placeholder="Paste shortlist JSON array..."
                rows={6}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #4b5563', backgroundColor: '#111827', color: '#fff', fontFamily: 'monospace', fontSize: '12px' }}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: '12px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: '#4f46e5',
                color: '#fff',
                fontSize: '14px',
                fontWeight: '600',
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.7 : 1
              }}
            >
              {submitting ? 'Ingesting Batch...' : 'Ingest and Send Invitations'}
            </button>
          </form>
        </div>

        {/* RIGHT PANEL: Stats and Batches List */}
        <div style={{
          flex: '1.2',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px'
        }}>
          {/* Batches tab list */}
          <div style={{
            backgroundColor: '#1f2937',
            borderRadius: '12px',
            border: '1px solid #374151',
            padding: '20px'
          }}>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#ffffff', marginBottom: '12px' }}>
              Select Active Batch
            </div>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '10px',
              maxHeight: '120px',
              overflowY: 'auto'
            }}>
              {batches.map(b => (
                <button
                  key={b.batchId}
                  onClick={() => setSelectedBatchId(b.batchId)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #374151',
                    backgroundColor: selectedBatchId === b.batchId ? '#4f46e5' : '#111827',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  {b.jobTitle} ({b.batchId})
                </button>
              ))}
            </div>
          </div>

          {/* Selected Batch Statistics Card */}
          {selectedBatchId && (
            <div style={{
              flex: 1,
              backgroundColor: '#1f2937',
              borderRadius: '12px',
              border: '1px solid #374151',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              minHeight: '0'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px'
              }}>
                <div style={{ fontSize: '18px', fontWeight: '700', color: '#ffffff' }}>
                  Batch Metrics: {selectedBatchId}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={downloadSelectedCandidatesCSV}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: '#10b981',
                      color: '#ffffff',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    📥 Export Selected CSV
                  </button>
                  <button
                    onClick={handleDeleteBatch}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: '#ef4444',
                      color: '#ffffff',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    🗑️ Delete Batch
                  </button>
                </div>
              </div>

              {/* Stats Row */}
              {selectedBatchStats && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '12px',
                  marginBottom: '20px'
                }}>
                  <div style={{ backgroundColor: '#111827', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>Total</div>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: '#fff' }}>{selectedBatchStats.totalInvited}</div>
                  </div>
                  <div style={{ backgroundColor: '#111827', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>Done</div>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: '#10b981' }}>{selectedBatchStats.totalCompleted}</div>
                  </div>
                  <div style={{ backgroundColor: '#111827', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>Pending</div>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: '#f59e0b' }}>{selectedBatchStats.totalPending}</div>
                  </div>
                  <div style={{ backgroundColor: '#111827', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>Avg Score</div>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: '#3b82f6' }}>{selectedBatchStats.averageScore}</div>
                  </div>
                </div>
              )}

              {/* Candidates Grid Table */}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {loading ? (
                  <div style={{ textAlign: 'center', padding: '30px', color: '#9ca3af' }}>Loading batch metrics...</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #374151', color: '#9ca3af', textAlign: 'left' }}>
                        <th style={{ padding: '10px 6px' }}>Candidate</th>
                        <th style={{ padding: '10px 6px' }}>Status</th>
                        <th style={{ padding: '10px 6px' }}>Score</th>
                        <th style={{ padding: '10px 6px', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {candidates.map(c => (
                        <tr key={c.interviewId} style={{ borderBottom: '1px solid #374151' }}>
                          <td style={{ padding: '12px 6px' }}>
                            <div style={{ fontWeight: '600', color: '#fff' }}>{c.name}</div>
                            <div style={{ fontSize: '11px', color: '#9ca3af' }}>{c.email}</div>
                          </td>
                          <td style={{ padding: '12px 6px' }}>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: '600',
                              backgroundColor: c.status === 'selected' ? '#05966920' : c.status === 'rejected' ? '#dc262620' : '#d9770620',
                              color: c.status === 'selected' ? '#10b981' : c.status === 'rejected' ? '#f87171' : '#fbbf24'
                            }}>
                              {c.status.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ padding: '12px 6px', fontWeight: '700', color: c.score >= 7.0 ? '#10b981' : '#f87171' }}>
                            {c.score > 0 ? c.score : '—'}
                          </td>
                          <td style={{ padding: '12px 6px', textAlign: 'right' }}>
                            {c.pdfDownloadUrl ? (
                              <a
                                href={`${API_BASE_URL.replace(/\/$/, '')}${c.pdfDownloadUrl}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  padding: '4px 10px',
                                  backgroundColor: '#4f46e5',
                                  color: '#fff',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  textDecoration: 'none',
                                  fontWeight: '600'
                                }}
                              >
                                PDF 📥
                              </a>
                            ) : (
                              <span style={{ color: '#6b7280', fontSize: '11px' }}>Pending</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
