import { createPortal } from 'react-dom';
import { useState, useEffect } from 'react';
import { X, Keyboard, Cpu, Settings, Sliders, HelpCircle, ArrowRightLeft, FolderOpen, Play, Wrench, AlertTriangle } from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: TabType;
}

type TabType = 'shortcuts' | 'leftSidebar' | 'rightSidebar' | 'settings';

export const HelpModal = ({ isOpen, onClose, defaultTab }: HelpModalProps) => {
  const { settings } = useEditorStore();
  const lang = settings.language || 'en';
  const [activeTab, setActiveTab] = useState<TabType>(defaultTab || 'shortcuts');

  useEffect(() => {
    if (isOpen && defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [isOpen, defaultTab]);

  if (!isOpen) return null;

  const t = (ko: string, en: string, ja?: string) => {
    if (lang === 'ko') return ko;
    if (lang === 'ja') return ja || en;
    return en;
  };

  const tabNames: Record<TabType, { ko: string; en: string; ja: string; icon: any }> = {
    shortcuts: { ko: '단축키 & 조작', en: 'Hotkeys & Control', ja: 'ショートカット＆操作', icon: Keyboard },
    leftSidebar: { ko: '왼쪽 패널 (파일)', en: 'Left Sidebar (File)', ja: '左パネル（ファイル）', icon: Wrench },
    rightSidebar: { ko: '오른쪽 패널 (설정)', en: 'Right Sidebar (Settings)', ja: '右パネル（設定）', icon: Sliders },
    settings: { ko: '상단 바 (Topbar)', en: 'Topbar Controls', ja: '上부バー（Topbar）', icon: Settings },
  };

  const modalContent = (
    <div className="modal-overlay" onClick={onClose} style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      backdropFilter: 'blur(4px)'
    }}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        width: '680px',
        height: '80vh',
        color: 'var(--text-primary)',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(255, 255, 255, 0.01)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '1.1rem' }}>
            <HelpCircle size={20} className="text-accent" style={{ color: 'var(--accent-color)' }} />
            <span>{t('kBMSE 도움말 및 사용법 가이드', 'kBMSE Help & Usage Guide', 'kBMSE ヘルプ＆使用ガイド')}</span>
          </div>
          <button onClick={onClose} style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'color 0.2s, background-color 0.2s'
          }} className="hover-highlight">
            <X size={18} />
          </button>
        </div>

        {/* Introduction Section */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.015)',
          borderBottom: '1px solid var(--border-color)',
          padding: '10px 20px',
          fontSize: '0.82rem',
          lineHeight: '1.45',
          color: 'var(--text-secondary)'
        }}>
          <strong>kBMSE</strong>는 {
            t(
              '누구나 완벽하게 나만의 BMS 음악 패턴을 창작할 수 있는 차세대 에디터입니다. 끊김 없이 부드러운 바이너리 스트리밍 재생 시스템과 유려한 테마를 결합하여 가장 쾌적하고 세련된 창작 공간을 선사합니다.',
              'is a next-generation BMS editor designed for rhythm game creators to craft custom music patterns. Combining smooth binary streaming audio with rich aesthetics, it offers a polished workspace for your creative journey.',
              'は、誰もが完璧に自分だけのBMS音楽パターンを創作できる次世代エディタです。途切れなくスムーズなバイナリ・ストリーミング再生システムと美麗なテーマを組み合わせ、最も快適で洗練された創作空間を提供します。'
            )
          }
        </div>

        {/* Tab Headers */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-color)',
          background: 'rgba(255, 255, 255, 0.01)',
          padding: '0 10px',
          overflowX: 'auto',
          scrollbarWidth: 'none'
        }}>
          {(Object.keys(tabNames) as TabType[]).map((tabKey) => {
            const TabIcon = tabNames[tabKey].icon;
            const isActive = activeTab === tabKey;
            return (
              <button
                key={tabKey}
                onClick={() => setActiveTab(tabKey)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '12px 16px',
                  background: 'none',
                  border: 'none',
                  borderBottom: isActive ? '2px solid var(--accent-color)' : '2px solid transparent',
                  color: isActive ? 'var(--accent-color)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '0.82rem',
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap'
                }}
              >
                <TabIcon size={14} />
                <span>{t(tabNames[tabKey].ko, tabNames[tabKey].en, tabNames[tabKey].ja)}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Scrollable Body Content */}
        <div style={{
          flex: 1,
          padding: '20px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          background: 'rgba(255, 255, 255, 0.005)'
        }}>
          
          {/* TAB 1: SHORTCUTS */}
          {activeTab === 'shortcuts' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '16px',
                fontSize: '0.8rem'
              }}>
                {/* Playback Shortcuts */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.01)',
                  border: '1px solid rgba(255, 255, 255, 0.03)',
                  borderRadius: '6px',
                  padding: '12px 14px'
                }}>
                  <div style={{ fontWeight: 600, color: 'var(--accent-color)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Play size={14} />
                    <span>{t('재생 제어 (Playback)', 'Playback Control', '再生制御 (Playback)')}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <span>{t('처음부터 재생', 'Play from beginning', '最初から再生')}</span>
                      <kbd style={{ background: '#27272a', padding: '2px 6px', borderRadius: '3px', border: '1px solid #3f3f46', fontSize: '0.7rem', color: '#e4e4e7' }}>F5</kbd>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <span>{t('현재 위치부터 재생', 'Play from current position', '現在位置から再生')}</span>
                      <kbd style={{ background: '#27272a', padding: '2px 6px', borderRadius: '3px', border: '1px solid #3f3f46', fontSize: '0.7rem', color: '#e4e4e7' }}>F6</kbd>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <span>{t('일시 정지', 'Pause', '一時停止')}</span>
                      <kbd style={{ background: '#27272a', padding: '2px 6px', borderRadius: '3px', border: '1px solid #3f3f46', fontSize: '0.7rem', color: '#e4e4e7' }}>F7</kbd>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                      <span>{t('정지', 'Stop', '停止')}</span>
                      <kbd style={{ background: '#27272a', padding: '2px 6px', borderRadius: '3px', border: '1px solid #3f3f46', fontSize: '0.7rem', color: '#e4e4e7' }}>F8</kbd>
                    </div>
                  </div>
                </div>

                {/* Tool Shortcuts */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.01)',
                  border: '1px solid rgba(255, 255, 255, 0.03)',
                  borderRadius: '6px',
                  padding: '12px 14px'
                }}>
                  <div style={{ fontWeight: 600, color: 'var(--accent-color)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Wrench size={14} />
                    <span>{t('도구 핫키 (Tools)', 'Tool Hotkeys', 'ツール・ホットキー (Tools)')}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <span>{t('시간 편집 (Time Edit)', 'Time Tool', '時間編集ツール')}</span>
                      <kbd style={{ background: '#27272a', padding: '2px 6px', borderRadius: '3px', border: '1px solid #3f3f46', fontSize: '0.7rem', color: '#e4e4e7' }}>F1</kbd>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <span>{t('선택 도구 (Select)', 'Select Tool', '選択ツール')}</span>
                      <kbd style={{ background: '#27272a', padding: '2px 6px', borderRadius: '3px', border: '1px solid #3f3f46', fontSize: '0.7rem', color: '#e4e4e7' }}>F2</kbd>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                      <span>{t('쓰기 도구 (Write)', 'Write Tool', 'ペンツール (書込)')}</span>
                      <kbd style={{ background: '#27272a', padding: '2px 6px', borderRadius: '3px', border: '1px solid #3f3f46', fontSize: '0.7rem', color: '#e4e4e7' }}>F3</kbd>
                    </div>
                  </div>
                </div>

                {/* Edit Operations */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.01)',
                  border: '1px solid rgba(255, 255, 255, 0.03)',
                  borderRadius: '6px',
                  padding: '12px 14px',
                  gridColumn: 'span 2'
                }}>
                  <div style={{ fontWeight: 600, color: 'var(--accent-color)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sliders size={14} />
                    <span>{t('에디터 데이터 조작 (Edit Operations)', 'Editor Operations', 'エディタ操作 (Edit Operations)')}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <span>{t('실행 취소 (Undo)', 'Undo', '元に戻す (Undo)')}</span>
                      <kbd style={{ background: '#27272a', padding: '2px 6px', borderRadius: '3px', border: '1px solid #3f3f46', fontSize: '0.7rem', color: '#e4e4e7' }}>Ctrl + Z</kbd>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <span>{t('다시 실행 (Redo)', 'Redo', 'やり直し (Redo)')}</span>
                      <kbd style={{ background: '#27272a', padding: '2px 6px', borderRadius: '3px', border: '1px solid #3f3f46', fontSize: '0.7rem', color: '#e4e4e7' }}>Ctrl + Y</kbd>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <span>{t('잘라내기 (Cut)', 'Cut', '切り取り (Cut)')}</span>
                      <kbd style={{ background: '#27272a', padding: '2px 6px', borderRadius: '3px', border: '1px solid #3f3f46', fontSize: '0.7rem', color: '#e4e4e7' }}>Ctrl + X</kbd>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <span>{t('복사 (Copy)', 'Copy', 'コピー (Copy)')}</span>
                      <kbd style={{ background: '#27272a', padding: '2px 6px', borderRadius: '3px', border: '1px solid #3f3f46', fontSize: '0.7rem', color: '#e4e4e7' }}>Ctrl + C</kbd>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <span>{t('붙여넣기 (Paste)', 'Paste', '貼り付け (Paste)')}</span>
                      <kbd style={{ background: '#27272a', padding: '2px 6px', borderRadius: '3px', border: '1px solid #3f3f46', fontSize: '0.7rem', color: '#e4e4e7' }}>Ctrl + V</kbd>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <span>{t('삭제 (Delete)', 'Delete', '削除 (Delete)')}</span>
                      <kbd style={{ background: '#27272a', padding: '2px 6px', borderRadius: '3px', border: '1px solid #3f3f46', fontSize: '0.7rem', color: '#e4e4e7' }}>Delete</kbd>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <span>{t('모두 선택 (Select All)', 'Select All', 'すべて選択 (Select All)')}</span>
                      <kbd style={{ background: '#27272a', padding: '2px 6px', borderRadius: '3px', border: '1px solid #3f3f46', fontSize: '0.7rem', color: '#e4e4e7' }}>Ctrl + A</kbd>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <span>{t('마디로 바로 이동', 'Go to Measure', '小節へジャンプ')}</span>
                      <kbd style={{ background: '#27272a', padding: '2px 6px', borderRadius: '3px', border: '1px solid #3f3f46', fontSize: '0.7rem', color: '#e4e4e7' }}>Ctrl + G</kbd>
                    </div>
                  </div>
                </div>

                {/* Mouse & Wheel Controls */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.01)',
                  border: '1px solid rgba(255, 255, 255, 0.03)',
                  borderRadius: '6px',
                  padding: '12px 14px',
                  gridColumn: 'span 2'
                }}>
                  <div style={{ fontWeight: 600, color: 'var(--accent-color)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sliders size={14} />
                    <span>{t('마우스 및 격자 조작 (Mouse & Grid Controls)', 'Mouse & Grid Controls', 'マウス＆グリッド操作')}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <span>{t('세로 격자 스크롤', 'Vertical Scroll', '垂直スクロール')}</span>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{t('마우스 휠', 'Mouse Wheel', 'マウスホイール')}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <span>{t('가로 격자 스크롤', 'Horizontal Scroll', '水平スクロール')}</span>
                      <kbd style={{ background: '#27272a', padding: '2px 6px', borderRadius: '3px', border: '1px solid #3f3f46', fontSize: '0.7rem', color: '#e4e4e7' }}>Shift + Wheel</kbd>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <span>{t('자동 스크롤 (토글)', 'Autoscroll (Toggle)', '自動スクロール (トグル)')}</span>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{t('마우스 휠 클릭', 'Mouse Wheel Click', 'ホイールクリック')}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <span>{t('화면 끌기 (Panning)', 'Screen Panning', '画面ドラッグ (ペニング)')}</span>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{t('휠 클릭 유지 후 드래그', 'Wheel Click + Drag', 'ホイールクリック＋ドラッグ')}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <span>{t('처음 마디(0마디)로', 'Scroll to 0 measure', '最初の小節 (0小節) へ')}</span>
                      <kbd style={{ background: '#27272a', padding: '2px 6px', borderRadius: '3px', border: '1px solid #3f3f46', fontSize: '0.7rem', color: '#e4e4e7' }}>Home</kbd>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <span>{t('마지막 마디로', 'Scroll to last measure', '最後の小節へ')}</span>
                      <kbd style={{ background: '#27272a', padding: '2px 6px', borderRadius: '3px', border: '1px solid #3f3f46', fontSize: '0.7rem', color: '#e4e4e7' }}>End</kbd>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LEFT SIDEBAR */}
          {activeTab === 'leftSidebar' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.8rem' }}>
              
              {/* File Operations Card */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.01)',
                border: '1px solid rgba(255, 255, 255, 0.03)',
                borderRadius: '6px',
                padding: '14px'
              }}>
                <div style={{ fontWeight: 600, color: 'var(--accent-color)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FolderOpen size={15} />
                  <span>{t('파일 (File)', 'File', 'ファイル (File)')}</span>
                </div>
                <div style={{ color: 'var(--text-secondary)', lineHeight: '1.5', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div>
                    {t('BMS 파일을 새로 생성하고, 컴퓨터에서 로드하여 저장하는 파일 제어 기능입니다.', 'File control features for creating, loading, and saving BMS files.', 'BMSファイルの新規作成、読み込み、保存を行うファイル管理機能です。')}
                  </div>
                  <div>
                    <strong>{t('1. 새로 만들기 (New)', '1. New', '1. 新規作成 (New)')}</strong>: {t('기존 캔버스 데이터를 모두 비우고 완전히 빈 새 문서로 시작합니다.', 'Clears all active canvas data and opens a blank new document.', '現在のキャンパスデータをすべて初期化し、空白の新規ドキュメントを開きます。')}
                  </div>
                  <div>
                    <strong>{t('2. 열기 (Open)', '2. Open', '2. 開く (Open)')}</strong>: {t('기존에 소장한 BMS 패턴 파일을 가져오며 관련 키음 폴더의 사운드 리소스들을 연동해옵니다.', 'Loads an existing BMS pattern file and binds its related keysound folder audio resources.', '既存のBMSファイルを読み込み、関連するキー音フォルダの音源データを連携します。')}
                  </div>
                  <div>
                    <strong>{t('3. 저장 (Save)', '3. Save (Ctrl+S)', '3. 保存 (Save)')}</strong>: {t('현재까지 캔버스에 배치한 노트 데이터를 작업 중인 원본 파일에 그대로 저장합니다. (Ctrl+S)', 'Saves current note layouts and timing parameters directly to the original file. (Ctrl+S)', '현재까지 캔버스에 배치한 노트 데이터를 작업 중인 원본 파일에 그대로 저장합니다. (Ctrl+S)')}
                  </div>
                  <div>
                    <strong>{t('4. 새로 저장 (Save As)', '4. Save As (Ctrl+Shift+S)', '4. 名前を付けて保存 (Save As)')}</strong>: {t('작업 중인 패턴 데이터를 완전히 별개의 신규 파일 경로로 지정하여 저장합니다. (Ctrl+Shift+S)', 'Exports the active workspace data to a newly designated file path. (Ctrl+Shift+S)', '작업 중인 패턴 데이터를 완전히 별개의 신규 파일 경로로 지정하여 저장합니다. (Ctrl+Shift+S)')}
                  </div>
                </div>
              </div>

              {/* Playback Control Card */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.01)',
                border: '1px solid rgba(255, 255, 255, 0.03)',
                borderRadius: '6px',
                padding: '14px'
              }}>
                <div style={{ fontWeight: 600, color: 'var(--accent-color)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Play size={15} />
                  <span>{t('재생 (Playback)', 'Playback', '再生 (Playback)')}</span>
                </div>
                <div style={{ color: 'var(--text-secondary)', lineHeight: '1.5', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div>
                    {t('작성 중인 BMS 패턴을 실시간으로 시뮬레이션하기 위한 재생 기능입니다.', 'Playback feature for real-time simulation of the BMS pattern.', '制作中のBMSパターンをリアルタイムでシミュレーションするための再生機能です。')}
                  </div>
                  <div>
                    <strong>{t('1. 처음부터 재생 (F5)', '1. Play from Start (F5)', '1. 最初から再生 (F5)')}</strong>: {t('패턴의 0마디 시작 지점부터 곡을 처음부터 재생합니다.', 'Plays the pattern from the very beginning (measure 0).', '0小節目の開始位置からパターンを最初から再生します。')}
                  </div>
                  <div>
                    <strong>{t('2. 현재부터 재생 (F6)', '2. Play from Current (F6)', '2. 現在から再生 (F6)')}</strong>: {t('현재 화면의 빨간색 가로 스크롤 플레이 바 위치부터 즉시 재생합니다.', 'Starts playing from the current red playback anchor position.', '画面上の赤い再生バーの位置から即座に再生を開始します。')}
                  </div>
                  <div>
                    <strong>{t('3. 일시정지 (F7)', '3. Pause (F7)', '3. 一時停止 (F7)')}</strong>: {t('재생 중인 사운드를 일시적으로 정지하고 그 자리에 멈춥니다.', 'Temporarily pauses playback at the current position.', '再生中の音源を一時停止し、その位置で待機します。')}
                  </div>
                  <div>
                    <strong>{t('4. 정지 (F8)', '4. Stop (F8)', '4. 停止 (F8)')}</strong>: {t('재생을 완전히 중단하고 재생을 누른 지점으로 돌아갑니다.', 'Fully stops playback and returns to the position where playback was started.', '再生を完全に停止し、再生を開始した位置に戻ります。')}
                  </div>
                </div>
              </div>

              {/* Time Edit Tools Card */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.01)',
                border: '1px solid rgba(255, 255, 255, 0.03)',
                borderRadius: '6px',
                padding: '14px'
              }}>
                <div style={{ fontWeight: 600, color: 'var(--accent-color)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Wrench size={15} />
                  <span>{t('시간 편집 (Time Edit Operations, F1)', 'Time Edit Operations (F1)', '時間編集ツール (Time Edit, F1)')}</span>
                </div>
                <div style={{ color: 'var(--text-secondary)', lineHeight: '1.5', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div>
                    <strong>{t('1. 공간 삽입/삭제 (Insert/Remove Space)', '1. Insert/Remove Space', '1. 小節空間の挿入・削除')}</strong>: 
                    {t(' 지정 마디 구간에 공백 마디를 물리적으로 추가해 밀어내거나, 실존하는 기존 마디를 소멸시켜 앞당깁니다.', ' Appends blank measure intervals or deletes/collapses existing measure ranges.', ' 指定の小節範囲に空白小節を追加してノーツを押し出したり、既存の小節を削除して前方に引き寄せます。')}
                  </div>
                  <div>
                    <strong>{t('2. BPM 일괄 변경 (BPM Changer)', '2. BPM Changer', '2. BPMの一括変更')}</strong>: 
                    {t(' 선택한 특정 드래그 구간 내의 모든 BPM 변화량을 고무줄처럼 압축 또는 팽창시켜 곡의 가속/대기를 설계합니다.', ' Compresses or expands BPM timelines within the selected range.', ' 選択した区間内のすべてのBPM変化を伸縮させ、楽曲の加速や減速のタイミングを調整します。')}
                  </div>
                  <div>
                    <strong>{t('3. STOP 구간 추가 (Convert Area to STOP)', '3. Convert Area to STOP', '3. STOPイベントへの変換')}</strong>: 
                    {t(' 드래그한 선택 구간의 공간을 축소 삭제하고, 그 물리적 시간만큼 앞마디의 끝단에 정지 변속 이벤트(#STOPxx)를 자동 연산하여 변환합니다.', ' Converts a physical dragged area into a temporary STOP pause event at the end of the previous measure.', ' ドラッグした選択範囲の空間を切り詰めて削除し、その物理時間分だけ手前の小節末尾に自動演算された一時停止イベント(#STOPxx)を作成します。')}
                    <div style={{ 
                      color: 'var(--text-secondary)', 
                      fontSize: '0.75rem', 
                      marginTop: '3px', 
                      borderLeft: '2px solid #ef4444', 
                      paddingLeft: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <AlertTriangle size={12} style={{ color: '#ef4444', flexShrink: 0 }} />
                      <span>
                        {t(
                          '드래그 구간 내에 키음(노트)이 존재하면 곡 훼손 방지를 위해 변환이 차단되며 에러 박스가 노출됩니다.',
                          'Blocks conversion and prompts an alert if playable notes exist inside the target STOP drag segment.',
                          'ドラッグ範囲内にノーツが存在する場合は、データの破損を防ぐため変換がブロックされ警告が表示されます。'
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* BMS Diff Card */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.01)',
                border: '1px solid rgba(255, 255, 255, 0.03)',
                borderRadius: '6px',
                padding: '14px'
              }}>
                <div style={{ fontWeight: 600, color: 'var(--accent-color)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ArrowRightLeft size={15} />
                  <span>{t('검사 (BMS Diff)', 'BMS Diff Checker', 'ズレ検出 (BMS Diff)')}</span>
                </div>
                <p style={{ color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 }}>
                  {t(
                    '현재 작업 중인 패턴과 다른 대상 BMS 패턴 파일을 선정하여 로드합니다. 두 파일 사이의 건반 노트의 엇갈림 오차, 마디 불일치, BPM 변속 노드 차이를 정밀 추적하여 실시간 리포트로 교차 검사해 줍니다.',
                    'Compares the active BMS file with an external target pattern. Pinpoints and cross-checks differences in note channels, measure alignments, and timing node shifts.',
                    '現在編集中のパターンと、比較対象の別BMSファイルを読み込みます。２つのファイル間でノーツのズレ、小節の不一致、BPM変化の差異を精密に追跡し、比較結果をリアルタイムに出力します。'
                  )}
                </p>
              </div>

            </div>
          )}

          {/* TAB 3: RIGHT SIDEBAR */}
          {activeTab === 'rightSidebar' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.8rem' }}>
              
              {/* Grid & Snap Card */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.01)',
                border: '1px solid rgba(255, 255, 255, 0.03)',
                borderRadius: '6px',
                padding: '14px'
              }}>
                <div style={{ fontWeight: 600, color: 'var(--accent-color)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sliders size={15} />
                  <span>{t('격자 눈금 및 스냅 (Grid & Snap)', 'Grid & Snap', 'グリッド線＆スナップ')}</span>
                </div>
                <p style={{ color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 }}>
                  {t(
                    '에디터 캔버스의 노트 자석 스냅 해상도를 결정합니다. 주 격자선 분할(4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192, 384, 9216 등)과 그 사이에 배치될 보조 격자선 분할을 별도로 설계하여 배치 정밀도를 극대화합니다. 가변 마디 내에서도 찌그러짐 없이 균일한 스냅 높이를 정합성 있게 유지합니다.',
                    'Controls note snap snap alignments on the canvas. Provides detailed subdivisions for main grid lines (up to 9216 snap) and auxiliary grid guides. Snap heights are dynamically normalized even within irregular measures.',
                    'キャンバス上でのノーツスナップ解像度を設定します。メイングリッド分割（4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192, 384, 9216など）とサブグリッド分割を個別に設定でき、配置の正確性を最大化します。変則小節内でも歪むことなく均一なスナップサイズを維持します。'
                  )}
                </p>
              </div>

              {/* Screen Zoom Card */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.01)',
                border: '1px solid rgba(255, 255, 255, 0.03)',
                borderRadius: '6px',
                padding: '14px'
              }}>
                <div style={{ fontWeight: 600, color: 'var(--accent-color)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sliders size={15} />
                  <span>{t('화면 줌 조절 (Zoom X / Y)', 'Zoom Control', '画面の拡大・縮小 (Zoom X/Y)')}</span>
                </div>
                <p style={{ color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 }}>
                  {t(
                    '가로 배율(Zoom X)을 통해 에디터의 건반 채널 컬럼 간격을 픽셀 단위로 좁히거나 넓혀 가독성을 높입니다. 세로 배율(Zoom Y)을 통해서는 스크롤 체감 속도 배율을 유연하게 늘리거나 축소하여 노트들이 겹치지 않고 보기 편하도록 조율합니다.',
                    'Adjusts canvas proportions. Zoom X contracts or expands lane pixel widths for dense note placement visibility, while Zoom Y stretches the vertical scale to avoid note collisions in high-BPM segments.',
                    '横倍率 (Zoom X) はレーン表示のピクセル幅を調整し、ノーツ配置の視認性を高めます。縦倍率 (Zoom Y) はグリッドの垂直スケールを拡大・縮小し、高BPMの密集箇所でのノーツの重なりを回避します。'
                  )}
                </p>
              </div>

              {/* Note Types Card */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.01)',
                border: '1px solid rgba(255, 255, 255, 0.03)',
                borderRadius: '6px',
                padding: '14px'
              }}>
                <div style={{ fontWeight: 600, color: 'var(--accent-color)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Cpu size={15} />
                  <span>{t('노트 종류 안내 (Note Channels)', 'Note Types', 'ノーツの種類')}</span>
                </div>
                <div style={{ color: 'var(--text-secondary)', lineHeight: '1.5', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div>
                    <strong>{t('1. 일반 노트 (Normal Note)', '1. Normal Note', '1. 通常ノーツ')}</strong>: 
                    {t(' 플레이어가 직접 기기를 통해 두드려 연주하는 키음 노트입니다.', ' Standard key sounds that players trigger interactively.', ' プレイヤーがキーを押したときに鳴る、標準的な打鍵音源ノーツです。')}
                  </div>
                  <div>
                    <strong>{t('2. 지뢰 노트 (Mine Note)', '2. Mine Note', '2. 地雷ノーツ')}</strong>: 
                    {t(' 플레이어 가이드상 누르면 강제로 데미지를 입거나 게이지가 감소하는 함정용 지뢰 노트입니다.', ' Traps that damage gauge if pressed by the player.', ' プレイヤーが誤って押すとダメージを受けたり、ゲージが減少するトラップノーツです。')}
                  </div>
                  <div>
                    <strong>{t('3. 숨김 노트 (Invisible Note)', '3. Invisible Note', '3. 不可視ノーツ (Invisible)')}</strong>: 
                    {t(' 화면상의 건반 레인에는 렌더링되지 않으나 음악이 흘러갈 때 숨김노트가 지나간 후에 누르면 해당 숨김 키음이 재생되는 노트입니다.', ' Notes that are not rendered on the lanes, but playing the key after the invisible note passes triggers its keysound.', ' プレイ中にレーン上には描画されませんが、不可視ノーツが通過するタイミングでキーを押すとキー音が鳴るノーツです。')}
                  </div>
                </div>
              </div>

              {/* WAV & BMP Resource Libraries Card */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.01)',
                border: '1px solid rgba(255, 255, 255, 0.03)',
                borderRadius: '6px',
                padding: '14px'
              }}>
                <div style={{ fontWeight: 600, color: 'var(--accent-color)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FolderOpen size={15} />
                  <span>{t('리소스 라이브러리 (WAV / BMP List)', 'WAV & BMP Resource Lists', 'リソースリスト (WAV/BMP)')}</span>
                </div>
                <p style={{ color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 }}>
                  {t(
                    'BMS 내부의 사운드 정의(#WAVxx) 및 백그라운드 영상 이펙트(#BMPxx)의 목록 일람표입니다. 연필 도구(F3)를 활성화한 상태에서 리소스 리스트 중 하나를 클릭하거나 더블클릭하여 노트를 배치할 키음 번호값(01~FF)을 실시간으로 지정하여 간편하게 조립할 수 있습니다.',
                    'BMS audio triggers (#WAVxx) and visual animation definitions (#BMPxx). Clicking or double-clicking any resource binds it as the active keysound value (01~FF) for note drawing with the Write Tool (F3).',
                    'BMSに定義された音源定義 (#WAVxx) や背景画像・映像定義 (#BMPxx) の一覧表です。ペンツール (F3) を選択した状態でリスト内の項目をクリックまたはダブルクリックすると、配置するノーツの割り当て番号 (01~FF) を変更して描画できます。'
                  )}
                </p>
              </div>

            </div>
          )}

          {/* TAB 4: TOPBAR CONTROLS */}
          {activeTab === 'settings' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.8rem' }}>
              
              {/* View Filters Control Card */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.01)',
                border: '1px solid rgba(255, 255, 255, 0.03)',
                borderRadius: '6px',
                padding: '14px'
              }}>
                <div style={{ fontWeight: 600, color: 'var(--accent-color)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sliders size={15} />
                  <span>{t('보기 필터 및 눈금 제어 (View Filters)', 'View Filters', '表示フィルター')}</span>
                </div>
                <p style={{ color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 }}>
                  {t(
                    '에디터 화면에 렌더링될 요소들을 유동적으로 켜고 끕니다. 템포(BPM) 레인, 정지(STOP) 레인, 스크롤(SCROLL) 레인, BGA / LAYER / POOR 레인 등 화면 공간을 많이 차지하는 특수 레인들을 원하지 않을 때 화면상에서 감춰 캔버스 창을 더 널찍하고 쾌적하게 운용할 수 있습니다. 그 외에도 마디선, 마디 번호, 건반 라인 구분선 등을 자유롭게 조율합니다.',
                    'Toggles visibility of editor elements. Hiding space-consuming lanes like BPM, STOP, SCROLL, or BGA/LAYER/POOR helps declutter your canvas. You can also customize grid guides, measure numbers, and lane separation borders.',
                    'エディタ画面に描画される要素を柔軟に切り替えます。テンポ (BPM) レーン、一時停止 (STOP) レーン、スクロール (SCROLL) レーン、BGA/LAYER/POOR レーンなど、場所を占有するレーンを非表示にし、表示領域を最適化できます。小節線、小節番号、レーン境界線なども自由に変更可能です。'
                  )}
                </p>
              </div>

              {/* Key Mode Selection Card */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.01)',
                border: '1px solid rgba(255, 255, 255, 0.03)',
                borderRadius: '6px',
                padding: '14px'
              }}>
                <div style={{ fontWeight: 600, color: 'var(--accent-color)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ArrowRightLeft size={15} />
                  <span>{t('키 모드 스위칭 (Key Mode Layout)', 'Key Mode Layout', 'キーモード変更')}</span>
                </div>
                <p style={{ color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 }}>
                  {t(
                    '플레이할 아케이드 환경(4K, 5K, 6K, 7K, 8K, 9K, 10K, 14K 등)에 맞춘 건반 레인 배치를 스위칭합니다. 특히 모드를 축소 변경할 때, 사라지는 라인에 올라가 있던 연주 노트들을 공중 분해하지 않고 자동으로 "01번 백그라운드 소리(Invisible) 채널"의 리스트로 안전하게 마이그레이션시켜 곡의 연주 음원 구성을 100% 온전히 보존해 줍니다.',
                    'Switches keyboard track layouts to fit arcade environments (4K, 5K, 6K, 7K, 8K, 9K, 10K, 14K). Displaced keysound notes from hidden lanes are migrated automatically into the 01 BGM channel list, preserving the pattern audio integrity.',
                    'プレイスタイル (4K, 5K, 6K, 7K, 8K, 9K, 10K, 14K など) に合わせたレーン配置に切り替えます。特にレーン数を減らす変更の際、消滅するレーンに配置されていたノーツは削除されず、自動的に「#01 BGM (不可視・背景音) レーン」へ移され、音源構成を完全に維持します。'
                  )}
                </p>
              </div>

              {/* General & Visual Options Card */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.01)',
                border: '1px solid rgba(255, 255, 255, 0.03)',
                borderRadius: '6px',
                padding: '14px'
              }}>
                <div style={{ fontWeight: 600, color: 'var(--accent-color)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Settings size={15} />
                  <span>{t('설정 옵션 튜닝 (Options Tuning)', 'Options Tuning', '環境設定')}</span>
                </div>
                <div style={{ color: 'var(--text-secondary)', lineHeight: '1.5', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div>
                    <strong>{t('1. 문자 인코딩 (Encoding)', '1. Encoding', '1. 文字エンコード')}</strong>: 
                    {t(' 일본어 아케이드 표준인 Shift-JIS 세팅과 만국 표준인 UTF-8 문자 포맷을 전환하여 한글/일본어 메타데이터 깨짐을 제어합니다.', ' Swaps Shift-JIS and UTF-8 encodings to prevent text corruptions in metadata.', ' 日本語や各国標準である Shift-JIS とグローバル標準の UTF-8 文字フォーマットを切り替え、タグやメタデータの文字化けを防ぎます。')}
                  </div>
                  <div>
                    <strong>{t('2. 진수 관리 (Base 36/62)', '2. Base 36/62 Mode', '2. 基数管理 (Base 36/62)')}</strong>: 
                    {t(' 타이밍 이벤트 인덱싱을 16진수 혹은 36/62진수 중 파일 기준으로 자동 판단하여 로드하거나 특정 진수로 고정합니다.', ' Selects indexing behavior for timing and keysound definitions (Auto/36-base/62-base).', ' ノーツ値や各種拡張定義のインデックスを 16進数、36進数、62進数から自動判断、または手動で強制指定します。')}
                  </div>
                  <div>
                    <strong>{t('3. 휠 스크롤 방향 (Scroll Direction)', '3. Scroll Direction', '3. スクリール方向')}</strong>: 
                    {t(' 휠 스크롤 조작 시 격자 화면이 흐르는 방향을 정방향(Normal) 또는 역방향(Reverse) 중 원하는 감도로 매칭합니다.', ' Configures mouse wheel scroll behaviors between Normal and Reverse speeds.', ' マウスホイールの回転に対するタイムライン의移動方向 (Normal/Reverse) や感度を設定します。')}
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.75rem',
          color: 'var(--text-secondary)',
          background: 'rgba(255, 255, 255, 0.015)'
        }}>
          <span>kBMSE BMS editor v0.1.0</span>
          <span>made by kindmana</span>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
