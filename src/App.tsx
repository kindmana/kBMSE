import { useEffect, useRef, useState } from 'react';
import { FolderOpen, Save, MousePointer2, Pencil, Eraser, Settings2, FileCode2, ZoomIn } from 'lucide-react';
import { useEditorStore } from './store/editorStore';
import { parseBms, encodeBmsValue, BmsData, BmsNote, encodeBms } from './parser/bmsParser';
import { getRecentFiles, addRecentFile, loadRecentFileHandle, RecentFile } from './utils/fileSystem';
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
  { name: 'D1', type: 'channel', channel: 0x21, width: DEFAULT_LANE_WIDTH, color: '#0a0a0a' },
  { name: 'D2', type: 'channel', channel: 0x22, width: DEFAULT_LANE_WIDTH, color: '#111114' },
  { name: 'D3', type: 'channel', channel: 0x23, width: DEFAULT_LANE_WIDTH, color: '#0a0a0a' },
  { name: 'D4', type: 'channel', channel: 0x24, width: DEFAULT_LANE_WIDTH, color: '#111114' },
  { name: 'D5', type: 'channel', channel: 0x25, width: DEFAULT_LANE_WIDTH, color: '#0a0a0a' },
  { name: 'D6', type: 'channel', channel: 0x28, width: DEFAULT_LANE_WIDTH, color: '#111114' },
  { name: 'D7', type: 'channel', channel: 0x29, width: DEFAULT_LANE_WIDTH, color: '#0a0a0a' },
  { name: 'S2', type: 'channel', channel: 0x26, width: DEFAULT_LANE_WIDTH, color: '#140c0c', isGroupEnd: true },
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
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { 
    activeTool, setActiveTool, 
    useBase62, setUseBase62, 
    bmsData, setBmsData, 
    rawBmsContent, setRawBmsContent,
    gridSnap, setGridSnap,
    selectedNotes, setSelectedNotes,
    currentNoteValue,
    addNote, removeNote, updateNote, removeNotes, updateNotes,
    undo, redo, commitHistory,
    zoomX, setZoomX,
    zoomY, setZoomY,
    fileName, setFileName,
    fileHandle, setFileHandle,
    historyIndex, lastSavedHistoryIndex, setLastSaved,
    updateHeader
  } = useEditorStore();

  const [isFileMenuOpen, setIsFileMenuOpen] = useState(false);
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);

  useEffect(() => {
    setRecentFiles(getRecentFiles());
  }, []);

  const isDirty = historyIndex !== lastSavedHistoryIndex;

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

  const getActiveLayout = () => {
    const player = bmsDataRef.current?.header.player || 1;
    if (player === 1) {
      return LAYOUT.filter(l => !l.name.startsWith('D') && l.name !== 'S2');
    }
    return LAYOUT;
  };
  const zoomYRef = useRef<number>(zoomY);
  const activeToolRef = useRef<string>(activeTool);
  const gridSnapRef = useRef<number>(gridSnap);
  const selectedNotesRef = useRef<string[]>(selectedNotes);

  useEffect(() => {
    bmsDataRef.current = bmsData;
    useBase62Ref.current = useBase62;
    zoomXRef.current = zoomX;
    zoomYRef.current = zoomY;
    activeToolRef.current = activeTool;
    gridSnapRef.current = gridSnap;
    selectedNotesRef.current = selectedNotes;
    requestRender();
  }, [bmsData, useBase62, zoomX, zoomY, activeTool, gridSnap, selectedNotes]);

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
      const zoomedLayout = getActiveLayout().map(l => ({ ...l, width: l.width * currentZoomX }));

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

            const isSelected = selectedNotesRef.current.includes(note.id);
            ctx.fillStyle = isSelected ? '#ffaaaa' : '#f4f4f5';
            ctx.fillRect(laneX + 1, noteY, lWidth - 2, noteHeight);
            
            ctx.strokeStyle = isSelected ? '#ff0000' : '#000000';
            ctx.strokeRect(laneX + 1, noteY, lWidth - 2, noteHeight);
            
            ctx.fillStyle = '#000000';
            ctx.font = '10px Inter'; // Increased font size
            ctx.textAlign = 'center';
            // encodeBmsValue avoids the Javascript RangeError of toString(62)
            ctx.fillText(encodeBmsValue(note.value, currentUseBase62), laneX + lWidth / 2, noteY + 10); // Adjusted Y for larger text
          }
        });
      }

      // Draw Selection Box
      if (isSelectingBox.current && selectionBoxStart.current && selectionBoxCurrent.current) {
        // Temporarily reset transform to screen coords to draw the selection box
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        const sx = selectionBoxStart.current.x;
        const sy = selectionBoxStart.current.y;
        const cx = selectionBoxCurrent.current.x;
        const cy = selectionBoxCurrent.current.y;
        
        ctx.fillStyle = 'rgba(100, 150, 255, 0.2)';
        ctx.fillRect(Math.min(sx, cx), Math.min(sy, cy), Math.abs(cx - sx), Math.abs(cy - sy));
        ctx.strokeStyle = 'rgba(100, 150, 255, 0.8)';
        ctx.strokeRect(Math.min(sx, cx), Math.min(sy, cy), Math.abs(cx - sx), Math.abs(cy - sy));
        ctx.restore();
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

  // Canvas Interaction State
  const isDraggingNotes = useRef(false);
  const isSelectingBox = useRef(false);
  const selectionBoxStart = useRef<{ x: number, y: number } | null>(null);
  const selectionBoxCurrent = useRef<{ x: number, y: number } | null>(null);
  
  // To track offsets for dragging multiple notes
  const dragStartBmsPos = useRef<{ measure: number, position: number, channel: number, index: number } | null>(null);
  const dragNoteInitialState = useRef<{ id: string, initialMeasure: number, initialPosition: number, initialChannel: number, initialIndex: number }[]>([]);

  const dragNoteDidMove = useRef(false);

  // Keyboard Shortcuts for Grid Snap, Undo/Redo, and Note Movement
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      
      if ((e.key === 'y' && (e.ctrlKey || e.metaKey)) || (e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey)) {
        e.preventDefault();
        redo();
        return;
      }

      if (e.key === 'PageUp') {
        e.preventDefault();
        setGridSnap(e.shiftKey ? gridSnap + 1 : gridSnap * 2);
      } else if (e.key === 'PageDown') {
        e.preventDefault();
        setGridSnap(e.shiftKey ? Math.max(1, gridSnap - 1) : Math.max(1, Math.floor(gridSnap / 2)));
      } else if (e.key === 'Delete') {
        if (selectedNotes.length > 0) {
           removeNotes(selectedNotes);
           setSelectedNotes([]);
           commitHistory();
        }
      } else if (e.key.startsWith('Arrow') && selectedNotes.length > 0 && bmsDataRef.current) {
        e.preventDefault();
        
        let mDiff = 0;
        let pDiff = 0;
        let laneDiff = 0;
        
        if (e.key === 'ArrowUp') pDiff = 1 / gridSnap;
        else if (e.key === 'ArrowDown') pDiff = -1 / gridSnap;
        else if (e.key === 'ArrowLeft') laneDiff = -1;
        else if (e.key === 'ArrowRight') laneDiff = 1;

        if (mDiff === 0 && pDiff === 0 && laneDiff === 0) return;

        const getLaneCategory = (channel: number) => {
          if (channel === 0x01 || (channel >= 0x11 && channel <= 0x19) || (channel >= 0x21 && channel <= 0x29) || channel === 0x16 || channel === 0x26) return 'keysound';
          if (channel === 0x04 || channel === 0x06 || channel === 0x0A) return 'video';
          return 'other';
        };

        let validLaneIndexDiff = laneDiff;
        if (laneDiff !== 0) {
          let minAllowedDiff = -Infinity;
          let maxAllowedDiff = Infinity;

          const notesToMove = bmsDataRef.current.notes.filter(n => selectedNotes.includes(n.id));
          const activeLayout = getActiveLayout();
          
          for (const dn of notesToMove) {
            const noteInitialLaneIndex = activeLayout.findIndex(l => 
              l.channel === dn.channel && 
              (l.type !== 'bgm' || l.name === `B${(dn.index % 32) + 1}`)
            );
            if (noteInitialLaneIndex === -1) continue;
            
            const initialCategory = getLaneCategory(dn.channel);
            if (initialCategory === 'other') {
               minAllowedDiff = Math.max(minAllowedDiff, 0);
               maxAllowedDiff = Math.min(maxAllowedDiff, 0);
               continue;
            }

            let lowestValidIndex = noteInitialLaneIndex;
            while (lowestValidIndex > 0 && getLaneCategory(activeLayout[lowestValidIndex - 1].channel || 0x01) === initialCategory) {
               lowestValidIndex--;
            }
            
            let highestValidIndex = noteInitialLaneIndex;
            while (highestValidIndex < activeLayout.length - 1 && getLaneCategory(activeLayout[highestValidIndex + 1].channel || 0x01) === initialCategory) {
               highestValidIndex++;
            }

            minAllowedDiff = Math.max(minAllowedDiff, lowestValidIndex - noteInitialLaneIndex);
            maxAllowedDiff = Math.min(maxAllowedDiff, highestValidIndex - noteInitialLaneIndex);
          }
          validLaneIndexDiff = Math.max(minAllowedDiff, Math.min(maxAllowedDiff, laneDiff));
        }

        if (validLaneIndexDiff === 0 && mDiff === 0 && pDiff === 0) return;

        const updatesArray: {id: string, updates: Partial<BmsNote>}[] = [];
        const notesToMove = bmsDataRef.current.notes.filter(n => selectedNotes.includes(n.id));

        for (const dn of notesToMove) {
          let newMeasure = dn.measure + mDiff;
          let newPosition = dn.position + pDiff;
          
          while (newPosition >= 1) { newPosition -= 1; newMeasure += 1; }
          while (newPosition < 0) { newPosition += 1; newMeasure -= 1; }
          if (newMeasure < 0) newMeasure = 0;
          
          newPosition = Math.round(newPosition * gridSnap) / gridSnap;
          if (newPosition >= 1) { newPosition = 0; newMeasure += 1; }

          const updates: any = { measure: newMeasure, position: newPosition };
          
          if (validLaneIndexDiff !== 0) {
            const activeLayout = getActiveLayout();
            const noteInitialLaneIndex = activeLayout.findIndex(l => 
              l.channel === dn.channel && 
              (l.type !== 'bgm' || l.name === `B${(dn.index % 32) + 1}`)
            );
            if (noteInitialLaneIndex !== -1) {
              const newLane = activeLayout[noteInitialLaneIndex + validLaneIndexDiff];
              updates.channel = newLane.channel || 0x01;
              if (updates.channel === 0x01) {
                updates.index = parseInt(newLane.name.substring(1)) - 1;
              }
            }
          }
          updatesArray.push({ id: dn.id, updates });
        }
        
        if (updatesArray.length > 0) {
          updateNotes(updatesArray);
          commitHistory();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gridSnap, setGridSnap, selectedNotes, removeNotes, setSelectedNotes, undo, redo, commitHistory, updateNotes]);

  // Global mouse drag tracking for scrollbars and notes
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      if (isDraggingV.current) {
        const deltaY = e.clientY - dragStartY.current;
        const trackHeight = canvas.height - 24;
        const vRect = vThumbRect.current;
        const draggableRange = trackHeight - vRect.h;
        if (draggableRange > 0) {
          const scrollDelta = -(deltaY / draggableRange) * maxScrollYRef.current;
          scrollY.current = Math.min(maxScrollYRef.current, Math.max(0, initialScrollY.current + scrollDelta));
          requestRender();
        }
        return;
      }

      if (isDraggingH.current) {
        const deltaX = e.clientX - dragStartX.current;
        const trackWidth = canvas.width - (maxScrollYRef.current > 0 ? 10 : 0);
        const hRect = hThumbRect.current;
        const draggableRange = trackWidth - hRect.w;
        if (draggableRange > 0) {
          const scrollDelta = (deltaX / draggableRange) * maxScrollXRef.current;
          scrollX.current = Math.min(maxScrollXRef.current, Math.max(0, initialScrollX.current + scrollDelta));
          requestRender();
        }
        return;
      }
      
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (isSelectingBox.current && selectionBoxStart.current) {
        selectionBoxCurrent.current = { x, y };
        requestRender();
      } else if (isDraggingNotes.current && dragStartBmsPos.current && bmsDataRef.current) {
        // Compute delta
        const ctxX = x + scrollX.current;
        const originY = canvas.height + scrollY.current;
        const ctxY = y - originY;

        let targetLane = null;
        let currentX = 50;
        const activeLayout = getActiveLayout();
        const currentZoomX = zoomXRef.current;
        for (const lane of activeLayout) {
          const width = lane.width * currentZoomX;
          if (ctxX >= currentX && ctxX < currentX + width) {
            targetLane = lane;
            break;
          }
          currentX += width;
        }

        if (!targetLane) return;

        const measureHeight = BASE_MEASURE_HEIGHT * zoomYRef.current;
        const absolutePosition = -ctxY / measureHeight;
        
        let targetMeasure = Math.floor(absolutePosition);
        let targetPos = absolutePosition - targetMeasure;
        const snap = gridSnapRef.current;
        targetPos = Math.round(targetPos * snap) / snap;
        if (targetPos >= 1) { targetMeasure += 1; targetPos = 0; }
        
        const mDiff = targetMeasure - dragStartBmsPos.current.measure;
        const pDiff = targetPos - dragStartBmsPos.current.position;

        const getLaneCategory = (channel: number) => {
          if (channel === 0x01 || (channel >= 0x11 && channel <= 0x19) || (channel >= 0x21 && channel <= 0x29) || channel === 0x16 || channel === 0x26) return 'keysound';
          if (channel === 0x04 || channel === 0x06 || channel === 0x0A) return 'video';
          return 'other';
        };

        const targetLaneIndex = activeLayout.findIndex(l => l === targetLane);
        const startLaneIndex = activeLayout.findIndex(l => 
          l.channel === dragStartBmsPos.current!.channel && 
          (l.type !== 'bgm' || l.name === `B${(dragStartBmsPos.current!.index % 32) + 1}`)
        );
        const laneIndexDiff = startLaneIndex !== -1 && targetLaneIndex !== -1 ? targetLaneIndex - startLaneIndex : 0;

        let minAllowedDiff = -Infinity;
        let maxAllowedDiff = Infinity;

        for (const dn of dragNoteInitialState.current) {
          const noteInitialLaneIndex = activeLayout.findIndex(l => 
            l.channel === dn.initialChannel && 
            (l.type !== 'bgm' || l.name === `B${(dn.initialIndex % 32) + 1}`)
          );
          if (noteInitialLaneIndex === -1) continue;
          
          const initialCategory = getLaneCategory(dn.initialChannel);
          if (initialCategory === 'other') {
             minAllowedDiff = Math.max(minAllowedDiff, 0);
             maxAllowedDiff = Math.min(maxAllowedDiff, 0);
             continue;
          }

          let lowestValidIndex = noteInitialLaneIndex;
          while (lowestValidIndex > 0 && getLaneCategory(activeLayout[lowestValidIndex - 1].channel || 0x01) === initialCategory) {
             lowestValidIndex--;
          }
          
          let highestValidIndex = noteInitialLaneIndex;
          while (highestValidIndex < activeLayout.length - 1 && getLaneCategory(activeLayout[highestValidIndex + 1].channel || 0x01) === initialCategory) {
             highestValidIndex++;
          }

          minAllowedDiff = Math.max(minAllowedDiff, lowestValidIndex - noteInitialLaneIndex);
          maxAllowedDiff = Math.min(maxAllowedDiff, highestValidIndex - noteInitialLaneIndex);
        }

        const validLaneIndexDiff = Math.max(minAllowedDiff, Math.min(maxAllowedDiff, laneIndexDiff));

        if (mDiff !== 0 || pDiff !== 0 || validLaneIndexDiff !== 0) {
          dragNoteDidMove.current = true;
        }

        dragNoteInitialState.current.forEach(dn => {
          let newMeasure = dn.initialMeasure + mDiff;
          let newPosition = dn.initialPosition + pDiff;
          
          while (newPosition >= 1) { newPosition -= 1; newMeasure += 1; }
          while (newPosition < 0) { newPosition += 1; newMeasure -= 1; }
          if (newMeasure < 0) newMeasure = 0;
          
          newPosition = Math.round(newPosition * snap) / snap;
          if (newPosition >= 1) { newPosition = 0; newMeasure += 1; }

          const updates: any = { measure: newMeasure, position: newPosition };
          
          if (validLaneIndexDiff !== 0) {
            const noteInitialLaneIndex = activeLayout.findIndex(l => 
              l.channel === dn.initialChannel && 
              (l.type !== 'bgm' || l.name === `B${(dn.initialIndex % 32) + 1}`)
            );
            if (noteInitialLaneIndex !== -1) {
              const newLane = activeLayout[noteInitialLaneIndex + validLaneIndexDiff];
              updates.channel = newLane.channel || 0x01;
              if (updates.channel === 0x01) {
                updates.index = parseInt(newLane.name.substring(1)) - 1;
              }
            }
          }
          
          updateNote(dn.id, updates);
        });
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      isDraggingV.current = false;
      isDraggingH.current = false;
      
      if (isSelectingBox.current && selectionBoxStart.current && selectionBoxCurrent.current && bmsDataRef.current) {
        const x1 = Math.min(selectionBoxStart.current.x, selectionBoxCurrent.current.x);
        const x2 = Math.max(selectionBoxStart.current.x, selectionBoxCurrent.current.x);
        const y1 = Math.min(selectionBoxStart.current.y, selectionBoxCurrent.current.y);
        const y2 = Math.max(selectionBoxStart.current.y, selectionBoxCurrent.current.y);

        const selectedIds: string[] = [];
        const currentMeasureHeight = BASE_MEASURE_HEIGHT * zoomYRef.current;
        const currentZoomX = zoomXRef.current;
        const originY = canvasRef.current!.height + scrollY.current;
        const activeLayout = getActiveLayout();

        bmsDataRef.current.notes.forEach(note => {
          let targetLaneIndex = -1;
          if (note.channel === 0x01) {
            targetLaneIndex = activeLayout.findIndex(l => l.type === 'bgm' && l.name === `B${(note.index % 32) + 1}`);
          } else {
            targetLaneIndex = activeLayout.findIndex(l => l.channel === note.channel);
          }
          if (targetLaneIndex === -1) return;

          let laneX = 50;
          for (let i = 0; i < targetLaneIndex; i++) laneX += activeLayout[i].width * currentZoomX;
          const lWidth = activeLayout[targetLaneIndex].width * currentZoomX;

          const y = -(note.measure * currentMeasureHeight + note.position * currentMeasureHeight);
          const noteY = y - 12;
          
          const canvasNoteX = laneX - scrollX.current;
          const canvasNoteY = noteY + originY;
          
          if (canvasNoteX + lWidth >= x1 && canvasNoteX <= x2 && canvasNoteY + 12 >= y1 && canvasNoteY <= y2) {
            selectedIds.push(note.id);
          }
        });

        if (e.shiftKey) {
           setSelectedNotes([...new Set([...selectedNotesRef.current, ...selectedIds])]);
        } else {
           setSelectedNotes(selectedIds);
        }
      }
      
      isSelectingBox.current = false;
      selectionBoxStart.current = null;
      selectionBoxCurrent.current = null;
      
      if (isDraggingNotes.current && dragNoteDidMove.current) {
        commitHistory();
      }
      
      isDraggingNotes.current = false;
      dragStartBmsPos.current = null;
      dragNoteDidMove.current = false;
      
      requestRender();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [updateNote, setSelectedNotes]);

  const getBmsPosition = (x: number, y: number) => {
    const ctxX = x + scrollX.current;
    const originY = canvasRef.current!.height + scrollY.current;
    const ctxY = y - originY;
    
    let currentX = 50;
    let targetLane = null;
    const activeLayout = getActiveLayout();
    const currentZoomX = zoomXRef.current;
    for (const lane of activeLayout) {
      const width = lane.width * currentZoomX;
      if (ctxX >= currentX && ctxX < currentX + width) {
        targetLane = lane;
        break;
      }
      currentX += width;
    }
    
    if (!targetLane) return null;
    
    const measureHeight = BASE_MEASURE_HEIGHT * zoomYRef.current;
    const absolutePosition = -ctxY / measureHeight;
    
    let measure = Math.floor(absolutePosition);
    let position = absolutePosition - measure;
    
    const snap = gridSnapRef.current;
    position = Math.round(position * snap) / snap;
    if (position >= 1) { measure += 1; position = 0; }
    if (measure < 0) return null;

    return { measure, position, lane: targetLane };
  };

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

    if (!bmsDataRef.current) return;
    
    const bmsPos = getBmsPosition(x, y);
    if (!bmsPos) return;

    const { measure, position, lane } = bmsPos;
    let actualChannel = lane.channel || 0;
    let actualIndex = 0;
    if (lane.type === 'bgm') {
      actualChannel = 0x01;
      actualIndex = parseInt(lane.name.substring(1)) - 1;
    }

    const findNoteAt = () => {
      const POS_TOLERANCE = 0.05;
      return bmsDataRef.current!.notes.find(n => 
        n.measure === measure && 
        n.channel === actualChannel && 
        (n.channel !== 0x01 || n.index === actualIndex) &&
        Math.abs(n.position - position) < POS_TOLERANCE
      );
    };

    if (activeToolRef.current === 'write') {
      if (actualChannel !== undefined) {
        // Only write if there's no note there
        if (!findNoteAt()) {
          addNote({
            id: crypto.randomUUID(),
            measure,
            position,
            channel: actualChannel,
            index: actualIndex,
            value: currentNoteValue
          });
          commitHistory();
        }
      }
    } else if (activeToolRef.current === 'erase') {
      const clickedNote = findNoteAt();
      if (clickedNote) {
        removeNote(clickedNote.id);
        commitHistory();
      }
    } else if (activeToolRef.current === 'select') {
      const clickedNote = findNoteAt();
      if (clickedNote) {
        if (!selectedNotesRef.current.includes(clickedNote.id)) {
          setSelectedNotes([clickedNote.id]);
          dragNoteInitialState.current = [{
            id: clickedNote.id,
            initialMeasure: clickedNote.measure,
            initialPosition: clickedNote.position,
            initialChannel: clickedNote.channel,
            initialIndex: clickedNote.index
          }];
        } else {
          dragNoteInitialState.current = bmsDataRef.current.notes
            .filter(n => selectedNotesRef.current.includes(n.id))
            .map(n => ({
              id: n.id,
              initialMeasure: n.measure,
              initialPosition: n.position,
              initialChannel: n.channel,
              initialIndex: n.index
            }));
        }
        isDraggingNotes.current = true;
        dragStartBmsPos.current = { measure, position, channel: actualChannel, index: actualIndex };
      } else {
        isSelectingBox.current = true;
        selectionBoxStart.current = { x, y };
        selectionBoxCurrent.current = { x, y };
        if (!e.shiftKey) setSelectedNotes([]);
      }
    }
  };

  const handleNew = () => {
    if (isDirty) {
      if (!window.confirm("You have unsaved changes. Are you sure you want to create a new file?")) return;
    }
    setBmsData(null);
    setRawBmsContent(null);
    setFileName("");
    setFileHandle(null);
    setIsFileMenuOpen(false);
  };

  const loadFileFromHandle = async (handle: any) => {
    try {
      const file = await handle.getFile();
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const text = event.target?.result as string;
          setRawBmsContent(text);
          const parsedData = parseBms(text, useBase62Ref.current);
          
          scrollY.current = 0;
          scrollX.current = 0;
          setBmsData(parsedData);
          setFileName(file.name);
          setFileHandle(handle);
          setLastSaved();
          
          const recents = await addRecentFile(handle);
          setRecentFiles(recents);
        } catch (err) {
          console.error("Failed to parse BMS", err);
          alert("Failed to parse BMS file.");
        }
      };
      reader.readAsText(file, 'Shift-JIS');
    } catch (e) {
      console.error(e);
      alert("Failed to read file. It may have been moved or permissions denied.");
    }
  };

  const handleOpen = async () => {
    setIsFileMenuOpen(false);
    if (isDirty) {
      if (!window.confirm("You have unsaved changes. Are you sure you want to open a different file?")) return;
    }
    try {
      const [handle] = await (window as any).showOpenFilePicker({
        types: [{ description: 'BMS Files', accept: { 'text/plain': ['.bms', '.bme', '.bml', '.pms'] } }]
      });
      await loadFileFromHandle(handle);
    } catch (e) {
      console.log('Open cancelled or failed', e);
    }
  };

  const handleSave = async () => {
    setIsFileMenuOpen(false);
    if (!isDirty || !bmsDataRef.current) return;

    if (!fileHandle) {
      handleSaveAs();
      return;
    }

    try {
      const bmsString = encodeBms(bmsDataRef.current, useBase62Ref.current);
      const writable = await fileHandle.createWritable();
      await writable.write(bmsString);
      await writable.close();
      setLastSaved();
    } catch (e) {
      console.error('Save failed', e);
      alert('Failed to save file. Check console for details.');
    }
  };

  const handleSaveAs = async () => {
    setIsFileMenuOpen(false);
    if (!bmsDataRef.current) return;

    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: fileName || 'untitled.bms',
        types: [{ description: 'BMS Files', accept: { 'text/plain': ['.bms', '.bme', '.bml', '.pms'] } }]
      });
      
      const bmsString = encodeBms(bmsDataRef.current, useBase62Ref.current);
      const writable = await handle.createWritable();
      await writable.write(bmsString);
      await writable.close();
      
      setFileName(handle.name);
      setFileHandle(handle);
      setLastSaved();
      
      const recents = await addRecentFile(handle);
      setRecentFiles(recents);
    } catch (e) {
      console.log('Save As cancelled or failed', e);
    }
  };

  const handleRecentClick = async (id: string) => {
    setIsFileMenuOpen(false);
    if (isDirty) {
      if (!window.confirm("You have unsaved changes. Are you sure you want to open a recent file?")) return;
    }
    const handle = await loadRecentFileHandle(id);
    if (handle) {
      await loadFileFromHandle(handle);
    } else {
      alert("Cannot open recent file. Permissions might have expired or file was deleted.");
      setRecentFiles(getRecentFiles()); // Refresh list to maybe clear invalid
    }
  };

  const handleExit = () => {
    setIsFileMenuOpen(false);
    if (isDirty) {
      if (!window.confirm("You have unsaved changes. Are you sure you want to exit?")) {
        return;
      }
    }
    // "Exit" by resetting to new state
    setBmsData(null);
    setRawBmsContent(null);
    setFileName("");
    setFileHandle(null);
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
          <div style={{ position: 'relative' }}>
            <div className={`menu-item ${isFileMenuOpen ? 'active' : ''}`} onClick={() => setIsFileMenuOpen(!isFileMenuOpen)}>File</div>
            {isFileMenuOpen && (
              <div className="dropdown-menu">
                <div className="dropdown-item" onClick={handleNew}>새로 만들기 (New)</div>
                <div className="dropdown-item" onClick={handleOpen}>열기 (Open)</div>
                <div className={`dropdown-item ${!isDirty || !bmsData ? 'disabled' : ''}`} onClick={handleSave}>저장 (Save)</div>
                <div className={`dropdown-item ${!bmsData ? 'disabled' : ''}`} onClick={handleSaveAs}>다른 이름으로 저장 (Save As)</div>
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

      <div className="main-area">
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
                className={`tool-button ${!isDirty || !bmsData ? 'disabled' : ''}`} 
                style={{ flex: 1, justifyContent: 'center', opacity: (!isDirty || !bmsData) ? 0.5 : 1, cursor: (!isDirty || !bmsData) ? 'not-allowed' : 'pointer' }}
                onClick={handleSave}
              >
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
                <select 
                  className="property-value" 
                  style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px 8px', fontSize: '0.9rem', outline: 'none', cursor: 'pointer' }}
                  value={bmsData.header.player}
                  onChange={(e) => updateHeader({ player: parseInt(e.target.value) })}
                >
                  <option value={1}>1 - Single Play</option>
                  <option value={2}>2 - Couple Play</option>
                  <option value={3}>3 - Double Play</option>
                </select>
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
      </div>
    </div>
  );
}

export default App;
