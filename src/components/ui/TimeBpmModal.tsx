import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useEditorStore } from '../../store/editorStore';

interface TimeBpmModalProps {
  isOpen: boolean;
  onClose: () => void;
  startAbs: number;
  endAbs: number;
  onApply: (multiplyMode: boolean, value: number) => void;
}

export const TimeBpmModal: React.FC<TimeBpmModalProps> = ({
  isOpen,
  onClose,
  startAbs,
  endAbs,
  onApply
}) => {
  const { settings } = useEditorStore();
  const lang = settings.language || 'en';

  const [multiplyMode, setMultiplyMode] = useState<boolean>(true);
  const [valStr, setValStr] = useState<string>('1.0');
  const [error, setError] = useState<string>('');
  
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setMultiplyMode(true);
      setValStr('1.0');
      setError('');
      setTimeout(() => {
        if (inputRef.current) inputRef.current.focus();
      }, 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleApply = () => {
    const val = parseFloat(valStr);
    if (isNaN(val) || val <= 0) {
      const errStr = lang === 'ko' 
        ? '0보다 큰 올바른 숫자 형식을 입력해 주세요.' 
        : lang === 'ja'
          ? '0より大きい有効な数値を入力してください。'
          : 'Please enter a valid positive number greater than 0.';
      setError(errStr);
      return;
    }
    onApply(multiplyMode, val);
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

  const handleInputChange = (val: string) => {
    setValStr(val);
    if (error) setError('');
  };

  const handleModeChange = (isMultiply: boolean) => {
    setMultiplyMode(isMultiply);
    setValStr(isMultiply ? '1.0' : '120.0');
    setError('');
  };

  const formattedStart = startAbs.toFixed(3);
  const formattedEnd = endAbs.toFixed(3);

  const getTexts = () => {
    if (lang === 'ko') {
      return {
        title: 'BPM 일괄 변경',
        rangeInfo: '선택 구간 정보',
        rangeLabel: `구간: ${formattedStart} ~ ${formattedEnd}마디`,
        changeType: '변경 방식 선택',
        scaleOpt: '배속 비율로 변경 (Scale)',
        scaleDesc: '지정 구간 안의 모든 BPM 변경 수치들에 배율을 곱합니다. (예: 2.0 = 두 배 속도로 가속, 0.5 = 절반 속도로 감속)',
        setOpt: '특정 값으로 고정 (Set Value)',
        setDesc: '지정 구간 안의 모든 BPM 변경 노트를 하나의 지정된 수치로 동일하게 일괄 강제 고정합니다.',
        inputScaleLabel: '배율 곱할 수치 (실수):',
        inputSetLabel: '고정할 BPM 수치 (실수):',
        cancel: '취소',
        apply: '적용'
      };
    }
    if (lang === 'ja') {
      return {
        title: 'BPMの一括変更',
        rangeInfo: '選択範囲情報',
        rangeLabel: `範囲: ${formattedStart} ～ ${formattedEnd}小節`,
        changeType: '変更方式の選択',
        scaleOpt: '倍率で変更 (Scale)',
        scaleDesc: '指定範囲内のすべてのBPM変更値に倍率を掛けます。（例: 2.0 = 2倍速へ加速、0.5 = 半分の速度へ減速）',
        setOpt: '特定の値に固定 (Set Value)',
        setDesc: '指定範囲内のすべてのBPM変更ノーツを、指定した単一の数値に強制的に統一します。',
        inputScaleLabel: '掛ける倍率（小数）:',
        inputSetLabel: '固定するBPM値（小数）:',
        cancel: 'キャンセル',
        apply: '適用'
      };
    }
    return {
      title: 'BPM Changer',
      rangeInfo: 'Selected Range Info',
      rangeLabel: `Range: ${formattedStart} ~ ${formattedEnd} measures`,
      changeType: 'Select Mode',
      scaleOpt: 'Scale BPM by ratio',
      scaleDesc: 'Multiplies all BPM changes inside the range by a ratio (e.g. 2.0 = double speed, 0.5 = half speed).',
      setOpt: 'Set to absolute value',
      setDesc: 'Forces all BPM changes inside the range to a single fixed BPM value.',
      inputScaleLabel: 'BPM Scale Ratio:',
      inputSetLabel: 'New Absolute BPM Value:',
      cancel: 'Cancel',
      apply: 'Apply'
    };
  };

  const t = getTexts();

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
        borderRadius: '10px',
        padding: '24px',
        width: '360px',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
        color: 'var(--text-primary)',
        fontFamily: 'inherit'
      }}>
        <h3 style={{ margin: '0 0 20px 0', fontSize: '1.2rem', fontWeight: 600, borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          {t.title}
        </h3>

        {/* 선택 영역 정보 요약 */}
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '6px',
          padding: '12px',
          marginBottom: '20px',
          fontSize: '0.85rem'
        }}>
          <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>{t.rangeInfo}</div>
          <div style={{ color: 'var(--text-primary)' }}>{t.rangeLabel}</div>
        </div>

        {/* 방식 라디오 선택 */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '10px' }}>
            {t.changeType}
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              cursor: 'pointer',
              padding: '10px',
              border: `1px solid ${multiplyMode ? 'var(--accent-color, #a78bfa)' : 'var(--border-color)'}`,
              background: multiplyMode ? 'rgba(167, 139, 250, 0.05)' : 'transparent',
              borderRadius: '6px',
              transition: 'all 0.2s'
            }}>
              <input 
                type="radio" 
                checked={multiplyMode === true} 
                onChange={() => handleModeChange(true)} 
                style={{ marginTop: '3px', cursor: 'pointer' }}
              />
              <div>
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{t.scaleOpt}</span>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  {t.scaleDesc}
                </p>
              </div>
            </label>

            <label style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              cursor: 'pointer',
              padding: '10px',
              border: `1px solid ${!multiplyMode ? 'var(--accent-color, #a78bfa)' : 'var(--border-color)'}`,
              background: !multiplyMode ? 'rgba(167, 139, 250, 0.05)' : 'transparent',
              borderRadius: '6px',
              transition: 'all 0.2s'
            }}>
              <input 
                type="radio" 
                checked={multiplyMode === false} 
                onChange={() => handleModeChange(false)} 
                style={{ marginTop: '3px', cursor: 'pointer' }}
              />
              <div>
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{t.setOpt}</span>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  {t.setDesc}
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* 값 입력 필드 */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 500 }}>
            {multiplyMode ? t.inputScaleLabel : t.inputSetLabel}
          </label>
          <input 
            ref={inputRef}
            type="number"
            step="any"
            value={valStr}
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

        {/* 푸터 버튼 */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button 
            onClick={onClose}
            style={{
              padding: '8px 16px',
              background: 'transparent',
              border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.85rem'
            }}
          >
            {t.cancel}
          </button>
          <button 
            onClick={handleApply}
            style={{
              padding: '8px 16px',
              background: 'var(--accent-color, #a78bfa)',
              border: 'none',
              color: 'white',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 500
            }}
          >
            {t.apply}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
