import { useState, useEffect, useRef } from 'react';
import { RecentFile } from '../../utils/fileSystem';
import { useEditorStore } from '../../store/editorStore';
import { getAudioContext } from '../../utils/audioPlayer';
import { translations } from '../../constants/translations';
import { HIDDEN_LANES, KeyMode } from '../../constants/layout';

interface TopbarProps {
  isFileMenuOpen: boolean;
  setIsFileMenuOpen: (open: boolean) => void;
  handleNew: () => void;
  handleOpen: () => void;
  handleSave: () => void;
  handleSaveAs: () => void;
  handleRecentClick: (id: string) => void;
  handleExit: () => void;
  isDirty: boolean;
  hasBmsData: boolean;
  recentFiles: RecentFile[];
  useBase62: boolean;
  
  // Edit Handlers
  handleUndo: () => void;
  handleRedo: () => void;
  handleCut: () => void;
  handleCopy: () => void;
  handlePaste: () => void;
  handleDelete: () => void;
  handleSelectAll: () => void;
  handleGoToMeasure: () => void;
  handleOpenSettings: (tab: 'general' | 'visual') => void;
  handleOpenHelp: (tab?: 'shortcuts' | 'leftSidebar' | 'rightSidebar' | 'settings') => void;
}

export const Topbar = ({
  isFileMenuOpen,
  setIsFileMenuOpen,
  handleNew,
  handleOpen,
  handleSave,
  handleSaveAs,
  handleRecentClick,
  handleExit,
  isDirty,
  hasBmsData,
  recentFiles,
  useBase62,
  handleUndo,
  handleRedo,
  handleCut,
  handleCopy,
  handlePaste,
  handleDelete,
  handleSelectAll,
  handleGoToMeasure,
  handleOpenSettings,
  handleOpenHelp
}: TopbarProps) => {
  const [isEditMenuOpen, setIsEditMenuOpen] = useState(false);
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);
  const [isPlayMenuOpen, setIsPlayMenuOpen] = useState(false);
  const [isSettingMenuOpen, setIsSettingMenuOpen] = useState(false);
  const [isKeyMenuOpen, setIsKeyMenuOpen] = useState(false);
  const [isHelpMenuOpen, setIsHelpMenuOpen] = useState(false);
  
  const { 
    viewSettings, 
    toggleViewSetting, 
    startPlay, 
    pausePlay, 
    stopPlay, 
    settings,
    keyMode,
    setKeyMode,
    migrateNotesForKeyMode,
    bmsData,
    updateHeader
  } = useEditorStore();
  const topbarRef = useRef<HTMLDivElement>(null);

  const closeAllMenus = () => {
    setIsFileMenuOpen(false);
    setIsEditMenuOpen(false);
    setIsViewMenuOpen(false);
    setIsPlayMenuOpen(false);
    setIsSettingMenuOpen(false);
    setIsKeyMenuOpen(false);
    setIsHelpMenuOpen(false);
  };

  const handleMenuClick = (menu: 'file' | 'edit' | 'view' | 'play' | 'setting' | 'key' | 'help') => {
    if (menu === 'file') {
      const targetState = !isFileMenuOpen;
      closeAllMenus();
      setIsFileMenuOpen(targetState);
    } else if (menu === 'edit') {
      const targetState = !isEditMenuOpen;
      closeAllMenus();
      setIsEditMenuOpen(targetState);
    } else if (menu === 'view') {
      const targetState = !isViewMenuOpen;
      closeAllMenus();
      setIsViewMenuOpen(targetState);
    } else if (menu === 'play') {
      const targetState = !isPlayMenuOpen;
      closeAllMenus();
      setIsPlayMenuOpen(targetState);
    } else if (menu === 'setting') {
      const targetState = !isSettingMenuOpen;
      closeAllMenus();
      setIsSettingMenuOpen(targetState);
    } else if (menu === 'key') {
      const targetState = !isKeyMenuOpen;
      closeAllMenus();
      setIsKeyMenuOpen(targetState);
    } else if (menu === 'help') {
      const targetState = !isHelpMenuOpen;
      closeAllMenus();
      setIsHelpMenuOpen(targetState);
    }
  };

  const lang = settings.language || 'en';
  const t = translations[lang] || translations.en;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (topbarRef.current && !topbarRef.current.contains(event.target as Node)) {
        setIsFileMenuOpen(false);
        setIsEditMenuOpen(false);
        setIsViewMenuOpen(false);
        setIsPlayMenuOpen(false);
        setIsSettingMenuOpen(false);
        setIsKeyMenuOpen(false);
        setIsHelpMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [setIsFileMenuOpen]);

  const handleKeyModeChange = (nextMode: KeyMode) => {
    setIsKeyMenuOpen(false);
    if (keyMode === nextMode) return;

    if (!bmsData) {
      setKeyMode(nextMode);
      return;
    }

    let player = bmsData.header.player || 1;
    const isNineOrMore = nextMode === '14K2S' || nextMode === '9K' || nextMode === '10K' || nextMode === '10K2S';
    const isSingleOnlyMode = nextMode === '7K1S' || nextMode === '4K' || nextMode === '5K' || nextMode === '5K1S' || nextMode === '6K' || nextMode === '8K';
    
    // Auto upgrade to double play (#PLAYER 3) if 9K or above is selected in single player mode
    if (isNineOrMore && player === 1) {
      player = 3;
      updateHeader({ player: 3 });
    }
    // Auto downgrade to single play (#PLAYER 1) if single-only mode is selected in double player mode
    else if (isSingleOnlyMode && player === 3) {
      player = 1;
      updateHeader({ player: 1 });
    }

    const p1Lanes = ['S1', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7'];
    const p2Lanes = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'S2'];
    const activeLanes = player === 1 ? p1Lanes : [...p1Lanes, ...p2Lanes];

    // 새 모드에서 가려지게 되는 레인들
    const hiddenInNext = HIDDEN_LANES[nextMode] || [];
    const actualHidden = hiddenInNext.filter(lane => activeLanes.includes(lane));

    // 이 가려지는 레인들의 채널 번호들
    const laneChannelMap: Record<string, number> = {
      'S1': 0x16, 'A1': 0x11, 'A2': 0x12, 'A3': 0x13, 'A4': 0x14, 'A5': 0x15, 'A6': 0x18, 'A7': 0x19,
      'D1': 0x21, 'D2': 0x22, 'D3': 0x23, 'D4': 0x24, 'D5': 0x25, 'D6': 0x28, 'D7': 0x29, 'S2': 0x26
    };
    
    const hiddenChannels = actualHidden.map(lane => laneChannelMap[lane]).filter(Boolean);

    const getBaseChannel = (channel: number): number => {
      if (channel >= 0x51 && channel <= 0x59) return channel - 0x40;
      if (channel >= 0x61 && channel <= 0x69) return channel - 0x40;
      if (channel >= 0x31 && channel <= 0x39) return channel - 0x20;
      if (channel >= 0x41 && channel <= 0x49) return channel - 0x20;
      if (channel >= 0xD1 && channel <= 0xD9) return channel - 0xC0;
      if (channel >= 0xE1 && channel <= 0xE9) return channel - 0xC0;
      return channel;
    };

    // 이 가려진 채널에 노트가 하나라도 올려져 있는지 검사합니다
    const hasNotesInHidden = bmsData.notes.some(note => {
      const baseChan = getBaseChannel(note.channel);
      return hiddenChannels.includes(baseChan);
    });

    if (hasNotesInHidden) {
      const confirmMsg = t.confirmKeyModeMigration;
      if (window.confirm(confirmMsg)) {
        migrateNotesForKeyMode(keyMode, nextMode);
        setKeyMode(nextMode);
      }
    } else {
      setKeyMode(nextMode);
    }
  };

  return (
    <header className="topbar" ref={topbarRef}>
      <div className="topbar-logo">kBMSE</div>
      <div className="topbar-menu">
        {/* File Menu */}
        <div style={{ position: 'relative' }}>
          <div className={`menu-item ${isFileMenuOpen ? 'active' : ''}`} onClick={() => handleMenuClick('file')}>
            {t.file}
          </div>
          {isFileMenuOpen && (
            <div className="dropdown-menu">
              <div className="dropdown-item" onClick={handleNew}>{t.new}</div>
              <div className="dropdown-item" onClick={handleOpen}>{t.openFile}</div>
              <div className={`dropdown-item ${!isDirty || !hasBmsData ? 'disabled' : ''}`} onClick={handleSave}>{t.save}</div>
              <div className={`dropdown-item ${!hasBmsData ? 'disabled' : ''}`} onClick={handleSaveAs}>{t.saveAs}</div>
              {recentFiles.length > 0 && <div className="dropdown-divider"></div>}
              {recentFiles.map(r => (
                <div key={r.id} className="dropdown-item" onClick={() => handleRecentClick(r.id)}>{r.name}</div>
              ))}
              <div className="dropdown-divider"></div>
              <div className="dropdown-item" onClick={handleExit}>{t.exit}</div>
            </div>
          )}
        </div>

        {/* Edit Menu */}
        <div style={{ position: 'relative' }}>
          <div className={`menu-item ${isEditMenuOpen ? 'active' : ''}`} onClick={() => handleMenuClick('edit')}>
            {t.edit}
          </div>
          {isEditMenuOpen && (
            <div className="dropdown-menu">
              <div className="dropdown-item" onClick={() => { handleUndo(); setIsEditMenuOpen(false); }}>
                {t.undo} <span style={{ float: 'right', opacity: 0.5 }}>Ctrl+Z</span>
              </div>
              <div className="dropdown-item" onClick={() => { handleRedo(); setIsEditMenuOpen(false); }}>
                {t.redo} <span style={{ float: 'right', opacity: 0.5 }}>Ctrl+Y</span>
              </div>
              <div className="dropdown-divider"></div>
              <div className="dropdown-item" onClick={() => { handleCut(); setIsEditMenuOpen(false); }}>
                {t.cut} <span style={{ float: 'right', opacity: 0.5 }}>Ctrl+X</span>
              </div>
              <div className="dropdown-item" onClick={() => { handleCopy(); setIsEditMenuOpen(false); }}>
                {t.copy} <span style={{ float: 'right', opacity: 0.5 }}>Ctrl+C</span>
              </div>
              <div className="dropdown-item" onClick={() => { handlePaste(); setIsEditMenuOpen(false); }}>
                {t.paste} <span style={{ float: 'right', opacity: 0.5 }}>Ctrl+V</span>
              </div>
              <div className="dropdown-item" onClick={() => { handleDelete(); setIsEditMenuOpen(false); }}>
                {t.delete} <span style={{ float: 'right', opacity: 0.5 }}>Del</span>
              </div>
              <div className="dropdown-divider"></div>
              <div className="dropdown-item" onClick={() => { handleSelectAll(); setIsEditMenuOpen(false); }}>
                {t.selectAll} <span style={{ float: 'right', opacity: 0.5 }}>Ctrl+A</span>
              </div>
              <div className="dropdown-item" onClick={() => { handleGoToMeasure(); setIsEditMenuOpen(false); }}>
                {t.goToMeasure} <span style={{ float: 'right', opacity: 0.5 }}>Ctrl+G</span>
              </div>
            </div>
          )}
        </div>

        {/* View Menu */}
        <div style={{ position: 'relative' }}>
          <div className={`menu-item ${isViewMenuOpen ? 'active' : ''}`} onClick={() => handleMenuClick('view')}>
            {t.view}
          </div>
          {isViewMenuOpen && (
            <div className="dropdown-menu" style={{ width: '240px' }}>
              <div className="dropdown-item" onClick={() => toggleViewSetting('showLeftSidebar')}>
                <span style={{ display: 'inline-block', width: '20px' }}>{viewSettings.showLeftSidebar ? '✓' : ''}</span>
                {t.leftSidebar}
              </div>
              <div className="dropdown-item" onClick={() => toggleViewSetting('showRightSidebar')}>
                <span style={{ display: 'inline-block', width: '20px' }}>{viewSettings.showRightSidebar ? '✓' : ''}</span>
                {t.rightSidebar}
              </div>
              <div className="dropdown-divider"></div>
              <div className="dropdown-item" onClick={() => toggleViewSetting('showGrid')}>
                <span style={{ display: 'inline-block', width: '20px' }}>{viewSettings.showGrid ? '✓' : ''}</span>
                {t.grid}
              </div>
              <div className="dropdown-item" onClick={() => toggleViewSetting('showAuxGrid')}>
                <span style={{ display: 'inline-block', width: '20px' }}>{viewSettings.showAuxGrid ? '✓' : ''}</span>
                {t.auxGrid}
              </div>
              <div className="dropdown-item" onClick={() => toggleViewSetting('showMeasureLine')}>
                <span style={{ display: 'inline-block', width: '20px' }}>{viewSettings.showMeasureLine ? '✓' : ''}</span>
                {t.measureLine}
              </div>
              <div className="dropdown-item" onClick={() => toggleViewSetting('showMeasureNumber')}>
                <span style={{ display: 'inline-block', width: '20px' }}>{viewSettings.showMeasureNumber ? '✓' : ''}</span>
                {t.measureNumber}
              </div>
              <div className="dropdown-item" onClick={() => toggleViewSetting('showVerticalLine')}>
                <span style={{ display: 'inline-block', width: '20px' }}>{viewSettings.showVerticalLine ? '✓' : ''}</span>
                {t.verticalLine}
              </div>
              <div className="dropdown-item" onClick={() => toggleViewSetting('showColumnHeader')}>
                <span style={{ display: 'inline-block', width: '20px' }}>{viewSettings.showColumnHeader ? '✓' : ''}</span>
                {t.laneHeader}
              </div>
              <div className="dropdown-divider"></div>
              <div className="dropdown-item" onClick={() => toggleViewSetting('showBpm')}>
                <span style={{ display: 'inline-block', width: '20px' }}>{viewSettings.showBpm ? '✓' : ''}</span>
                {t.bpm}
              </div>
              <div className="dropdown-item" onClick={() => toggleViewSetting('showStop')}>
                <span style={{ display: 'inline-block', width: '20px' }}>{viewSettings.showStop ? '✓' : ''}</span>
                {t.stop}
              </div>
              <div className="dropdown-item" onClick={() => toggleViewSetting('showScroll')}>
                <span style={{ display: 'inline-block', width: '20px' }}>{viewSettings.showScroll ? '✓' : ''}</span>
                {t.scroll}
              </div>
              <div className="dropdown-item" onClick={() => toggleViewSetting('showBga')}>
                <span style={{ display: 'inline-block', width: '20px' }}>{viewSettings.showBga ? '✓' : ''}</span>
                {t.bga}
              </div>
            </div>
          )}
        </div>

        {/* Play Menu */}
        <div style={{ position: 'relative' }}>
          <div className={`menu-item ${isPlayMenuOpen ? 'active' : ''}`} onClick={() => handleMenuClick('play')}>
            {t.play}
          </div>
          {isPlayMenuOpen && (
            <div className="dropdown-menu" style={{ width: '220px' }}>
              <div className="dropdown-item" onClick={(e) => { 
                e.preventDefault();
                e.stopPropagation();
                const actx = getAudioContext();
                if (actx.state === 'suspended') actx.resume().catch(err => console.error(err));
                startPlay(true); 
                setIsPlayMenuOpen(false); 
              }}>
                {t.playBeginning} <span style={{ float: 'right', opacity: 0.5 }}>F5</span>
              </div>
              <div className="dropdown-item" onClick={(e) => { 
                e.preventDefault();
                e.stopPropagation();
                const actx = getAudioContext();
                if (actx.state === 'suspended') actx.resume().catch(err => console.error(err));
                startPlay(false); 
                setIsPlayMenuOpen(false); 
              }}>
                {t.playCurrent} <span style={{ float: 'right', opacity: 0.5 }}>F6</span>
              </div>
              <div className="dropdown-item" onClick={(e) => { 
                e.preventDefault();
                e.stopPropagation();
                pausePlay(); 
                setIsPlayMenuOpen(false); 
              }}>
                {t.pause} <span style={{ float: 'right', opacity: 0.5 }}>F7</span>
              </div>
              <div className="dropdown-item" onClick={(e) => { 
                e.preventDefault();
                e.stopPropagation();
                stopPlay(); 
                setIsPlayMenuOpen(false); 
              }}>
                {t.stopPlay} <span style={{ float: 'right', opacity: 0.5 }}>F8</span>
              </div>
            </div>
          )}
        </div>

        {/* Setting Menu */}
        <div style={{ position: 'relative' }}>
          <div className={`menu-item ${isSettingMenuOpen ? 'active' : ''}`} onClick={() => handleMenuClick('setting')} style={{ cursor: 'pointer' }}>
            {t.setting}
          </div>
          {isSettingMenuOpen && (
            <div className="dropdown-menu">
              <div className="dropdown-item" onClick={() => { handleOpenSettings('general'); setIsSettingMenuOpen(false); }}>
                {t.generalSettings}
              </div>
              <div className="dropdown-item" onClick={() => { handleOpenSettings('visual'); setIsSettingMenuOpen(false); }}>
                {t.visualSettings}
              </div>
            </div>
          )}
        </div>

        {/* Key Mode Menu */}
        <div style={{ position: 'relative' }}>
          <div className={`menu-item ${isKeyMenuOpen ? 'active' : ''}`} onClick={() => handleMenuClick('key')} style={{ cursor: 'pointer' }}>
            {t.keyMode}
          </div>
          {isKeyMenuOpen && (
            <div className="dropdown-menu" style={{ width: '160px' }}>
              {(['7K1S', '14K2S', '4K', '5K', '5K1S', '6K', '8K', '9K', '10K', '10K2S'] as const).map((mode) => (
                <div 
                  key={mode} 
                  className={`dropdown-item ${keyMode === mode ? 'active' : ''}`}
                  onClick={() => handleKeyModeChange(mode)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <span>{mode === '9K' ? '9K (PMS)' : mode}</span>
                  {keyMode === mode && <span style={{ marginLeft: '10px', fontSize: '0.8rem' }}>✓</span>}
                </div>
              ))}
            </div>
          )}
        </div>
        {/* Help Menu */}
        <div style={{ position: 'relative' }}>
          <div className={`menu-item ${isHelpMenuOpen ? 'active' : ''}`} onClick={() => handleMenuClick('help')} style={{ cursor: 'pointer' }}>
            {t.help}
          </div>
          {isHelpMenuOpen && (
            <div className="dropdown-menu" style={{ width: '220px' }}>
              <div className="dropdown-item" onClick={() => { handleOpenHelp('shortcuts'); setIsHelpMenuOpen(false); }}>
                {lang === 'ko' ? '단축키 & 조작' : lang === 'ja' ? 'ショートカット＆操作' : 'Hotkeys & Control'}
              </div>
              <div className="dropdown-item" onClick={() => { handleOpenHelp('leftSidebar'); setIsHelpMenuOpen(false); }}>
                {lang === 'ko' ? '왼쪽 패널 (파일)' : lang === 'ja' ? '左パネル（ファイル）' : 'Left Sidebar (File)'}
              </div>
              <div className="dropdown-item" onClick={() => { handleOpenHelp('rightSidebar'); setIsHelpMenuOpen(false); }}>
                {lang === 'ko' ? '오른쪽 패널 (설정)' : lang === 'ja' ? '右パネル（設定）' : 'Right Sidebar (Settings)'}
              </div>
              <div className="dropdown-item" onClick={() => { handleOpenHelp('settings'); setIsHelpMenuOpen(false); }}>
                {lang === 'ko' ? '상단 바 (Topbar)' : lang === 'ja' ? '上部バー（Topbar）' : 'Topbar Controls'}
              </div>
            </div>
          )}
        </div>
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px', paddingRight: '12px' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
          {t.mode}: {useBase62 ? '62-Base' : '36-Base'}
        </span>
      </div>
    </header>
  );
};
