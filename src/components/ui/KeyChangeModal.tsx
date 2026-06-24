import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useEditorStore } from '../../store/editorStore';
import { decodeBmsValue, encodeBmsValue } from '../../parser/bmsParser';

interface KeyChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  useBase62: 16 | 36 | 62;
  defaultValue: number;
  onApply: (newValue: number) => void;
}

export const KeyChangeModal: React.FC<KeyChangeModalProps> = ({
  isOpen,
  onClose,
  useBase62,
  defaultValue,
  onApply
}) => {
  const { settings } = useEditorStore();
  const lang = settings.language || 'en';

  const [error, setError] = useState<string>('');
  const [inputStr, setInputStr] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const initialCode = encodeBmsValue(defaultValue, useBase62);
      setInputStr(initialCode === '00' ? '' : initialCode);
      setError('');
      setTimeout(() => {
        if (inputRef.current) inputRef.current.focus();
      }, 50);
    }
  }, [isOpen, defaultValue, useBase62]);

  if (!isOpen) return null;

  const title = lang === 'ko' ? '키음 변경' : lang === 'ja' ? 'キー音変更' : 'Change Keysound';
  const label = lang === 'ko' ? '변경할 키음을 입력하세요:' : lang === 'ja' ? '変更するキー音を入力してください:' : 'Enter keysound value:';

  const handleInputChange = (val: string) => {
    let processed = val;
    // 36진수 혹은 16진수일 때 소문자가 들어오면 자동으로 대문자로 변환해주는 센스
    if (useBase62 === 36 || useBase62 === 16) {
      processed = val.toUpperCase();
    }
    setInputStr(processed);
    if (error) setError('');
  };

  const handleApply = () => {
    const val = inputStr.trim();

    if (val.length !== 2) {
      setError(
        lang === 'ko'
          ? '반드시 2자리 코드를 입력해야 합니다.'
          : lang === 'ja'
            ? '必ず2桁의 코드(코-도)를 입력해주세요.'
            : 'Must enter a 2-character code.'
      );
      return;
    }

    // 진법에 맞는 문자셋 정규식 검사
    let isValid = false;
    if (useBase62 === 16) {
      isValid = /^[0-9A-F]{2}$/.test(val);
    } else if (useBase62 === 36) {
      isValid = /^[0-9A-Z]{2}$/.test(val);
    } else if (useBase62 === 62) {
      isValid = /^[0-9A-Za-z]{2}$/.test(val);
    }

    if (!isValid) {
      let limitMsg = '';
      if (useBase62 === 16) limitMsg = '0-9, A-F';
      else if (useBase62 === 36) limitMsg = '0-9, A-Z';
      else if (useBase62 === 62) limitMsg = '0-9, A-Z, a-z';

      setError(
        lang === 'ko'
          ? `현재 진법 설정에 유효하지 않은 문자입니다. (허용: ${limitMsg})`
          : lang === 'ja'
            ? `現在の進法設定に無効な文字です。 (許容: ${limitMsg})`
            : `Invalid character for current base mode. (Allowed: ${limitMsg})`
      );
      return;
    }

    // 00은 빈 노트를 의미하므로 키음 변경 시에는 제한
    const decodedVal = decodeBmsValue(val, useBase62);
    if (decodedVal <= 0) {
      setError(
        lang === 'ko'
          ? '00은 빈 노트를 의미하므로 키음 번호로 사용할 수 없습니다.'
          : lang === 'ja'
            ? '00は空のノートを意味するため、キー音番号として使用できません。'
            : '00 represents an empty note and cannot be used as a keysound.'
      );
      return;
    }

    onApply(decodedVal);
    onClose();
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
          <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            {label} {useBase62 === 16 ? '(16-Base)' : useBase62 === 36 ? '(36-Base)' : '(62-Base)'}
          </label>
          <input 
            ref={inputRef}
            type="text"
            maxLength={2}
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
              fontSize: '1rem',
              fontWeight: 'bold',
              letterSpacing: '1px',
              textTransform: (useBase62 === 36 || useBase62 === 16) ? 'uppercase' : 'none'
            }}
          />
          {error && (
            <div style={{ color: '#ff4d4f', fontSize: '0.8rem', marginTop: '6px', lineHeight: '1.2' }}>
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
