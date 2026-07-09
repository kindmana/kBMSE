import { useEffect } from 'react';
import { BmsData } from '../parser/bmsParser';
import { useEditorStore } from '../store/editorStore';
import { getAudioContext } from '../utils/audioPlayer';
import { BASE_MEASURE_HEIGHT } from '../constants/layout';

// iBMSC 채널 번호 -> 에디터 실채널 번호
const ibmscToEditorChannelMap: Record<number, number> = {
  1: 256,  // SCROLL
  2: 8,    // BPM (확장 BPM)
  3: 9,    // STOP
  5: 22,   // 1P SC
  7: 17,   // 1P KEY1
  8: 18,   // 1P KEY2
  9: 19,   // 1P KEY3
  10: 20,  // 1P KEY4
  11: 21,  // 1P KEY5
  12: 24,  // 1P KEY6
  13: 25,  // 1P KEY7
  32: 33,  // 2P KEY1
  33: 34,  // 2P KEY2
  34: 35,  // 2P KEY3
  35: 36,  // 2P KEY4
  36: 37,  // 2P KEY5
  37: 40,  // 2P KEY6
  38: 41,  // 2P KEY7
  56: 38,  // 2P SC
  59: 4,   // BGA (0x04)
  60: 7,   // LAYER (0x07)
  61: 6,   // POOR (0x06)
};

// 에디터 실채널 번호 -> iBMSC 채널 번호
const editorToIbmscChannelMap: Record<number, number> = {
  256: 1,  // SCROLL
  3: 2,    // 일반 BPM
  8: 2,    // 확장 BPM
  9: 3,    // STOP
  22: 5,   // 1P SC
  17: 7,   // 1P KEY1
  18: 8,   // 1P KEY2
  19: 9,   // 1P KEY3
  20: 10,  // 1P KEY4
  21: 11,  // 1P KEY5
  24: 12,  // 1P KEY6
  25: 13,  // 1P KEY7
  33: 32,  // 2P KEY1
  34: 33,  // 2P KEY2
  35: 34,  // 2P KEY3
  36: 35,  // 2P KEY4
  37: 36,  // 2P KEY5
  40: 37,  // 2P KEY6
  41: 38,  // 2P KEY7
  38: 56,  // 2P SC
  4: 59,   // BGA
  7: 60,   // LAYER
  6: 61,   // POOR
};

function serializeToIbmscFormat(notes: any[]): string {
  const lines = notes.map(n => {
    let channel = n.channel;
    let flag = 0;
    let extra = 0;

    // 숨김노트 복원 (일반 채널로 변환하고 flag = -1 세팅)
    const isHidden1P = channel >= 49 && channel <= 57;
    const isHidden2P = channel >= 65 && channel <= 73;
    if (isHidden1P || isHidden2P) {
      channel = channel - 32;
      flag = -1;
    }
    // 지뢰노트 복원 (일반 채널로 변환하고 extra = -1 세팅)
    else if ((channel >= 209 && channel <= 217) || (channel >= 225 && channel <= 233)) {
      channel = channel - 192;
      extra = -1;
    }

    let rawChannel = editorToIbmscChannelMap[channel];
    if (rawChannel === undefined) {
      if (channel === 1) {
        rawChannel = 63 + (n.index || 0); // BGM 영역
      } else {
        rawChannel = 63; // 폴백 BGM
      }
    }

    const absoluteTime = Math.round(n.measure * 192 + n.position * 192);

    const rawValue = (n.value || 0) * 10000;

    let length = 0;
    if (n.partnerId) {
      const partner = notes.find(pn => pn.id === n.partnerId);
      if (partner) {
        const partnerTime = Math.round(partner.measure * 192 + partner.position * 192);
        if (partnerTime > absoluteTime) {
          length = partnerTime - absoluteTime;
        } else if (partnerTime < absoluteTime) {
          return null;
        }
      }
    }

    return `${rawChannel} ${absoluteTime} ${rawValue} ${length} ${flag} ${extra}`;
  }).filter(line => line !== null);

  return "iBMSC Clipboard Data xNT\r\n" + lines.join("\r\n");
}

async function setSystemClipboard(text: string) {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('write_clipboard_text', { text });
  } catch (tauriErr) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(text);
      } catch (err) {
        console.error("[Clipboard] Web write failed:", err);
      }
    }
  }
}

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
    
    // 시스템 클립보드 직렬화 복사
    const ibmscString = serializeToIbmscFormat(notesToCopy);
    setSystemClipboard(ibmscString);

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

    // 시스템 클립보드 직렬화 복사
    const ibmscString = serializeToIbmscFormat(notesToCopy);
    setSystemClipboard(ibmscString);
  };

  // 3. 붙여넣기 (Paste)
  const handlePaste = async (forcedText?: string) => {
    const state = useEditorStore.getState();
    let bmsData = state.bmsData;
    
    // 에디터 활성화 전 빈 파일 상태에서 붙여넣기를 시도할 경우 기본 빈 BMS 데이터 생성 기동
    if (!bmsData) {
      state.setUseBase62(36); // 기본 진법 인식 모드를 36진수로 설정
      bmsData = {
        header: {
          title: "New BMS",
          artist: "",
          genre: "",
          bpm: 130,
          player: 1,
          rank: 3,
          playLevel: "1",
          total: 100,
          wavs: {},
          bmps: {},
          stagefile: "",
          banner: "",
          backbmp: "",
          difficulty: 1,
          lnobj: "",
          other: {}
        },
        notes: [],
        wavs: {},
        bmps: {},
        stops: {},
        bpms: {},
        scrolls: {},
        measureLengths: {}
      };
      state.setBmsData(bmsData, "new_file.bms");
    }

    let externalNotes: any[] = [];
    let isExternalFormat = false;
    let text = forcedText || "";

    if (!text) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        text = await invoke<string>('read_clipboard_text');
      } catch (tauriErr) {
        if (navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
          try {
            text = await navigator.clipboard.readText();
          } catch (err: any) {
            console.warn("[Paste] Failed to read from clipboard or clipboard is empty:", err);
          }
        }
      }
    }

    if (!text) return;

    const trimmed = text.trim();

    if (trimmed.startsWith("BMSE ClipBoard Object Data Format")) {
      isExternalFormat = true;
      const lines = trimmed.split(/\r?\n/);
      const parsedNotes: { measure: number; channel: number; index?: number; ticks: number; value: number }[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        if (line.length < 12) continue;

        const typeChar = line[0];
        const channelStr = line.substring(1, 3);
        const ticksStr = line.substring(3, 11);
        const valueStr = line.substring(11);

        const ticks = parseInt(ticksStr, 10);
        const value = parseInt(valueStr, 10);
        if (isNaN(ticks) || isNaN(value)) continue;

        let channel = 0;
        let bgmIndex: number | undefined = undefined;
        if (typeChar === '0') {
          channel = parseInt(channelStr, 16);
        } else if (typeChar === '1') {
          channel = 1; // BGM
          bgmIndex = parseInt(channelStr, 16) - 1; // "01" -> 0, "02" -> 1
        } else {
          continue;
        }

        if (isNaN(channel)) continue;

        const measure = Math.floor(ticks / 192);
        parsedNotes.push({ measure, channel, index: bgmIndex, ticks, value });
      }

      if (parsedNotes.length > 0) {
        parsedNotes.sort((a, b) => {
          if (a.measure !== b.measure) return a.measure - b.measure;
          if (a.channel !== b.channel) return a.channel - b.channel;
          return a.ticks - b.ticks;
        });

        const measureChannelCount: Record<string, number> = {};
        externalNotes = parsedNotes.map(pn => {
          const key = `${pn.measure}_${pn.channel}`;
          let idx = pn.index;
          if (idx === undefined) {
            idx = measureChannelCount[key] || 0;
            measureChannelCount[key] = idx + 1;
          }
          const position = (pn.ticks % 192) / 192;
          return {
            id: crypto.randomUUID(),
            measure: pn.measure,
            channel: pn.channel,
            index: idx,
            position: position,
            value: pn.value
          };
        });
      }
    } else if (trimmed.startsWith("iBMSC Clipboard Data")) {
      isExternalFormat = true;
      const lines = trimmed.split(/\r?\n/);
      const parsedNotes: { time: number; channel: number; index?: number; value: number; length: number }[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const tokens = line.split(/\s+/);
        if (tokens.length < 5) continue;

        const rawChannel = parseInt(tokens[0], 10);
        const rawTime = parseInt(tokens[1], 10);
        const rawValue = parseInt(tokens[2], 10);
        const rawLength = parseInt(tokens[3], 10);
        const rawFlag = tokens.length >= 5 ? parseInt(tokens[4], 10) : 0;
        const rawExtra = tokens.length >= 6 ? parseInt(tokens[5], 10) : 0;

        if (isNaN(rawChannel) || isNaN(rawTime) || isNaN(rawValue) || isNaN(rawLength)) continue;

        let channel = ibmscToEditorChannelMap[rawChannel];
        let bgmIndex: number | undefined = undefined;
        if (channel === undefined) {
          if (rawChannel >= 63) {
            channel = 1; // BGM 영역 (63번부터 1씩 증가) -> 에디터 채널 1
            bgmIndex = rawChannel - 63;
          } else {
            channel = 1; // 기본 폴백 BGM
            bgmIndex = 0;
          }
        }

        // 숨김노트 (flag === -1)
        if (rawFlag === -1 && channel !== 1) {
          channel = channel + 32;
        }
        // 지뢰노트 (extra === -1)
        else if (rawExtra === -1 && channel !== 1) {
          channel = channel + 192;
        }

        const value = Math.floor(rawValue / 10000);

        parsedNotes.push({
          time: rawTime,
          channel,
          index: bgmIndex,
          value,
          length: rawLength
        });
      }

      if (parsedNotes.length > 0) {
        const tempNotes: any[] = [];
        for (const pn of parsedNotes) {
          if (pn.length > 0) {
            const startId = crypto.randomUUID();
            const endId = crypto.randomUUID();
            const startMeasure = Math.floor(pn.time / 192);
            const startPos = (pn.time % 192) / 192;
            const endMeasure = Math.floor((pn.time + pn.length) / 192);
            const endPos = ((pn.time + pn.length) % 192) / 192;

            tempNotes.push({
              id: startId,
              measure: startMeasure,
              channel: pn.channel,
              index: pn.index,
              position: startPos,
              value: pn.value,
              partnerId: endId,
              ticks: pn.time
            });

            tempNotes.push({
              id: endId,
              measure: endMeasure,
              channel: pn.channel,
              index: pn.index,
              position: endPos,
              value: pn.value,
              partnerId: startId,
              ticks: pn.time + pn.length
            });
          } else {
            const measure = Math.floor(pn.time / 192);
            const pos = (pn.time % 192) / 192;
            tempNotes.push({
              id: crypto.randomUUID(),
              measure: measure,
              channel: pn.channel,
              index: pn.index,
              position: pos,
              value: pn.value,
              ticks: pn.time
            });
          }
        }

        tempNotes.sort((a, b) => {
          if (a.measure !== b.measure) return a.measure - b.measure;
          if (a.channel !== b.channel) return a.channel - b.channel;
          return a.ticks - b.ticks;
        });

        const measureChannelCount: Record<string, number> = {};
        externalNotes = tempNotes.map(n => {
          const key = `${n.measure}_${n.channel}`;
          let idx = n.index;
          if (idx === undefined) {
            idx = measureChannelCount[key] || 0;
            measureChannelCount[key] = idx + 1;
          }
          const { ticks, ...rest } = n;
          return {
            ...rest,
            index: idx
          };
        });
      }
    }

    let notesToInsert: any[] = [];
    let sourceMinMeasure = 0;

    if (isExternalFormat && externalNotes.length > 0) {
      notesToInsert = externalNotes;
      let minMeasure = Infinity;
      let minPos = Infinity;
      for (const n of externalNotes) {
        if (n.measure < minMeasure) {
          minMeasure = n.measure;
          minPos = n.position;
        } else if (n.measure === minMeasure && n.position < minPos) {
          minPos = n.position;
        }
      }
      sourceMinMeasure = minMeasure;
    } else {
      const clipboard = state.clipboard;
      if (!clipboard || clipboard.length === 0) return;

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
      sourceMinMeasure = minMeasure;

      const idMap = new Map<string, string>();
      clipboard.forEach(n => {
        idMap.set(n.id, crypto.randomUUID());
      });

      notesToInsert = clipboard.map(n => {
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
          partnerId: newPartnerId
        };
      });
    }

    if (notesToInsert.length === 0) return;

    let targetMeasure = sourceMinMeasure;
    if (hoverBmsPos.current) {
      targetMeasure = hoverBmsPos.current.measure;
    } else {
      const midY = scrollY.current + (canvasRef.current?.clientHeight || 600) / 2;
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

    const offsetMeasure = targetMeasure - sourceMinMeasure;
    const finalNotes = notesToInsert.map(n => ({
      ...n,
      measure: Math.max(0, n.measure + offsetMeasure)
    }));

    state.addNotes(finalNotes);
    state.setSelectedNotes(finalNotes.map(n => n.id));
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

  // 전역 KeyDown 및 Clipboard Paste 리스너 바인딩 등록 및 해제 라이프사이클 전용 Effect
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

    const handleGlobalPaste = (e: ClipboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      e.preventDefault();
      const text = e.clipboardData?.getData('text') || "";
      handlePaste(text);
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    window.addEventListener('paste', handleGlobalPaste);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      window.removeEventListener('paste', handleGlobalPaste);
    };
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
