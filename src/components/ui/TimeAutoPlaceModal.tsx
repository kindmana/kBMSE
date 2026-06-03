import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useEditorStore } from '../../store/editorStore';
import { Trash2, Plus, AlertCircle } from 'lucide-react';

interface ConstraintInput {
  id: string;
  baseBeatDenom: string; // "16" 등 분모 문자열 입력
  maxNotes: string;      // "1" 등 최대 겹침 수 입력
}

interface TimeAutoPlaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  startAbs: number;
  endAbs: number;
  onApply: (
    constraints: { baseBeatDenom: number; maxNotes: number }[]
  ) => { success: boolean; errorMsg?: string };
}

export const TimeAutoPlaceModal: React.FC<TimeAutoPlaceModalProps> = ({
  isOpen,
  onClose,
  startAbs,
  endAbs,
  onApply
}) => {
  const { settings } = useEditorStore();
  const lang = settings.language || 'en';

  const [constraints, setConstraints] = useState<ConstraintInput[]>(() => {
    try {
      const saved = localStorage.getItem('kbmse_auto_place_constraints');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((item: any) => ({
            id: crypto.randomUUID(),
            baseBeatDenom: String(item.baseBeatDenom || '16'),
            maxNotes: String(item.maxNotes || '1')
          }));
        }
      }
    } catch (e) {
      console.error(e);
    }
    return [{ id: crypto.randomUUID(), baseBeatDenom: '16', maxNotes: '1' }];
  });
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      try {
        const saved = localStorage.getItem('kbmse_auto_place_constraints');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setConstraints(parsed.map((item: any) => ({
              id: crypto.randomUUID(),
              baseBeatDenom: String(item.baseBeatDenom || '16'),
              maxNotes: String(item.maxNotes || '1')
            })));
          }
        }
      } catch (e) {
        console.error(e);
      }
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddConstraint = () => {
    if (constraints.length >= 3) return;
    setConstraints([
      ...constraints,
      { id: crypto.randomUUID(), baseBeatDenom: '16', maxNotes: '1' }
    ]);
    setError('');
  };

  const handleRemoveConstraint = (id: string) => {
    if (constraints.length <= 1) return;
    setConstraints(constraints.filter(c => c.id !== id));
    setError('');
  };

  const handleConstraintChange = (id: string, field: 'baseBeatDenom' | 'maxNotes', val: string) => {
    setConstraints(
      constraints.map(c => (c.id === id ? { ...c, [field]: val } : c))
    );
    if (error) setError('');
  };

  const handleApply = () => {
    // 입력값 검증
    const parsedConstraints = constraints.map(c => {
      const denom = parseInt(c.baseBeatDenom);
      const maxN = parseInt(c.maxNotes);
      return { denom, maxN };
    });

    for (const c of parsedConstraints) {
      if (isNaN(c.denom) || c.denom <= 0) {
        const err = lang === 'ko'
          ? '박자 분모는 0보다 큰 정수여야 합니다.'
          : lang === 'ja'
            ? '拍子の分母は0より大きい整数である必要があります。'
            : 'Beat denominator must be a positive integer greater than 0.';
        setError(err);
        return;
      }
      if (isNaN(c.maxN) || c.maxN <= 0) {
        const err = lang === 'ko'
          ? '최대 겹침 수는 1 이상의 정수여야 합니다.'
          : lang === 'ja'
            ? '最大重なり数は1以上の整数である必要があります。'
            : 'Max notes must be a positive integer greater than or equal to 1.';
        setError(err);
        return;
      }
    }

    const formattedConstraints = parsedConstraints.map(c => ({
      baseBeatDenom: c.denom,
      maxNotes: c.maxN
    }));

    const result = onApply(formattedConstraints);
    if (result.success) {
      try {
        localStorage.setItem(
          'kbmse_auto_place_constraints',
          JSON.stringify(constraints.map(c => ({
            baseBeatDenom: c.baseBeatDenom,
            maxNotes: c.maxNotes
          })))
        );
      } catch (e) {
        console.error(e);
      }
      onClose();
    } else if (result.errorMsg) {
      setError(result.errorMsg);
    }
  };

  const formattedStart = startAbs.toFixed(3);
  const formattedEnd = endAbs.toFixed(3);

  const getTexts = () => {
    if (lang === 'ko') {
      return {
        title: '노트 자동 배치 설정',
        rangeInfo: '지정 구간 정보',
        rangeLabel: `구간: ${formattedStart} ~ ${formattedEnd}마디`,
        constraintSection: '재배치 제약 조건 (최대 3개)',
        beatLabel: '박자 단위',
        maxNotesLabel: '최대 겹침 수',
        addBtn: '조건 추가',
        apply: '자동 배치 적용',
        cancel: '취소',
        desc: '지정 영역 내 건반 노트들의 시간 위치를 고정한 채, 각 라인을 제약조건에 만족하도록 무작위 재배치합니다.'
      };
    }
    if (lang === 'ja') {
      return {
        title: 'ノーツ自動配置設定',
        rangeInfo: '指定範囲情報',
        rangeLabel: `範囲: ${formattedStart} ～ ${formattedEnd}小節`,
        constraintSection: '再配置制約条件 (最大3個)',
        beatLabel: '拍子単位',
        maxNotesLabel: '最大重なり数',
        addBtn: '条件追加',
        apply: '自動配置を適用',
        cancel: 'キャンセル',
        desc: '指定範囲内の演奏ノーツの時間位置を維持したまま、各レーンを制約条件を満たすようにランダムに再配置します。'
      };
    }
    return {
      title: 'Auto Place Notes Settings',
      rangeInfo: 'Selected Range Info',
      rangeLabel: `Range: ${formattedStart} ~ ${formattedEnd} measures`,
      constraintSection: 'Re-placement Constraints (Max 3)',
      beatLabel: 'Beat Unit',
      maxNotesLabel: 'Max Notes Limit',
      addBtn: 'Add Constraint',
      apply: 'Apply Auto Placement',
      cancel: 'Cancel',
      desc: 'Randomly shuffles playable notes inside the selected range to different lanes while preserving their absolute positions and complying with constraints.'
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
        background: 'var(--bg-primary, #1e1e1e)',
        border: '1px solid var(--border-color, #333)',
        borderRadius: '10px',
        padding: '24px',
        width: '420px',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
        color: 'var(--text-primary, #fff)',
        fontFamily: 'inherit'
      }}>
        <h3 style={{ margin: '0 0 15px 0', fontSize: '1.2rem', fontWeight: 600, borderBottom: '1px solid var(--border-color, #333)', paddingBottom: '12px' }}>
          {t.title}
        </h3>

        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #888)', lineHeight: '1.4', marginBottom: '15px' }}>
          {t.desc}
        </div>

        {/* 선택 영역 요약 */}
        <div style={{
          background: 'var(--bg-secondary, #121212)',
          border: '1px solid var(--border-color, #333)',
          borderRadius: '6px',
          padding: '10px 12px',
          marginBottom: '20px',
          fontSize: '0.85rem'
        }}>
          <div style={{ fontWeight: 600, color: 'var(--text-secondary, #888)', marginBottom: '2px' }}>{t.rangeInfo}</div>
          <div style={{ color: 'var(--text-primary, #fff)' }}>{t.rangeLabel}</div>
        </div>

        {/* 제약 조건 섹션 */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary, #888)' }}>
              {t.constraintSection}
            </span>
            {constraints.length < 3 && (
              <button
                type="button"
                onClick={handleAddConstraint}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--accent-color, #a78bfa)',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  padding: '2px 6px'
                }}
              >
                <Plus size={14} />
                {t.addBtn}
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {constraints.map((c) => (
              <div
                key={c.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  background: 'var(--bg-secondary, #121212)',
                  border: '1px solid var(--border-color, #333)',
                  borderRadius: '6px',
                  padding: '10px 12px'
                }}
              >
                {/* 1 / N 입력 박스 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #888)' }}>1 /</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={c.baseBeatDenom}
                    onChange={(e) => handleConstraintChange(c.id, 'baseBeatDenom', e.target.value)}
                    style={{
                      width: '55px',
                      padding: '5px 8px',
                      background: 'var(--bg-primary, #1e1e1e)',
                      border: '1px solid var(--border-color, #333)',
                      borderRadius: '4px',
                      color: 'var(--text-primary, #fff)',
                      fontSize: '0.85rem',
                      textAlign: 'center',
                      outline: 'none'
                    }}
                    placeholder="16"
                  />
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-primary, #fff)' }}>
                    {lang === 'ko' ? '박자 내' : lang === 'ja' ? '拍子内' : 'Beat'}
                  </span>
                </div>

                {/* 최대 수 N 입력 박스 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #888)' }}>
                    {lang === 'ko' ? '최대' : lang === 'ja' ? '最大' : 'Max'}
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={c.maxNotes}
                    onChange={(e) => handleConstraintChange(c.id, 'maxNotes', e.target.value)}
                    style={{
                      width: '50px',
                      padding: '5px 8px',
                      background: 'var(--bg-primary, #1e1e1e)',
                      border: '1px solid var(--border-color, #333)',
                      borderRadius: '4px',
                      color: 'var(--text-primary, #fff)',
                      fontSize: '0.85rem',
                      textAlign: 'center',
                      outline: 'none'
                    }}
                    placeholder="1"
                  />
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-primary, #fff)' }}>
                    {lang === 'ko' ? '개 제한' : lang === 'ja' ? '個制限' : 'Limit'}
                  </span>
                </div>

                {/* 삭제 버튼 */}
                {constraints.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveConstraint(c.id)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#ef4444',
                      cursor: 'pointer',
                      padding: '4px',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 에러 피드백 */}
        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '6px',
            padding: '10px 12px',
            marginBottom: '20px',
            color: '#ef4444',
            fontSize: '0.8rem',
            lineHeight: '1.4'
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
            <span>{error}</span>
          </div>
        )}

        {/* 푸터 버튼 */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 16px',
              background: 'transparent',
              border: '1px solid var(--border-color, #333)',
              color: 'var(--text-secondary, #888)',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.85rem'
            }}
          >
            {t.cancel}
          </button>
          <button
            type="button"
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
