import { useState, useRef } from 'react';
import { FileCode2, ZoomIn, ChevronDown, ChevronRight, Music, Image, Monitor } from 'lucide-react';
import { BmsData, encodeBmsValue } from '../../parser/bmsParser';
import { TextInput, NumberInput, SelectInput, FileInput, LnObjInput } from '../ui/PropertyInputs';
import { useEditorStore } from '../../store/editorStore';

interface RightSidebarProps {
  bmsData: BmsData | null;
  updateHeader: (header: Partial<BmsData['header']>) => void;
  updateWav: (index: number, filename: string) => void;
  updateBmp: (index: number, filename: string) => void;
  useBase62: boolean;
  gridSnap: number;
  setGridSnap: (snap: number) => void;
  zoomX: number;
  setZoomX: (zoom: number) => void;
  zoomY: number;
  setZoomY: (zoom: number) => void;
}

export const RightSidebar = ({
  bmsData,
  updateHeader,
  updateWav,
  updateBmp,
  useBase62,
  gridSnap,
  setGridSnap,
  zoomX,
  setZoomX,
  zoomY,
  setZoomY
}: RightSidebarProps) => {
  const { currentNoteValue, setCurrentNoteValue } = useEditorStore();

  const [openSections, setOpenSections] = useState({
    header: true,
    wavbmp: true,
    display: true
  });

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const [activeTab, setActiveTab] = useState<'wav' | 'bmp'>('wav');

  // Hidden file inputs
  const wavInputRef = useRef<HTMLInputElement>(null);
  const bmpInputRef = useRef<HTMLInputElement>(null);
  const [editingWavIndex, setEditingWavIndex] = useState<number | null>(null);
  const [editingBmpIndex, setEditingBmpIndex] = useState<number | null>(null);

  const handleWavClick = (index: number) => {
    setCurrentNoteValue(index);
  };

  const handleWavDoubleClick = (index: number) => {
    setEditingWavIndex(index);
    if (wavInputRef.current) wavInputRef.current.click();
  };

  const handleWavFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && editingWavIndex !== null) {
      updateWav(editingWavIndex, e.target.files[0].name);
    }
    if (wavInputRef.current) wavInputRef.current.value = '';
    setEditingWavIndex(null);
  };

  const handleBmpClick = (index: number) => {
    setCurrentNoteValue(index);
  };

  const handleBmpDoubleClick = (index: number) => {
    setEditingBmpIndex(index);
    if (bmpInputRef.current) bmpInputRef.current.click();
  };

  const handleBmpFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && editingBmpIndex !== null) {
      updateBmp(editingBmpIndex, e.target.files[0].name);
    }
    if (bmpInputRef.current) bmpInputRef.current.value = '';
    setEditingBmpIndex(null);
  };

  const renderWavBmpList = () => {
    if (!bmsData) return null;
    const itemsCount = useBase62 ? 3843 : 1295;
    const items = [];
    
    const isWav = activeTab === 'wav';
    const dict = isWav ? bmsData.wavs : bmsData.bmps;
    
    for (let i = 1; i <= itemsCount; i++) {
      const hexIndex = encodeBmsValue(i, useBase62);
      const filename = dict[i] || '';
      items.push(
        <div 
          key={i} 
          onClick={() => isWav ? handleWavClick(i) : handleBmpClick(i)}
          onDoubleClick={() => isWav ? handleWavDoubleClick(i) : handleBmpDoubleClick(i)}
          style={{ 
            display: 'flex', 
            borderBottom: '1px solid var(--border-color)', 
            cursor: 'pointer',
            padding: '4px 8px',
            fontSize: '0.8rem',
            alignItems: 'center',
            background: currentNoteValue === i ? 'rgba(255,255,255,0.15)' : (filename ? 'rgba(255,255,255,0.02)' : 'transparent')
          }}
          onMouseEnter={(e) => { if (currentNoteValue !== i) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
          onMouseLeave={(e) => { if (currentNoteValue !== i) e.currentTarget.style.background = filename ? 'rgba(255,255,255,0.02)' : 'transparent' }}
          className="list-item-hover"
        >
          <span style={{ width: '30px', color: 'var(--text-secondary)' }}>{hexIndex}</span>
          <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: filename ? 'var(--text-primary)' : 'rgba(255,255,255,0.2)' }}>
            {filename || '(empty)'}
          </span>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '250px' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
          <button 
            style={{ flex: 1, padding: '5px', background: isWav ? 'var(--bg-secondary)' : 'transparent', color: isWav ? 'var(--text-primary)' : 'var(--text-secondary)', border: 'none', cursor: 'pointer', fontSize: '0.85rem' }}
            onClick={() => setActiveTab('wav')}
          >
            <Music size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> WAV
          </button>
          <button 
            style={{ flex: 1, padding: '5px', background: !isWav ? 'var(--bg-secondary)' : 'transparent', color: !isWav ? 'var(--text-primary)' : 'var(--text-secondary)', border: 'none', cursor: 'pointer', fontSize: '0.85rem' }}
            onClick={() => setActiveTab('bmp')}
          >
            <Image size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> BMP
          </button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, userSelect: 'none' }}>
          {items}
        </div>
      </div>
    );
  };

  const AccordionHeader = ({ title, section, icon }: { title: string, section: keyof typeof openSections, icon?: React.ReactNode }) => (
    <div 
      className="panel-title" 
      style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', userSelect: 'none', margin: '0', padding: '10px 0', borderBottom: openSections[section] ? '1px solid var(--border-color)' : 'none' }}
      onClick={() => toggleSection(section)}
    >
      <span style={{ marginRight: '5px', display: 'flex', alignItems: 'center' }}>
        {openSections[section] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </span>
      {icon && <span style={{ marginRight: '5px', display: 'flex', alignItems: 'center' }}>{icon}</span>}
      {title}
    </div>
  );

  return (
    <aside className="right-panel" style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', gap: '10px' }}>
      {/* Hidden file inputs for WAV/BMP lists */}
      <input type="file" ref={wavInputRef} style={{ display: 'none' }} onChange={handleWavFileChange} />
      <input type="file" ref={bmpInputRef} style={{ display: 'none' }} onChange={handleBmpFileChange} />

      {/* Header Info Section */}
      <div style={{ display: 'flex', flexDirection: 'column', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
        <AccordionHeader title="Header Info" section="header" />
        
        {openSections.header && (
          <div style={{ marginTop: '10px' }}>
            {bmsData ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <TextInput label="TITLE" value={bmsData.header.title} onChange={(val: string) => updateHeader({ title: val })} />
                <TextInput label="SUBTITLE" value={bmsData.header.subtitle} onChange={(val: string) => updateHeader({ subtitle: val })} />
                <TextInput label="ARTIST" value={bmsData.header.artist} onChange={(val: string) => updateHeader({ artist: val })} />
                <TextInput label="SUBARTIST" value={bmsData.header.subartist} onChange={(val: string) => updateHeader({ subartist: val })} />
                <TextInput label="GENRE" value={bmsData.header.genre} onChange={(val: string) => updateHeader({ genre: val })} />
                
                <NumberInput label="BPM" value={bmsData.header.bpm} isFloat={true} onChange={(val: number) => updateHeader({ bpm: val })} />
                
                <SelectInput label="PLAYER" value={bmsData.header.player} onChange={(val: number) => updateHeader({ player: val })} options={[
                  { value: 1, label: '1 - Single Play' },
                  { value: 2, label: '2 - Couple Play' },
                  { value: 3, label: '3 - Double Play' }
                ]} />
                
                <SelectInput label="RANK" value={bmsData.header.rank} onChange={(val: number) => updateHeader({ rank: val })} options={[
                  { value: 0, label: '0 - Very Hard' },
                  { value: 1, label: '1 - Hard' },
                  { value: 2, label: '2 - Normal' },
                  { value: 3, label: '3 - Easy' },
                  { value: 4, label: '4 - Very Easy' }
                ]} />
                
                <TextInput label="PLAYLEVEL" value={bmsData.header.playLevel} onChange={(val: string) => updateHeader({ playLevel: val })} />
                
                <NumberInput label="DIFFICULTY" value={bmsData.header.difficulty} min={0} max={5} onChange={(val: number) => updateHeader({ difficulty: val })} />
                
                <NumberInput label="TOTAL" value={bmsData.header.total} isFloat={true} onChange={(val: number) => updateHeader({ total: val })} />
                
                <SelectInput label="LNMODE" value={bmsData.header.lnmode ?? ''} onChange={(val: number | undefined) => updateHeader({ lnmode: val })} options={[
                  { value: '', label: 'None' },
                  { value: 1, label: '1 - LN' },
                  { value: 2, label: '2 - CN' },
                  { value: 3, label: '3 - HCN' }
                ]} />
                
                <LnObjInput label="LNOBJ" value={bmsData.header.lnobj} onChange={(val: string) => updateHeader({ lnobj: val })} />
                
                <NumberInput label="DEFEXRANK" value={bmsData.header.defexrank} isFloat={true} onChange={(val: number) => updateHeader({ defexrank: val })} />
                
                <TextInput label="COMMENT" value={bmsData.header.comment} onChange={(val: string) => updateHeader({ comment: val })} />
                
                <div className="dropdown-divider" style={{ margin: '5px 0' }}></div>
                
                <FileInput label="STAGEFILE" value={bmsData.header.stagefile} onChange={(val: string) => updateHeader({ stagefile: val })} />
                <FileInput label="BANNER" value={bmsData.header.banner} onChange={(val: string) => updateHeader({ banner: val })} />
                <FileInput label="BACKBMP" value={bmsData.header.backbmp} onChange={(val: string) => updateHeader({ backbmp: val })} />
                <FileInput label="WAV00" value={bmsData.header.wav00} onChange={(val: string) => updateHeader({ wav00: val })} />
                <FileInput label="BMP00" value={bmsData.header.bmp00} onChange={(val: string) => updateHeader({ bmp00: val })} />
                <FileInput label="PREVIEW" value={bmsData.header.preview} onChange={(val: string) => updateHeader({ preview: val })} />
              </div>
            ) : (
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center', marginTop: '10px' }}>
                <FileCode2 size={32} style={{ opacity: 0.5, margin: '0 auto 10px' }} />
                <p>No BMS file loaded.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* WAV / BMP List Section */}
      <div style={{ display: 'flex', flexDirection: 'column', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
        <AccordionHeader title="WAV / BMP List" section="wavbmp" />
        {openSections.wavbmp && (
          <div style={{ marginTop: '10px' }}>
            {bmsData ? renderWavBmpList() : (
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>
                No BMS file loaded.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Display Section (Grid Snap & Zoom) */}
      <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: '10px' }}>
        <AccordionHeader title="Display Settings" section="display" icon={<Monitor size={14} />} />
        {openSections.display && (
          <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Grid Snap Sub-section */}
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                Grid Snap
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}>
                  <span>1/</span>
                  <input 
                    type="number"
                    defaultValue={gridSnap}
                    key={`snap-${gridSnap}`}
                    onBlur={(e) => {
                      let val = parseInt(e.target.value);
                      if (isNaN(val)) val = gridSnap;
                      if (val < 1) val = 1;
                      if (val > 10000) val = 10000;
                      setGridSnap(val);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                    }}
                    style={{ width: '55px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '2px 4px', fontSize: '0.85rem' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '5px' }}>
                  <button 
                    className="tool-button" 
                    style={{ padding: '2px 8px', minWidth: '30px', justifyContent: 'center' }}
                    onClick={() => setGridSnap(Math.max(1, Math.floor(gridSnap / 2)))}
                  >
                    -
                  </button>
                  <button 
                    className="tool-button" 
                    style={{ padding: '2px 8px', minWidth: '30px', justifyContent: 'center' }}
                    onClick={() => setGridSnap(Math.min(10000, gridSnap * 2))}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Zoom Sub-section */}
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <ZoomIn size={14} /> Zoom
              </div>
              
              <div style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  <span>Horizontal (X)</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                    <input 
                      type="number"
                      defaultValue={Math.round(zoomX * 100)}
                      key={`zx-${Math.round(zoomX * 100)}`}
                      onBlur={(e) => {
                        let val = parseInt(e.target.value);
                        if (isNaN(val)) val = Math.round(zoomX * 100);
                        if (val < 50) val = 50;
                        if (val > 300) val = 300;
                        setZoomX(val / 100);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur();
                      }}
                      style={{ width: '45px', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: '4px', textAlign: 'right', padding: '2px', fontSize: '0.75rem' }}
                    />
                    <span>%</span>
                  </div>
                </div>
                <input 
                  type="range" 
                  min="0.5" max="3" step="0.1" 
                  value={zoomX} 
                  onChange={(e) => setZoomX(parseFloat(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  <span>Vertical (Y)</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                    <input 
                      type="number"
                      defaultValue={Math.round(zoomY * 100)}
                      key={`zy-${Math.round(zoomY * 100)}`}
                      onBlur={(e) => {
                        let val = parseInt(e.target.value);
                        if (isNaN(val)) val = Math.round(zoomY * 100);
                        if (val < 10) val = 10;
                        if (val > 10000) val = 10000;
                        setZoomY(val / 100);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur();
                      }}
                      style={{ width: '45px', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: '4px', textAlign: 'right', padding: '2px', fontSize: '0.75rem' }}
                    />
                    <span>%</span>
                  </div>
                </div>
                <input 
                  type="range" 
                  min="0.5" max="4" step="0.1" 
                  value={zoomY} 
                  onChange={(e) => setZoomY(parseFloat(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
