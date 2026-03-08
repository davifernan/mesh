import React, { useEffect, useState } from 'react';
import { Text } from 'folds';
import { useSetting } from '../../../state/hooks/settings';
import { settingsAtom } from '../../../state/settings';
import { SequenceCard } from '../../../components/sequence-card';
import { SequenceCardStyle } from '../styles.css';

export function PTTKeyBind() {
  const [pttKey, setPttKey] = useSetting(settingsAtom, 'pttKey');
  const [isListening, setIsListening] = useState(false);

  const startListening = () => {
    setIsListening(true);
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      if (e.code === 'Escape') {
        setIsListening(false);
      } else {
        setPttKey(e.code);
        setIsListening(false);
      }
      window.removeEventListener('keydown', onKey);
    };
    window.addEventListener('keydown', onKey, { once: true });
  };

  // Cleanup if component unmounts while listening
  useEffect(() => {
    if (!isListening) return;
    return () => {
      setIsListening(false);
    };
  }, [isListening]);

  return (
    <SequenceCard className={SequenceCardStyle}>
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <Text size="T300" style={{ fontWeight: 600 }}>
          Push-to-Talk Key
        </Text>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={startListening}
            style={{
              background: isListening ? 'rgba(88,101,242,0.15)' : 'var(--bg-surface-low, #1e1f22)',
              color: isListening ? 'var(--brand-primary, #5865f2)' : 'var(--text-normal, #dbdee1)',
              border: `1px solid ${isListening ? 'var(--brand-primary, #5865f2)' : 'var(--background-modifier-accent, #3a3c40)'}`,
              borderRadius: '4px',
              padding: '6px 16px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              minWidth: '120px',
              textAlign: 'center',
            }}
          >
            {isListening ? 'Listening...' : (pttKey ?? 'Click to bind...')}
          </button>
          {pttKey && !isListening && (
            <button
              type="button"
              onClick={() => setPttKey(null)}
              style={{
                background: 'transparent',
                color: '#949ba4',
                border: 'none',
                cursor: 'pointer',
                fontSize: '12px',
                padding: '0',
              }}
            >
              Clear
            </button>
          )}
        </div>
        {isListening && (
          <Text size="T200" priority="300">
            Press any key to bind. Press Escape to cancel.
          </Text>
        )}
      </div>
    </SequenceCard>
  );
}
