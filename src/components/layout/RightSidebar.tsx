import { FileCode2, ZoomIn } from 'lucide-react';
import { BmsData } from '../../parser/bmsParser';
import { TextInput, NumberInput, SelectInput, FileInput, LnObjInput } from '../ui/PropertyInputs';

interface RightSidebarProps {
  bmsData: BmsData | null;
  updateHeader: (header: Partial<BmsData['header']>) => void;
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
  gridSnap,
  setGridSnap,
  zoomX,
  setZoomX,
  zoomY,
  setZoomY
}: RightSidebarProps) => {
  return (
    <aside className="right-panel" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="panel-title">Header Info</div>
      
      {bmsData ? (
        <div style={{ overflowY: 'auto', flex: 1, paddingRight: '10px' }}>
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
          
          <div className="dropdown-divider" style={{ margin: '15px 0' }}></div>
          
          <FileInput label="STAGEFILE" value={bmsData.header.stagefile} onChange={(val: string) => updateHeader({ stagefile: val })} />
          <FileInput label="BANNER" value={bmsData.header.banner} onChange={(val: string) => updateHeader({ banner: val })} />
          <FileInput label="BACKBMP" value={bmsData.header.backbmp} onChange={(val: string) => updateHeader({ backbmp: val })} />
          <FileInput label="WAV00" value={bmsData.header.wav00} onChange={(val: string) => updateHeader({ wav00: val })} />
          <FileInput label="BMP00" value={bmsData.header.bmp00} onChange={(val: string) => updateHeader({ bmp00: val })} />
          <FileInput label="PREVIEW" value={bmsData.header.preview} onChange={(val: string) => updateHeader({ preview: val })} />
        </div>
      ) : (
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center', marginTop: '20px', flex: 1 }}>
          <FileCode2 size={32} style={{ opacity: 0.5, margin: '0 auto 10px' }} />
          <p>No BMS file loaded.</p>
        </div>
      )}

      {/* Grid Snap Controls */}
      <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
        <div className="panel-title">Grid Snap</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
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
        
      {/* Zoom Controls */}
        <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
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
    </aside>
  );
};
