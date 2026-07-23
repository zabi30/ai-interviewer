import React, { useState } from 'react';
import Editor from '@monaco-editor/react';

interface CodingPlaygroundProps {
  initialCode?: string;
  onCodeChange?: (code: string) => void;
}

const STARTER_CODES: Record<string, string> = {
  javascript: `// JavaScript Playground\n// Write your solution here...\nfunction solution() {\n  console.log("Hello, AI Interviewer!");\n  return true;\n}\n\nsolution();`,
  python: `# Python Playground\n# Write your solution here...\ndef solution():\n    print("Hello, AI Interviewer!")\n    return True\n\nsolution()`,
  cpp: `// C++ Playground\n#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, AI Interviewer!" << endl;\n    return 0;\n}`,
  java: `// Java Playground\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, AI Interviewer!");\n    }\n}`
};

export function CodingPlayground({ initialCode = '', onCodeChange }: CodingPlaygroundProps) {
  const [lang, setLang] = useState('javascript');
  const [code, setCode] = useState(initialCode || STARTER_CODES.javascript);

  const handleLanguageChange = (selectedLang: string) => {
    setLang(selectedLang);
    const newStarterCode = STARTER_CODES[selectedLang] || '';
    setCode(newStarterCode);
    if (onCodeChange) onCodeChange(newStarterCode);
  };

  const handleCodeChange = (newVal: string) => {
    setCode(newVal);
    if (onCodeChange) onCodeChange(newVal);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: '#111827',
      borderRadius: '12px',
      overflow: 'hidden',
      border: '1px solid #374151'
    }}>
      {/* Tab bar selector */}
      <div style={{
        display: 'flex',
        overflowX: 'auto',
        backgroundColor: '#1f2937',
        borderBottom: '1px solid #374151',
        padding: '8px 12px',
        gap: '8px'
      }}>
        {Object.keys(STARTER_CODES).map((l) => {
          const isActive = lang === l;
          return (
            <button
              key={l}
              onClick={() => handleLanguageChange(l)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: isActive ? '#3b82f6' : 'transparent',
                color: isActive ? '#ffffff' : '#9ca3af',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {l.toUpperCase()}
            </button>
          );
        })}
      </div>

      {/* Monaco Container */}
      <div style={{ flex: 1, width: '100%', minHeight: '300px' }}>
        <Editor
          height="100%"
          language={lang}
          theme="vs-dark"
          value={code}
          onChange={(val: string | undefined) => handleCodeChange(val || '')}
          options={{
            fontSize: 14,
            minimap: { enabled: false },
            automaticLayout: true,
            padding: { top: 12 },
          }}
        />
      </div>
    </div>
  );
}
