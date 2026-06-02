import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useEditorStore } from '../../store/editorStore';
import { translations } from '../../constants/translations';

interface GoToMeasureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (measure: number) => void;
}

export const GoToMeasureModal: React.FC<GoToMeasureModalProps> = ({
  isOpen, onClose, onApply
}) => {
  const { settings } = useEditorStore();
  const lang = settings.language || 'en';
  const t = translations[lang] || translations.en;

  const [error, setError] = useState<string>('');
  const [measureStr, setMeasureStr] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setMeasureStr('');
      setError('');
      setTimeout(() => {
        if (inputRef.current) inputRef.current.focus();
      }, 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleApply = () => {
    const val = parseInt(measureStr, 10);
    if (!isNaN(val) && val >= 0 && val <= 999) {
      onApply(val);
      onClose();
    } else {
      const alertMsg = lang === 'ko' 
        ? '올바른 마디 번호(0-999)를 입력해 주세요.' 
        : lang === 'ja'
          ? '有効な小節番号（0-999）を入力してください。'
          : 'Please enter a valid measure number (0-999).';
      setError(alertMsg);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleApply();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const handleInputChange = (val: string) => {
    setMeasureStr(val);
    if (error) setError('');
  };

  return createPortal(
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        padding: '20px',
        width: '300px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
      }}>
        <h3 style={{ margin: '0 0 15px 0', fontSize: '1.1rem' }}>{t.goToMeasureTitle}</h3>
        
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '5px' }}>{t.measureNumberLabel}</label>
          <input 
            ref={inputRef}
            type="number"
            min="0"
            max="999"
            value={measureStr}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              width: '100%',
              padding: '8px',
              background: 'var(--bg-secondary)',
              border: error ? '1px solid #ff4d4f' : '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              borderRadius: '4px'
            }}
          />
          {error && (
            <div style={{ color: '#ff4d4f', fontSize: '0.8rem', marginTop: '5px' }}>
              {error}
            </div>
          )}
        </div>
        
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button 
            onClick={onClose}
            style={{
              padding: '8px 16px',
              background: 'transparent',
              border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            {t.cancel}
          </button>
          <button 
            onClick={handleApply}
            style={{
              padding: '8px 16px',
              background: '#4a90e2',
              border: 'none',
              color: 'white',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            {t.go}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
