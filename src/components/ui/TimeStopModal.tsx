import React from 'react';
import { createPortal } from 'react-dom';
import { useEditorStore } from '../../store/editorStore';

interface TimeStopModalProps {
  isOpen: boolean;
  onClose: () => void;
  duration: number;
  startAbs: number;
  endAbs: number;
  hasNotesInside: boolean;
  onApply: () => void;
}

export const TimeStopModal: React.FC<TimeStopModalProps> = ({
  isOpen,
  onClose,
  duration,
  startAbs,
  endAbs,
  hasNotesInside,
  onApply
}) => {
  const { settings } = useEditorStore();
  const lang = settings.language || 'en';

  if (!isOpen) return null;

  const handleApply = () => {
    onApply();
    onClose();
  };

  const formattedStart = startAbs.toFixed(3);
  const formattedEnd = endAbs.toFixed(3);
  const formattedDuration = duration.toFixed(3);
  
  // STOP value inside #STOPxx represents 1/192nd of a standard bar.
  const stopValue = Math.round(duration * 192);

  const getTexts = () => {
    if (lang === 'ko') {
      return {
        title: 'STOP 구간 추가',
        rangeInfo: '선택 구간 정보',
        rangeLabel: `구간: ${formattedStart} ~ ${formattedEnd}마디 (${formattedDuration}마디 크기)`,
        calcLabel: '변환 수치 연산',
        calcFormula: `정지 수치 = ${formattedDuration}마디 × 192 = ${stopValue}`,
        description: `드래그하여 선택한 물리적 공간(${formattedDuration}마디)을 삭제하고, 해당 영역의 시작 위치(${formattedStart})에 #STOP 이벤트를 삽입합니다.`,
        errorNotesExist: '드래그한 구간 내(시작점 제외)에 키음이 존재하여 STOP 구간을 추가할 수 없습니다.',
        cancel: '취소',
        apply: '구간 추가'
      };
    }
    if (lang === 'ja') {
      return {
        title: 'STOP区間の追加',
        rangeInfo: '選択範囲情報',
        rangeLabel: `範囲: ${formattedStart} ～ ${formattedEnd}小節 (${formattedDuration}小節サイズ)`,
        calcLabel: '変換値の算出',
        calcFormula: `停止値 = ${formattedDuration}小節 × 192 = ${stopValue}`,
        description: `ドラッグして選択した物理スペース（${formattedDuration}小節）を削除し、その範囲の開始位置（${formattedStart}）に #STOP イベントを挿入します。`,
        errorNotesExist: '選択した範囲内（開始位置を除く）にキー音が存在するため、STOP区間を追加できません。',
        cancel: 'キャンセル',
        apply: '区間追加'
      };
    }
    return {
      title: 'Add STOP Area',
      rangeInfo: 'Selected Range Info',
      rangeLabel: `Range: ${formattedStart} ~ ${formattedEnd} measures (${formattedDuration} measures size)`,
      calcLabel: 'Calculated STOP Value',
      calcFormula: `STOP Value = ${formattedDuration} measures × 192 = ${stopValue}`,
      description: `Removes the selected physical spacing (${formattedDuration} measures) and inserts a #STOP event at the start position (${formattedStart}).`,
      errorNotesExist: 'Cannot add STOP area because notes exist within the selected range (excluding the start position).',
      cancel: 'Cancel',
      apply: 'Add Area'
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
        width: '380px',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
        color: 'var(--text-primary)',
        fontFamily: 'inherit'
      }}>
        <h3 style={{ margin: '0 0 20px 0', fontSize: '1.2rem', fontWeight: 600, borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          {t.title}
        </h3>

        {/* 선택 영역 정보 */}
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '6px',
          padding: '12px',
          marginBottom: '16px',
          fontSize: '0.85rem'
        }}>
          <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>{t.rangeInfo}</div>
          <div style={{ color: 'var(--text-primary)' }}>{t.rangeLabel}</div>
        </div>

        {/* STOP 치 계산 요약 */}
        <div style={{
          background: 'rgba(167, 139, 250, 0.05)',
          border: '1px solid var(--accent-color, #a78bfa)',
          borderRadius: '6px',
          padding: '12px',
          marginBottom: '20px',
          fontSize: '0.85rem'
        }}>
          <div style={{ fontWeight: 600, color: 'var(--accent-color, #a78bfa)', marginBottom: '4px' }}>{t.calcLabel}</div>
          <div style={{ color: 'var(--text-primary)' }}>{t.calcFormula}</div>
        </div>

        {/* 안내 내용 */}
        <div style={{
          fontSize: '0.8rem',
          color: 'var(--text-secondary)',
          lineHeight: '1.5',
          marginBottom: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <p style={{ margin: 0 }}>{t.description}</p>
        </div>

        {/* 에러 경고 상자 */}
        {hasNotesInside && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '6px',
            padding: '12px',
            marginBottom: '20px',
            fontSize: '0.82rem',
            color: '#ef4444',
            lineHeight: '1.4',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 500
          }}>
            <span style={{ fontSize: '1rem' }}>⚠️</span>
            <div>{t.errorNotesExist}</div>
          </div>
        )}

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
            disabled={hasNotesInside}
            style={{
              padding: '8px 16px',
              background: hasNotesInside ? 'var(--border-color)' : 'var(--accent-color, #a78bfa)',
              border: 'none',
              color: hasNotesInside ? 'var(--text-secondary)' : 'white',
              borderRadius: '6px',
              cursor: hasNotesInside ? 'not-allowed' : 'pointer',
              fontSize: '0.85rem',
              fontWeight: 500,
              opacity: hasNotesInside ? 0.6 : 1,
              transition: 'all 0.2s ease'
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
