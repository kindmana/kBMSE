import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useEditorStore } from '../../store/editorStore';

interface TimingValueModalProps {
  isOpen: boolean;
  onClose: () => void;
  channel: number;
  onApply: (value: number) => void;
  defaultValue?: number;
}

export const TimingValueModal: React.FC<TimingValueModalProps> = ({
  isOpen,
  onClose,
  channel,
  onApply,
  defaultValue
}) => {
  const { settings } = useEditorStore();
  const lang = settings.language || 'en';

  const [error, setError] = useState<string>('');
  const [inputStr, setInputStr] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setInputStr(defaultValue !== undefined ? defaultValue.toString() : '');
      setError('');
      setTimeout(() => {
        if (inputRef.current) inputRef.current.focus();
      }, 50);
    }
  }, [isOpen, defaultValue]);

  if (!isOpen) return null;

  // 타이틀 및 라벨 정보 설정
  let title = '';
  let label = '';
  let step = 'any';

  if (channel === 0x08) {
    title = lang === 'ko' ? 'BPM 속도 설정' : lang === 'ja' ? 'BPM速度設定' : 'Set BPM Speed';
    label = lang === 'ko' ? 'BPM 속도를 입력하세요 (정수 혹은 실수):' : lang === 'ja' ? 'BPM速度を入力してください（整数または小数）:' : 'Enter BPM speed (integer or float):';
  } else if (channel === 0x09) {
    title = lang === 'ko' ? 'STOP 시간 설정' : lang === 'ja' ? 'STOP時間設定' : 'Set STOP Duration';
    label = lang === 'ko' ? 'STOP 대기 시간을 입력하세요 (정수 혹은 실수):' : lang === 'ja' ? 'STOP時間を入力してください（整数または小数）:' : 'Enter STOP value (integer or float):';
  } else {
    title = lang === 'ko' ? 'SCROLL 배율 설정' : lang === 'ja' ? 'SCROLL倍率設定' : 'Set SCROLL Multiplier';
    label = lang === 'ko' ? 'SCROLL 속도 배율을 입력하세요 (예: 1.0, 0.5, -1.0):' : lang === 'ja' ? 'SCROLL倍率を入力してください（例：1.0, 0.5, -1.0）:' : 'Enter SCROLL multiplier (e.g. 1.0, 0.5, -1.0):';
  }

  const handleApply = () => {
    const val = parseFloat(inputStr);
    if (!isNaN(val)) {
      onApply(val);
      onClose();
    } else {
      const alertMsg = lang === 'ko' 
        ? '올바른 숫자 형식을 입력해 주세요.' 
        : lang === 'ja'
          ? '有効な数値を入力してください。'
          : 'Please enter a valid number format.';
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
    setInputStr(val);
    if (error) setError('');
  };

  return createPortal(
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
      backdropFilter: 'blur(3px)'
    }}>
      <div style={{
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        padding: '20px',
        width: '320px',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)'
      }}>
        <h3 style={{ margin: '0 0 15px 0', fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{title}</h3>
        
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>{label}</label>
          <input 
            ref={inputRef}
            type="number"
            step={step}
            value={inputStr}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              width: '100%',
              padding: '10px',
              background: 'var(--bg-secondary)',
              border: error ? '1px solid #ff4d4f' : '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              borderRadius: '6px',
              outline: 'none',
              boxSizing: 'border-box',
              fontSize: '0.9rem'
            }}
          />
          {error && (
            <div style={{ color: '#ff4d4f', fontSize: '0.8rem', marginTop: '6px' }}>
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
              cursor: 'pointer',
              fontSize: '0.85rem'
            }}
          >
            {lang === 'ko' ? '취소' : lang === 'ja' ? 'キャンセル' : 'Cancel'}
          </button>
          <button 
            onClick={handleApply}
            style={{
              padding: '8px 16px',
              background: 'var(--accent-color)',
              border: 'none',
              color: 'white',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 500
            }}
          >
            {lang === 'ko' ? '적용' : lang === 'ja' ? '適用' : 'Apply'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
