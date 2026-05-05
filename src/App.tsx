import { useEffect, useRef } from 'react';
import { FolderOpen, Save, MousePointer2, Pencil, Eraser, Settings2, FileCode2 } from 'lucide-react';
import { useEditorStore } from './store/editorStore';
import { parseBms } from './parser/bmsParser';
import './App.css';

// Lane Layout Configuration
interface LaneConfig {
  name: string;
  type: 'measure' | 'channel' | 'bgm';
  channel?: number;
  width: number;
  color: string;
}

const LAYOUT: LaneConfig[] = [
  // 1. Measure
  { name: 'MSR', type: 'measure', width: 40, color: '#050505' },
  // 2. Timing
  { name: 'BPM', type: 'channel', channel: 0x08, width: 25, color: '#0a0a0a' },
  { name: 'STOP', type: 'channel', channel: 0x09, width: 25, color: '#0a0a0a' },
  { name: 'SC', type: 'channel', channel: 0x02, width: 25, color: '#0a0a0a' }, // SCROLL
  // 3. Video
  { name: 'BGA', type: 'channel', channel: 0x04, width: 30, color: '#080808' },
  { name: 'LYR', type: 'channel', channel: 0x06, width: 30, color: '#080808' },
  { name: 'POR', type: 'channel', channel: 0x0A, width: 30, color: '#080808' },
  // 4. 1P Notes (11-19)
  { name: 'S1', type: 'channel', channel: 0x16, width: 30, color: '#140c0c' }, // Dark red tint
  { name: '1', type: 'channel', channel: 0x11, width: 20, color: '#0a0a0a' },
  { name: '2', type: 'channel', channel: 0x12, width: 20, color: '#111114' }, // Blueish dark
  { name: '3', type: 'channel', channel: 0x13, width: 20, color: '#0a0a0a' },
  { name: '4', type: 'channel', channel: 0x14, width: 20, color: '#111114' },
  { name: '5', type: 'channel', channel: 0x15, width: 20, color: '#0a0a0a' },
  { name: '6', type: 'channel', channel: 0x18, width: 20, color: '#111114' },
  { name: '7', type: 'channel', channel: 0x19, width: 20, color: '#0a0a0a' },
  // 5. 2P Notes (21-29)
  { name: 'S2', type: 'channel', channel: 0x26, width: 30, color: '#140c0c' },
  { name: '1', type: 'channel', channel: 0x21, width: 20, color: '#0a0a0a' },
  { name: '2', type: 'channel', channel: 0x22, width: 20, color: '#111114' },
  { name: '3', type: 'channel', channel: 0x23, width: 20, color: '#0a0a0a' },
  { name: '4', type: 'channel', channel: 0x24, width: 20, color: '#111114' },
  { name: '5', type: 'channel', channel: 0x25, width: 20, color: '#0a0a0a' },
  { name: '6', type: 'channel', channel: 0x28, width: 20, color: '#111114' },
  { name: '7', type: 'channel', channel: 0x29, width: 20, color: '#0a0a0a' },
  // 6. BGM (Generic 8 lanes)
  { name: 'BGM1', type: 'bgm', channel: 0x01, width: 30, color: '#0a0a0a' },
  { name: 'BGM2', type: 'bgm', channel: 0x01, width: 30, color: '#0f0f0f' },
  { name: 'BGM3', type: 'bgm', channel: 0x01, width: 30, color: '#0a0a0a' },
  { name: 'BGM4', type: 'bgm', channel: 0x01, width: 30, color: '#0f0f0f' },
  { name: 'BGM5', type: 'bgm', channel: 0x01, width: 30, color: '#0a0a0a' },
  { name: 'BGM6', type: 'bgm', channel: 0x01, width: 30, color: '#0f0f0f' },
  { name: 'BGM7', type: 'bgm', channel: 0x01, width: 30, color: '#0a0a0a' },
  { name: 'BGM8', type: 'bgm', channel: 0x01, width: 30, color: '#0f0f0f' },
];

// 1 Measure = 192 pixels in height
const MEASURE_HEIGHT = 192; 

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { 
    activeTool, setActiveTool, 
    useBase62, setUseBase62, 
    bmsData, setBmsData, 
    rawBmsContent, setRawBmsContent,
    setFileName 
  } = useEditorStore();

  // Scroll state (using refs for performance during rendering)
  const scrollY = useRef(0);
  const scrollX = useRef(0);
  const renderRequested = useRef(false);

  const drawGridAndNotes = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fix for high DPI displays (if wanted later, skip for now to keep it simple)
    // Clear whole canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Background of container
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    
    // Origin is bottom-left, scrolling moves us up
    ctx.translate(-scrollX.current, canvas.height + scrollY.current);

    // Calculate visible Y bounds to prevent drawing massive rectangles
    const topY = -(canvas.height + scrollY.current);
    const bottomY = -scrollY.current;

    let currentX = 50; // Starting padding

    // 1. Draw Lane Backgrounds & Borders
    LAYOUT.forEach((lane) => {
      // Lane background
      ctx.fillStyle = lane.color;
      ctx.fillRect(currentX, topY, lane.width, canvas.height);

      // Lane Border
      ctx.strokeStyle = '#222222';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(currentX, topY);
      ctx.lineTo(currentX, bottomY);
      ctx.moveTo(currentX + lane.width, topY);
      ctx.lineTo(currentX + lane.width, bottomY);
      ctx.stroke();

      currentX += lane.width;
    });

    // 2. Draw Measure Lines & Numbers
    const totalMeasures = bmsData ? Math.max(...bmsData.notes.map(n => n.measure), 100) + 1 : 100;
    
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'; // subtle horizontal line
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '10px Inter';
    ctx.textAlign = 'center';

    for (let m = 0; m <= totalMeasures; m++) {
      const y = -(m * MEASURE_HEIGHT);
      
      // Culling for measure lines
      if (y < topY - MEASURE_HEIGHT || y > bottomY + MEASURE_HEIGHT) continue;

      // Horizontal Line
      ctx.beginPath();
      ctx.moveTo(50, y);
      ctx.lineTo(currentX, y);
      ctx.stroke();

      // Sub-lines (e.g. 4 beats per measure)
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      for (let beat = 1; beat < 4; beat++) {
        const beatY = y - (MEASURE_HEIGHT / 4) * beat;
        ctx.beginPath();
        ctx.moveTo(50, beatY);
        ctx.lineTo(currentX, beatY);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';

      // Measure Number
      const measureLane = LAYOUT.find(l => l.type === 'measure');
      if (measureLane) {
        ctx.fillText(m.toString(), 50 + measureLane.width / 2, y - 5);
      }
    }

    // 3. Draw Notes
    if (bmsData) {
      const bgmGroups: Record<string, number> = {};

      bmsData.notes.forEach(note => {
        const y = -(note.measure * MEASURE_HEIGHT + note.position * MEASURE_HEIGHT);
        
        // Culling: Only draw notes that are visible
        if (y < topY - 20 || y > bottomY + 20) return;

        let targetLaneIndex = -1;
        
        if (note.channel === 0x01) {
          const key = `${note.measure}_${note.position}`;
          if (!bgmGroups[key]) bgmGroups[key] = 0;
          
          const bgmOffset = bgmGroups[key] % 8;
          bgmGroups[key]++;
          targetLaneIndex = LAYOUT.findIndex(l => l.type === 'bgm' && l.name === `BGM${bgmOffset + 1}`);
        } else {
          targetLaneIndex = LAYOUT.findIndex(l => l.channel === note.channel);
        }

        if (targetLaneIndex !== -1) {
          let laneX = 50;
          for (let i = 0; i < targetLaneIndex; i++) laneX += LAYOUT[i].width;
          const lWidth = LAYOUT[targetLaneIndex].width;
          
          // Draw Note Body
          ctx.fillStyle = '#f4f4f5';
          ctx.fillRect(laneX + 1, y - 3, lWidth - 2, 6);
          
          // Note Border
          ctx.strokeStyle = '#000000';
          ctx.strokeRect(laneX + 1, y - 3, lWidth - 2, 6);
          
          // Draw Value
          ctx.fillStyle = '#000000';
          ctx.font = '7px Inter';
          ctx.textAlign = 'center';
          ctx.fillText(note.value.toString(useBase62 ? 62 : 36).toUpperCase(), laneX + lWidth / 2, y + 2);
        }
      });
    }

    // 4. Draw Lane Headers (Sticky at bottom)
    ctx.restore();
    ctx.save();
    ctx.translate(-scrollX.current, canvas.height - 24); // Bottom sticky area
    
    // Header Background
    ctx.fillStyle = 'rgba(10, 10, 12, 0.9)';
    ctx.fillRect(scrollX.current, 0, canvas.width + scrollX.current, 24);
    
    // Header Top Border
    ctx.strokeStyle = '#333333';
    ctx.beginPath();
    ctx.moveTo(scrollX.current, 0);
    ctx.lineTo(canvas.width + scrollX.current, 0);
    ctx.stroke();

    let headerX = 50;
    ctx.fillStyle = '#a1a1aa';
    ctx.font = '10px Inter';
    ctx.textAlign = 'center';
    
    LAYOUT.forEach((lane) => {
      ctx.fillText(lane.name, headerX + lane.width / 2, 16);
      headerX += lane.width;
    });
    
    ctx.restore();
    renderRequested.current = false;
  };

  const requestRender = () => {
    if (!renderRequested.current) {
      renderRequested.current = true;
      requestAnimationFrame(drawGridAndNotes);
    }
  };

  // Canvas Resize Handler
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeCanvas = () => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      requestRender();
    };

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    return () => window.removeEventListener('resize', resizeCanvas);
  }, [bmsData, useBase62]); 

  // Mouse Wheel Scrolling
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.shiftKey) {
        scrollX.current = Math.max(0, scrollX.current + e.deltaY);
      } else {
        scrollY.current = Math.max(0, scrollY.current + e.deltaY);
      }
      requestRender();
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  // File loading
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setRawBmsContent(text);
      const parsedData = parseBms(text, useBase62);
      setBmsData(parsedData);
      
      // Reset scroll
      scrollY.current = 0;
      scrollX.current = 0;
      requestRender();
    };
    reader.readAsText(file); 
  };

  // Toggle Mode
  const handleToggleMode = () => {
    const newMode = !useBase62;
    setUseBase62(newMode);
    
    if (rawBmsContent) {
      const parsedData = parseBms(rawBmsContent, newMode);
      setBmsData(parsedData);
      requestRender();
    }
  };

  return (
    <div className="app-container">
      {/* Topbar */}
      <header className="topbar">
        <div className="topbar-logo">kBMSE</div>
        <div className="topbar-menu">
          <div className="menu-item" onClick={() => fileInputRef.current?.click()}>File</div>
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

      {/* Main Area */}
      <div className="main-area">
        {/* Sidebar */}
        <aside className="sidebar">
          <div>
            <div className="panel-title">Actions</div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <input 
                type="file" 
                accept=".bms,.bme,.bml,.pms" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                onChange={handleFileSelect}
              />
              <button 
                className="tool-button" 
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => fileInputRef.current?.click()}
              >
                <FolderOpen size={16} /> Open
              </button>
              <button className="tool-button" style={{ flex: 1, justifyContent: 'center' }}>
                <Save size={16} /> Save
              </button>
            </div>
          </div>

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

        {/* Canvas Area */}
        <main className="canvas-container" ref={containerRef}>
          <canvas ref={canvasRef} />
        </main>

        {/* Right Panel: Header Info */}
        <aside className="right-panel">
          <div className="panel-title">Header Info</div>
          
          {bmsData ? (
            <div style={{ overflowY: 'auto', flex: 1, paddingRight: '10px' }}>
              <div className="property-item">
                <span className="property-label">Title</span>
                <span className="property-value">{bmsData.header.title || 'Untitled'}</span>
              </div>
              <div className="property-item">
                <span className="property-label">Artist</span>
                <span className="property-value">{bmsData.header.artist || 'Unknown'}</span>
              </div>
              <div className="property-item">
                <span className="property-label">Genre</span>
                <span className="property-value">{bmsData.header.genre || '-'}</span>
              </div>
              <div className="property-item">
                <span className="property-label">BPM</span>
                <span className="property-value">{bmsData.header.bpm}</span>
              </div>
              <div className="property-item">
                <span className="property-label">PlayLevel</span>
                <span className="property-value">{bmsData.header.playLevel}</span>
              </div>
              <div className="property-item">
                <span className="property-label">Player</span>
                <span className="property-value">{bmsData.header.player}</span>
              </div>
              <div className="property-item">
                <span className="property-label">Rank</span>
                <span className="property-value">{bmsData.header.rank}</span>
              </div>
              <div className="property-item">
                <span className="property-label">Total Notes</span>
                <span className="property-value">{bmsData.notes.length}</span>
              </div>
              <div className="property-item">
                <span className="property-label">Total</span>
                <span className="property-value">{bmsData.header.total || 160}</span>
              </div>
            </div>
          ) : (
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center', marginTop: '20px' }}>
              <FileCode2 size={32} style={{ opacity: 0.5, margin: '0 auto 10px' }} />
              <p>No BMS file loaded.</p>
              <p style={{ fontSize: '0.75rem', marginTop: '5px' }}>Click Open to load a file.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

export default App;
