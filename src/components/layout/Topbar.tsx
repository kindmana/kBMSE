import { Settings2 } from 'lucide-react';
import { RecentFile } from '../../utils/fileSystem';

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
  handleToggleMode: () => void;
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
  handleToggleMode
}: TopbarProps) => {
  return (
    <header className="topbar">
      <div className="topbar-logo">kBMSE</div>
      <div className="topbar-menu">
        <div style={{ position: 'relative' }}>
          <div className={`menu-item ${isFileMenuOpen ? 'active' : ''}`} onClick={() => setIsFileMenuOpen(!isFileMenuOpen)}>File</div>
          {isFileMenuOpen && (
            <div className="dropdown-menu">
              <div className="dropdown-item" onClick={handleNew}>새로 만들기 (New)</div>
              <div className="dropdown-item" onClick={handleOpen}>열기 (Open)</div>
              <div className={`dropdown-item ${!isDirty || !hasBmsData ? 'disabled' : ''}`} onClick={handleSave}>저장 (Save)</div>
              <div className={`dropdown-item ${!hasBmsData ? 'disabled' : ''}`} onClick={handleSaveAs}>다른 이름으로 저장 (Save As)</div>
              {recentFiles.length > 0 && <div className="dropdown-divider"></div>}
              {recentFiles.map(r => (
                <div key={r.id} className="dropdown-item" onClick={() => handleRecentClick(r.id)}>{r.name}</div>
              ))}
              <div className="dropdown-divider"></div>
              <div className="dropdown-item" onClick={handleExit}>종료 (Exit)</div>
            </div>
          )}
        </div>
        <div className="menu-item">Edit</div>
        <div className="menu-item">View</div>
        <div className="menu-item">Play</div>
        <div className="menu-item">Help</div>
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          Mode: {useBase62 ? '62-Base' : '36-Base'}
        </span>
        <button 
          onClick={handleToggleMode}
          style={{ 
            background: 'transparent', 
            border: '1px solid var(--border-color)', 
            color: 'var(--text-primary)',
            borderRadius: '4px',
            padding: '4px 8px',
            cursor: 'pointer',
            fontSize: '0.8rem',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          <Settings2 size={14} /> Toggle
        </button>
      </div>
    </header>
  );
};
