import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useEditorStore } from '../../store/editorStore';

interface TimeSpaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  duration: number;
  startAbs: number;
  endAbs: number;
  onApply: (mode: 'insert' | 'remove') => void;
}

export const TimeSpaceModal: React.FC<TimeSpaceModalProps> = ({
  isOpen,
  onClose,
  duration,
  startAbs,
  endAbs,
  onApply
}) => {
  const { settings } = useEditorStore();
  const lang = settings.language || 'en';

  const [mode, setMode] = useState<'insert' | 'remove'>('insert');

  if (!isOpen) return null;

  const handleApply = () => {
    onApply(mode);
    onClose();
  };

  const formattedStart = startAbs.toFixed(3);
  const formattedEnd = endAbs.toFixed(3);
  const formattedDuration = duration.toFixed(3);

  const getTexts = () => {
    if (lang === 'ko') {
      return {
        title: '공간 삽입 / 삭제',
        rangeInfo: '선택 구간 정보',
        rangeLabel: `구간: ${formattedStart} ~ ${formattedEnd}마디`,
        durationLabel: `길이: ${formattedDuration}마디`,
        opType: '작업 선택',
        insertOpt: '공간 삽입 (Insert Space)',
        insertDesc: `선택한 길이(${formattedDuration}마디)만큼 선택 시작 지점(${formattedStart}) 이후의 모든 노트를 위로 밀어냅니다. 새로운 빈 공간을 만들 때 사용합니다.`,
        removeOpt: '공간 삭제 (Remove Space)',
        removeDesc: `선택한 구간(${formattedStart} ~ ${formattedEnd}) 내부에 존재하는 모든 노트를 잘라내어 삭제하고, 그 위의 모든 노트를 아래로 당겨옵니다.`,
        cancel: '취소',
        apply: '적용'
      };
    }
    if (lang === 'ja') {
      return {
        title: '空白の挿入 / 削除',
        rangeInfo: '選択範囲情報',
        rangeLabel: `範囲: ${formattedStart} ～ ${formattedEnd}小節`,
        durationLabel: `長さ: ${formattedDuration}小節`,
        opType: '操作選択',
        insertOpt: '空白の挿入 (Insert Space)',
        insertDesc: `選択された長さ（${formattedDuration}小節）だけ、開始位置（${formattedStart}）以降のすべてのノーツを上に押し上げます。新しい空白スペースを作ります。`,
        removeOpt: '空白の削除 (Remove Space)',
        removeDesc: `選択された範囲（${formattedStart} ～ ${formattedEnd}）内に存在するすべてのノーツを切り取って削除し、それより上のすべてのノーツを下に引き下げます。`,
        cancel: 'キャンセル',
        apply: '適用'
      };
    }
    return {
      title: 'Insert / Remove Space',
      rangeInfo: 'Selected Range Info',
      rangeLabel: `Range: ${formattedStart} ~ ${formattedEnd} measures`,
      durationLabel: `Length: ${formattedDuration} measures`,
      opType: 'Select Operation',
      insertOpt: 'Insert Space',
      insertDesc: `Pushes all notes starting at ${formattedStart} upwards by the selected duration (${formattedDuration} measures) to make a new empty space.`,
      removeOpt: 'Remove Space',
      removeDesc: `Cuts and deletes all notes inside the selected range (${formattedStart} ~ ${formattedEnd}), and pulls down all subsequent notes.`,
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
          fontSize: '0.85rem',
          lineHeight: '1.5'
        }}>
          <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>{t.rangeInfo}</div>
          <div style={{ color: 'var(--text-primary)' }}>{t.rangeLabel}</div>
          <div style={{ color: 'var(--text-primary)' }}>{t.durationLabel}</div>
        </div>

        {/* 라디오 버튼 선택 형식 */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '10px' }}>
            {t.opType}
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              cursor: 'pointer',
              padding: '10px',
              border: `1px solid ${mode === 'insert' ? 'var(--accent-color, #a78bfa)' : 'var(--border-color)'}`,
              background: mode === 'insert' ? 'rgba(167, 139, 250, 0.05)' : 'transparent',
              borderRadius: '6px',
              transition: 'all 0.2s'
            }}>
              <input 
                type="radio" 
                checked={mode === 'insert'} 
                onChange={() => setMode('insert')} 
                style={{ marginTop: '3px', cursor: 'pointer' }}
              />
              <div>
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{t.insertOpt}</span>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  {t.insertDesc}
                </p>
              </div>
            </label>

            <label style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              cursor: 'pointer',
              padding: '10px',
              border: `1px solid ${mode === 'remove' ? 'var(--accent-color, #a78bfa)' : 'var(--border-color)'}`,
              background: mode === 'remove' ? 'rgba(167, 139, 250, 0.05)' : 'transparent',
              borderRadius: '6px',
              transition: 'all 0.2s'
            }}>
              <input 
                type="radio" 
                checked={mode === 'remove'} 
                onChange={() => setMode('remove')} 
                style={{ marginTop: '3px', cursor: 'pointer' }}
              />
              <div>
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{t.removeOpt}</span>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  {t.removeDesc}
                </p>
              </div>
            </label>
          </div>
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
