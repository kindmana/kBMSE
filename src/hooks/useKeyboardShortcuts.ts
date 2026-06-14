import { useEffect } from 'react';
import { BmsData } from '../parser/bmsParser';
import { useEditorStore } from '../store/editorStore';
import { getAudioContext } from '../utils/audioPlayer';
import { BASE_MEASURE_HEIGHT } from '../constants/layout';

export interface KeyboardShortcutsRefs {
  scrollY: React.MutableRefObject<number>;
  hoverBmsPos: React.MutableRefObject<{ measure: number; position: number } | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  measureOffsetsRef: React.MutableRefObject<{ offsets: number[]; totalLen: number; maxM: number }>;
  zoomYRef: React.MutableRefObject<number>;
  maxScrollYRef: React.MutableRefObject<number>;
  bmsDataRef: React.MutableRefObject<BmsData | null>;
}

export interface KeyboardShortcutsActions {
  setIsGoToMeasureOpen: (open: boolean) => void;
  requestRender: () => void;
  MIN_SCROLL_Y: number;
}

/**
 * 에디터 내 전역 키보드 핫키 리스너 및 복사/잘라내기/붙여넣기(클립보드) 서비스 커스텀 훅
 * - Ctrl + C/V/X/A/Z/Y 등 전역 조작 이벤트 리스너 바인딩
 * - F1~F3 툴 스왑, F5~F8 재생 제어 단축키 통합 관리
 * - Home / End 순간 마디 좌표 이동 제어 캡슐화
 */
export function useKeyboardShortcuts(
  refs: KeyboardShortcutsRefs,
  actions: KeyboardShortcutsActions
) {
  const { scrollY, hoverBmsPos, canvasRef, measureOffsetsRef, zoomYRef, maxScrollYRef, bmsDataRef } = refs;
  const { setIsGoToMeasureOpen, requestRender, MIN_SCROLL_Y } = actions;

  const handleUndo = () => useEditorStore.getState().undo();
  const handleRedo = () => useEditorStore.getState().redo();

  // 1. 잘라내기 (Cut)
  const handleCut = () => {
    const state = useEditorStore.getState();
    if (!state.bmsData || state.selectedNotes.length === 0) return;
    const notesToCopy = state.bmsData.notes.filter(n => state.selectedNotes.includes(n.id));
    state.setClipboard(notesToCopy);
    state.removeNotes(state.selectedNotes);
    state.setSelectedNotes([]);
    state.commitHistory();
  };

  // 2. 복사 (Copy)
  const handleCopy = () => {
    const state = useEditorStore.getState();
    if (!state.bmsData || state.selectedNotes.length === 0) return;
    const notesToCopy = state.bmsData.notes.filter(n => state.selectedNotes.includes(n.id));
    state.setClipboard(notesToCopy);
  };

  // 3. 붙여넣기 (Paste)
  const handlePaste = () => {
    const state = useEditorStore.getState();
    const clipboard = state.clipboard;
    const bmsData = state.bmsData;
    if (!clipboard || clipboard.length === 0 || !bmsData) return;
    
    // 복사된 노트군 중 최소 measure/position 지점(시작점) 연산
    let minMeasure = Infinity;
    let minPos = Infinity;
    for (const n of clipboard) {
      if (n.measure < minMeasure) {
        minMeasure = n.measure;
        minPos = n.position;
      } else if (n.measure === minMeasure && n.position < minPos) {
        minPos = n.position;
      }
    }
    
    let targetMeasure = minMeasure;
    if (hoverBmsPos.current) {
      targetMeasure = hoverBmsPos.current.measure;
    } else {
      // 마우스 호버 지점이 없을 경우 화면 중앙 마디 앵커링 계산
      const midY = scrollY.current + (canvasRef.current?.height || 600) / 2;
      let bestM = 0;
      let bestDiff = Infinity;
      measureOffsetsRef.current.offsets.forEach((y, m) => {
        const diff = Math.abs(y - midY);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestM = m;
        }
      });
      targetMeasure = bestM;
    }
    
    const offsetMeasure = targetMeasure - minMeasure;
    
    // 1. 구 ID ➔ 신 ID 매핑 생성
    const idMap = new Map<string, string>();
    clipboard.forEach(n => {
      idMap.set(n.id, crypto.randomUUID());
    });

    // 2. 새로운 노트 생성 (partnerId도 신규 ID로 재매핑)
    const newNotes = clipboard.map(n => {
      const newId = idMap.get(n.id)!;
      let newPartnerId = undefined;
      if (n.partnerId) {
        if (idMap.has(n.partnerId)) {
          newPartnerId = idMap.get(n.partnerId);
        }
      }
      return {
        ...n,
        id: newId,
        partnerId: newPartnerId,
        measure: Math.max(0, n.measure + offsetMeasure)
      };
    });
    
    state.addNotes(newNotes);
    state.setSelectedNotes(newNotes.map(n => n.id));
    state.commitHistory();
  };

  // 4. 삭제 (Delete)
  const handleDelete = () => {
    const state = useEditorStore.getState();
    if (state.selectedNotes.length > 0) {
      state.removeNotes(state.selectedNotes);
      state.setSelectedNotes([]);
      state.commitHistory();
    }
  };

  // 5. 전체 선택 (Select All)
  const handleSelectAll = () => {
    const state = useEditorStore.getState();
    if (state.bmsData) {
      state.setSelectedNotes(state.bmsData.notes.map(n => n.id));
    }
  };

  // 전역 KeyDown 리스너 바인딩 등록 및 해제 라이프사이클 전용 Effect
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 텍스트 입력 창 등을 타이핑하고 있을 시 오동작 방지 필터
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const isCtrl = e.ctrlKey || e.metaKey;

      if (isCtrl && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      } else if (isCtrl && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (isCtrl && e.key.toLowerCase() === 'x') {
        e.preventDefault();
        handleCut();
      } else if (isCtrl && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleCopy();
      } else if (isCtrl && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        handlePaste();
      } else if (isCtrl && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        handleSelectAll();
      } else if (isCtrl && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        e.stopPropagation();
        setIsGoToMeasureOpen(true);
      } else if (e.key === 'Delete') {
        e.preventDefault();
        handleDelete();
      } else if (e.key === 'F1') {
        e.preventDefault();
        useEditorStore.getState().setActiveTool('time');
      } else if (e.key === 'F2') {
        e.preventDefault();
        useEditorStore.getState().setActiveTool('select');
      } else if (e.key === 'F3') {
        e.preventDefault();
        useEditorStore.getState().setActiveTool('write');
      } else if (e.key === 'F5') {
        e.preventDefault();
        if (useEditorStore.getState().audioProgress !== null) return;
        const actx = getAudioContext();
        if (actx.state === 'suspended') {
          actx.resume().catch(err => console.error(`[Shortcut] Failed to resume:`, err));
        }
        useEditorStore.getState().startPlay(true);
      } else if (e.key === 'F6') {
        e.preventDefault();
        if (useEditorStore.getState().audioProgress !== null) return;
        const actx = getAudioContext();
        if (actx.state === 'suspended') {
          actx.resume().catch(err => console.error(`[Shortcut] Failed to resume:`, err));
        }
        useEditorStore.getState().startPlay(false);
      } else if (e.key === 'F7') {
        e.preventDefault();
        if (useEditorStore.getState().audioProgress !== null) return;
        useEditorStore.getState().pausePlay();
      } else if (e.key === 'F8') {
        e.preventDefault();
        if (useEditorStore.getState().audioProgress !== null) return;
        useEditorStore.getState().stopPlay();
      } else if (e.key === 'Home') {
        e.preventDefault();
        scrollY.current = MIN_SCROLL_Y;
        requestRender();
      } else if (e.key === 'End') {
        e.preventDefault();
        if (bmsDataRef.current) {
          const notes = bmsDataRef.current.notes || [];
          let lastMeasure = 0;
          if (notes.length > 0) {
            lastMeasure = Math.max(...notes.map(n => n.measure));
          } else if (bmsDataRef.current.measureLengths) {
            lastMeasure = Object.keys(bmsDataRef.current.measureLengths).map(Number).reduce((a, b) => Math.max(a, b), 0);
          }
          
          const currentMeasureHeight = BASE_MEASURE_HEIGHT * zoomYRef.current;
          const currentMeasureOffsets = measureOffsetsRef.current;
          const targetMeasure = Math.max(0, Math.min(currentMeasureOffsets.offsets.length - 1, lastMeasure));
          const measureStart = currentMeasureOffsets.offsets[targetMeasure];
          const targetY = measureStart * currentMeasureHeight;
          
          scrollY.current = Math.min(maxScrollYRef.current, Math.max(MIN_SCROLL_Y, targetY - 80));
          requestRender();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [MIN_SCROLL_Y]);

  return {
    handleUndo,
    handleRedo,
    handleCut,
    handleCopy,
    handlePaste,
    handleDelete,
    handleSelectAll
  };
}
