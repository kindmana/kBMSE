import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useEditorStore } from './store/editorStore';
import { encodeBmsValue, decodeBmsValue, BmsData, BmsNote } from './parser/bmsParser';
import { getRecentFiles, RecentFile } from './utils/fileSystem';
import { getAudioContext, playSound, playSoloSound, findAudioBuffer } from './utils/audioPlayer';
import { useFileOperations } from './hooks/useFileOperations';
import './App.css';

import { BASE_MEASURE_HEIGHT, getTargetLaneIndex, getActiveLayout as getActiveLayoutUtil } from './constants/layout';
import { Topbar } from './components/layout/Topbar';
import { LeftSidebar } from './components/layout/LeftSidebar';
import { RightSidebar } from './components/layout/RightSidebar';
import { GoToMeasureModal } from './components/ui/GoToMeasureModal';
import { SettingsModal } from './components/ui/SettingsModal';
import { HelpModal } from './components/ui/HelpModal';
import { BmsDiffModal } from './components/ui/BmsDiffModal';
import { BmsValidationErrorModal } from './components/ui/BmsValidationErrorModal';
import { BmsValidationError } from './utils/bmsValidator';
import { TimingValueModal } from './components/ui/TimingValueModal';
import { KeyChangeModal } from './components/ui/KeyChangeModal';
import { TimeSpaceModal } from './components/ui/TimeSpaceModal';
import { TimeBpmModal } from './components/ui/TimeBpmModal';
import { TimeStopModal } from './components/ui/TimeStopModal';
import { TimeAutoPlaceModal } from './components/ui/TimeAutoPlaceModal';
import { getSnappedAbsTime as getSnappedAbsTimeUtil, getBmsPosFromAbsTime } from './utils/coordinateCalculator';
import { useTimeEditOperations } from './hooks/useTimeEditOperations';
import { useBmsDiff } from './hooks/useBmsDiff';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { usePlaybackController } from './hooks/usePlaybackController';
import {
  RenderContext,
  drawLaneBackgrounds,
  drawMeasureLinesAndGrid,
  drawTimeSelectionOverlay,
  drawLongNoteBodies,
  drawDraggingLongNotePreview,
  drawNotes,
  drawGhostNote,
  drawSelectionBox,
  drawPlaybackGuides,
  drawHeaderSticky,
  drawAutoscrollAnchor
} from './utils/canvasRenderer';

const MIN_SCROLL_Y = -120; // 0번 마디 밑부분 여백을 위해 마이너스 스크롤 허용

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { 
    activeTool, setActiveTool, 
    useBase62, 
    bmsData, setBmsData, 
    setRawBmsContent,
    gridSnap, setGridSnap,
    auxGridSnap,
    selectedNotes, setSelectedNotes: storeSetSelectedNotes,
    currentNoteValue,
    addNote, addNotes, removeNote, updateNote, removeNotes, updateNotes,
    undo, redo, commitHistory,
    zoomX, setZoomX,
    zoomY, setZoomY,
    fileName, setFileName,
    fileHandle, setFileHandle,
    historyIndex, lastSavedHistoryIndex, setLastSaved,
    updateHeader, updateWav, updateBmp,
    viewSettings,
    settings,
    keyMode,
    lockVerticalPosition,
    
    // Playback state and actions
    isPlaying,
    playFromBeginning,
    stopPlay
  } = useEditorStore();

  const setSelectedNotes = useCallback((ids: string[]) => {
    const extendedIds = new Set<string>(ids);
    const pairs = longNotePairsRef.current || [];
    
    let sizeBefore: number;
    do {
      sizeBefore = extendedIds.size;
      pairs.forEach(pair => {
        if (extendedIds.has(pair.start.id)) {
          extendedIds.add(pair.end.id);
        }
        if (extendedIds.has(pair.end.id)) {
          extendedIds.add(pair.start.id);
        }
      });
    } while (extendedIds.size !== sizeBefore);

    storeSetSelectedNotes(Array.from(extendedIds));
  }, [storeSetSelectedNotes]);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'general' | 'visual'>('general');
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [helpTab, setHelpTab] = useState<'shortcuts' | 'leftSidebar' | 'rightSidebar' | 'settings'>('shortcuts');

  const handleOpenSettings = (tab: 'general' | 'visual') => {
    setSettingsTab(tab);
    setIsSettingsOpen(true);
  };

  const handleOpenHelp = (tab: 'shortcuts' | 'leftSidebar' | 'rightSidebar' | 'settings' = 'shortcuts') => {
    setHelpTab(tab);
    setIsHelpOpen(true);
  };

  // Playback Refs are now managed by usePlaybackController hook

  const [isFileMenuOpen, setIsFileMenuOpen] = useState(false);
  const [isGoToMeasureOpen, setIsGoToMeasureOpen] = useState(false);
  const [isBmsDiffOpen, setIsBmsDiffOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<BmsValidationError[]>([]);
  const [isValidationErrorOpen, setIsValidationErrorOpen] = useState(false);
  const saveForceRef = useRef<(() => void) | null>(null);
  const [isTimingValueModalOpen, setIsTimingValueModalOpen] = useState(false);
  const [timingModalChannel, setTimingModalChannel] = useState(0);
  const [timingModalDefaultValue, setTimingModalDefaultValue] = useState<number | undefined>(undefined);
  const timingModalClickInfo = useRef<{ measure: number; position: number; actualChannel: number; actualIndex: number; editingNoteId?: string } | null>(null);
  
  const [isKeyChangeModalOpen, setIsKeyChangeModalOpen] = useState(false);
  const [keyChangeModalDefaultValue, setKeyChangeModalDefaultValue] = useState<number>(0);
  const [keyChangeModalNoteId, setKeyChangeModalNoteId] = useState<string | null>(null);
  const [bmsFilesToSelect, setBmsFilesToSelect] = useState<File[]>([]);
  const [isBmsSelectionOpen, setIsBmsSelectionOpen] = useState(false);
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);

  // 시간편집 (Time Edit F1) 도구 상태 및 드래그 Ref 선언
  const [timeSelection, setTimeSelection] = useState<{ start: number; end: number } | null>(null);
  const [isTimeSpaceModalOpen, setIsTimeSpaceModalOpen] = useState(false);
  const [isTimeBpmModalOpen, setIsTimeBpmModalOpen] = useState(false);
  const [isTimeStopModalOpen, setIsTimeStopModalOpen] = useState(false);
  const [isTimeAutoPlaceModalOpen, setIsTimeAutoPlaceModalOpen] = useState(false);

  const isTimeDragging = useRef(false);
  const timeDragStart = useRef<number | null>(null);
  const timeDragCurrent = useRef<number | null>(null);

  // 툴 전환 시 시간 선택 영역 실시간 청소
  useEffect(() => {
    if (activeTool !== 'time') {
      setTimeSelection(null);
    }
  }, [activeTool]);

  useEffect(() => {
    setRecentFiles(getRecentFiles());
  }, []);

  // BMS 키음 엇갈림 검사 보존 상태 useBmsDiff 훅 바인딩
  const {
    diffBaseBms,
    setDiffBaseBms,
    diffBaseFileName,
    setDiffBaseFileName,
    diffResults,
    setDiffResults,
    diffIsCompared,
    setDiffIsCompared,
    diffCheckHistoryIndex,
    resetDiff
  } = useBmsDiff(historyIndex);



  const currentSpeed = useEditorStore((state) => state.playbackSpeed);

  const isDirty = historyIndex !== lastSavedHistoryIndex;

  const totalNotesCount = bmsData?.notes.length || 0;
  const playableNotesCount = bmsData?.notes.filter(n => (n.channel >= 0x11 && n.channel <= 0x19) || (n.channel >= 0x21 && n.channel <= 0x29)).length || 0;

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

  // Resize State
  const isResizingLeft = useRef(false);
  const isResizingRight = useRef(false);

  // References to state to avoid stale closures in requestAnimationFrame
  const bmsDataRef = useRef<BmsData | null>(null);
  const useBase62Ref = useRef<16 | 36 | 62>(useBase62);
  const zoomXRef = useRef<number>(zoomX);

  const getActiveLayout = () => {
    const player = bmsDataRef.current?.header.player || 1;
    return getActiveLayoutUtil(
      player,
      keyModeRef.current,
      settingsRef.current.scratchOnRight,
      settingsRef.current.customLaneColors,
      viewSettingsRef.current
    );
  };

  // Replaced with refs for performance:
  const leftWidthRef = useRef(300);
  const rightWidthRef = useRef(300);
  const appContainerRef = useRef<HTMLDivElement>(null);

  const zoomYRef = useRef<number>(zoomY);
  const prevZoomYRef = useRef<number>(zoomY);
  const activeToolRef = useRef<string>(activeTool);
  const gridSnapRef = useRef<number>(gridSnap);
  const auxGridSnapRef = useRef<number>(auxGridSnap);
  const selectedNotesRef = useRef<string[]>(selectedNotes);
  const viewSettingsRef = useRef(viewSettings);
  const settingsRef = useRef(settings);
  const keyModeRef = useRef(keyMode);
  const lockVerticalPositionRef = useRef(lockVerticalPosition);

  // Autoscroll Feature states and helpers
  const isAutoscrolling = useRef<boolean>(false);
  const autoscrollAnchor = useRef<{ x: number; y: number } | null>(null);
  const autoscrollCurrent = useRef<{ x: number; y: number } | null>(null);
  const autoscrollFrameId = useRef<number | null>(null);

  const handleAutoscrollMouseMove = (e: MouseEvent) => {
    autoscrollCurrent.current = { x: e.clientX, y: e.clientY };
  };

  const stopAutoscroll = () => {
    if (!isAutoscrolling.current) return;
    isAutoscrolling.current = false;
    autoscrollAnchor.current = null;
    autoscrollCurrent.current = null;
    
    if (autoscrollFrameId.current !== null) {
      cancelAnimationFrame(autoscrollFrameId.current);
      autoscrollFrameId.current = null;
    }
    
    window.removeEventListener('mousemove', handleAutoscrollMouseMove);
    window.removeEventListener('mousedown', handleAutoscrollMousedownOutside);
    requestRender();
  };

  const handleAutoscrollMousedownOutside = (e: MouseEvent) => {
    // Prevent immediate close trigger during click down
    e.preventDefault();
    stopAutoscroll();
  };

  const runAutoscrollLoop = () => {
    if (!isAutoscrolling.current || !autoscrollAnchor.current || !autoscrollCurrent.current) {
      return;
    }

    const anchor = autoscrollAnchor.current;
    const current = autoscrollCurrent.current;

    const dx = current.x - anchor.x;
    const dy = current.y - anchor.y;

    const deadzone = 10;
    
    if (Math.abs(dy) > deadzone) {
      let speedY = (dy - Math.sign(dy) * deadzone) * 0.12;
      if (settingsRef.current.scrollDirection === 'normal') {
        speedY = -speedY;
      }
      scrollY.current += speedY;
    }
    
    if (Math.abs(dx) > deadzone) {
      const speedX = (dx - Math.sign(dx) * deadzone) * 0.12;
      scrollX.current += speedX;
    }

    scrollY.current = Math.min(maxScrollYRef.current, Math.max(MIN_SCROLL_Y, scrollY.current));
    scrollX.current = Math.min(maxScrollXRef.current, Math.max(0, scrollX.current));

    requestRender();

    autoscrollFrameId.current = requestAnimationFrame(runAutoscrollLoop);
  };

  const startAutoscroll = (clientX: number, clientY: number) => {
    isAutoscrolling.current = true;
    autoscrollAnchor.current = { x: clientX, y: clientY };
    autoscrollCurrent.current = { x: clientX, y: clientY };

    window.addEventListener('mousemove', handleAutoscrollMouseMove);
    
    setTimeout(() => {
      window.addEventListener('mousedown', handleAutoscrollMousedownOutside);
    }, 50);

    autoscrollFrameId.current = requestAnimationFrame(runAutoscrollLoop);
    requestRender();
  };

  useEffect(() => {
    return () => {
      if (autoscrollFrameId.current !== null) {
        cancelAnimationFrame(autoscrollFrameId.current);
      }
      window.removeEventListener('mousemove', handleAutoscrollMouseMove);
      window.removeEventListener('mousedown', handleAutoscrollMousedownOutside);
    };
  }, []);

  useEffect(() => {
    const oldZoomY = prevZoomYRef.current;
    if (oldZoomY !== zoomY) {
      const canvasHeight = canvasRef.current ? canvasRef.current.clientHeight : 600;
      const centerY = canvasHeight / 2;
      const targetScrollY = (centerY + scrollY.current) * (zoomY / oldZoomY) - centerY;
      
      const currentMeasureOffsets = measureOffsetsRef.current;
      if (currentMeasureOffsets) {
        const currentMeasureHeight = BASE_MEASURE_HEIGHT * zoomY;
        const totalHeight = currentMeasureOffsets.totalLen * currentMeasureHeight + 100;
        const newMaxScrollY = Math.max(0, totalHeight - canvasHeight);
        
        scrollY.current = Math.min(newMaxScrollY, Math.max(MIN_SCROLL_Y, targetScrollY));
        maxScrollYRef.current = newMaxScrollY;
      } else {
        scrollY.current = Math.max(MIN_SCROLL_Y, targetScrollY);
      }
      prevZoomYRef.current = zoomY;
    }

    bmsDataRef.current = bmsData;
    useBase62Ref.current = useBase62;
    zoomXRef.current = zoomX;
    zoomYRef.current = zoomY;
    activeToolRef.current = activeTool;
    
    // activeTool 변경 시 캔버스 마우스 커서 즉각 갱신
    if (canvasRef.current) {
      if (activeTool === 'select') {
        canvasRef.current.style.cursor = 'default';
      } else {
        canvasRef.current.style.cursor = 'crosshair';
      }
    }

    gridSnapRef.current = gridSnap;
    auxGridSnapRef.current = auxGridSnap;
    selectedNotesRef.current = selectedNotes;
    viewSettingsRef.current = viewSettings;
    settingsRef.current = settings;
    keyModeRef.current = keyMode;
    lockVerticalPositionRef.current = lockVerticalPosition;
    requestRender();
  }, [bmsData, useBase62, zoomX, zoomY, activeTool, gridSnap, auxGridSnap, selectedNotes, viewSettings, settings, keyMode, lockVerticalPosition]);

  useEffect(() => {
    let animationFrameId: number;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isResizingLeft.current && !isResizingRight.current) return;

      cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(() => {
        if (isResizingLeft.current) {
          let newWidth = e.clientX;
          if (newWidth < 200) newWidth = 200;
          if (newWidth > 600) newWidth = 600;
          leftWidthRef.current = newWidth;
          if (appContainerRef.current) {
            appContainerRef.current.style.setProperty('--sidebar-width', `${newWidth}px`);
          }
          requestRender();
        } else if (isResizingRight.current) {
          let newWidth = window.innerWidth - e.clientX;
          if (newWidth < 250) newWidth = 250;
          if (newWidth > 600) newWidth = 600;
          rightWidthRef.current = newWidth;
          if (appContainerRef.current) {
            appContainerRef.current.style.setProperty('--right-panel-width', `${newWidth}px`);
          }
          requestRender();
        }
      });
    };
    const handleGlobalMouseUp = () => {
      isResizingLeft.current = false;
      isResizingRight.current = false;
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const measureOffsets = useMemo(() => {
    const offsets: number[] = [];
    let currentOffset = 0;
    
    const noteMax = bmsData && bmsData.notes.length > 0 ? Math.max(...bmsData.notes.map(n => n.measure)) : 0;
    const lengthMax = bmsData && Object.keys(bmsData.measureLengths).length > 0 ? Math.max(...Object.keys(bmsData.measureLengths).map(Number)) : 0;
    const maxM = Math.max(100, noteMax, lengthMax) + 1;
    
    for (let m = 0; m <= maxM; m++) {
      offsets.push(currentOffset);
      const len = bmsData?.measureLengths?.[m] ?? 1;
      currentOffset += len;
    }
    console.log("[Diagnostic] Recalculating measureOffsets. maxM:", maxM, "measureLengths keys:", bmsData ? Object.keys(bmsData.measureLengths) : "none", "sample offsets[7..9]:", offsets.slice(7, 10));
    return { offsets, totalLen: currentOffset, maxM };
  }, [bmsData]);

  const hasNotesInsideStopArea = useMemo(() => {
    if (!timeSelection || !bmsData || !measureOffsets) return false;
    const { start: startAbs, end: endAbs } = timeSelection;
    if (endAbs <= startAbs) return false;

    const startLimit = startAbs + 1e-6;
    const endLimit = endAbs + 1e-6;

    return bmsData.notes.some(note => {
      if (note.measure >= measureOffsets.offsets.length) return false;
      const noteMeasureLen = bmsData.measureLengths[note.measure] ?? 1;
      const noteAbs = measureOffsets.offsets[note.measure] + note.position * noteMeasureLen;
      return noteAbs > startLimit && noteAbs <= endLimit;
    });
  }, [timeSelection, bmsData, measureOffsets]);

  const overlappingNoteIds = useMemo(() => {
    if (!bmsData) return new Set<string>();
    const overlaps = new Set<string>();
    const notes = bmsData.notes;
    
    // Sort notes by channel, then by measure and position
    const sorted = [...notes].sort((a, b) => {
      if (a.channel !== b.channel) return a.channel - b.channel;
      if (a.measure !== b.measure) return a.measure - b.measure;
      return a.position - b.position;
    });
    
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];
      
      if (a.channel === b.channel) {
        // BGM 채널인 경우 가상 BGM 레이어(index % 100)가 동일할 때만 겹침으로 간주
        if (a.channel === 0x01 && (a.index % 100) !== (b.index % 100)) {
          continue;
        }
        
        const isPerfectOverlap = a.measure === b.measure && Math.abs(a.position - b.position) < 1e-9;
        if (isPerfectOverlap) {
          overlaps.add(a.id);
          overlaps.add(b.id);
        }
      }
    }
    return overlaps;
  }, [bmsData?.notes]);

  // Find Long Note pairs
  const longNotePairs = useMemo(() => {
    if (!bmsData) return [];
    const pairs: { start: BmsNote, end: BmsNote }[] = [];
    const visited = new Set<string>();

    // 1. partnerId가 이미 존재하는 노트들을 짝지음
    for (const note of bmsData.notes) {
      if (note.partnerId && !visited.has(note.id)) {
        const partner = bmsData.notes.find(n => n.id === note.partnerId);
        if (partner && !visited.has(partner.id)) {
          visited.add(note.id);
          visited.add(partner.id);
          // 시작점과 끝점 구분 (measure + position 순서 기준)
          const t1 = note.measure + note.position;
          const t2 = partner.measure + partner.position;
          if (t1 <= t2) {
            pairs.push({ start: note, end: partner });
          } else {
            pairs.push({ start: partner, end: note });
          }
        }
      }
    }

    // 2. 만약 partnerId가 누락된 롱노트가 있다면, 시간 순으로 정렬하여 짝을 맞추고 partnerId를 주입해주는 폴백 동작
    const unmatchedLnNotesByChannel = new Map<number, BmsNote[]>();
    for (const note of bmsData.notes) {
      if (visited.has(note.id)) continue;
      if ((note.channel >= 0x51 && note.channel <= 0x59) || (note.channel >= 0x61 && note.channel <= 0x69)) {
        if (!unmatchedLnNotesByChannel.has(note.channel)) unmatchedLnNotesByChannel.set(note.channel, []);
        unmatchedLnNotesByChannel.get(note.channel)!.push(note);
      }
    }

    unmatchedLnNotesByChannel.forEach(notes => {
      notes.sort((a, b) => (a.measure + a.position) - (b.measure + b.position));
      for (let i = 0; i < notes.length - 1; i += 2) {
        const start = notes[i];
        const end = notes[i+1];
        const startWithPartner = { ...start, partnerId: end.id };
        const endWithPartner = { ...end, partnerId: start.id };
        pairs.push({ start: startWithPartner, end: endWithPartner });
        visited.add(start.id);
        visited.add(end.id);
      }
    });

    // 3. LNOBJ에 대한 폴백
    const lnObjStr = bmsData.header.lnobj;
    if (lnObjStr) {
      const lnObjVal = decodeBmsValue(lnObjStr, useBase62);
      if (lnObjVal > 0) {
        const playableNotesByChannel = new Map<number, BmsNote[]>();
        for (const note of bmsData.notes) {
          if (visited.has(note.id)) continue;
          if ((note.channel >= 0x11 && note.channel <= 0x19) || (note.channel >= 0x21 && note.channel <= 0x29)) {
            if (!playableNotesByChannel.has(note.channel)) playableNotesByChannel.set(note.channel, []);
            playableNotesByChannel.get(note.channel)!.push(note);
          }
        }

        playableNotesByChannel.forEach(notes => {
          notes.sort((a, b) => (a.measure + a.position) - (b.measure + b.position));
          for (let i = 1; i < notes.length; i++) {
            const n = notes[i];
            if (n.value === lnObjVal && !visited.has(n.id)) {
              const startNote = notes[i-1];
              if (startNote.value !== lnObjVal && !visited.has(startNote.id)) {
                const startNoteWithPartner = { ...startNote, partnerId: n.id };
                const nWithPartner = { ...n, partnerId: startNote.id };
                pairs.push({ start: startNoteWithPartner, end: nWithPartner });
                visited.add(startNote.id);
                visited.add(n.id);
              }
            }
          }
        });
      }
    }
    
    return pairs;
  }, [bmsData?.notes, bmsData?.header.lnobj, useBase62]);

  const measureOffsetsRef = useRef(measureOffsets);
  measureOffsetsRef.current = measureOffsets;

  const {
    timelineRef,
    sortedNotesRef,
    playedNoteIdsRef,
    isPlayingRef,
    playStartRealTimeRef,
    playStartTimeOffsetRef,
    playbackSpeedRef
  } = usePlaybackController(
    {
      isPlaying,
      playFromBeginning,
      bmsData,
      playbackSpeed: currentSpeed,
      measureOffsets,
      zoomY
    },
    {
      scrollY,
      requestRender
    }
  );
  
  // 새 파일 로드 시 엇갈림 검사 결과 자동 초기화 및 재생 즉시 정지, 0마디 이동
  useEffect(() => {
    resetDiff();
    stopPlay();
    scrollY.current = MIN_SCROLL_Y;
    requestRender();
  }, [fileName]);
  
  const overlappingNoteIdsRef = useRef(overlappingNoteIds);
  overlappingNoteIdsRef.current = overlappingNoteIds;

  const longNotePairsRef = useRef(longNotePairs);
  longNotePairsRef.current = longNotePairs;

  const longNoteEndIds = useMemo(() => {
    const ids = new Set<string>();
    longNotePairs.forEach(pair => {
      ids.add(pair.end.id);
    });
    return ids;
  }, [longNotePairs]);

  const longNoteEndIdsRef = useRef(longNoteEndIds);
  longNoteEndIdsRef.current = longNoteEndIds;

  const currentNoteValueRef = useRef(currentNoteValue);
  currentNoteValueRef.current = currentNoteValue;

  const {
    handleNew,
    handleOpen,
    handleSave,
    handleSaveAs,
    handleRecentClick,
    loadBmsFromFile,
    loadBmsByAbsolutePath
  } = useFileOperations({
    isDirty,
    bmsDataRef,
    useBase62Ref,
    scrollY,
    scrollX,
    fileName,
    fileHandle,
    setBmsData,
    setRawBmsContent,
    setFileName,
    setFileHandle,
    setLastSaved,
    setIsFileMenuOpen,
    setRecentFiles,
    setBmsFilesToSelect,
    setIsBmsSelectionOpen,
    onValidationError: (errors, onSaveForce) => {
      setValidationErrors(errors);
      saveForceRef.current = onSaveForce || null;
      setIsValidationErrorOpen(true);
    }
  });

  useEffect(() => {
    // 앱 시작 시 CLI 실행 인자(Argument)로 전달된 파일이 있는지 백엔드에 묻고 로딩을 수행합니다.
    const checkStartupArgs = async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const fileToLoad: string | null = await invoke('get_args_file');
        if (fileToLoad) {
          console.log(`[FileAssociation] Found startup file argument: ${fileToLoad}`);
          await loadBmsByAbsolutePath(fileToLoad);
        }
      } catch (err) {
        console.error("Failed to resolve startup file args:", err);
      }
    };
    checkStartupArgs();
  }, []);

  const drawGridAndNotes = () => {
    // if (isPlayingRef.current !== lastIsPlayingLog.current) {
    //   console.log(`[DrawLoop] isPlaying state changed: ${lastIsPlayingLog.current} -> ${isPlayingRef.current}. Timeline exists: ${!!timelineRef.current}, BMS Data exists: ${!!bmsDataRef.current}, Sorted Notes count: ${sortedNotesRef.current?.length}`);
    //   lastIsPlayingLog.current = isPlayingRef.current;
    //   debugFrameCount.current = 0;
    // }
    renderRequested.current = false;
    try {
      const rawCanvas = canvasRef.current;
      if (!rawCanvas) return;
      const ctx = rawCanvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const canvas = {
        width: rawCanvas.width / dpr,
        height: rawCanvas.height / dpr,
        style: rawCanvas.style,
        getBoundingClientRect: () => rawCanvas.getBoundingClientRect()
      } as unknown as HTMLCanvasElement;

      ctx.save();
      ctx.scale(dpr, dpr);

      const currentBmsData = bmsDataRef.current;
      const currentUseBase62 = useBase62Ref.current;
      const currentMeasureOffsets = measureOffsetsRef.current;
      const currentOverlapping = overlappingNoteIdsRef.current;
      const currentLongNotePairs = longNotePairsRef.current;
      const currentZoomX = zoomXRef.current;
      const currentZoomY = zoomYRef.current;
      const currentSettings = settingsRef.current;
      
      const currentMeasureHeight = BASE_MEASURE_HEIGHT * currentZoomY;

      // Update autoscroll & schedule audio playback when isPlaying is true
      if (isPlayingRef.current && timelineRef.current) {
        const actx = getAudioContext();
        
        if (playStartRealTimeRef.current === -1 && actx.state === 'running') {
          playStartRealTimeRef.current = actx.currentTime;
          console.log(`[Playback] playStartRealTime captured at first active frame: ${playStartRealTimeRef.current}`);

          // 중간 재생 엇갈림 구제: 현재 재생 개시점(startOffset) 이전에 속해 있으나,
          // 사운드 버퍼의 길이(duration)가 길어 현재 시점에도 계속 울려 퍼져야 하는 롱 BGM/루프음을 중간 재생
          const startOffset = playStartTimeOffsetRef.current;
          const currentBuffers = useEditorStore.getState().audioBuffers;
          const sorted = sortedNotesRef.current;
          
          if (currentBmsData && sorted) {
            console.log(`[PlaybackCatchUp] Scanning past notes for long loop catch-up at startOffset: ${startOffset.toFixed(3)}s`);
            for (let i = 0; i < sorted.length; i++) {
              const note = sorted[i];
              // 시작 지점보다 미래의 노트는 배제
              if (note.absoluteTime >= startOffset) continue;
              
              const isAudioChannel = 
                note.channel === 0x01 || 
                (note.channel >= 0x11 && note.channel <= 0x19) || 
                (note.channel >= 0x21 && note.channel <= 0x29) || 
                (note.channel >= 0x51 && note.channel <= 0x59) || 
                (note.channel >= 0x61 && note.channel <= 0x69);
                
              if (!isAudioChannel || longNoteEndIdsRef.current.has(note.id)) continue;
              
              const wavIndex = note.value;
              const filename = currentBmsData.wavs[wavIndex];
              if (filename) {
                const buffer = findAudioBuffer(filename, currentBuffers);
                if (buffer) {
                  const duration = buffer.duration;
                  // 재생 시작점 시점에도 오디오가 여전히 지속되는지 확인
                  if (note.absoluteTime + duration > startOffset) {
                    const latency = actx.currentTime - playStartRealTimeRef.current;
                    const soundOffset = startOffset - note.absoluteTime + latency;
                    playSound(buffer, actx.currentTime, note.id, note.value, soundOffset);
                    console.log(`[PlaybackCatchUp] Catch-up sound note ${note.id} (WAV ${wavIndex}) from soundOffset: ${soundOffset.toFixed(3)}s (latency: +${latency.toFixed(4)}s)`);
                  }
                }
              }
            }
          }
        }

        if (playStartRealTimeRef.current !== -1) {
          const now = actx.currentTime;
          const speed = playbackSpeedRef.current;
          const elapsed = (now - playStartRealTimeRef.current) * speed + playStartTimeOffsetRef.current;
          
          // debugFrameCount.current++;
          // if (debugFrameCount.current % 60 === 0) {
          //   console.log(`[PlaybackLoop] elapsed: ${elapsed.toFixed(3)}s, currentTimeOffset: ${playStartTimeOffsetRef.current.toFixed(3)}s, playStartRealTime: ${playStartRealTimeRef.current.toFixed(3)}s, actx.currentTime: ${actx.currentTime.toFixed(3)}s, sortedNotes length: ${sortedNotesRef.current?.length}, playedNotes size: ${playedNoteIdsRef.current?.size}`);
          // }
          
          // Position current Y to match target position of elapsed seconds at judgment line (80px from bottom)
          const pos = timelineRef.current.timeToPosition(elapsed);
          if (pos.measure < currentMeasureOffsets.offsets.length) {
            const measureStart = currentMeasureOffsets.offsets[pos.measure];
            const measureLen = currentBmsData?.measureLengths?.[pos.measure] ?? 1;
            const worldY = (measureStart + pos.position * measureLen) * currentMeasureHeight;
            
            scrollY.current = Math.min(maxScrollYRef.current, Math.max(MIN_SCROLL_Y, worldY - 80));
          }

          // Key sound look-ahead scheduler (+150ms window)
          const lookAhead = 0.150;
          const limitTime = elapsed + lookAhead;
          const sorted = sortedNotesRef.current;
          const played = playedNoteIdsRef.current;
          
          if (currentBmsData) {
            for (let i = 0; i < sorted.length; i++) {
              const note = sorted[i];
              
              // Skip notes that have already passed (allowing small threshold)
              if (note.absoluteTime < elapsed - 0.050) {
                played.add(note.id);
                continue;
              }
              
              // Beyond our look-ahead window, since notes are sorted, we can stop early
              if (note.absoluteTime > limitTime) {
                break;
              }
              
              // Skip non-audio channels (like BGA, poor, stops, bpms)
              const isAudioChannel = 
                note.channel === 0x01 || 
                (note.channel >= 0x11 && note.channel <= 0x19) || 
                (note.channel >= 0x21 && note.channel <= 0x29) || 
                (note.channel >= 0x51 && note.channel <= 0x59) || 
                (note.channel >= 0x61 && note.channel <= 0x69);
              
              if (!isAudioChannel) {
                played.add(note.id);
                continue;
              }

              if (longNoteEndIdsRef.current.has(note.id)) {
                played.add(note.id);
                continue;
              }

              if (!played.has(note.id)) {
                played.add(note.id);
                
                // Map note time to absolute AudioContext time
                const playTime = playStartRealTimeRef.current + (note.absoluteTime - playStartTimeOffsetRef.current) / speed;
                
                // Trigger audio buffer if loaded
                const wavIndex = note.value;
                const filename = currentBmsData.wavs[wavIndex];
                if (filename) {
                  const currentBuffers = useEditorStore.getState().audioBuffers;
                  const buffer = findAudioBuffer(filename, currentBuffers);
                  if (buffer) {
                    playSound(buffer, playTime, note.id, note.value, undefined, speed);
                  }
                }
              }
            }
          }

          // Automatic stop at the end of the song
          const totalDuration = timelineRef.current.totalDuration;
          if (elapsed >= totalDuration + 1.0) {
            setTimeout(() => {
              stopPlay();
            }, 0);
          } else {
            // Request continuous frames
            requestRender();
          }
        } else {
          // AudioContext is not running yet (e.g. resuming), wait for next frame
          requestRender();
        }
      }

      // Apply zoom to layout widths
      const zoomedLayout = getActiveLayout().map(l => ({ ...l, width: l.width * currentZoomX }));

      const theme = currentSettings.theme;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // 캔버스 기저 배경은 완전한 검정색(#000000)으로 단색 칠하여, 불투명도 0% 영역이 완벽한 검정색으로 표현되도록 합니다.
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      
      // Setup coordinates: bottom-left is origin, Y goes UP
      const originY = canvas.height + scrollY.current;
      ctx.translate(-scrollX.current, originY);

      const topY = -originY;
      const bottomY = canvas.height - originY;

      let currentX = 50; // Padding
      const totalWidth = 50 + zoomedLayout.reduce((sum, l) => sum + l.width, 0) + 50;

      const settings = viewSettingsRef.current;

      const rc: RenderContext = {
        ctx,
        canvas,
        theme,
        zoomedLayout,
        currentZoomX,
        currentZoomY,
        currentSettings,
        viewSettings: settings,
        scrollY: scrollY.current,
        scrollX: scrollX.current,
        currentMeasureHeight,
        topY,
        bottomY,
        measureOffsets: currentMeasureOffsets
      };

      // 1. 레인 배경 그리기
      drawLaneBackgrounds(rc);

      zoomedLayout.forEach((lane) => {
        currentX += lane.width;
      });

      // 2. 마디선 및 그리드 격자 그리기
      drawMeasureLinesAndGrid(rc, currentBmsData, gridSnapRef.current, auxGridSnapRef.current, currentX);

      // 2.3 시간 선택 영역 가이드 그리기 (F1 도구 전용)
      drawTimeSelectionOverlay(
        rc,
        activeToolRef.current,
        isTimeDragging.current,
        timeDragStart.current,
        timeDragCurrent.current,
        timeSelection,
        currentX
      );

      // 2.5 롱노트 연결 바 그리기
      drawLongNoteBodies(rc, currentBmsData, currentLongNotePairs, selectedNotesRef.current);

      // 2.6 작성 중인 롱노트 프리뷰 그리기
      drawDraggingLongNotePreview(
        rc,
        currentBmsData,
        isDrawingLongNote.current,
        writeStartBmsPos.current,
        writeCurrentBmsPos.current
      );

      // 3. 일반/롱노트 본체 그리기
      drawNotes(rc, currentBmsData, selectedNotesRef.current, currentOverlapping, currentUseBase62, encodeBmsValue);

      // 4. 작성 고스트 노트 그리기
      drawGhostNote(
        rc,
        currentBmsData,
        activeToolRef.current,
        hoverBmsPos.current,
        currentNoteValueRef.current,
        currentUseBase62,
        encodeBmsValue
      );

      // 4.5 올가미 다중선택 박스 그리기
      drawSelectionBox(
        rc,
        isSelectingBox.current,
        selectionBoxStart.current,
        selectionBoxCurrent.current
      );

      ctx.restore(); // Translate 복원

      // 5. 플레이 기준선(빨간 진행선) 그리기
      drawPlaybackGuides(rc, currentX);

      // 5.5 상단 열 이름 텍스트 그리기 (Sticky Header)
      drawHeaderSticky(rc);

      // 6. 스크롤바 그리기
      const headerHeight = settings.showColumnHeader ? 24 : 0;
      const totalHeight = currentMeasureOffsets.totalLen * currentMeasureHeight + 100;
      maxScrollXRef.current = Math.max(0, totalWidth - canvas.width);
      maxScrollYRef.current = Math.max(0, totalHeight - canvas.height);

      const maxScrollY = maxScrollYRef.current;
      const maxScrollX = maxScrollXRef.current;

      // 세로 스크롤바 계산 및 드로잉
      if (maxScrollY > MIN_SCROLL_Y) {
        const scrollbarWidth = 10;
        const trackHeight = canvas.height - headerHeight;
        const viewRatio = Math.min(1, canvas.height / (totalHeight - MIN_SCROLL_Y));
        const thumbHeight = Math.max(30, trackHeight * viewRatio);
        const scrollRange = maxScrollY - MIN_SCROLL_Y;
        const scrollRatio = scrollRange > 0 ? (scrollY.current - MIN_SCROLL_Y) / scrollRange : 0;
        const thumbY = headerHeight + (1 - scrollRatio) * (trackHeight - thumbHeight);
        const rectX = canvas.width - scrollbarWidth + 2;
        vThumbRect.current = { x: rectX, y: thumbY, w: scrollbarWidth - 4, h: thumbHeight };

        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(canvas.width - scrollbarWidth, headerHeight, scrollbarWidth, trackHeight);

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

      // 가로 스크롤바 계산 및 드로잉
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

      // 7. 오토스크롤 앵커 및 화살표 그리기
      drawAutoscrollAnchor(
        rc,
        canvasRef,
        isAutoscrolling.current,
        autoscrollAnchor.current,
        autoscrollCurrent.current,
        dpr
      );

      ctx.restore(); // Scale 복원
      ctx.restore();
    } catch (e) {
      console.error("Render Error:", e);
    }
  };

  function requestRender() {
    if (!renderRequested.current) {
      renderRequested.current = true;
      requestAnimationFrame(drawGridAndNotes);
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = container.clientWidth;
      const h = container.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      requestRender();
    };

    window.addEventListener('resize', resizeCanvas);
    
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    window.addEventListener('contextmenu', handleContextMenu);
    
    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas();
    });
    resizeObserver.observe(container);

    resizeCanvas();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('contextmenu', handleContextMenu);
      resizeObserver.disconnect();
    };
  }, []); // Only bind once, state is handled via refs

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const currentSettings = settingsRef.current;
      const scrollSize = currentSettings.wheelScrollSize;
      
      let delta = e.deltaY;
      if (currentSettings.scrollDirection === 'normal') {
        delta = -delta;
      }
      
      if (e.shiftKey) {
        scrollX.current = Math.min(maxScrollXRef.current, Math.max(0, scrollX.current + delta));
      } else {
        if (scrollSize !== 'pixel') {
          const sign = Math.sign(delta);
          const currentMeasureHeight = BASE_MEASURE_HEIGHT * zoomYRef.current;
          
          if (scrollSize === 'page') {
            const canvas = canvasRef.current;
            const pageScroll = canvas ? canvas.height * 0.8 : 400;
            delta = sign * pageScroll;
          } else {
            const fraction = parseFloat(scrollSize);
            if (!isNaN(fraction)) {
              delta = sign * fraction * currentMeasureHeight;
            }
          }
        }
        scrollY.current = Math.min(maxScrollYRef.current, Math.max(MIN_SCROLL_Y, scrollY.current + delta));
      }

      if (isSelectingBox.current && selectionBoxStart.current && canvasRef.current) {
        const mx = lastMouseCoords.current.x;
        const my = lastMouseCoords.current.y;
        const currentOriginY = canvasRef.current.height + scrollY.current;
        selectionBoxCurrent.current = {
          x: mx + scrollX.current,
          y: my - currentOriginY
        };
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
  const lastMouseCoords = useRef<{ x: number, y: number }>({ x: 0, y: 0 });
  
  const hoverBmsPos = useRef<{ measure: number, position: number, lane: any } | null>(null);

  // 쓰기 모드에서의 롱노트 드래그 관련 Ref
  const isDrawingLongNote = useRef(false);
  const writeStartBmsPos = useRef<{ measure: number; position: number; lane: any; channel: number; index: number; value?: number } | null>(null);
  const writeCurrentBmsPos = useRef<{ measure: number; position: number; lane: any; channel: number; index: number; value?: number } | null>(null);
  const isResizingLongNote = useRef(false);
  const resizeTargetNoteId = useRef<string | null>(null);
  const resizeOffsetAbs = useRef<number>(0);
  
  // To track offsets for dragging multiple notes
  const dragStartBmsPos = useRef<{ measure: number, position: number, channel: number, index: number } | null>(null);
  const dragStartAbsPos = useRef<number>(0);
  const dragNoteInitialState = useRef<{ id: string, initialMeasure: number, initialPosition: number, initialChannel: number, initialIndex: number }[]>([]);

  const dragNoteDidMove = useRef(false);

  // Panning (Middle Click Drag) State
  const isPanning = useRef(false);
  const panStartX = useRef(0);
  const panStartY = useRef(0);
  const panStartScrollX = useRef(0);
  const panStartScrollY = useRef(0);

  // Keyboard Shortcuts for Grid Snap, Undo/Redo, and Note Movement
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'PageUp') {
        e.preventDefault();
        setGridSnap(e.shiftKey ? gridSnap + 1 : gridSnap * 2);
      } else if (e.key === 'PageDown') {
        e.preventDefault();
        setGridSnap(e.shiftKey ? Math.max(1, gridSnap - 1) : Math.max(1, Math.floor(gridSnap / 2)));
      } else if (e.key.startsWith('Arrow') && selectedNotes.length > 0 && bmsDataRef.current) {
        e.preventDefault();
        
        let mDiff = 0;
        let pDiff = 0;
        let laneDiff = 0;
        
        if (e.key === 'ArrowUp' && !lockVerticalPositionRef.current) pDiff = 1 / gridSnap;
        else if (e.key === 'ArrowDown' && !lockVerticalPositionRef.current) pDiff = -1 / gridSnap;
        else if (e.key === 'ArrowLeft') laneDiff = -1;
        else if (e.key === 'ArrowRight') laneDiff = 1;

        if (mDiff === 0 && pDiff === 0 && laneDiff === 0) return;

        const getLaneCategory = (channel: number) => {
          if (channel === 0x01 || 
              (channel >= 0x11 && channel <= 0x19) || 
              (channel >= 0x21 && channel <= 0x29) || 
              (channel >= 0x51 && channel <= 0x59) || 
              (channel >= 0x61 && channel <= 0x69) || 
              channel === 0x16 || 
              channel === 0x26 ||
              (channel >= 0x31 && channel <= 0x39) ||
              (channel >= 0x41 && channel <= 0x49) ||
              (channel >= 0xD1 && channel <= 0xD9) ||
              (channel >= 0xE1 && channel <= 0xE9)) return 'keysound';
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
            const noteInitialLaneIndex = getTargetLaneIndex(activeLayout, dn.channel, dn.index);
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
          let newMeasure = dn.measure;
          let newPosition = dn.position;
          
          if (pDiff !== 0 || mDiff !== 0) {
            newMeasure = dn.measure + mDiff;
            newPosition = dn.position + pDiff;
            while (newPosition >= 1) { newPosition -= 1; newMeasure += 1; }
            while (newPosition < 0) { newPosition += 1; newMeasure -= 1; }
            if (newMeasure < 0) newMeasure = 0;
            
            newPosition = Math.round(newPosition * gridSnap) / gridSnap;
            if (newPosition >= 1) { newPosition = 0; newMeasure += 1; }
          }

          const updates: any = { measure: newMeasure, position: newPosition };
          
          if (validLaneIndexDiff !== 0) {
            const activeLayout = getActiveLayout();
            const noteInitialLaneIndex = getTargetLaneIndex(activeLayout, dn.channel, dn.index);
            if (noteInitialLaneIndex !== -1) {
              const newLane = activeLayout[noteInitialLaneIndex + validLaneIndexDiff];
              const targetBase = newLane.channel || 0x01;
              
              const getShiftedChannel = (origChan: number, baseChan: number): number => {
                let offset = 0;
                if (origChan >= 0x51 && origChan <= 0x59) offset = 0x40;
                else if (origChan >= 0x61 && origChan <= 0x69) offset = 0x40;
                else if (origChan >= 0x31 && origChan <= 0x39) offset = 0x20;
                else if (origChan >= 0x41 && origChan <= 0x49) offset = 0x20;
                else if (origChan >= 0xD1 && origChan <= 0xD9) offset = 0xC0;
                else if (origChan >= 0xE1 && origChan <= 0xE9) offset = 0xC0;
                
                if (offset === 0 || baseChan === 0x01) return baseChan;
                return baseChan + offset;
              };
              
              updates.channel = getShiftedChannel(dn.channel, targetBase);
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

      if (isPanning.current) {
        const dx = e.clientX - panStartX.current;
        const dy = e.clientY - panStartY.current;
        scrollX.current = Math.min(maxScrollXRef.current, Math.max(0, panStartScrollX.current - dx));
        scrollY.current = Math.min(maxScrollYRef.current, Math.max(MIN_SCROLL_Y, panStartScrollY.current + dy));
        requestRender();
        return;
      }

      if (isDraggingV.current) {
        const deltaY = e.clientY - dragStartY.current;
        const headerHeight = viewSettingsRef.current.showColumnHeader ? 24 : 0;
        const trackHeight = canvas.clientHeight - headerHeight;
        const vRect = vThumbRect.current;
        const draggableRange = trackHeight - vRect.h;
        if (draggableRange > 0) {
          const scrollRange = maxScrollYRef.current - MIN_SCROLL_Y;
          const scrollDelta = -(deltaY / draggableRange) * scrollRange;
          scrollY.current = Math.min(maxScrollYRef.current, Math.max(MIN_SCROLL_Y, initialScrollY.current + scrollDelta));
          requestRender();
        }
        return;
      }

      if (isDraggingH.current) {
        const deltaX = e.clientX - dragStartX.current;
        const trackWidth = canvas.clientWidth - (maxScrollYRef.current > 0 ? 10 : 0);
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
      lastMouseCoords.current = { x, y };

      if (isTimeDragging.current && timeDragStart.current !== null) {
        const originY = canvas.clientHeight + scrollY.current;
        const ctxY = y - originY;
        const measureHeight = BASE_MEASURE_HEIGHT * zoomYRef.current;
        const absolutePosition = -ctxY / measureHeight;
        const snappedPosition = getSnappedAbsTime(absolutePosition);
        timeDragCurrent.current = snappedPosition;
        requestRender();
        return;
      }

      if (isDrawingLongNote.current && writeStartBmsPos.current) {
        const bmsPos = getBmsPosition(x, y);
        if (bmsPos) {
          writeCurrentBmsPos.current = {
            ...bmsPos,
            channel: writeStartBmsPos.current.channel,
            index: writeStartBmsPos.current.index
          };
          requestRender();
        }
        return;
      }

      if (isResizingLongNote.current && resizeTargetNoteId.current && bmsDataRef.current) {
        const originY = canvas.clientHeight + scrollY.current;
        const ctxY = y - originY;
        const measureHeight = BASE_MEASURE_HEIGHT * zoomYRef.current;
        const absolutePosition = -ctxY / measureHeight;
        
        const targetAbsTime = absolutePosition - resizeOffsetAbs.current;
        
        const currentOffsets = measureOffsetsRef.current;
        let targetMeasure = 0;
        while (targetMeasure < currentOffsets.offsets.length - 1 && currentOffsets.offsets[targetMeasure + 1] <= targetAbsTime) {
          targetMeasure++;
        }
        const measureStart = currentOffsets.offsets[targetMeasure];
        const measureLen = bmsDataRef.current.measureLengths?.[targetMeasure] ?? 1;
        
        let offsetVal = targetAbsTime - measureStart;
        if (targetMeasure === 0 && offsetVal < 0) {
          offsetVal = 0;
        }
        
        const snap = gridSnapRef.current;
        let snappedOffset = Math.round(offsetVal * snap) / snap;
        let targetPos = 0;
        
        if (snappedOffset >= measureLen - 1e-9) {
          targetMeasure += 1;
          targetPos = 0;
        } else {
          const finalMeasureLen = bmsDataRef.current.measureLengths?.[targetMeasure] ?? 1;
          targetPos = snappedOffset / finalMeasureLen;
        }

        const currentNote = bmsDataRef.current.notes.find(n => n.id === resizeTargetNoteId.current);
        if (currentNote && (currentNote.measure !== targetMeasure || currentNote.position !== targetPos)) {
          dragNoteDidMove.current = true;
          updateNote(resizeTargetNoteId.current, {
            measure: targetMeasure,
            position: targetPos
          });
          requestRender();
        }
        return;
      }

      if (isSelectingBox.current && selectionBoxStart.current) {
        const currentOriginY = canvas.height + scrollY.current;
        selectionBoxCurrent.current = {
          x: x + scrollX.current,
          y: y - currentOriginY
        };
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
        
        const currentOffsets = measureOffsetsRef.current;
        let targetMeasure = 0;
        while (targetMeasure < currentOffsets.offsets.length - 1 && currentOffsets.offsets[targetMeasure + 1] <= absolutePosition) {
          targetMeasure++;
        }
        const measureStart = currentOffsets.offsets[targetMeasure];
        const measureLen = bmsDataRef.current?.measureLengths?.[targetMeasure] ?? 1;
        const offsetVal = absolutePosition - measureStart;
        
        const snap = gridSnapRef.current;
        let snappedOffset = Math.round(offsetVal * snap) / snap;
        let targetPos = 0;
        
        if (snappedOffset >= measureLen - 1e-9) {
          targetMeasure += 1;
          targetPos = 0;
        } else {
          const finalMeasureLen = bmsDataRef.current?.measureLengths?.[targetMeasure] ?? 1;
          targetPos = snappedOffset / finalMeasureLen;
        }
        
        let mDiff = targetMeasure - dragStartBmsPos.current.measure;
        let pDiff = targetPos - dragStartBmsPos.current.position;

        if (lockVerticalPositionRef.current) {
          mDiff = 0;
          pDiff = 0;
        } else {
          const dragStartAbs = dragStartAbsPos.current;
          const absDiff = Math.abs(absolutePosition - dragStartAbs);
          const threshold = (bmsDataRef.current?.measureLengths?.[dragStartBmsPos.current.measure] ?? 1) / snap;
          if (absDiff < threshold) {
            mDiff = 0;
            pDiff = 0;
          }
        }

        const getLaneCategory = (channel: number) => {
          if (channel === 0x01 || 
              (channel >= 0x11 && channel <= 0x19) || 
              (channel >= 0x21 && channel <= 0x29) || 
              (channel >= 0x51 && channel <= 0x59) || 
              (channel >= 0x61 && channel <= 0x69) || 
              channel === 0x16 || 
              channel === 0x26 ||
              (channel >= 0x31 && channel <= 0x39) ||
              (channel >= 0x41 && channel <= 0x49) ||
              (channel >= 0xD1 && channel <= 0xD9) ||
              (channel >= 0xE1 && channel <= 0xE9)) return 'keysound';
          if (channel === 0x04 || channel === 0x06 || channel === 0x0A) return 'video';
          return 'other';
        };

        const targetLaneIndex = activeLayout.findIndex(l => l === targetLane);
        const startLaneIndex = getTargetLaneIndex(activeLayout, dragStartBmsPos.current!.channel, dragStartBmsPos.current!.index);
        const laneIndexDiff = startLaneIndex !== -1 && targetLaneIndex !== -1 ? targetLaneIndex - startLaneIndex : 0;

        let minAllowedDiff = -Infinity;
        let maxAllowedDiff = Infinity;

        for (const dn of dragNoteInitialState.current) {
          const noteInitialLaneIndex = getTargetLaneIndex(activeLayout, dn.initialChannel, dn.initialIndex);
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
          let newMeasure = dn.initialMeasure;
          let newPosition = dn.initialPosition;
          
          if (pDiff !== 0 || mDiff !== 0) {
            newMeasure = dn.initialMeasure + mDiff;
            newPosition = dn.initialPosition + pDiff;
            while (newPosition >= 1) { newPosition -= 1; newMeasure += 1; }
            while (newPosition < 0) { newPosition += 1; newMeasure -= 1; }
            if (newMeasure < 0) newMeasure = 0;
            
            // Snap newPosition based on absolute measure beat logic to avoid floating-point drift
            const finalMeasureLen = bmsDataRef.current?.measureLengths?.[newMeasure] ?? 1;
            const offsetVal = newPosition * finalMeasureLen;
            let snappedOffset = Math.round(offsetVal * snap) / snap;
            
            if (snappedOffset >= finalMeasureLen - 1e-9) {
              newMeasure += 1;
              newPosition = 0;
            } else {
              newPosition = snappedOffset / finalMeasureLen;
            }
          }

          const updates: any = { measure: newMeasure, position: newPosition };
          
          if (validLaneIndexDiff !== 0) {
            const noteInitialLaneIndex = getTargetLaneIndex(activeLayout, dn.initialChannel, dn.initialIndex);
            if (noteInitialLaneIndex !== -1) {
              const newLane = activeLayout[noteInitialLaneIndex + validLaneIndexDiff];
              const targetBase = newLane.channel || 0x01;
              
              const getShiftedChannel = (origChan: number, baseChan: number): number => {
                let offset = 0;
                if (origChan >= 0x51 && origChan <= 0x59) offset = 0x40;
                else if (origChan >= 0x61 && origChan <= 0x69) offset = 0x40;
                else if (origChan >= 0x31 && origChan <= 0x39) offset = 0x20;
                else if (origChan >= 0x41 && origChan <= 0x49) offset = 0x20;
                else if (origChan >= 0xD1 && origChan <= 0xD9) offset = 0xC0;
                else if (origChan >= 0xE1 && origChan <= 0xE9) offset = 0xC0;
                
                if (offset === 0 || baseChan === 0x01) return baseChan;
                return baseChan + offset;
              };
              
              updates.channel = getShiftedChannel(dn.initialChannel, targetBase);
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
      if (isPanning.current) {
        isPanning.current = false;
        requestRender();
        return;
      }

      if (isResizingLongNote.current) {
        isResizingLongNote.current = false;
        resizeTargetNoteId.current = null;
        if (dragNoteDidMove.current) {
          commitHistory();
        }
        requestRender();
        return;
      }

      isDraggingV.current = false;
      isDraggingH.current = false;

      if (isTimeDragging.current && timeDragStart.current !== null && timeDragCurrent.current !== null) {
        isTimeDragging.current = false;
        const start = Math.min(timeDragStart.current, timeDragCurrent.current);
        const end = Math.max(timeDragStart.current, timeDragCurrent.current);
        if (end - start > 0.005) {
          setTimeSelection({ start, end });
        } else {
          setTimeSelection(null);
        }
        timeDragStart.current = null;
        timeDragCurrent.current = null;
        requestRender();
        return;
      }

      if (isDrawingLongNote.current && writeStartBmsPos.current && bmsDataRef.current) {
        isDrawingLongNote.current = false;
        const start = writeStartBmsPos.current;
        const end = writeCurrentBmsPos.current || start;

        const startMeasureLen = bmsDataRef.current.measureLengths[start.measure] ?? 1;
        const endMeasureLen = bmsDataRef.current.measureLengths[end.measure] ?? 1;

        const startAbsolutePos = measureOffsetsRef.current.offsets[start.measure] + start.position * startMeasureLen;
        const endAbsolutePos = measureOffsetsRef.current.offsets[end.measure] + end.position * endMeasureLen;

        const actualChannel = start.channel;
        const actualIndex = start.index;

        const normalizeChannel = (ch: number) => {
          if (ch >= 0x51 && ch <= 0x59) return ch - 0x40; // LN -> Normal
          if (ch >= 0x61 && ch <= 0x69) return ch - 0x40;
          if (ch >= 0x31 && ch <= 0x39) return ch - 0x20; // Invisible -> Normal
          if (ch >= 0x41 && ch <= 0x49) return ch - 0x20;
          if (ch >= 0xD1 && ch <= 0xD9) return ch - 0xC0; // Mine -> Normal
          if (ch >= 0xE1 && ch <= 0xE9) return ch - 0xC0;
          return ch;
        };

        if (Math.abs(endAbsolutePos - startAbsolutePos) < 1e-6) {
          // 단노트 추가
          let targetChannel = actualChannel;
          const isPlayable = (actualChannel >= 0x11 && actualChannel <= 0x19) || 
                             (actualChannel >= 0x21 && actualChannel <= 0x29);
          if (isPlayable) {
            if (e.shiftKey) {
              targetChannel = actualChannel + 0xC0; // MINE
            } else if (e.ctrlKey) {
              targetChannel = actualChannel + 0x20; // INVISIBLE
            }
          }

          // 이미 같은 위치(measure, position, targetChannel)에 노트가 존재하는지 검사하여 중복 쓰기 방지
          const targetNorm = normalizeChannel(targetChannel);
          const hasExisting = bmsDataRef.current.notes.some(n => 
            n.measure === start.measure && 
            normalizeChannel(n.channel) === targetNorm && 
            (n.channel !== 0x01 || n.index === actualIndex) &&
            Math.abs(n.position - start.position) < 1e-5
          );
          if (hasExisting) {
            return;
          }

          addNote({
            id: crypto.randomUUID(),
            measure: start.measure,
            position: start.position,
            channel: targetChannel,
            index: actualIndex,
            value: currentNoteValueRef.current
          });
          commitHistory();
          playPreviewSound(currentNoteValueRef.current);
        } else {
          // 롱노트 추가
          const lowerNote = startAbsolutePos <= endAbsolutePos ? start : end;
          const upperNote = startAbsolutePos <= endAbsolutePos ? end : start;

          const isPlayable = (actualChannel >= 0x11 && actualChannel <= 0x19) || 
                             (actualChannel >= 0x21 && actualChannel <= 0x29);

          const baseValue = start.value !== undefined ? start.value : currentNoteValueRef.current;
          let startChannel = actualChannel;
          let endChannel = actualChannel;
          let startValue = baseValue;
          let endValue = baseValue;

          if (isPlayable) {
            const lnObjStr = bmsDataRef.current.header.lnobj;
            const lnObjVal = lnObjStr ? decodeBmsValue(lnObjStr, useBase62Ref.current) : 0;
            if (lnObjVal > 0 && settingsRef.current.lnWriteMode !== 'channel') {
              // LNOBJ 방식
              startChannel = actualChannel;
              endChannel = actualChannel;
              startValue = baseValue;
              endValue = lnObjVal;
            } else {
              // 전통적 LN 채널 방식
              startChannel = actualChannel + 0x40;
              endChannel = actualChannel + 0x40;
              startValue = baseValue;
              endValue = baseValue;
            }
          }

          // 겹침 영역의 노트들을 키음 영역(BGM)으로 안전하게 대피 (BGM 채널 0x01 분산 분배)
          const lowerAbs = Math.min(startAbsolutePos, endAbsolutePos);
          const upperAbs = Math.max(startAbsolutePos, endAbsolutePos);

          const overlappingUpdates: { id: string, updates: Partial<BmsNote> }[] = [];
          const notesToDelete: string[] = [];

          bmsDataRef.current.notes.forEach(note => {
            if (normalizeChannel(note.channel) === normalizeChannel(actualChannel) && 
                (note.channel !== 0x01 || note.index === actualIndex)) {
              const noteMeasureLen = bmsDataRef.current!.measureLengths[note.measure] ?? 1;
              const noteAbs = measureOffsetsRef.current.offsets[note.measure] + note.position * noteMeasureLen;
              
              if (Math.abs(noteAbs - lowerAbs) < 1e-6 || Math.abs(noteAbs - upperAbs) < 1e-6) {
                notesToDelete.push(note.id);
              } else if (noteAbs > lowerAbs + 1e-6 && noteAbs < upperAbs - 1e-6) {
                // BGM 인덱스 분배
                let bgmIndex = 0;
                if (note.channel >= 0x11 && note.channel <= 0x19) {
                  bgmIndex = (note.channel - 0x11);
                } else if (note.channel >= 0x21 && note.channel <= 0x29) {
                  bgmIndex = (note.channel - 0x21) + 8;
                } else if (note.channel >= 0x51 && note.channel <= 0x59) {
                  bgmIndex = (note.channel - 0x51);
                } else if (note.channel >= 0x61 && note.channel <= 0x69) {
                  bgmIndex = (note.channel - 0x61) + 8;
                } else {
                  bgmIndex = note.index % 32;
                }

                overlappingUpdates.push({
                  id: note.id,
                  updates: {
                    channel: 0x01,
                    index: bgmIndex
                  }
                });
              }
            }
          });

          if (notesToDelete.length > 0) {
            removeNotes(notesToDelete);
          }
          if (overlappingUpdates.length > 0) {
            updateNotes(overlappingUpdates);
          }

          const startId = crypto.randomUUID();
          const endId = crypto.randomUUID();

          addNotes([
            {
              id: startId,
              measure: lowerNote.measure,
              position: lowerNote.position,
              channel: startChannel,
              index: actualIndex,
              value: startValue,
              partnerId: endId
            },
            {
              id: endId,
              measure: upperNote.measure,
              position: upperNote.position,
              channel: endChannel,
              index: actualIndex,
              value: endValue,
              partnerId: startId
            }
          ]);
          commitHistory();
          playPreviewSound(startValue);
        }

        writeStartBmsPos.current = null;
        writeCurrentBmsPos.current = null;
        requestRender();
        return;
      }
      
      if (isSelectingBox.current && selectionBoxStart.current && selectionBoxCurrent.current && bmsDataRef.current) {
        const x1 = Math.min(selectionBoxStart.current.x, selectionBoxCurrent.current.x);
        const x2 = Math.max(selectionBoxStart.current.x, selectionBoxCurrent.current.x);
        const y1 = Math.min(selectionBoxStart.current.y, selectionBoxCurrent.current.y);
        const y2 = Math.max(selectionBoxStart.current.y, selectionBoxCurrent.current.y);

        const selectedIds: string[] = [];
        const currentMeasureHeight = BASE_MEASURE_HEIGHT * zoomYRef.current;
        const currentZoomX = zoomXRef.current;
        const activeLayout = getActiveLayout();
        const noteHeight = settingsRef.current.noteHeight ?? 12;

        // 1. 일반 노트(및 단독 노드)의 드래그 박스 충돌 판정
        bmsDataRef.current.notes.forEach(note => {
          let targetLaneIndex = getTargetLaneIndex(activeLayout, note.channel, note.index);
          if (targetLaneIndex === -1) return;

          let laneX = 50;
          for (let i = 0; i < targetLaneIndex; i++) laneX += activeLayout[i].width * currentZoomX;
          const lWidth = activeLayout[targetLaneIndex].width * currentZoomX;

          const measureLen = bmsDataRef.current?.measureLengths?.[note.measure] ?? 1;
          const y = -(measureOffsetsRef.current.offsets[note.measure] + note.position * measureLen) * currentMeasureHeight;
          const noteY = y - noteHeight;
          
          if (laneX + lWidth >= x1 && laneX <= x2 && noteY + noteHeight >= y1 && noteY <= y2) {
            selectedIds.push(note.id);
          }
        });

        // 2. 롱노트 몸통(Body) 드래그 박스 충돌 판정
        const currentLongNotePairs = longNotePairsRef.current || [];
        currentLongNotePairs.forEach(pair => {
          const { start, end } = pair;
          let targetLaneIndex = getTargetLaneIndex(activeLayout, start.channel, start.index);
          if (targetLaneIndex === -1) return;

          let laneX = 50;
          for (let i = 0; i < targetLaneIndex; i++) laneX += activeLayout[i].width * currentZoomX;
          const lWidth = activeLayout[targetLaneIndex].width * currentZoomX;

          // X축 충돌 확인
          if (x1 <= laneX + lWidth && x2 >= laneX) {
            const startMeasureLen = bmsDataRef.current!.measureLengths?.[start.measure] ?? 1;
            const endMeasureLen = bmsDataRef.current!.measureLengths?.[end.measure] ?? 1;

            const startAbsolutePos = measureOffsetsRef.current.offsets[start.measure] + start.position * startMeasureLen;
            const endAbsolutePos = measureOffsetsRef.current.offsets[end.measure] + end.position * endMeasureLen;

            const startY = -startAbsolutePos * currentMeasureHeight;
            const endY = -endAbsolutePos * currentMeasureHeight;

            const yTop = Math.min(startY, endY);
            const yBottom = Math.max(startY, endY);

            // Y축 충돌 확인 (음수 Y 좌표계이므로 yTop이 더 작고 위쪽임)
            if (y1 <= yBottom && y2 >= yTop - noteHeight) {
              selectedIds.push(start.id);
              selectedIds.push(end.id);
            }
          }
        });

        // 3. 롱노트의 파트너 강제 선택 (시작/끝 쌍 보장)
        currentLongNotePairs.forEach(pair => {
          const hasStart = selectedIds.includes(pair.start.id);
          const hasEnd = selectedIds.includes(pair.end.id);
          if (hasStart || hasEnd) {
            if (!hasStart) selectedIds.push(pair.start.id);
            if (!hasEnd) selectedIds.push(pair.end.id);
          }
        });

        const uniqueSelectedIds = [...new Set(selectedIds)];

        if (e.shiftKey) {
           setSelectedNotes([...new Set([...selectedNotesRef.current, ...uniqueSelectedIds])]);
        } else {
           setSelectedNotes(uniqueSelectedIds);
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
      
      if (activeToolRef.current === 'select' && canvasRef.current) {
        canvasRef.current.style.cursor = 'default';
      }
      
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
    if (viewSettingsRef.current.showColumnHeader && y < 24) return null;
    const ctxX = x + scrollX.current;
    const originY = canvasRef.current!.clientHeight + scrollY.current;
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
    const absolutePosition = -ctxY / measureHeight; // This is the cumulative length
    
    const currentOffsets = measureOffsetsRef.current;
    let targetMeasure = 0;
    while (targetMeasure < currentOffsets.offsets.length - 1 && currentOffsets.offsets[targetMeasure + 1] <= absolutePosition) {
      targetMeasure++;
    }
    
    const measureStart = currentOffsets.offsets[targetMeasure];
    const measureLen = bmsDataRef.current?.measureLengths?.[targetMeasure] ?? 1;
    const offsetVal = absolutePosition - measureStart;
    
    const snap = gridSnapRef.current;
    let snappedOffset = Math.round(offsetVal * snap) / snap;
    
    let finalMeasure = targetMeasure;
    let finalPos = 0;
    
    if (snappedOffset >= measureLen - 1e-9) {
      finalMeasure = targetMeasure + 1;
      finalPos = 0;
    } else {
      finalMeasure = targetMeasure;
      const finalMeasureLen = bmsDataRef.current?.measureLengths?.[finalMeasure] ?? 1;
      finalPos = snappedOffset / finalMeasureLen;
    }
    
    if (finalMeasure < 0) return null;
    return { measure: finalMeasure, position: finalPos, lane: targetLane };
  };

  const playPreviewSound = (wavIndex: number) => {
    if (!settingsRef.current.playNotePreview) return;
    if (!bmsDataRef.current) return;
    const filename = bmsDataRef.current.wavs[wavIndex];
    if (filename) {
      const currentBuffers = useEditorStore.getState().audioBuffers;
      const buffer = findAudioBuffer(filename, currentBuffers);
      if (buffer) {
        const actx = getAudioContext();
        if (actx.state === 'suspended') {
          actx.resume().catch(err => console.error(err));
        }
        playSoloSound(buffer, actx.currentTime);
      }
    }
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Eagerly resume AudioContext inside the user activation handler to prevent web audio latency
    const actx = getAudioContext();
    if (actx.state === 'suspended') {
      actx.resume().catch(err => console.error(err));
    }

    if (e.button === 1) {
      e.preventDefault();
      const behavior = settingsRef.current.wheelClickBehavior;
      if (behavior === 'drag') {
        isPanning.current = true;
        panStartX.current = e.clientX;
        panStartY.current = e.clientY;
        panStartScrollX.current = scrollX.current;
        panStartScrollY.current = scrollY.current;
      } else if (behavior === 'autoscroll') {
        if (isAutoscrolling.current) {
          stopAutoscroll();
        } else {
          startAutoscroll(e.clientX, e.clientY);
        }
      }
      return;
    }

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    lastMouseCoords.current = { x, y };

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

    if (activeToolRef.current === 'time') {
      const originY = canvasRef.current!.clientHeight + scrollY.current;
      const ctxY = y - originY;
      const measureHeight = BASE_MEASURE_HEIGHT * zoomYRef.current;
      const absolutePosition = -ctxY / measureHeight;
      const snappedPosition = getSnappedAbsTime(absolutePosition);

      isTimeDragging.current = true;
      timeDragStart.current = snappedPosition;
      timeDragCurrent.current = snappedPosition;
      setTimeSelection(null);
      requestRender();
      return;
    }

    // Pixel-perfect node finder matching the exact screen box bounds of drawn notes.
    // This solves grid-snapping discrepancy where snap position differs from actual note position.
    const findNoteAtPixel = (mouseX: number, mouseY: number): { note: BmsNote; isBody?: boolean } | undefined => {
      if (!bmsDataRef.current) return undefined;
      const currentMeasureHeight = BASE_MEASURE_HEIGHT * zoomYRef.current;
      const currentMeasureOffsets = measureOffsetsRef.current;
      const zoomedLayout = getActiveLayout().map(l => ({ ...l, width: l.width * zoomXRef.current }));
      const canvasHeight = canvasRef.current!.clientHeight;
      const worldX = mouseX + scrollX.current;
      const worldY = mouseY - (canvasHeight + scrollY.current);
      
      const notes = bmsDataRef.current.notes;
      const noteHeight = settingsRef.current.noteHeight ?? 12;
      const currentLongNotePairs = longNotePairsRef.current || [];

      for (let i = notes.length - 1; i >= 0; i--) {
        const note = notes[i];
        
        const targetLaneIndex = getTargetLaneIndex(zoomedLayout, note.channel, note.index);
        if (targetLaneIndex === -1) continue;

        let laneX = 50;
        for (let j = 0; j < targetLaneIndex; j++) {
          laneX += zoomedLayout[j].width;
        }
        const lWidth = zoomedLayout[targetLaneIndex].width;

        if (worldX < laneX + 1 || worldX > laneX + lWidth - 1) continue;

        if (note.measure >= currentMeasureOffsets.offsets.length) continue;
        const measureStart = currentMeasureOffsets.offsets[note.measure];
        const measureLen = bmsDataRef.current.measureLengths?.[note.measure] ?? 1;
        const absolutePos = measureStart + note.position * measureLen;
        const yVal = -absolutePos * currentMeasureHeight;
        const noteY = yVal - noteHeight;

        if (worldY >= noteY && worldY <= noteY + noteHeight) {
          const paired = currentLongNotePairs.find(p => p.start.id === note.id || p.end.id === note.id);
          if (paired) {
            const matchedNote = paired.start.id === note.id ? paired.start : paired.end;
            return { note: matchedNote };
          }
          return { note };
        }
      }

      // 롱노트 몸통(Body) 검출
      for (let i = currentLongNotePairs.length - 1; i >= 0; i--) {
        const pair = currentLongNotePairs[i];
        const { start, end } = pair;

        const targetLaneIndex = getTargetLaneIndex(zoomedLayout, start.channel, start.index);
        if (targetLaneIndex === -1) continue;

        let laneX = 50;
        for (let j = 0; j < targetLaneIndex; j++) {
          laneX += zoomedLayout[j].width;
        }
        const lWidth = zoomedLayout[targetLaneIndex].width;

        // worldX가 레인 범위 내인지 검사
        if (worldX < laneX + 1 || worldX > laneX + lWidth - 1) continue;

        if (start.measure >= currentMeasureOffsets.offsets.length || end.measure >= currentMeasureOffsets.offsets.length) continue;

        const startMeasureLen = bmsDataRef.current.measureLengths?.[start.measure] ?? 1;
        const endMeasureLen = bmsDataRef.current.measureLengths?.[end.measure] ?? 1;

        const startAbsolutePos = currentMeasureOffsets.offsets[start.measure] + start.position * startMeasureLen;
        const endAbsolutePos = currentMeasureOffsets.offsets[end.measure] + end.position * endMeasureLen;

        const startY = -startAbsolutePos * currentMeasureHeight;
        const endY = -endAbsolutePos * currentMeasureHeight;

        const yTop = Math.min(startY, endY);
        const yBottom = Math.max(startY, endY);

        // worldY가 롱노트 몸통 범위 내에 있는지 검사
        if (worldY >= yTop - noteHeight && worldY <= yBottom) {
          return { note: end, isBody: true }; // 끝 노트를 반환하여 끝부분(위)이 조절되게 함
        }
      }

      return undefined;
    };

    if (e.button === 2) {
      e.preventDefault();
      const clicked = findNoteAtPixel(x, y);
      if (clicked) {
        setKeyChangeModalNoteId(clicked.note.id);
        setKeyChangeModalDefaultValue(clicked.note.value);
        setIsKeyChangeModalOpen(true);
      }
      return;
    }
    
    const bmsPos = getBmsPosition(x, y);
    if (!bmsPos) return;

    const { measure, position, lane } = bmsPos;
    let actualChannel = lane.channel || 0;
    let actualIndex = 0;
    if (lane.type === 'bgm') {
      actualChannel = 0x01;
      actualIndex = parseInt(lane.name.substring(1)) - 1;
    }

    const normalizeChannel = (ch: number) => {
      if (ch >= 0x51 && ch <= 0x59) return ch - 0x40; // LN -> Normal
      if (ch >= 0x61 && ch <= 0x69) return ch - 0x40;
      if (ch >= 0x31 && ch <= 0x39) return ch - 0x20; // Invisible -> Normal
      if (ch >= 0x41 && ch <= 0x49) return ch - 0x20;
      if (ch >= 0xD1 && ch <= 0xD9) return ch - 0xC0; // Mine -> Normal
      if (ch >= 0xE1 && ch <= 0xE9) return ch - 0xC0;
      return ch;
    };

    const findNoteAt = () => {
      const POS_TOLERANCE = 1e-5;
      const notes = bmsDataRef.current!.notes;
      const targetNorm = normalizeChannel(actualChannel);
      for (let i = notes.length - 1; i >= 0; i--) {
        const n = notes[i];
        if (n.measure === measure && 
            normalizeChannel(n.channel) === targetNorm && 
            (n.channel !== 0x01 || n.index === actualIndex) &&
            Math.abs(n.position - position) < POS_TOLERANCE) {
          return n;
        }
      }
      return undefined;
    };

    if (activeToolRef.current === 'write') {
      const found = findNoteAtPixel(x, y);
      const clickedNote = found?.note;
      if (clickedNote && clickedNote.partnerId) {
        isResizingLongNote.current = true;
        resizeTargetNoteId.current = clickedNote.id;
        dragNoteDidMove.current = false;
        
        const measureStart = measureOffsetsRef.current.offsets[measure];
        const measureLen = bmsDataRef.current!.measureLengths[measure] ?? 1;
        dragStartAbsPos.current = measureStart + position * measureLen;
        dragStartBmsPos.current = { measure, position, channel: actualChannel, index: actualIndex };
        
        if (found.isBody) {
          // 몸통을 누른 경우, 윗부분(clickedNote)을 즉시 클릭한 위치의 격자로 이동시킴!
          updateNote(clickedNote.id, {
            measure: measure,
            position: position
          });
          resizeOffsetAbs.current = 0;
          dragNoteDidMove.current = true;
        } else {
          const targetMeasureStart = measureOffsetsRef.current.offsets[clickedNote.measure];
          const targetMeasureLen = bmsDataRef.current!.measureLengths[clickedNote.measure] ?? 1;
          const targetAbsTime = targetMeasureStart + clickedNote.position * targetMeasureLen;
          resizeOffsetAbs.current = dragStartAbsPos.current - targetAbsTime;
        }
        
        requestRender();
        return;
      }

      if (actualChannel !== undefined) {
        const existingNote = findNoteAt();
        const isTimingChannel = actualChannel === 0x08 || actualChannel === 0x09 || actualChannel === 256;

        if (isTimingChannel) {
          if (existingNote) {
            // 이미 타이밍 노정이 있는 경우 ➔ 수정 모달 노출
            let existingVal = 0;
            if (actualChannel === 0x08) existingVal = bmsDataRef.current?.bpms?.[existingNote.value] ?? 120;
            else if (actualChannel === 0x09) existingVal = bmsDataRef.current?.stops?.[existingNote.value] ?? 0;
            else if (actualChannel === 256) existingVal = bmsDataRef.current?.scrolls?.[existingNote.value] ?? 1;

            timingModalClickInfo.current = { 
              measure, 
              position, 
              actualChannel, 
              actualIndex, 
              editingNoteId: existingNote.id 
            };
            setTimingModalChannel(actualChannel);
            setTimingModalDefaultValue(existingVal);
            setIsTimingValueModalOpen(true);
            return;
          } else {
            // 신규 타이밍 노정 생성 모달 노출
            timingModalClickInfo.current = { measure, position, actualChannel, actualIndex };
            setTimingModalChannel(actualChannel);
            setTimingModalDefaultValue(undefined);
            setIsTimingValueModalOpen(true);
            return;
          }
        }

        const canWriteOnExisting = existingNote && (
          (existingNote.channel >= 0x11 && existingNote.channel <= 0x19) ||
          (existingNote.channel >= 0x21 && existingNote.channel <= 0x29)
        );

        if (!existingNote || canWriteOnExisting) {
          const isPlayable = (actualChannel >= 0x11 && actualChannel <= 0x19) || 
                             (actualChannel >= 0x21 && actualChannel <= 0x29);
          if (isPlayable) {
            const startPos = { 
              measure, 
              position, 
              lane, 
              channel: actualChannel, 
              index: actualIndex,
              value: existingNote ? existingNote.value : undefined
            };
            isDrawingLongNote.current = true;
            writeStartBmsPos.current = startPos;
            writeCurrentBmsPos.current = startPos;
            requestRender();
          } else if (!existingNote) {
            addNote({
              id: crypto.randomUUID(),
              measure,
              position,
              channel: actualChannel,
              index: actualIndex,
              value: currentNoteValue
            });
            commitHistory();
            playPreviewSound(currentNoteValue);
          }
        }
      }
    } else if (activeToolRef.current === 'erase') {
      const found = findNoteAtPixel(x, y);
      const clickedNote = found?.note;
      if (clickedNote) {
        removeNote(clickedNote.id);
        commitHistory();
      }
    } else if (activeToolRef.current === 'select') {
      const found = findNoteAtPixel(x, y);
      const clickedNote = found?.note;
      if (clickedNote) {
        const isAudioChannel = 
          clickedNote.channel === 0x01 || 
          (clickedNote.channel >= 0x11 && clickedNote.channel <= 0x19) || 
          (clickedNote.channel >= 0x21 && clickedNote.channel <= 0x29) || 
          (clickedNote.channel >= 0x51 && clickedNote.channel <= 0x59) || 
          (clickedNote.channel >= 0x61 && clickedNote.channel <= 0x69);

        if (isAudioChannel && !longNoteEndIdsRef.current.has(clickedNote.id)) {
          playPreviewSound(clickedNote.value);
        }
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
          let dragNotes = bmsDataRef.current.notes.filter(n => selectedNotesRef.current.includes(n.id));
          
          if (dragNotes.length === 2) {
            const [n1, n2] = dragNotes;
            const isPlayable = (n1.channel >= 0x11 && n1.channel <= 0x19) || 
                               (n1.channel >= 0x21 && n1.channel <= 0x29) || 
                               (n1.channel >= 0x51 && n1.channel <= 0x59) || 
                               (n1.channel >= 0x61 && n1.channel <= 0x69);
            const threshold = isPlayable ? (1 / 128) + 1e-6 : 1e-6;
            
            let overlapEachOther = false;
            if (n1.channel === n2.channel) {
              if (n1.channel === 0x01) {
                overlapEachOther = (n1.index % 100) === (n2.index % 100) && Math.abs(n1.measure + n1.position - (n2.measure + n2.position)) <= threshold;
              } else {
                overlapEachOther = Math.abs(n1.measure + n1.position - (n2.measure + n2.position)) <= threshold;
              }
            }
            
            if (overlapEachOther) {
              const topNote = bmsDataRef.current.notes.indexOf(n1) > bmsDataRef.current.notes.indexOf(n2) ? n1 : n2;
              dragNotes = [topNote];
              setSelectedNotes([topNote.id]);
            }
          }

          dragNoteInitialState.current = dragNotes.map(n => ({
            id: n.id,
            initialMeasure: n.measure,
            initialPosition: n.position,
            initialChannel: n.channel,
            initialIndex: n.index
          }));
        }
        isDraggingNotes.current = true;
        const measureStart = measureOffsetsRef.current.offsets[measure];
        const measureLen = bmsDataRef.current.measureLengths?.[measure] ?? 1;
        dragStartAbsPos.current = measureStart + position * measureLen;
        dragStartBmsPos.current = { measure, position, channel: actualChannel, index: actualIndex };
      } else {
        isSelectingBox.current = true;
        const currentOriginY = canvasRef.current!.height + scrollY.current;
        const wx = x + scrollX.current;
        const wy = y - currentOriginY;
        selectionBoxStart.current = { x: wx, y: wy };
        selectionBoxCurrent.current = { x: wx, y: wy };
        if (!e.shiftKey) setSelectedNotes([]);
      }
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

  const handleApplyTimingValue = (parsedVal: number) => {
    const info = timingModalClickInfo.current;
    if (!info) return;
    const { measure, position, actualChannel, actualIndex, editingNoteId } = info;
    const currentBmsData = bmsDataRef.current;
    if (!currentBmsData) return;
    
    if (!currentBmsData.bpms) currentBmsData.bpms = {};
    if (!currentBmsData.stops) currentBmsData.stops = {};
    if (!currentBmsData.scrolls) currentBmsData.scrolls = {};
    
    let valType = '';
    if (actualChannel === 0x08) valType = 'bpm';
    else if (actualChannel === 0x09) valType = 'stop';
    else if (actualChannel === 256) valType = 'scroll';
    
    let targetMap: Record<number, number> = {};
    if (valType === 'bpm') targetMap = currentBmsData.bpms;
    else if (valType === 'stop') targetMap = currentBmsData.stops;
    else if (valType === 'scroll') targetMap = currentBmsData.scrolls;
    
    let targetIdx = -1;
    const entries = Object.entries(targetMap);
    for (const [k, v] of entries) {
      if (Math.abs(v - parsedVal) < 1e-7) {
        targetIdx = parseInt(k);
        break;
      }
    }
    
    if (targetIdx === -1) {
      let nextIdx = 1;
      while (targetMap[nextIdx] !== undefined) {
        nextIdx++;
      }
      targetMap[nextIdx] = parsedVal;
      targetIdx = nextIdx;
    }
    
    if (editingNoteId) {
      // 수정 모드: 기존 노정을 업데이트
      updateNote(editingNoteId, {
        value: targetIdx
      });
    } else {
      // 생성 모드: 새 노정을 생성
      addNote({
        id: crypto.randomUUID(),
        measure,
        position,
        channel: actualChannel,
        index: actualIndex,
        value: targetIdx
      });
    }
    commitHistory();
    requestRender();
  };

  const handleApplyKeyChange = (newValue: number) => {
    if (!keyChangeModalNoteId || !bmsDataRef.current) return;
    const note = bmsDataRef.current.notes.find(n => n.id === keyChangeModalNoteId);
    if (!note) return;

    commitHistory();

    const updatesArray: { id: string, updates: Partial<BmsNote> }[] = [
      { id: note.id, updates: { value: newValue } }
    ];

    // 채널 방식 롱노트(51~69)인 경우 파트너의 value도 동기화
    if (note.partnerId && note.channel >= 0x51 && note.channel <= 0x69) {
      const partner = bmsDataRef.current.notes.find(n => n.id === note.partnerId);
      if (partner) {
        updatesArray.push({ id: partner.id, updates: { value: newValue } });
      }
    }

    updateNotes(updatesArray);
    requestRender();
  };

  // ==========================================
  // 시간편집 (Time Edit, F1) 신규 훅 및 유틸 바인딩
  // ==========================================
  const {
    handleApplyTimeSpace,
    handleApplyTimeBpm,
    handleApplyTimeStop,
    handleApplyAutoPlace
  } = useTimeEditOperations(
    {
      bmsData,
      timeSelection,
      measureOffsets,
      longNotePairs,
      hasNotesInsideStopArea
    },
    {
      commitHistory,
      setTimeSelection,
      requestRender
    }
  );

  const handleApplyTimeAutoPlace = (
    constraints: { baseBeatDenom: number; maxNotes: number }[]
  ): { success: boolean; errorMsg?: string } => {
    const activeLayout = getActiveLayout();
    const availableLanes = activeLayout
      .filter(l => l.channel !== undefined && (
        (l.channel >= 0x11 && l.channel <= 0x19) ||
        (l.channel >= 0x21 && l.channel <= 0x29)
      ))
      .map(l => ({ channel: l.channel!, index: (l as any).index || 0 }));

    const res = handleApplyAutoPlace(constraints, availableLanes);
    if (res.success) {
      return { success: true };
    } else {
      let errorMsg = '';
      if (res.reason === 'math_impossible' && res.errorAt !== undefined) {
        const measureOffsets = measureOffsetsRef.current;
        const measureLengths = bmsDataRef.current?.measureLengths || {};
        const pos = getBmsPosFromAbsTime(res.errorAt, measureLengths, measureOffsets.offsets);
        // 기약분수 표현을 위해 위치 계산
        // 일반적으로 position은 0~1 사이의 값입니다.
        // 예를 들어 0.25 = 1/4구간, 0.5 = 1/2구간 등
        // pos.position을 사람이 읽기 편한 위치 텍스트로 치환합니다.
        let posText = '';
        if (Math.abs(pos.position - 0) < 1e-4) posText = '시작점';
        else if (Math.abs(pos.position - 0.25) < 1e-4) posText = '1/4 지점';
        else if (Math.abs(pos.position - 0.5) < 1e-4) posText = '1/2 지점';
        else if (Math.abs(pos.position - 0.75) < 1e-4) posText = '3/4 지점';
        else posText = `${(pos.position * 100).toFixed(1)}% 지점`;

        const formatted = `${pos.measure}마디 ${posText}`;
        errorMsg = `[수학적 불가능] ${formatted} 부근에 노트가 너무 촘촘하게 배치되어 제약 조건을 만족할 수 없습니다.`;
      } else {
        errorMsg = `[재배치 실패] 제약 조건을 만족하는 노트 배치를 찾을 수 없습니다. 조건을 완화하여 다시 시도해 주세요.`;
      }
      return { success: false, errorMsg };
    }
  };

  // 절대 마디 실수값(absTime)에 현재 격자 박자(gridSnap)를 적용하여 정교하게 스냅된 실수값을 구합니다.
  const getSnappedAbsTime = (absTime: number): number => {
    return getSnappedAbsTimeUtil(
      absTime,
      gridSnapRef.current,
      measureOffsetsRef.current.offsets,
      bmsDataRef.current?.measureLengths || {}
    );
  };

  // ==========================================
  // 키보드 단축키 및 클립보드 신규 훅 바인딩
  // ==========================================
  const {
    handleUndo,
    handleRedo,
    handleCut,
    handleCopy,
    handlePaste,
    handleDelete,
    handleSelectAll
  } = useKeyboardShortcuts(
    {
      scrollY,
      hoverBmsPos,
      canvasRef,
      measureOffsetsRef,
      zoomYRef,
      maxScrollYRef,
      bmsDataRef
    },
    {
      setIsGoToMeasureOpen,
      requestRender,
      MIN_SCROLL_Y
    }
  );

  return (
    <div 
      className={`app-container theme-${settings.theme || 'dark'}`} 
      ref={appContainerRef}
      style={{ 
        '--sidebar-width': viewSettings.showLeftSidebar ? `${leftWidthRef.current}px` : '0px', 
        '--right-panel-width': viewSettings.showRightSidebar ? `${rightWidthRef.current}px` : '0px' 
      } as React.CSSProperties}
    >
      <Topbar 
  isFileMenuOpen={isFileMenuOpen} setIsFileMenuOpen={setIsFileMenuOpen} 
  handleNew={handleNew} handleOpen={handleOpen} handleSave={handleSave} 
  handleSaveAs={handleSaveAs} handleRecentClick={handleRecentClick} 
  handleExit={handleExit} isDirty={isDirty} hasBmsData={!!bmsData} 
  recentFiles={recentFiles} 
  handleUndo={handleUndo} handleRedo={handleRedo} handleCut={handleCut}
  handleCopy={handleCopy} handlePaste={handlePaste} handleDelete={handleDelete}
  handleSelectAll={handleSelectAll} handleGoToMeasure={() => setIsGoToMeasureOpen(true)}
  handleOpenSettings={handleOpenSettings}
  handleOpenHelp={handleOpenHelp}
/>

<div className="main-area">
  {viewSettings.showLeftSidebar && (
    <>
      <LeftSidebar 
        handleNew={handleNew}
        handleOpen={handleOpen}
        handleSave={handleSave} 
        handleSaveAs={handleSaveAs}
        handleOpenDiff={() => setIsBmsDiffOpen(true)}
        isDirty={isDirty} hasBmsData={!!bmsData} 
        totalNotesCount={totalNotesCount} playableNotesCount={playableNotesCount} 
        activeTool={activeTool} setActiveTool={setActiveTool} 
        timeSelection={timeSelection}
        onOpenTimeSpaceModal={() => setIsTimeSpaceModalOpen(true)}
        onOpenTimeBpmModal={() => setIsTimeBpmModalOpen(true)}
        onOpenTimeStopModal={() => setIsTimeStopModalOpen(true)}
        onOpenTimeAutoPlaceModal={() => setIsTimeAutoPlaceModalOpen(true)}
      />
      <div 
        className="resizer resizer-left"
        onMouseDown={() => { isResizingLeft.current = true; }}
      />
    </>
  )}

  <main className="canvas-container" ref={containerRef}>
    <canvas 
      ref={canvasRef} 
      onMouseDown={handleCanvasMouseDown} 
      onContextMenu={(e) => e.preventDefault()} 
      onMouseMove={(e) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const pos = getBmsPosition(x, y);
        hoverBmsPos.current = pos;

        if (activeToolRef.current === 'write') {
          if (canvasRef.current) {
            canvasRef.current.style.cursor = pos ? 'none' : 'crosshair';
          }
          requestRender();
        } else if (activeToolRef.current === 'select') {
          if (canvasRef.current) {
            const isDragging = isDraggingNotes.current || isSelectingBox.current || isPanning.current;
            canvasRef.current.style.cursor = isDragging ? 'crosshair' : 'default';
          }
          requestRender();
        } else {
          if (canvasRef.current) {
            canvasRef.current.style.cursor = 'crosshair';
          }
          requestRender();
        }
      }}
      onMouseLeave={() => {
        hoverBmsPos.current = null;
        if (canvasRef.current) {
          if (activeToolRef.current === 'select') {
            canvasRef.current.style.cursor = 'default';
          } else {
            canvasRef.current.style.cursor = 'crosshair';
          }
        }
        requestRender();
      }}
      style={{ cursor: activeTool === 'select' ? 'default' : 'crosshair' }}
    />
  </main>

  {viewSettings.showRightSidebar && (
    <>
      <div 
        className="resizer resizer-right"
        onMouseDown={() => { isResizingRight.current = true; }}
      />
      <RightSidebar 
        bmsData={bmsData} updateHeader={updateHeader} 
        updateWav={updateWav} updateBmp={updateBmp} useBase62={useBase62}
        gridSnap={gridSnap} setGridSnap={setGridSnap} 
        zoomX={zoomX} setZoomX={setZoomX} 
        zoomY={zoomY} setZoomY={setZoomY} 
      />
    </>
  )}
</div>

{isTimingValueModalOpen && (
  <TimingValueModal 
    isOpen={true}
    onClose={() => setIsTimingValueModalOpen(false)}
    channel={timingModalChannel}
    onApply={handleApplyTimingValue}
    defaultValue={timingModalDefaultValue}
  />
)}

{isKeyChangeModalOpen && (
  <KeyChangeModal 
    isOpen={true}
    onClose={() => setIsKeyChangeModalOpen(false)}
    useBase62={useBase62}
    defaultValue={keyChangeModalDefaultValue}
    onApply={handleApplyKeyChange}
  />
)}

{isTimeSpaceModalOpen && (
  <TimeSpaceModal 
    isOpen={true}
    onClose={() => setIsTimeSpaceModalOpen(false)}
    duration={timeSelection ? timeSelection.end - timeSelection.start : 0}
    startAbs={timeSelection ? timeSelection.start : 0}
    endAbs={timeSelection ? timeSelection.end : 0}
    onApply={handleApplyTimeSpace}
  />
)}

{isTimeBpmModalOpen && (
  <TimeBpmModal 
    isOpen={true}
    onClose={() => setIsTimeBpmModalOpen(false)}
    startAbs={timeSelection ? timeSelection.start : 0}
    endAbs={timeSelection ? timeSelection.end : 0}
    onApply={handleApplyTimeBpm}
  />
)}

{isTimeStopModalOpen && (
  <TimeStopModal 
    isOpen={true}
    onClose={() => setIsTimeStopModalOpen(false)}
    duration={timeSelection ? timeSelection.end - timeSelection.start : 0}
    startAbs={timeSelection ? timeSelection.start : 0}
    endAbs={timeSelection ? timeSelection.end : 0}
    hasNotesInside={hasNotesInsideStopArea}
    onApply={handleApplyTimeStop}
  />
)}

{isTimeAutoPlaceModalOpen && (
  <TimeAutoPlaceModal
    isOpen={true}
    onClose={() => setIsTimeAutoPlaceModalOpen(false)}
    startAbs={timeSelection ? timeSelection.start : 0}
    endAbs={timeSelection ? timeSelection.end : 0}
    onApply={handleApplyTimeAutoPlace}
  />
)}

{isGoToMeasureOpen && (
  <GoToMeasureModal 
    isOpen={true} 
    onClose={() => setIsGoToMeasureOpen(false)} 
    onApply={(measure) => {
      // Find Y position for this measure
      const currentMeasureOffsets = measureOffsetsRef.current;
      const measureOffset = currentMeasureOffsets.offsets[measure];
      if (measureOffset !== undefined) {
        const currentMeasureHeight = BASE_MEASURE_HEIGHT * zoomYRef.current;
        const measureY = measureOffset * currentMeasureHeight;
        // Place the measure line 100px above the bottom of the screen
        const targetScrollY = measureY - 100;
        scrollY.current = Math.min(maxScrollYRef.current, Math.max(MIN_SCROLL_Y, targetScrollY));
        requestRender();
      }
    }} 
  />
)}

{isBmsSelectionOpen && (
  <div className="modal-overlay">
    <div className="modal-content" style={{ width: '400px', maxHeight: '400px', display: 'flex', flexDirection: 'column' }}>
      <h3 style={{ margin: '0 0 12px 0' }}>Select BMS File</h3>
      <p style={{ fontSize: '0.85rem', margin: '0 0 15px 0', color: 'var(--text-secondary)' }}>
        Multiple BMS files detected in the folder. Please select a file to load:
      </p>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '15px' }}>
        {bmsFilesToSelect.map((file, idx) => (
          <button
            key={idx}
            className="tool-button"
            style={{ width: '100%', padding: '10px', justifyContent: 'flex-start', textAlign: 'left', background: 'rgba(255,255,255,0.05)' }}
            onClick={async () => {
              setIsBmsSelectionOpen(false);
              await loadBmsFromFile(file);
            }}
          >
            {file.name}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="tool-button" onClick={() => setIsBmsSelectionOpen(false)}>Cancel</button>
      </div>
    </div>
  </div>
)}

{isSettingsOpen && (
  <SettingsModal 
    isOpen={true} 
    onClose={() => setIsSettingsOpen(false)} 
    initialTab={settingsTab}
  />
)}

{isHelpOpen && (
  <HelpModal 
    isOpen={true} 
    onClose={() => setIsHelpOpen(false)} 
    defaultTab={helpTab}
  />
)}

{isBmsDiffOpen && (
  <BmsDiffModal
    isOpen={true}
    onClose={() => setIsBmsDiffOpen(false)}
    baseBms={diffBaseBms}
    setBaseBms={setDiffBaseBms}
    baseFileName={diffBaseFileName}
    setBaseFileName={setDiffBaseFileName}
    diffResults={diffResults}
    setDiffResults={setDiffResults}
    isCompared={diffIsCompared}
    setIsCompared={setDiffIsCompared}
    diffCheckHistoryIndex={diffCheckHistoryIndex}
    onGoToMeasure={(measure) => {
      const currentMeasureOffsets = measureOffsetsRef.current;
      const measureOffset = currentMeasureOffsets.offsets[measure];
      if (measureOffset !== undefined) {
        const currentMeasureHeight = BASE_MEASURE_HEIGHT * zoomYRef.current;
        const measureY = measureOffset * currentMeasureHeight;
        const targetScrollY = measureY - 100;
        scrollY.current = Math.min(maxScrollYRef.current, Math.max(MIN_SCROLL_Y, targetScrollY));
        requestRender();
      }
    }}
  />
)}

{isValidationErrorOpen && (
  <BmsValidationErrorModal
    isOpen={true}
    onClose={() => setIsValidationErrorOpen(false)}
    errors={validationErrors}
    onSaveForce={saveForceRef.current || undefined}
    onGoToMeasure={(measure) => {
      const currentMeasureOffsets = measureOffsetsRef.current;
      const measureOffset = currentMeasureOffsets.offsets[measure];
      if (measureOffset !== undefined) {
        const currentMeasureHeight = BASE_MEASURE_HEIGHT * zoomYRef.current;
        const measureY = measureOffset * currentMeasureHeight;
        const targetScrollY = measureY - 100;
        scrollY.current = Math.min(maxScrollYRef.current, Math.max(MIN_SCROLL_Y, targetScrollY));
        requestRender();
      }
    }}
  />
)}

</div>
);
}

export default App;
