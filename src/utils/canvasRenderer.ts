import { BmsData } from '../parser/bmsParser';
import { getTargetLaneIndex } from '../constants/layout';

export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  canvas: { width: number; height: number };
  theme: string;
  zoomedLayout: any[];
  currentZoomX: number;
  currentZoomY: number;
  currentSettings: any;
  viewSettings: any;
  scrollY: number;
  scrollX: number;
  currentMeasureHeight: number;
  topY: number;
  bottomY: number;
  measureOffsets: any;
}

export function drawLaneBackgrounds(rc: RenderContext) {
  const { ctx, zoomedLayout, theme, currentSettings, viewSettings, topY, bottomY, canvas } = rc;

  // Draw left-most boundary line
  if (viewSettings.showVerticalLine) {
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(50, topY);
    ctx.lineTo(50, bottomY);
    ctx.strokeStyle = theme === 'light' 
      ? `rgba(0,0,0,${currentSettings.verticalLineOpacity * 0.4})` 
      : `rgba(255,255,255,${currentSettings.verticalLineOpacity})`;
    ctx.stroke();
  }

  // Draw Lane Backgrounds and right-side borders
  let currentX = 50;
  zoomedLayout.forEach((lane) => {
    let laneKey = lane.name;
    if (lane.type === 'bgm') {
      laneKey = 'B';
    }
    
    const customColors = currentSettings.customLaneColors || {};
    const customColor = customColors[laneKey];
    let laneColor = lane.color;
    let bgAlpha = 1.0;

    // Apply custom grid color to measure and timing lanes
    const isTimingOrMeasureLane = lane.type === 'measure' || lane.name === 'BPM' || lane.name === 'STOP' || lane.name === 'SCR';

    if (customColor) {
      laneColor = customColor.gridBg ?? customColor.bg;
      bgAlpha = customColor.gridBgAlpha ?? (isTimingOrMeasureLane ? 0.0 : 0.15);
    } else {
      if (lane.type === 'measure') {
        laneColor = '#000000';
        bgAlpha = 0.0;
      } else if (lane.name === 'BPM' || lane.name === 'STOP' || lane.name === 'SCR') {
        laneColor = '#000000';
        bgAlpha = 0.0;
      } else if (lane.name === 'BGA' || lane.name === 'LYR' || lane.name === 'POR') {
        laneColor = '#10b981';
        bgAlpha = 0.15;
      } else if (lane.name === 'S1' || lane.name === 'S2') {
        laneColor = '#ef4444';
        bgAlpha = 0.15;
      } else if (lane.type === 'bgm') {
        laneColor = '#e4e4e7';
        bgAlpha = 0.15;
      } else {
        bgAlpha = 0.15;
        if (lane.color === '#1e40af') {
          laneColor = '#1e40af';
        } else {
          laneColor = '#ffffff';
        }
      }
    }

    ctx.save();
    ctx.globalAlpha = bgAlpha;
    ctx.fillStyle = laneColor;
    ctx.fillRect(currentX, topY, lane.width, canvas.height);
    ctx.restore();
    
    currentX += lane.width;

    if (viewSettings.showVerticalLine) {
      ctx.beginPath();
      ctx.moveTo(currentX, topY);
      ctx.lineTo(currentX, bottomY);
      
      let strokeColor = '';
      if (lane.isGroupEnd) {
        strokeColor = theme === 'light'
          ? `rgba(0, 0, 0, ${currentSettings.verticalLineOpacity * 0.4})`
          : `rgba(255, 255, 255, ${currentSettings.verticalLineOpacity})`;
      } else {
        strokeColor = theme === 'light'
          ? `rgba(0, 0, 0, ${currentSettings.subVerticalLineOpacity * 0.4})`
          : `rgba(255, 255, 255, ${currentSettings.subVerticalLineOpacity})`;
      }
      
      ctx.strokeStyle = strokeColor;
      ctx.stroke();
    }
  });
}

export function drawMeasureLinesAndGrid(
  rc: RenderContext,
  bmsData: BmsData | null,
  gridSnap: number,
  auxGridSnap: number,
  currentX: number
) {
  const { ctx, theme, currentSettings, viewSettings, currentMeasureHeight, topY, bottomY, zoomedLayout, measureOffsets } = rc;

  const maxMeasure = measureOffsets.maxM;
  const totalMeasures = Math.max(maxMeasure, 100);

  for (let m = 0; m <= totalMeasures; m++) {
    const measureLen = bmsData?.measureLengths?.[m] ?? 1;
    const y = -(measureOffsets.offsets[m] * currentMeasureHeight);
    const yEnd = y - currentMeasureHeight * measureLen;
    
    if (y < topY - currentMeasureHeight || yEnd > bottomY + currentMeasureHeight) continue;

    if (viewSettings.showMeasureLine) {
      ctx.strokeStyle = theme === 'light' 
        ? `rgba(0, 0, 0, ${currentSettings.measureLineOpacity * 0.4})` 
        : (theme === 'cyberpunk' ? `rgba(255, 0, 255, ${currentSettings.measureLineOpacity})` : `rgba(255, 255, 255, ${currentSettings.measureLineOpacity})`);
      ctx.beginPath();
      ctx.moveTo(50, y);
      ctx.lineTo(currentX, y);
      ctx.stroke();
    }

    const snap = gridSnap;
    const auxSnap = auxGridSnap;
    const lineMap = new Map<number, number>();

    // 1. Aux grid lines (higher priority/brightness)
    const maxAux = Math.ceil(measureLen * auxSnap);
    for (let j = 1; j < maxAux; j++) {
      const ratio = j / auxSnap;
      if (ratio >= measureLen - 1e-9) continue;
      lineMap.set(ratio, 0.2); // Aux grid line opacity representation
    }

    // 2. Main grid lines (lower priority/brightness)
    const maxMain = Math.ceil(measureLen * snap);
    for (let i = 1; i < maxMain; i++) {
      const ratio = i / snap;
      if (ratio >= measureLen - 1e-9) continue;
      let exists = false;
      for (const key of lineMap.keys()) {
        if (Math.abs(key - ratio) < 1e-9) {
          exists = true;
          break;
        }
      }
      if (!exists) {
        lineMap.set(ratio, 0.08); // Main grid line opacity representation
      }
    }

    // Draw unique lines
    if (viewSettings.showGrid || viewSettings.showAuxGrid) {
      const auxColor = currentSettings.auxGridColor;

      lineMap.forEach((opacity, ratio) => {
        const isAux = opacity === 0.2;
        if (isAux && !viewSettings.showAuxGrid) return;
        if (!isAux && !viewSettings.showGrid) return;

        const lineY = y - currentMeasureHeight * ratio;
        const targetOpacity = isAux ? currentSettings.auxGridOpacity : currentSettings.gridOpacity;
        
        let strokeColor = theme === 'light' 
          ? `rgba(0, 0, 0, ${targetOpacity * 0.4})`
          : `rgba(255, 255, 255, ${targetOpacity})`;

        if (isAux) {
          if (auxColor === 'green') strokeColor = `rgba(34, 197, 94, ${targetOpacity * (theme === 'light' ? 0.8 : 1.5)})`;
          else if (auxColor === 'blue') strokeColor = `rgba(59, 130, 246, ${targetOpacity * (theme === 'light' ? 0.8 : 1.5)})`;
          else if (auxColor === 'red') strokeColor = `rgba(239, 68, 68, ${targetOpacity * (theme === 'light' ? 0.8 : 1.5)})`;
        }

        ctx.strokeStyle = strokeColor;
        ctx.beginPath();
        ctx.moveTo(50, lineY);
        ctx.lineTo(currentX, lineY);
        ctx.stroke();
      });
    }

    const measureLane = zoomedLayout.find(l => l.type === 'measure');
    if (measureLane) {
      if (viewSettings.showMeasureLine) {
        ctx.strokeStyle = theme === 'light' 
          ? `rgba(0, 0, 0, ${currentSettings.measureLineOpacity * 0.4})` 
          : `rgba(255, 255, 255, ${currentSettings.measureLineOpacity})`;
        ctx.beginPath();
        ctx.moveTo(50, y);
        ctx.lineTo(50 + measureLane.width, y);
        ctx.stroke();
      }

      if (viewSettings.showMeasureNumber) {
        ctx.fillStyle = theme === 'light' ? '#3f3f46' : '#a1a1aa';
        ctx.font = '10px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(m.toString(), 50 + measureLane.width / 2, y - 5);
      }
    }
  }
}

export function drawTimeSelectionOverlay(
  rc: RenderContext,
  activeTool: string,
  isTimeDragging: boolean,
  timeDragStart: number | null,
  timeDragCurrent: number | null,
  timeSelection: { start: number; end: number } | null,
  currentX: number
) {
  const { ctx, currentMeasureHeight } = rc;
  if (activeTool !== 'time') return;

  let selectionStart = null;
  let selectionEnd = null;

  if (isTimeDragging && timeDragStart !== null && timeDragCurrent !== null) {
    selectionStart = Math.min(timeDragStart, timeDragCurrent);
    selectionEnd = Math.max(timeDragStart, timeDragCurrent);
  } else if (timeSelection) {
    selectionStart = timeSelection.start;
    selectionEnd = timeSelection.end;
  }

  if (selectionStart !== null && selectionEnd !== null) {
    const yStart = -(selectionStart * currentMeasureHeight);
    const yEnd = -(selectionEnd * currentMeasureHeight);
    const yTop = Math.min(yStart, yEnd);
    const yBottom = Math.max(yStart, yEnd);

    ctx.save();
    ctx.fillStyle = 'rgba(167, 139, 250, 0.18)'; // Premium elegant translucent violet
    ctx.fillRect(50, yTop, currentX - 50, yBottom - yTop);

    // Dot border styling
    ctx.strokeStyle = '#a78bfa';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);

    ctx.beginPath();
    ctx.moveTo(50, yStart);
    ctx.lineTo(currentX, yStart);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(50, yEnd);
    ctx.lineTo(currentX, yEnd);
    ctx.stroke();

    ctx.restore();
  }
}

export function drawLongNoteBodies(
  rc: RenderContext,
  bmsData: BmsData | null,
  longNotePairs: any[],
  selectedNotes: string[]
) {
  const { ctx, currentMeasureHeight, bottomY, topY, zoomedLayout, measureOffsets } = rc;
  if (!bmsData || longNotePairs.length === 0) return;

  longNotePairs.forEach(pair => {
    const { start, end } = pair;
    const isSelected = selectedNotes.includes(start.id) || selectedNotes.includes(end.id);
    
    if (isSelected) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.6)';
    } else {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    }
    
    const startMeasureLen = bmsData.measureLengths[start.measure] ?? 1;
    const endMeasureLen = bmsData.measureLengths[end.measure] ?? 1;
    
    const startY = -(measureOffsets.offsets[start.measure] + start.position * startMeasureLen) * currentMeasureHeight;
    const endY = -(measureOffsets.offsets[end.measure] + end.position * endMeasureLen) * currentMeasureHeight;
    
    if (Math.min(startY, endY) > bottomY + 20 || Math.max(startY, endY) < topY - 20) return;

    let targetLaneIndex = getTargetLaneIndex(zoomedLayout, start.channel, start.index);
    if (targetLaneIndex !== -1) {
      let laneX = 50;
      for (let i = 0; i < targetLaneIndex; i++) laneX += zoomedLayout[i].width;
      const lWidth = zoomedLayout[targetLaneIndex].width;
      
      const yTop = Math.min(startY, endY);
      const yBottom = Math.max(startY, endY);
      
      ctx.fillRect(laneX + 1, yTop, lWidth - 2, yBottom - yTop);
    }
  });
}

export function drawDraggingLongNotePreview(
  rc: RenderContext,
  bmsData: BmsData | null,
  isDrawingLongNote: boolean,
  writeStartBmsPos: any,
  writeCurrentBmsPos: any
) {
  const { ctx, currentMeasureHeight, zoomedLayout, measureOffsets, currentSettings } = rc;
  if (!isDrawingLongNote || !writeStartBmsPos || !writeCurrentBmsPos || !bmsData) return;

  const start = writeStartBmsPos;
  const end = writeCurrentBmsPos;

  const startMeasureLen = bmsData.measureLengths[start.measure] ?? 1;
  const endMeasureLen = bmsData.measureLengths[end.measure] ?? 1;

  const startAbsolutePos = measureOffsets.offsets[start.measure] + start.position * startMeasureLen;
  const endAbsolutePos = measureOffsets.offsets[end.measure] + end.position * endMeasureLen;

  const startY = -startAbsolutePos * currentMeasureHeight;
  const endY = -endAbsolutePos * currentMeasureHeight;

  let targetLaneIndex = getTargetLaneIndex(zoomedLayout, start.channel, start.index);
  if (targetLaneIndex !== -1) {
    let laneX = 50;
    for (let i = 0; i < targetLaneIndex; i++) laneX += zoomedLayout[i].width;
    const lWidth = zoomedLayout[targetLaneIndex].width;

    const yTop = Math.min(startY, endY);
    const yBottom = Math.max(startY, endY);

    ctx.fillStyle = 'rgba(234, 179, 8, 0.4)';
    ctx.fillRect(laneX + 1, yTop, lWidth - 2, yBottom - yTop);

    const noteHeight = currentSettings.noteHeight ?? 12;
    ctx.fillStyle = 'rgba(234, 179, 8, 0.7)';
    ctx.fillRect(laneX + 2, yTop - noteHeight, lWidth - 4, noteHeight);
    ctx.fillRect(laneX + 2, yBottom - noteHeight, lWidth - 4, noteHeight);
  }
}

export function drawNotes(
  rc: RenderContext,
  bmsData: BmsData | null,
  selectedNotes: string[],
  overlappingNoteIds: Set<string>,
  useBase62: 16 | 36 | 62,
  encodeBmsValue: (val: number, base: 16 | 36 | 62) => string
) {
  const { ctx, currentMeasureHeight, bottomY, topY, zoomedLayout, measureOffsets, currentSettings } = rc;
  if (!bmsData) return;

  bmsData.notes.forEach(note => {
    const measureLen = bmsData.measureLengths[note.measure] ?? 1;
    const y = -(measureOffsets.offsets[note.measure] + note.position * measureLen) * currentMeasureHeight;
    
    if (y < topY - 20 || y > bottomY + 20) return;

    let targetLaneIndex = getTargetLaneIndex(zoomedLayout, note.channel, note.index);

    if (targetLaneIndex !== -1) {
      let laneX = 50;
      for (let i = 0; i < targetLaneIndex; i++) laneX += zoomedLayout[i].width;
      const lWidth = zoomedLayout[targetLaneIndex].width;
      
      const noteHeight = currentSettings.noteHeight ?? 12;
      const noteY = y - noteHeight;

      const noteSkin = currentSettings.noteSkin;
      const isSelected = selectedNotes.includes(note.id);
      const isOverlapping = overlappingNoteIds.has(note.id);
      
      const isInvisible = (note.channel >= 0x31 && note.channel <= 0x39) || (note.channel >= 0x41 && note.channel <= 0x49);
      const isMine = (note.channel >= 0xD1 && note.channel <= 0xD9) || (note.channel >= 0xE1 && note.channel <= 0xE9);
      
      let laneKey = '';
      if (targetLaneIndex !== -1) {
        const lane = zoomedLayout[targetLaneIndex];
        if (lane.type === 'bgm') {
          laneKey = 'B';
        } else {
          laneKey = lane.name;
        }
      }
      const customColors = currentSettings.customLaneColors || {};
      const laneColor = customColors[laneKey] || { bg: '#f4f4f5', bgAlpha: 1.0, fg: '#000000', fgAlpha: 1.0 };

      let baseColor = laneColor.bg;
      let baseAlpha = laneColor.bgAlpha ?? 1.0;
      let borderColor = '#000000';
      let textColor = laneColor.fg;
      let textAlpha = laneColor.fgAlpha ?? 1.0;
      
      if (isOverlapping) {
        const overlapColor = customColors['OVERLAP'] || { bg: '#ffffaa', bgAlpha: 1.0, fg: '#bbbb00', fgAlpha: 1.0 };
        baseColor = overlapColor.bg;
        baseAlpha = overlapColor.bgAlpha ?? 1.0;
        borderColor = overlapColor.fg;
        textColor = overlapColor.fg;
        textAlpha = overlapColor.fgAlpha ?? 1.0;
      } else if (isSelected) {
        const selectColor = customColors['SELECT'] || { bg: '#ffaaaa', bgAlpha: 1.0, fg: '#ff0000', fgAlpha: 1.0 };
        baseColor = selectColor.bg;
        baseAlpha = selectColor.bgAlpha ?? 1.0;
        borderColor = selectColor.fg;
        textColor = selectColor.fg;
        textAlpha = selectColor.fgAlpha ?? 1.0;
      } else if (isMine) {
        const mineColor = customColors['MINE'] || { bg: '#991b1b', bgAlpha: 1.0, fg: '#ffffff', fgAlpha: 1.0 };
        baseColor = mineColor.bg;
        baseAlpha = mineColor.bgAlpha ?? 1.0;
        borderColor = '#7f1d1d';
        textColor = mineColor.fg;
        textAlpha = mineColor.fgAlpha ?? 1.0;
      } else if (isInvisible) {
        const invColor = customColors['INV'] || { bg: '#f4f4f5', bgAlpha: 0.4, fg: '#000000', fgAlpha: 0.4 };
        baseColor = invColor.bg;
        baseAlpha = invColor.bgAlpha ?? 0.4;
        textColor = invColor.fg;
        textAlpha = invColor.fgAlpha ?? 0.4;
      }

      ctx.save();
      ctx.globalAlpha = baseAlpha;

      ctx.fillStyle = baseColor;
      ctx.strokeStyle = borderColor;

      if (noteSkin === 'gradient') {
        ctx.fillRect(laneX + 1, noteY, lWidth - 2, noteHeight);
        const grad = ctx.createLinearGradient(laneX, noteY, laneX, noteY + noteHeight);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0.2)');
        ctx.fillStyle = grad;
        ctx.fillRect(laneX + 1, noteY, lWidth - 2, noteHeight);
        ctx.strokeRect(laneX + 1, noteY, lWidth - 2, noteHeight);
      } else if (noteSkin === '3d') {
        ctx.fillRect(laneX + 1, noteY, lWidth - 2, noteHeight);
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.fillRect(laneX + 1, noteY, lWidth - 2, 2);
        ctx.fillRect(laneX + 1, noteY, 2, noteHeight);
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(laneX + 1, noteY + noteHeight - 2, lWidth - 2, 2);
        ctx.fillRect(laneX + lWidth - 3, noteY, 2, noteHeight);
        
        ctx.strokeRect(laneX + 1, noteY, lWidth - 2, noteHeight);
      } else {
        ctx.fillRect(laneX + 1, noteY, lWidth - 2, noteHeight);
        ctx.strokeRect(laneX + 1, noteY, lWidth - 2, noteHeight);
      }
      
      ctx.globalAlpha = textAlpha;
      ctx.fillStyle = textColor;
      ctx.font = `${currentSettings.fontSize ?? 10}px Inter`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      let displayText = encodeBmsValue(note.value, useBase62);
      if (currentSettings.showKeySoundFileName && bmsData.wavs[note.value]) {
        const fullWav = bmsData.wavs[note.value];
        const baseWav = fullWav.split('.')[0] || fullWav;
        displayText = baseWav.length > 5 ? baseWav.substring(0, 5) : baseWav;
      } else if (note.channel === 0x03) {
        displayText = note.value.toString();
      } else if (note.channel === 0x08) {
        const bpmVal = bmsData.bpms[note.value];
        if (bpmVal !== undefined) displayText = bpmVal.toString();
      } else if (note.channel === 0x09) {
        const stopVal = bmsData.stops[note.value];
        if (stopVal !== undefined) displayText = stopVal.toString();
      } else if (note.channel === 256) {
        const scrollVal = bmsData.scrolls[note.value];
        if (scrollVal !== undefined) displayText = scrollVal.toString();
      }
      ctx.fillText(displayText, laneX + lWidth / 2, noteY + noteHeight / 2);
      
      ctx.restore();
    }
  });
}

export function drawGhostNote(
  rc: RenderContext,
  bmsData: BmsData | null,
  activeTool: string,
  hoverBmsPos: any,
  currentNoteValue: number,
  useBase62: 16 | 36 | 62,
  encodeBmsValue: (val: number, base: 16 | 36 | 62) => string
) {
  const { ctx, currentMeasureHeight, zoomedLayout, measureOffsets, currentSettings } = rc;
  if (activeTool !== 'write' || !hoverBmsPos) return;

  const measureLen = bmsData?.measureLengths[hoverBmsPos.measure] ?? 1;
  const y = -(measureOffsets.offsets[hoverBmsPos.measure] + hoverBmsPos.position * measureLen) * currentMeasureHeight;
  
  let laneX = 50;
  let found = false;
  let lWidth = 0;
  for (const lane of zoomedLayout) {
    if (lane.name === hoverBmsPos.lane.name) {
      found = true;
      lWidth = lane.width;
      break;
    }
    laneX += lane.width;
  }

  if (found) {
    const noteHeight = currentSettings.noteHeight ?? 12;
    const noteY = y - noteHeight;
    
    let laneKey = '';
    if (hoverBmsPos.lane.type === 'bgm') {
      laneKey = 'B';
    } else {
      laneKey = hoverBmsPos.lane.name;
    }
    const customColors = currentSettings.customLaneColors || {};
    const laneColor = customColors[laneKey] || { bg: '#f4f4f5', bgAlpha: 1.0, fg: '#000000', fgAlpha: 1.0 };

    ctx.save();
    ctx.globalAlpha = (laneColor.bgAlpha ?? 1.0) * 0.5;
    ctx.fillStyle = laneColor.bg;
    ctx.fillRect(laneX + 1, noteY, lWidth - 2, noteHeight);
    ctx.strokeStyle = '#ff0000';
    ctx.strokeRect(laneX + 1, noteY, lWidth - 2, noteHeight);
    
    let displayText = encodeBmsValue(currentNoteValue, useBase62);
    ctx.globalAlpha = (laneColor.fgAlpha ?? 1.0) * 0.5;
    ctx.fillStyle = laneColor.fg;
    ctx.font = `${currentSettings.fontSize ?? 10}px Inter`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(displayText, laneX + lWidth / 2, noteY + noteHeight / 2);
    ctx.restore();
  }
}

export function drawSelectionBox(
  rc: RenderContext,
  isSelectingBox: boolean,
  selectionBoxStart: { x: number; y: number } | null,
  selectionBoxCurrent: { x: number; y: number } | null
) {
  const { ctx } = rc;
  if (!isSelectingBox || !selectionBoxStart || !selectionBoxCurrent) return;
  const sx = selectionBoxStart.x;
  const sy = selectionBoxStart.y;
  const cx = selectionBoxCurrent.x;
  const cy = selectionBoxCurrent.y;
  
  ctx.save();
  ctx.fillStyle = 'rgba(100, 150, 255, 0.2)';
  ctx.fillRect(Math.min(sx, cx), Math.min(sy, cy), Math.abs(cx - sx), Math.abs(cy - sy));
  ctx.strokeStyle = 'rgba(100, 150, 255, 0.8)';
  ctx.strokeRect(Math.min(sx, cx), Math.min(sy, cy), Math.abs(cx - sx), Math.abs(cy - sy));
  ctx.restore();
}

export function drawPlaybackGuides(
  rc: RenderContext,
  currentX: number
) {
  const { ctx, canvas, scrollX } = rc;
  
  ctx.save();
  ctx.strokeStyle = '#ef4444'; // Red-500
  ctx.lineWidth = 3;
  ctx.beginPath();
  
  const judgmentLineStartX = Math.max(50, 50 - scrollX);
  const judgmentLineEndX = Math.min(canvas.width, currentX - scrollX);
  
  if (judgmentLineStartX < judgmentLineEndX) {
    ctx.moveTo(judgmentLineStartX, canvas.height - 80);
    ctx.lineTo(judgmentLineEndX, canvas.height - 80);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawHeaderSticky(
  rc: RenderContext
) {
  const { ctx, canvas, scrollX, zoomedLayout, viewSettings } = rc;
  if (!viewSettings.showColumnHeader) return;

  ctx.save();
  ctx.translate(-scrollX, 0);
  
  ctx.fillStyle = 'rgba(10, 10, 12, 0.9)';
  ctx.fillRect(scrollX, 0, canvas.width + scrollX, 24);
  
  // Header Bottom Border
  ctx.strokeStyle = '#333333';
  ctx.beginPath();
  ctx.moveTo(scrollX, 24);
  ctx.lineTo(canvas.width + scrollX, 24);
  ctx.stroke();

  let headerX = 50;
  ctx.fillStyle = '#a1a1aa';
  ctx.font = '10px Inter';
  ctx.textAlign = 'center';
  
  zoomedLayout.forEach((lane) => {
    ctx.fillText(lane.name, headerX + lane.width / 2, 16);
    headerX += lane.width;
  });
  ctx.restore();
}

export function drawAutoscrollAnchor(
  rc: RenderContext,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  isAutoscrolling: boolean,
  autoscrollAnchor: { x: number; y: number } | null,
  autoscrollCurrent: { x: number; y: number } | null,
  dpr: number
) {
  const { ctx } = rc;
  if (!isAutoscrolling || !autoscrollAnchor || !canvasRef.current) return;

  const rect = canvasRef.current.getBoundingClientRect();
  const anchorX = autoscrollAnchor.x - rect.left;
  const anchorY = autoscrollAnchor.y - rect.top;

  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // 1. Semi-transparent outer ring guide
  ctx.beginPath();
  ctx.arc(anchorX, anchorY, 16, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.stroke();

  // 2. Central anchor dot
  ctx.beginPath();
  ctx.arc(anchorX, anchorY, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.fill();

  // 3. Dynamic arrow guide line to current mouse position
  if (autoscrollCurrent) {
    const curX = autoscrollCurrent.x - rect.left;
    const curY = autoscrollCurrent.y - rect.top;
    const dx = curX - anchorX;
    const dy = curY - anchorY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 15) {
      ctx.beginPath();
      ctx.moveTo(anchorX, anchorY);
      ctx.lineTo(curX, curY);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(curX, curY, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ff007f'; // Vivid neon rose
      ctx.fill();
    }
  }
  ctx.restore();
}
