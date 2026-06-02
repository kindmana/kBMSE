import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ShieldAlert, Navigation, HelpCircle, Layers, Hourglass, Zap } from 'lucide-react';
import { BmsValidationError } from '../../utils/bmsValidator';

interface BmsValidationErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  errors: BmsValidationError[];
  onGoToMeasure: (measure: number) => void;
}

const gcd = (a: number, b: number): number => {
  while (b !== 0) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
};

const getFractionString = (pos: number): string => {
  if (pos === 0) return '0/1';
  const possibleDenominators = [2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96, 192];
  for (const d of possibleDenominators) {
    const numerator = pos * d;
    if (Math.abs(numerator - Math.round(numerator)) < 0.0005) {
      const num = Math.round(numerator);
      const divisor = gcd(num, d);
      return `${num / divisor}/${d / divisor}`;
    }
  }
  const d = 192;
  const num = Math.round(pos * d);
  const divisor = gcd(num, d);
  return `${num / divisor}/${d / divisor}`;
};

export const BmsValidationErrorModal = ({
  isOpen,
  onClose,
  errors,
  onGoToMeasure
}: BmsValidationErrorModalProps) => {
  const [filterType, setFilterType] = useState<string>('all');

  if (!isOpen || errors.length === 0) return null;

  // 에러 타입별 요약 계산
  const countByType = {
    all: errors.length,
    overlap: errors.filter(e => e.type === 'overlap').length,
    ln: errors.filter(e => ['ln_pair', 'ln_overlap', 'ln_length'].includes(e.type)).length,
    lnobj: errors.filter(e => e.type === 'lnobj').length,
    timing: errors.filter(e => ['bpm', 'stop', 'scroll', 'measure', 'header'].includes(e.type)).length
  };

  const getTypeName = (type: string) => {
    switch (type) {
      case 'overlap': return '완전 겹침';
      case 'ln_pair': return '롱노트 페어';
      case 'ln_overlap': return '롱노트 꼬임';
      case 'ln_length': return '롱노트 길이';
      case 'lnobj': return 'LNOBJ 논리';
      case 'bpm': return 'BPM 정의';
      case 'stop': return 'STOP 정의';
      case 'scroll': return 'SCROLL 정의';
      case 'measure': return '마디 설정';
      case 'header': return '기본 설정';
      default: return '일반';
    }
  };

  const getTypeBadgeStyle = (type: string) => {
    switch (type) {
      case 'overlap':
        return { bg: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'rgba(239, 68, 68, 0.2)' };
      case 'lnobj':
        return { bg: 'rgba(168, 85, 247, 0.1)', color: '#a855f7', border: 'rgba(168, 85, 247, 0.2)' };
      case 'ln_pair':
      case 'ln_overlap':
      case 'ln_length':
        return { bg: 'rgba(234, 179, 8, 0.1)', color: '#eab308', border: 'rgba(234, 179, 8, 0.2)' };
      default:
        return { bg: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: 'rgba(59, 130, 246, 0.2)' };
    }
  };

  // 필터링 적용
  const filteredErrors = errors.filter(err => {
    if (filterType === 'all') return true;
    if (filterType === 'overlap') return err.type === 'overlap';
    if (filterType === 'ln') return ['ln_pair', 'ln_overlap', 'ln_length'].includes(err.type);
    if (filterType === 'lnobj') return err.type === 'lnobj';
    if (filterType === 'timing') return ['bpm', 'stop', 'scroll', 'measure', 'header'].includes(err.type);
    return true;
  });

  return createPortal(
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1200,
        backdropFilter: 'blur(5px)'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="modal-content glass-effect"
        style={{
          width: '820px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '0',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          borderRadius: '14px',
          boxShadow: '0 25px 50px rgba(0,0,0,0.6), 0 0 25px rgba(239, 68, 68, 0.1)',
          overflow: 'hidden',
          background: 'rgba(18, 12, 12, 0.98)',
          backdropFilter: 'blur(20px)',
          animation: 'modalSlideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards'
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 20px',
            borderBottom: '1px solid rgba(239, 68, 68, 0.15)',
            background: 'linear-gradient(90deg, rgba(239, 68, 68, 0.05) 0%, rgba(0,0,0,0) 100%)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldAlert size={20} style={{ color: '#ef4444' }} />
            <div>
              <h3 style={{ margin: '0', fontSize: '1.1rem', fontWeight: 700, color: '#fca5a5' }}>
                BMS 오류 발견
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)' }}>
                치명적인 패턴 및 제어 채널 손상이 발견되어 파일 저장이 완전히 차단되었습니다.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255,255,255,0.5)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '6px',
              borderRadius: '50%',
              transition: 'background 0.2s',
              outline: 'none'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, overflow: 'hidden' }}>
          
          {/* Summary Dashboard Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
            {/* All */}
            <div
              onClick={() => setFilterType('all')}
              style={{
                background: filterType === 'all' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(255,255,255,0.02)',
                border: filterType === 'all' ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.05)',
                borderRadius: '8px', padding: '10px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s ease'
              }}
            >
              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginBottom: '4px' }}>
                <Layers size={11} /> 전체 오류
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fca5a5' }}>{countByType.all}</div>
            </div>

            {/* Overlaps */}
            <div
              onClick={() => setFilterType('overlap')}
              style={{
                background: filterType === 'overlap' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(255,255,255,0.02)',
                border: filterType === 'overlap' ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.05)',
                borderRadius: '8px', padding: '10px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s ease'
              }}
            >
              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginBottom: '4px' }}>
                <Zap size={11} style={{ color: '#ef4444' }} /> 완전 겹침
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ef4444' }}>{countByType.overlap}</div>
            </div>

            {/* Long Notes */}
            <div
              onClick={() => setFilterType('ln')}
              style={{
                background: filterType === 'ln' ? 'rgba(234, 179, 8, 0.08)' : 'rgba(255,255,255,0.02)',
                border: filterType === 'ln' ? '1px solid #eab308' : '1px solid rgba(255,255,255,0.05)',
                borderRadius: '8px', padding: '10px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s ease'
              }}
            >
              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginBottom: '4px' }}>
                <Hourglass size={11} style={{ color: '#eab308' }} /> 롱노트 페어/구간
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#eab308' }}>{countByType.ln}</div>
            </div>

            {/* LNOBJ */}
            <div
              onClick={() => setFilterType('lnobj')}
              style={{
                background: filterType === 'lnobj' ? 'rgba(168, 85, 247, 0.08)' : 'rgba(255,255,255,0.02)',
                border: filterType === 'lnobj' ? '1px solid #a855f7' : '1px solid rgba(255,255,255,0.05)',
                borderRadius: '8px', padding: '10px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s ease'
              }}
            >
              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginBottom: '4px' }}>
                <HelpCircle size={11} style={{ color: '#a855f7' }} /> LNOBJ 논리
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#a855f7' }}>{countByType.lnobj}</div>
            </div>

            {/* Timings */}
            <div
              onClick={() => setFilterType('timing')}
              style={{
                background: filterType === 'timing' ? 'rgba(59, 130, 246, 0.08)' : 'rgba(255,255,255,0.02)',
                border: filterType === 'timing' ? '1px solid #3b82f6' : '1px solid rgba(255,255,255,0.05)',
                borderRadius: '8px', padding: '10px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s ease'
              }}
            >
              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginBottom: '4px' }}>
                <Layers size={11} style={{ color: '#3b82f6' }} /> 제어/설정/BPM
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#3b82f6' }}>{countByType.timing}</div>
            </div>
          </div>

          {/* Table list view */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px' }}>
            <div style={{ overflowY: 'auto', flex: 1, background: 'rgba(0,0,0,0.2)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', position: 'sticky', top: 0, zIndex: 1 }}>
                    <th style={{ padding: '10px 14px', width: '90px', color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>유형</th>
                    <th style={{ padding: '10px 14px', color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>발생 위치 (마디/구간)</th>
                    <th style={{ padding: '10px 14px', width: '220px', color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>발생 레인</th>
                    <th style={{ padding: '10px 14px', width: '90px', color: 'rgba(255,255,255,0.6)', fontWeight: 600, textAlign: 'center' }}>이동</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredErrors.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ padding: '30px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem' }}>
                        이 카테고리에 해당하는 오류가 존재하지 않습니다.
                      </td>
                    </tr>
                  ) : (
                    filteredErrors.map((err) => {
                      const badge = getTypeBadgeStyle(err.type);
                      
                      let locationStr = '-';
                      if (err.measure !== undefined) {
                        const mStr = `${err.measure}마디`;
                        if (err.position !== undefined && err.position > 0) {
                          locationStr = `${mStr} ${getFractionString(err.position)}구간`;
                        } else {
                          locationStr = mStr;
                        }
                      }

                      return (
                        <tr
                          key={err.id}
                          style={{
                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                            transition: 'background 0.15s ease'
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          <td style={{ padding: '10px 14px' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '0.68rem',
                                fontWeight: 600,
                                background: badge.bg,
                                color: badge.color,
                                border: `1px solid ${badge.border}`
                              }}
                            >
                              {getTypeName(err.type)}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', color: '#ffffff', fontWeight: 600 }}>
                            {locationStr}
                          </td>
                          <td style={{ padding: '10px 14px', color: 'rgba(255,255,255,0.8)', fontSize: '0.78rem' }}>
                            {err.laneName || '-'}
                          </td>
                          <td style={{ padding: '8px 14px', textAlign: 'center' }}>
                            {err.measure !== undefined ? (
                              <button
                                onClick={() => {
                                  onGoToMeasure(err.measure!);
                                  onClose();
                                }}
                                style={{
                                  background: 'rgba(255,255,255,0.04)',
                                  border: '1px solid rgba(255,255,255,0.1)',
                                  color: 'var(--text-primary)',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '0.7rem',
                                  fontWeight: 600,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  transition: 'all 0.15s ease'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                                  e.currentTarget.style.borderColor = '#ef4444';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                                }}
                              >
                                <Navigation size={10} />
                                이동
                              </button>
                            ) : (
                              <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.2)' }}>-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(0,0,0,0.3)',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center'
          }}
        >
          <button
            onClick={onClose}
            style={{
              background: '#ef4444',
              color: '#ffffff',
              border: 'none',
              padding: '6px 16px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: 600,
              boxShadow: '0 4px 12px rgba(239,68,68,0.25)',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#dc2626')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ef4444')}
          >
            닫기
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
