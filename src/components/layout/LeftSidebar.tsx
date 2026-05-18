import { FolderOpen, Save, MousePointer2, Pencil, Eraser } from 'lucide-react';

interface LeftSidebarProps {
  handleOpen: () => void;
  handleSave: () => void;
  isDirty: boolean;
  hasBmsData: boolean;
  totalNotesCount: number;
  playableNotesCount: number;
  activeTool: string;
  setActiveTool: (tool: string) => void;
}

export const LeftSidebar = ({
  handleOpen,
  handleSave,
  isDirty,
  hasBmsData,
  totalNotesCount,
  playableNotesCount,
  activeTool,
  setActiveTool
}: LeftSidebarProps) => {
  return (
    <aside className="sidebar">
      <div>
        <div className="panel-title">Actions</div>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <button 
            className="tool-button" 
            style={{ flex: 1, justifyContent: 'center' }}
            onClick={handleOpen}
          >
            <FolderOpen size={16} /> Open
          </button>
          <button 
            className={`tool-button ${!isDirty || !hasBmsData ? 'disabled' : ''}`} 
            style={{ flex: 1, justifyContent: 'center', opacity: (!isDirty || !hasBmsData) ? 0.5 : 1, cursor: (!isDirty || !hasBmsData) ? 'not-allowed' : 'pointer' }}
            onClick={handleSave}
          >
            <Save size={16} /> Save
          </button>
        </div>
      </div>

      {hasBmsData && (
        <div style={{ marginBottom: '20px' }}>
          <div className="panel-title">Stats</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '0 5px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Total Notes</span>
              <span>{totalNotesCount}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Playable Notes</span>
              <span>{playableNotesCount}</span>
            </div>
          </div>
        </div>
      )}

      <div>
        <div className="panel-title">Tools</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button 
            className={`tool-button ${activeTool === 'select' ? 'active' : ''}`}
            onClick={() => setActiveTool('select')}
          >
            <MousePointer2 size={16} /> Select
          </button>
          <button 
            className={`tool-button ${activeTool === 'write' ? 'active' : ''}`}
            onClick={() => setActiveTool('write')}
          >
            <Pencil size={16} /> Write
          </button>
          <button 
            className={`tool-button ${activeTool === 'erase' ? 'active' : ''}`}
            onClick={() => setActiveTool('erase')}
          >
            <Eraser size={16} /> Erase
          </button>
        </div>
      </div>
    </aside>
  );
};
