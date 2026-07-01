import { Save, MousePointer2, Pencil, Clock, Play, PlayCircle, Pause, Square, FilePlus, FolderOpen, Download, Scale } from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import { getAudioContext } from '../../utils/audioPlayer';
import { translations } from '../../constants/translations';

interface LeftSidebarProps {
  handleNew: () => void;
  handleOpen: () => void;
  handleSave: () => void;
  handleSaveAs: () => void;
  handleOpenDiff: () => void;
  isDirty: boolean;
  hasBmsData: boolean;
  totalNotesCount: number;
  playableNotesCount: number;
  activeTool: string;
  setActiveTool: (tool: string) => void;
  timeSelection: { start: number; end: number } | null;
  onOpenTimeSpaceModal: () => void;
  onOpenTimeBpmModal: () => void;
  onOpenTimeStopModal: () => void;
  onOpenTimeAutoPlaceModal: () => void;
}

export const LeftSidebar = ({
  handleNew,
  handleOpen,
  handleSave,
  handleSaveAs,
  handleOpenDiff,
  isDirty,
  hasBmsData,
  totalNotesCount,
  playableNotesCount,
  activeTool,
  setActiveTool,
  timeSelection,
  onOpenTimeSpaceModal,
  onOpenTimeBpmModal,
  onOpenTimeStopModal,
  onOpenTimeAutoPlaceModal
}: LeftSidebarProps) => {
  const { 
    startPlay, 
    pausePlay, 
    stopPlay, 
    audioProgress, 
    audioBuffers,
    settings,
    lockVerticalPosition,
    setLockVerticalPosition,
    playbackSpeed,
    setPlaybackSpeed
  } = useEditorStore();

  const lang = settings.language || 'en';
  const t = translations[lang] || translations.en;

  const getPlayBtnTexts = () => {
    if (lang === 'ko') {
      return { start: '처음 (F5)', cur: '현재 (F6)', pause: '일시정지 (F7)', stop: '정지 (F8)' };
    }
    if (lang === 'ja') {
      return { start: '最初 (F5)', cur: '現在 (F6)', pause: '一時停止 (F7)', stop: '停止 (F8)' };
    }
    return { start: 'Start (F5)', cur: 'Cur (F6)', pause: 'Pause (F7)', stop: 'Stop (F8)' };
  };

  const getPlayTooltips = () => {
    if (lang === 'ko') {
      return { start: '처음부터 재생', cur: '현재 마디부터 재생', pause: '일시정지', stop: '정지' };
    }
    if (lang === 'ja') {
      return { start: '最初から再生', cur: '現在の小節から再生', pause: '一時停止', stop: '停止' };
    }
    return { start: 'Play from start', cur: 'Play from current measure', pause: 'Pause', stop: 'Stop' };
  };

  const playBtnTexts = getPlayBtnTexts();
  const playTooltips = getPlayTooltips();
  const isLoading = audioProgress !== null;

  const sidebarBtnStyle: React.CSSProperties = {
    height: '38px',
    fontSize: '0.78rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '0 8px',
    cursor: 'pointer',
    width: '100%',
    boxSizing: 'border-box'
  };

  return (
    <aside className="sidebar">
      {/* 1. 기능 */}
      <div>
        <div className="panel-title">{t.actions}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '20px' }}>
          <button 
            className="tool-button" 
            style={sidebarBtnStyle}
            onClick={(e) => {
              (e.currentTarget as HTMLElement)?.blur();
              handleNew();
            }}
            title={t.new}
          >
            <FilePlus size={14} />
            <span style={{ whiteSpace: 'nowrap' }}>{t.new}</span>
          </button>
          
          <button 
            className="tool-button" 
            style={sidebarBtnStyle}
            onClick={(e) => {
              (e.currentTarget as HTMLElement)?.blur();
              handleOpen();
            }}
            title={t.openFile}
          >
            <FolderOpen size={14} />
            <span style={{ whiteSpace: 'nowrap' }}>{t.openFile}</span>
          </button>

          <button 
            className={`tool-button ${!isDirty || !hasBmsData ? 'disabled' : ''}`} 
            style={{ 
              ...sidebarBtnStyle,
              opacity: (!isDirty || !hasBmsData) ? 0.5 : 1,
              cursor: (!isDirty || !hasBmsData) ? 'not-allowed' : 'pointer'
            }}
            disabled={!isDirty || !hasBmsData}
            onClick={(e) => {
              if (!isDirty || !hasBmsData) return;
              (e.currentTarget as HTMLElement)?.blur();
              handleSave();
            }}
            title={t.save}
          >
            <Save size={14} />
            <span style={{ whiteSpace: 'nowrap' }}>{t.save}</span>
          </button>

          <button 
            className={`tool-button ${!hasBmsData ? 'disabled' : ''}`} 
            style={{ 
              ...sidebarBtnStyle,
              opacity: !hasBmsData ? 0.5 : 1,
              cursor: !hasBmsData ? 'not-allowed' : 'pointer'
            }}
            disabled={!hasBmsData}
            onClick={(e) => {
              if (!hasBmsData) return;
              (e.currentTarget as HTMLElement)?.blur();
              handleSaveAs();
            }}
            title={t.saveAs}
          >
            <Download size={14} />
            <span style={{ whiteSpace: 'nowrap' }}>{t.saveAs}</span>
          </button>
        </div>
      </div>

      {/* 2. 도구 */}
      <div>
        <div className="panel-title">{t.tools}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
          <button 
            className={`tool-button ${activeTool === 'time' ? 'active' : ''}`}
            style={sidebarBtnStyle}
            onClick={() => setActiveTool('time')}
          >
            <Clock size={14} /> <span style={{ whiteSpace: 'nowrap' }}>{t.timeTool}</span>
          </button>
          <button 
            className={`tool-button ${activeTool === 'select' ? 'active' : ''}`}
            style={sidebarBtnStyle}
            onClick={() => setActiveTool('select')}
          >
            <MousePointer2 size={14} /> <span style={{ whiteSpace: 'nowrap' }}>{t.selectTool}</span>
          </button>
          <button 
            className={`tool-button ${activeTool === 'write' ? 'active' : ''}`}
            style={sidebarBtnStyle}
            onClick={() => setActiveTool('write')}
          >
            <Pencil size={14} /> <span style={{ whiteSpace: 'nowrap' }}>{t.writeTool}</span>
          </button>
        </div>
      </div>

      {/* 3. 수직위치 고정 */}
      <div style={{ marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid var(--glass-border)' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.8rem', userSelect: 'none', color: 'var(--text-primary)' }}>
          <input 
            type="checkbox" 
            checked={lockVerticalPosition} 
            onChange={(e) => setLockVerticalPosition(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          <span style={{ fontWeight: '500' }}>{lang === 'ko' ? '수직 위치 고정' : lang === 'ja' ? '垂直位置の固定' : 'Lock Vertical Position'}</span>
        </label>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '4px', paddingLeft: '22px', lineHeight: '1.3' }}>
          {lang === 'ko' ? '체크 시 키보드 상하 이동 및 마우스 상하 드래그가 고정됩니다.' : lang === 'ja' ? 'チェックすると、キーボードでの上下移動およびマウスでの上下ドラッグが固定されます。' : 'Disables vertical keyboard and mouse movement.'}
        </div>
      </div>

      {/* 3.5. 시간편집 제어 */}
      {activeTool === 'time' && (
        <div style={{ marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid var(--glass-border)' }}>
          <div className="panel-title">
            {lang === 'ko' ? '시간편집 제어' : lang === 'ja' ? '時間編集制御' : 'Time Edit Controls'}
          </div>
          
          {/* 선택 구간 안내 */}
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            padding: '10px',
            marginBottom: '12px',
            fontSize: '0.75rem',
            lineHeight: '1.4',
            color: timeSelection ? 'var(--text-primary)' : 'var(--text-secondary)'
          }}>
            {timeSelection ? (
              <>
                <div style={{ fontWeight: '600', color: 'var(--accent-color)', marginBottom: '2px' }}>
                  {lang === 'ko' ? '선택 완료' : lang === 'ja' ? '選択完了' : 'Range Selected'}
                </div>
                <div>
                  {lang === 'ko' ? `구간: ${timeSelection.start.toFixed(3)} ~ ${timeSelection.end.toFixed(3)}마디` : 
                   lang === 'ja' ? `範囲: ${timeSelection.start.toFixed(3)} ～ ${timeSelection.end.toFixed(3)}小節` : 
                   `Range: ${timeSelection.start.toFixed(3)} ~ ${timeSelection.end.toFixed(3)}`}
                </div>
                <div style={{ fontWeight: '500' }}>
                  {lang === 'ko' ? `길이: ${(timeSelection.end - timeSelection.start).toFixed(3)}마디` : 
                   lang === 'ja' ? `長さ: ${(timeSelection.end - timeSelection.start).toFixed(3)}小節` : 
                   `Length: ${(timeSelection.end - timeSelection.start).toFixed(3)} meas`}
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '4px 0' }}>
                {lang === 'ko' ? '타임라인을 마우스 드래그하여 범위를 지정해 주세요.' : 
                 lang === 'ja' ? 'タイムラインをドラッグして範囲を選択してください。' : 
                 'Drag on the timeline to select a range.'}
              </div>
            )}
          </div>

          {/* 작업 버튼 3종 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              className={`tool-button ${!timeSelection ? 'disabled' : ''}`}
              style={{
                ...sidebarBtnStyle,
                opacity: !timeSelection ? 0.5 : 1,
                cursor: !timeSelection ? 'not-allowed' : 'pointer'
              }}
              disabled={!timeSelection}
              onClick={onOpenTimeSpaceModal}
            >
              <Clock size={13} />
              <span style={{ whiteSpace: 'nowrap' }}>
                {lang === 'ko' ? '공간 삽입 / 삭제' : lang === 'ja' ? '空白の挿入・削除' : 'Insert / Remove Space'}
              </span>
            </button>

            <button
              className={`tool-button ${!timeSelection ? 'disabled' : ''}`}
              style={{
                ...sidebarBtnStyle,
                opacity: !timeSelection ? 0.5 : 1,
                cursor: !timeSelection ? 'not-allowed' : 'pointer'
              }}
              disabled={!timeSelection}
              onClick={onOpenTimeBpmModal}
            >
              <Clock size={13} />
              <span style={{ whiteSpace: 'nowrap' }}>
                {lang === 'ko' ? 'BPM 일괄 변경' : lang === 'ja' ? 'BPM一括変更' : 'BPM Changer'}
              </span>
            </button>

            <button
              className={`tool-button ${!timeSelection ? 'disabled' : ''}`}
              style={{
                ...sidebarBtnStyle,
                opacity: !timeSelection ? 0.5 : 1,
                cursor: !timeSelection ? 'not-allowed' : 'pointer'
              }}
              disabled={!timeSelection}
              onClick={onOpenTimeStopModal}
            >
              <Clock size={13} />
              <span style={{ whiteSpace: 'nowrap' }}>
                {lang === 'ko' ? 'STOP 구간 추가' : lang === 'ja' ? 'STOP区間の追加' : 'Add STOP Area'}
              </span>
            </button>
            <button
              className={`tool-button ${!timeSelection ? 'disabled' : ''}`}
              style={{
                ...sidebarBtnStyle,
                opacity: !timeSelection ? 0.5 : 1,
                cursor: !timeSelection ? 'not-allowed' : 'pointer'
              }}
              disabled={!timeSelection}
              onClick={onOpenTimeAutoPlaceModal}
            >
              <Clock size={13} />
              <span style={{ whiteSpace: 'nowrap' }}>
                {lang === 'ko' ? '노트 자동 배치' : lang === 'ja' ? 'ノーツ自動配置' : 'Auto Place Notes'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* 4. 재생 */}
      {hasBmsData && (
        <div style={{ marginBottom: '20px' }}>
          <div className="panel-title">{t.playback}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
            <button 
              className={`tool-button ${isLoading ? 'disabled' : ''}`} 
              style={{ ...sidebarBtnStyle, opacity: isLoading ? 0.5 : 1, cursor: isLoading ? 'not-allowed' : 'pointer' }}
              title={playTooltips.start}
              disabled={isLoading}
              onClick={(e) => {
                if (isLoading) return;
                e.preventDefault();
                e.stopPropagation();
                (e.currentTarget as HTMLElement)?.blur();
                const actx = getAudioContext();
                if (actx.state === 'suspended') actx.resume().catch(err => console.error(err));
                startPlay(true);
              }}
            >
              <PlayCircle size={14} /> <span style={{ whiteSpace: 'nowrap' }}>{playBtnTexts.start}</span>
            </button>
            <button 
              className={`tool-button ${isLoading ? 'disabled' : ''}`} 
              style={{ ...sidebarBtnStyle, opacity: isLoading ? 0.5 : 1, cursor: isLoading ? 'not-allowed' : 'pointer' }}
              title={playTooltips.cur}
              disabled={isLoading}
              onClick={(e) => {
                if (isLoading) return;
                e.preventDefault();
                e.stopPropagation();
                (e.currentTarget as HTMLElement)?.blur();
                const actx = getAudioContext();
                if (actx.state === 'suspended') actx.resume().catch(err => console.error(err));
                startPlay(false);
              }}
            >
              <Play size={14} /> <span style={{ whiteSpace: 'nowrap' }}>{playBtnTexts.cur}</span>
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button 
              className={`tool-button ${isLoading ? 'disabled' : ''}`} 
              style={{ ...sidebarBtnStyle, opacity: isLoading ? 0.5 : 1, cursor: isLoading ? 'not-allowed' : 'pointer' }}
              title={playTooltips.pause}
              disabled={isLoading}
              onClick={(e) => {
                if (isLoading) return;
                e.preventDefault();
                e.stopPropagation();
                (e.currentTarget as HTMLElement)?.blur();
                pausePlay();
              }}
            >
              <Pause size={14} /> <span style={{ whiteSpace: 'nowrap' }}>{playBtnTexts.pause}</span>
            </button>
            <button 
              className={`tool-button ${isLoading ? 'disabled' : ''}`} 
              style={{ ...sidebarBtnStyle, opacity: isLoading ? 0.5 : 1, cursor: isLoading ? 'not-allowed' : 'pointer' }}
              title={playTooltips.stop}
              disabled={isLoading}
              onClick={(e) => {
                if (isLoading) return;
                e.preventDefault();
                e.stopPropagation();
                (e.currentTarget as HTMLElement)?.blur();
                stopPlay();
              }}
            >
              <Square size={12} /> <span style={{ whiteSpace: 'nowrap' }}>{playBtnTexts.stop}</span>
            </button>
          </div>
          
          {/* 재생 속도 조절 슬라이더 */}
          <div style={{ marginTop: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              <span>{lang === 'ko' ? '재생 속도' : lang === 'ja' ? '再生速度' : 'Playback Speed'}</span>
              <span style={{ fontWeight: 'bold', color: 'var(--accent-color)' }}>{playbackSpeed.toFixed(2)}x</span>
            </div>
            <input 
              type="range" 
              min="0.25" 
              max="2.0" 
              step="0.05" 
              value={playbackSpeed} 
              disabled={isLoading}
              onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
              style={{ width: '100%', cursor: isLoading ? 'not-allowed' : 'pointer' }}
            />
          </div>
        </div>
      )}

      {/* 5. 검사 */}
      {hasBmsData && (
        <div style={{ marginBottom: '20px' }}>
          <div className="panel-title">{lang === 'ko' ? '검사' : lang === 'ja' ? '検査' : 'BMS Diff'}</div>
          <button 
            className="tool-button" 
            style={sidebarBtnStyle}
            onClick={(e) => {
              (e.currentTarget as HTMLElement)?.blur();
              handleOpenDiff();
            }}
          >
            <Scale size={14} style={{ color: 'var(--accent-color)' }} />
            <span style={{ whiteSpace: 'nowrap' }}>{lang === 'ko' ? '엇갈림 검사' : lang === 'ja' ? 'ズレ検出' : 'Misalignment Diff'}</span>
          </button>
        </div>
      )}

      {/* 6. 노트정보 */}
      {hasBmsData && (
        <div style={{ marginBottom: '20px' }}>
          <div className="panel-title">{t.stats}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '0 5px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>{t.totalNotes}</span>
              <span>{totalNotesCount}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>{t.playableNotes}</span>
              <span>{playableNotesCount}</span>
            </div>
          </div>
        </div>
      )}

      {/* 7. 키음 로딩 상태 */}
      {hasBmsData && (
        <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid var(--glass-border)' }}>
          <div className="panel-title" style={{ marginBottom: '5px', fontSize: '0.75rem' }}>{t.keysoundStatus}</div>
          {audioProgress && (
            <div style={{ fontSize: '0.75rem', color: 'var(--accent-color)', wordBreak: 'break-all' }}>
              {t.loadingSounds.replace('{loaded}', String(audioProgress.loaded)).replace('{total}', String(audioProgress.total)).replace('({name})', '').trim()}
              <div style={{ opacity: 0.8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {audioProgress.name}
              </div>
            </div>
          )}
          
          {!audioProgress && Object.keys(audioBuffers).length > 0 && (
            <div style={{ fontSize: '0.75rem', color: '#22c55e' }}>
              {t.loadingComplete.replace('{count}', String(Object.keys(audioBuffers).length))}
            </div>
          )}

          {!audioProgress && Object.keys(audioBuffers).length === 0 && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {t.noSounds}
            </div>
          )}
        </div>
      )}
    </aside>
  );
};
