import { useEffect, useRef } from 'react';
import { FolderOpen, Save, MousePointer2, Pencil, Eraser, Settings2, FileCode2, ZoomIn } from 'lucide-react';
import { useEditorStore } from './store/editorStore';
import { parseBms, encodeBmsValue, BmsData } from './parser/bmsParser';
import './App.css';

// Lane Layout Configuration
interface LaneConfig {
  name: string;
  type: 'measure' | 'channel' | 'bgm';
  channel?: number;
  width: number;
  color: string;
  isGroupEnd?: boolean;
}

const DEFAULT_LANE_WIDTH = 25; // Uniform width for all lanes

const LAYOUT: LaneConfig[] = [
  // 1. Measure
  { name: 'MSR', type: 'measure', width: DEFAULT_LANE_WIDTH, color: '#050505', isGroupEnd: true },
  // 2. Timing
  { name: 'BPM', type: 'channel', channel: 0x08, width: DEFAULT_LANE_WIDTH, color: '#0a0a0a' },
  { name: 'STOP', type: 'channel', channel: 0x09, width: DEFAULT_LANE_WIDTH, color: '#0a0a0a' },
  { name: 'SCR', type: 'channel', channel: 0x02, width: DEFAULT_LANE_WIDTH, color: '#0a0a0a', isGroupEnd: true }, // SCROLL
  // 3. Video
  { name: 'BGA', type: 'channel', channel: 0x04, width: DEFAULT_LANE_WIDTH, color: '#080808' },
  { name: 'LYR', type: 'channel', channel: 0x06, width: DEFAULT_LANE_WIDTH, color: '#080808' },
  { name: 'POR', type: 'channel', channel: 0x0A, width: DEFAULT_LANE_WIDTH, color: '#080808', isGroupEnd: true },
  // 4. 1P Notes (11-19)
  { name: 'S1', type: 'channel', channel: 0x16, width: DEFAULT_LANE_WIDTH, color: '#140c0c' },
  { name: 'A1', type: 'channel', channel: 0x11, width: DEFAULT_LANE_WIDTH, color: '#0a0a0a' },
  { name: 'A2', type: 'channel', channel: 0x12, width: DEFAULT_LANE_WIDTH, color: '#111114' },
  { name: 'A3', type: 'channel', channel: 0x13, width: DEFAULT_LANE_WIDTH, color: '#0a0a0a' },
  { name: 'A4', type: 'channel', channel: 0x14, width: DEFAULT_LANE_WIDTH, color: '#111114' },
  { name: 'A5', type: 'channel', channel: 0x15, width: DEFAULT_LANE_WIDTH, color: '#0a0a0a' },
  { name: 'A6', type: 'channel', channel: 0x18, width: DEFAULT_LANE_WIDTH, color: '#111114' },
  { name: 'A7', type: 'channel', channel: 0x19, width: DEFAULT_LANE_WIDTH, color: '#0a0a0a', isGroupEnd: true },
  // 5. 2P Notes (21-29)
  { name: 'S2', type: 'channel', channel: 0x26, width: DEFAULT_LANE_WIDTH, color: '#140c0c' },
  { name: 'D1', type: 'channel', channel: 0x21, width: DEFAULT_LANE_WIDTH, color: '#0a0a0a' },
  { name: 'D2', type: 'channel', channel: 0x22, width: DEFAULT_LANE_WIDTH, color: '#111114' },
  { name: 'D3', type: 'channel', channel: 0x23, width: DEFAULT_LANE_WIDTH, color: '#0a0a0a' },
  { name: 'D4', type: 'channel', channel: 0x24, width: DEFAULT_LANE_WIDTH, color: '#111114' },
  { name: 'D5', type: 'channel', channel: 0x25, width: DEFAULT_LANE_WIDTH, color: '#0a0a0a' },
  { name: 'D6', type: 'channel', channel: 0x28, width: DEFAULT_LANE_WIDTH, color: '#111114' },
  { name: 'D7', type: 'channel', channel: 0x29, width: DEFAULT_LANE_WIDTH, color: '#0a0a0a', isGroupEnd: true },
  // 6. BGM (Generic 32 lanes)
  ...Array.from({ length: 32 }).map((_, i) => ({
    name: `B${i + 1}`,
    type: 'bgm' as const,
    channel: 0x01,
    width: DEFAULT_LANE_WIDTH,
    color: i % 2 === 0 ? '#0a0a0a' : '#0f0f0f'
  }))
];

const BASE_MEASURE_HEIGHT = 192; 

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { 
    activeTool, setActiveTool, 
    useBase62, setUseBase62, 
    bmsData, setBmsData, 
    rawBmsContent, setRawBmsContent,
    zoomX, setZoomX,
    zoomY, setZoomY,
    setFileName 
  } = useEditorStore();

  // Scroll state
  const scrollY = useRef(0);
  const scrollX = useRef(0);
  const maxScrollYRef = useRef(0);
  const maxScrollXRef = useRef(0);
  const renderRequested = useRef(false);

  // Scrollbar Drag State
  const vThumbRect = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const hThumbRect = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const isDraggingV = useRef(false);
  const isDraggingH = useRef(false);
  const dragStartY = useRef(0);
  const dragStartX = useRef(0);
  const initialScrollY = useRef(0);
  const initialScrollX = useRef(0);

  // References to state to avoid stale closures in requestAnimationFrame
  const bmsDataRef = useRef<BmsData | null>(null);
  const useBase62Ref = useRef<boolean>(useBase62);
  const zoomXRef = useRef<number>(zoomX);
  const zoomYRef = useRef<number>(zoomY);

  useEffect(() => {
    bmsDataRef.current = bmsData;
    useBase62Ref.current = useBase62;
    zoomXRef.current = zoomX;
    zoomYRef.current = zoomY;
    requestRender();
  }, [bmsData, useBase62, zoomX, zoomY]);

  const drawGridAndNotes = () => {
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const currentBmsData = bmsDataRef.current;
      const currentUseBase62 = useBase62Ref.current;
      const currentZoomX = zoomXRef.current;
      const currentZoomY = zoomYRef.current;
      
      const currentMeasureHeight = BASE_MEASURE_HEIGHT * currentZoomY;

      // Apply zoom to layout widths
      const zoomedLayout = LAYOUT.map(l => ({ ...l, width: l.width * currentZoomX }));

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Container Background
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      
      // Setup coordinates: bottom-left is origin, Y goes UP
      const originY = canvas.height + scrollY.current;
      ctx.translate(-scrollX.current, originY);

      const topY = -originY;
      const bottomY = canvas.height - originY;

      let currentX = 50; // Padding
      const totalWidth = 50 + zoomedLayout.reduce((sum, l) => sum + l.width, 0) + 50;

      // Draw left-most boundary line
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(50, topY);
      ctx.lineTo(50, bottomY);
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.stroke();

      // 1. Draw Lane Backgrounds and right-side borders
      zoomedLayout.forEach((lane) => {
        ctx.fillStyle = lane.color;
        ctx.fillRect(currentX, topY, lane.width, canvas.height);
        
        currentX += lane.width;

        ctx.beginPath();
        ctx.moveTo(currentX, topY);
        ctx.lineTo(currentX, bottomY);
        ctx.strokeStyle = lane.isGroupEnd ? 'rgba(255,255,255,0.4)' : '#222222';
        ctx.stroke();
      });

      // 2. Draw Measure Lines
      const maxMeasure = currentBmsData && currentBmsData.notes.length > 0
        ? currentBmsData.notes.reduce((max, note) => Math.max(max, note.measure), 0)
        : 100;
      const totalMeasures = Math.max(maxMeasure, 100) + 1;
      const totalHeight = totalMeasures * currentMeasureHeight + 100;

      // Update scroll bounds
      maxScrollXRef.current = Math.max(0, totalWidth - canvas.width);
      maxScrollYRef.current = Math.max(0, totalHeight - canvas.height);
      
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '10px Inter';
      ctx.textAlign = 'center';

      for (let m = 0; m <= totalMeasures; m++) {
        const y = -(m * currentMeasureHeight);
        
        if (y < topY - currentMeasureHeight || y > bottomY + currentMeasureHeight) continue;

        ctx.strokeStyle = 'rgba(255,255,255,0.5)'; // Brighter measure line
        ctx.beginPath();
        ctx.moveTo(50, y);
        ctx.lineTo(currentX, y);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255,255,255,0.03)';
        for (let beat = 1; beat < 4; beat++) {
          const beatY = y - (currentMeasureHeight / 4) * beat;
          ctx.beginPath();
          ctx.moveTo(50, beatY);
          ctx.lineTo(currentX, beatY);
          ctx.stroke();
        }

        const measureLane = zoomedLayout.find(l => l.type === 'measure');
        if (measureLane) {
          ctx.fillText(m.toString(), 50 + measureLane.width / 2, y - 5);
        }
      }

      // 3. Draw Notes
      if (currentBmsData) {
        currentBmsData.notes.forEach(note => {
          const y = -(note.measure * currentMeasureHeight + note.position * currentMeasureHeight);
          
          if (y < topY - 20 || y > bottomY + 20) return;

          let targetLaneIndex = -1;
          
          if (note.channel === 0x01) {
            // Use the parsed index (occurrence of #xxx01 in the measure) to determine the BGM lane.
            const bgmOffset = note.index % 32; // Expanded to 32 BGM lanes
            targetLaneIndex = zoomedLayout.findIndex(l => l.type === 'bgm' && l.name === `B${bgmOffset + 1}`);
          } else {
            targetLaneIndex = zoomedLayout.findIndex(l => l.channel === note.channel);
          }

          if (targetLaneIndex !== -1) {
            let laneX = 50;
            for (let i = 0; i < targetLaneIndex; i++) laneX += zoomedLayout[i].width;
            const lWidth = zoomedLayout[targetLaneIndex].width;
            
            // Align UP from the measure line. Y goes UP in canvas logic (negative).
            const noteHeight = 12; // Increased note height
            const noteY = y - noteHeight; // Draw upwards from the baseline

            ctx.fillStyle = '#f4f4f5';
            ctx.fillRect(laneX + 1, noteY, lWidth - 2, noteHeight);
            
            ctx.strokeStyle = '#000000';
            ctx.strokeRect(laneX + 1, noteY, lWidth - 2, noteHeight);
            
            ctx.fillStyle = '#000000';
            ctx.font = '10px Inter'; // Increased font size
            ctx.textAlign = 'center';
            // encodeBmsValue avoids the Javascript RangeError of toString(62)
            ctx.fillText(encodeBmsValue(note.value, currentUseBase62), laneX + lWidth / 2, noteY + 10); // Adjusted Y for larger text
          }
        });
      }

      // 4. Draw Header Background (Sticky Top)
      ctx.restore();
      ctx.save();
      ctx.translate(-scrollX.current, 0); // Top sticky area
      
      ctx.fillStyle = 'rgba(10, 10, 12, 0.9)';
      ctx.fillRect(scrollX.current, 0, canvas.width + scrollX.current, 24);
      
      // Header Bottom Border
      ctx.strokeStyle = '#333333';
      ctx.beginPath();
      ctx.moveTo(scrollX.current, 24);
      ctx.lineTo(canvas.width + scrollX.current, 24);
      ctx.stroke();

      let headerX = 50;
      ctx.fillStyle = '#a1a1aa';
      ctx.font = '10px Inter';
      ctx.textAlign = 'center';
      
      zoomedLayout.forEach((lane) => {
        ctx.fillText(lane.name, headerX + lane.width / 2, 16);
        headerX += lane.width;
      });
      
      // 5. Draw Visual Scrollbars
      ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset to screen coordinates

      const maxScrollY = maxScrollYRef.current;
      const maxScrollX = maxScrollXRef.current;

      // Vertical Scrollbar
      if (maxScrollY > 0) {
        const scrollbarWidth = 10;
        const trackHeight = canvas.height - 24; // Below top header
        const viewRatio = Math.min(1, canvas.height / totalHeight);
        const thumbHeight = Math.max(30, trackHeight * viewRatio);
        
        // In our coordinate system, scrollY = 0 is bottom (measure 0).
        // Thumb should be at the bottom when scrollY = 0.
        const scrollRatio = scrollY.current / maxScrollY;
        const thumbY = 24 + (1 - scrollRatio) * (trackHeight - thumbHeight);

        const rectX = canvas.width - scrollbarWidth + 2;
        vThumbRect.current = { x: rectX, y: thumbY, w: scrollbarWidth - 4, h: thumbHeight };

        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(canvas.width - scrollbarWidth, 24, scrollbarWidth, trackHeight);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(rectX, thumbY, scrollbarWidth - 4, thumbHeight, 4);
        } else {
          ctx.fillRect(rectX, thumbY, scrollbarWidth - 4, thumbHeight);
        }
        ctx.fill();
      } else {
        vThumbRect.current = { x: 0, y: 0, w: 0, h: 0 };
      }

      // Horizontal Scrollbar
      if (maxScrollX > 0) {
        const scrollbarHeight = 10;
        const trackWidth = canvas.width - (maxScrollY > 0 ? 10 : 0);
        const viewRatio = Math.min(1, canvas.width / totalWidth);
        const thumbWidth = Math.max(30, trackWidth * viewRatio);
        
        const scrollRatio = scrollX.current / maxScrollX;
        const thumbX = scrollRatio * (trackWidth - thumbWidth);

        const rectY = canvas.height - scrollbarHeight + 2;
        hThumbRect.current = { x: thumbX, y: rectY, w: thumbWidth, h: scrollbarHeight - 4 };

        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, canvas.height - scrollbarHeight, trackWidth, scrollbarHeight);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(thumbX, rectY, thumbWidth, scrollbarHeight - 4, 4);
        } else {
          ctx.fillRect(thumbX, rectY, thumbWidth, scrollbarHeight - 4);
        }
        ctx.fill();
      } else {
        hThumbRect.current = { x: 0, y: 0, w: 0, h: 0 };
      }

      ctx.restore();
    } catch (e) {
      console.error("Render Error:", e);
    } finally {
      renderRequested.current = false;
    }
  };

  const requestRender = () => {
    if (!renderRequested.current) {
      renderRequested.current = true;
      requestAnimationFrame(drawGridAndNotes);
    }
  };

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
  }, []); // Only bind once, state is handled via refs

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.shiftKey) {
        scrollX.current = Math.min(maxScrollXRef.current, Math.max(0, scrollX.current + e.deltaY));
      } else {
        scrollY.current = Math.min(maxScrollYRef.current, Math.max(0, scrollY.current + e.deltaY));
      }
      requestRender();
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  // Global mouse drag tracking for scrollbars
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingV.current && !isDraggingH.current) return;
      
      const canvas = canvasRef.current;
      if (!canvas) return;

      if (isDraggingV.current) {
        const deltaY = e.clientY - dragStartY.current;
        const trackHeight = canvas.height - 24;
        const vRect = vThumbRect.current;
        const draggableRange = trackHeight - vRect.h;
        
        if (draggableRange > 0) {
          // deltaY moves thumb down -> mapped to decreasing scrollY
          const scrollDelta = -(deltaY / draggableRange) * maxScrollYRef.current;
          scrollY.current = Math.min(maxScrollYRef.current, Math.max(0, initialScrollY.current + scrollDelta));
          requestRender();
        }
      }

      if (isDraggingH.current) {
        const deltaX = e.clientX - dragStartX.current;
        const trackWidth = canvas.width - (maxScrollYRef.current > 0 ? 10 : 0);
        const hRect = hThumbRect.current;
        const draggableRange = trackWidth - hRect.w;
        
        if (draggableRange > 0) {
          // deltaX moves thumb right -> mapped to increasing scrollX
          const scrollDelta = (deltaX / draggableRange) * maxScrollXRef.current;
          scrollX.current = Math.min(maxScrollXRef.current, Math.max(0, initialScrollX.current + scrollDelta));
          requestRender();
        }
      }
    };

    const handleMouseUp = () => {
      isDraggingV.current = false;
      isDraggingH.current = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Canvas Mouse Down
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const vRect = vThumbRect.current;
    if (vRect.w > 0 && x >= vRect.x - 2 && x <= vRect.x + vRect.w + 2 && y >= vRect.y && y <= vRect.y + vRect.h) {
      isDraggingV.current = true;
      dragStartY.current = e.clientY;
      initialScrollY.current = scrollY.current;
      return;
    }

    const hRect = hThumbRect.current;
    if (hRect.w > 0 && x >= hRect.x && x <= hRect.x + hRect.w && y >= hRect.y - 2 && y <= hRect.y + hRect.h + 2) {
      isDraggingH.current = true;
      dragStartX.current = e.clientX;
      initialScrollX.current = scrollX.current;
      return;
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        setRawBmsContent(text);
        const parsedData = parseBms(text, useBase62Ref.current);
        
        scrollY.current = 0;
        scrollX.current = 0;
        setBmsData(parsedData); // This will trigger useEffect -> requestRender
      } catch (err) {
        console.error("Failed to parse BMS", err);
      }
    };
    // Default to Shift-JIS encoding for BMS files, as most legacy and Japanese BMS files use it.
    reader.readAsText(file, 'Shift-JIS'); 
    
    // Reset value so the same file can be selected again
    e.target.value = '';
  };

  const handleToggleMode = () => {
    const newMode = !useBase62;
    setUseBase62(newMode);
    
    if (rawBmsContent) {
      const parsedData = parseBms(rawBmsContent, newMode);
      setBmsData(parsedData);
    }
  };

  return (
    <div className="app-container">
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

      <div className="main-area">
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

        <main className="canvas-container" ref={containerRef}>
          <canvas ref={canvasRef} onMouseDown={handleCanvasMouseDown} />
        </main>

        <aside className="right-panel" style={{ display: 'flex', flexDirection: 'column' }}>
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
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center', marginTop: '20px', flex: 1 }}>
              <FileCode2 size={32} style={{ opacity: 0.5, margin: '0 auto 10px' }} />
              <p>No BMS file loaded.</p>
            </div>
          )}

          {/* Zoom Controls */}
          <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
            <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <ZoomIn size={14} /> Zoom
            </div>
            
            <div style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                <span>Horizontal (X)</span>
                <span>{Math.round(zoomX * 100)}%</span>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                <span>Vertical (Y)</span>
                <span>{Math.round(zoomY * 100)}%</span>
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
      </div>
    </div>
  );
}

export default App;
