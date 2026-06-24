import { create } from 'zustand';
import { BmsData, BmsNote, decodeBmsValue } from '../parser/bmsParser';
import { stopAllSounds, getAudioContext } from '../utils/audioPlayer';
import { KeyMode, HIDDEN_LANES } from '../constants/layout';

export interface HistoryEntry {
  notes: BmsNote[];
  keyMode: KeyMode;
  expansion: string;
  player: number;
  measureLengths?: Record<number, number>;
  stops?: Record<number, number>;
  bpms?: Record<number, number>;
  header?: BmsData['header'];
  wavs?: Record<number, string>;
  bmps?: Record<number, string>;
}

export function getNotesAfterRemoval(notes: BmsNote[], idsToRemove: string[], lnobjVal?: number): BmsNote[] {
  const pairs: { start: BmsNote; end: BmsNote }[] = [];
  const processedIds = new Set<string>();

  // 1. partnerId 관계를 통한 모든 롱노트 쌍 수집 (LNOBJ 및 채널 방식 통합 대응)
  notes.forEach(note => {
    if (note.partnerId && !processedIds.has(note.id)) {
      const partner = notes.find(n => n.id === note.partnerId);
      if (partner && !processedIds.has(partner.id)) {
        processedIds.add(note.id);
        processedIds.add(partner.id);
        
        const noteTime = note.measure + note.position;
        const partnerTime = partner.measure + partner.position;
        if (noteTime <= partnerTime) {
          pairs.push({ start: note, end: partner });
        } else {
          pairs.push({ start: partner, end: note });
        }
      }
    }
  });

  // 2. LNOBJ 폴백을 통한 롱노트 쌍 수집 (스토어에 partnerId가 온전히 들어있지 않을 수 있으므로)
  if (lnobjVal && lnobjVal > 0) {
    const playableNotesByChannel = new Map<number, BmsNote[]>();
    notes.forEach(note => {
      if (processedIds.has(note.id)) return;
      if ((note.channel >= 0x11 && note.channel <= 0x19) || (note.channel >= 0x21 && note.channel <= 0x29)) {
        if (!playableNotesByChannel.has(note.channel)) {
          playableNotesByChannel.set(note.channel, []);
        }
        playableNotesByChannel.get(note.channel)!.push(note);
      }
    });

    playableNotesByChannel.forEach(chNotes => {
      chNotes.sort((a, b) => (a.measure + a.position) - (b.measure + b.position));
      for (let i = 1; i < chNotes.length; i++) {
        const n = chNotes[i];
        if (n.value === lnobjVal && !processedIds.has(n.id)) {
          const startNote = chNotes[i-1];
          if (startNote.value !== lnobjVal && !processedIds.has(startNote.id)) {
            pairs.push({ start: startNote, end: n });
            processedIds.add(startNote.id);
            processedIds.add(n.id);
          }
        }
      }
    });
  }

  let activeIdsToRemove = [...idsToRemove];
  let notesToUpdate = [...notes];

  pairs.forEach(pair => {
    const hasStart = activeIdsToRemove.includes(pair.start.id);
    const hasEnd = activeIdsToRemove.includes(pair.end.id);
    
    if (hasStart || hasEnd) {
      // 롱노트 해제 시 무조건 끝 부분 노드(end)를 삭제 대상으로 추가
      if (!activeIdsToRemove.includes(pair.end.id)) {
        activeIdsToRemove.push(pair.end.id);
      }
      // 시작 부분 노드(start)는 절대 지워지지 않도록 제외
      activeIdsToRemove = activeIdsToRemove.filter(id => id !== pair.start.id);
      
      // 시작 부분 노드를 일반 노트 채널로 변환
      notesToUpdate = notesToUpdate.map(n => {
        if (n.id === pair.start.id) {
          const isLnChannel = (n.channel >= 0x51 && n.channel <= 0x59) || (n.channel >= 0x61 && n.channel <= 0x69);
          return {
            ...n,
            channel: isLnChannel ? n.channel - 0x40 : n.channel,
            partnerId: undefined
          };
        }
        return n;
      });
    }
  });

  return notesToUpdate.filter(n => !activeIdsToRemove.includes(n.id));
}

function fixLongNoteValuePairings(notes: BmsNote[], lnobjVal: number): BmsNote[] {
  const processedIds = new Set<string>();
  const pairs: { start: BmsNote; end: BmsNote }[] = [];
  
  // 1. partnerId 관계를 통한 모든 롱노트 쌍 수집
  notes.forEach(note => {
    if (note.partnerId && !processedIds.has(note.id)) {
      const partner = notes.find(n => n.id === note.partnerId);
      if (partner && !processedIds.has(partner.id)) {
        processedIds.add(note.id);
        processedIds.add(partner.id);
        
        const t1 = note.measure + note.position;
        const t2 = partner.measure + partner.position;
        if (t1 <= t2) {
          pairs.push({ start: note, end: partner });
        } else {
          pairs.push({ start: partner, end: note });
        }
      }
    }
  });

  // 2. LNOBJ 폴백을 통한 롱노트 쌍 수집
  if (lnobjVal > 0) {
    const playableNotesByChannel = new Map<number, BmsNote[]>();
    notes.forEach(note => {
      if (processedIds.has(note.id)) return;
      if ((note.channel >= 0x11 && note.channel <= 0x19) || (note.channel >= 0x21 && note.channel <= 0x29)) {
        if (!playableNotesByChannel.has(note.channel)) {
          playableNotesByChannel.set(note.channel, []);
        }
        playableNotesByChannel.get(note.channel)!.push(note);
      }
    });

    playableNotesByChannel.forEach(chNotes => {
      chNotes.sort((a, b) => (a.measure + a.position) - (b.measure + b.position));
      for (let i = 1; i < chNotes.length; i++) {
        const n = chNotes[i];
        if (n.value === lnobjVal && !processedIds.has(n.id)) {
          const startNote = chNotes[i-1];
          if (startNote.value !== lnobjVal && !processedIds.has(startNote.id)) {
            pairs.push({ start: startNote, end: n });
            processedIds.add(startNote.id);
            processedIds.add(n.id);
          }
        }
      }
    });
  }

  let updatedNotes = [...notes];
  
  // 수집된 pairs의 노정들에 partnerId가 누락되어 있다면 상호 기입해 줍니다.
  pairs.forEach(pair => {
    updatedNotes = updatedNotes.map(n => {
      if (n.id === pair.start.id && !n.partnerId) {
        return { ...n, partnerId: pair.end.id };
      }
      if (n.id === pair.end.id && !n.partnerId) {
        return { ...n, partnerId: pair.start.id };
      }
      return n;
    });
  });
  
  pairs.forEach(pair => {
    if (lnobjVal > 0) {
      const currentStart = updatedNotes.find(n => n.id === pair.start.id);
      const currentEnd = updatedNotes.find(n => n.id === pair.end.id);
      
      if (currentStart && currentEnd) {
        const isLnobjStart = currentStart.value === lnobjVal;
        const isLnobjEnd = currentEnd.value === lnobjVal;
        
        if (isLnobjStart && !isLnobjEnd) {
          updatedNotes = updatedNotes.map(n => {
            if (n.id === pair.start.id) {
              return { ...n, value: currentEnd.value };
            }
            if (n.id === pair.end.id) {
              return { ...n, value: lnobjVal };
            }
            return n;
          });
        }
      }
    }
  });

  return updatedNotes;
}

export function detectBase62Needed(bmsContent: string): boolean {
  const lines = bmsContent.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('#')) continue;
    
    // 1. #WAVxx or #BMPxx declarations
    const wavBmpMatch = trimmed.match(/^#(?:WAV|BMP)([0-9A-Za-z]{2})/i);
    if (wavBmpMatch) {
      const id = wavBmpMatch[1];
      if (/[a-z]/.test(id)) {
        return true;
      }
    }
    
    // 2. Channel data lines: #00111:001122aa...
    const dataMatch = trimmed.match(/^#\d{3}[0-9A-Za-z]{2}:([0-9A-Za-z]+)/);
    if (dataMatch) {
      const dataStr = dataMatch[1];
      if (/[a-z]/.test(dataStr)) {
        return true;
      }
    }
  }
  return false;
}

export interface LaneColorConfig {
  bg: string;
  bgAlpha: number;
  fg: string;
  fgAlpha: number;
  width?: number;
  gridBg?: string;
  gridBgAlpha?: number;
}

export type CustomLaneColors = Record<string, LaneColorConfig>;

export interface EditorSettings {
  // General Options
  playNotePreview: boolean;
  showKeySoundFileName: boolean;
  scratchOnRight: boolean;
  encoding: string; // 'shift-jis' | 'utf-8' | 'euc-kr'
  maxGridResolution: number; // 1-10000
  wheelScrollSize: string; // 'pixel' | '1' | '1/2' | '1/3' | '1/4' | '1/8' | 'page'
  wheelClickBehavior: 'drag' | 'autoscroll';
  language: 'en' | 'ko' | 'ja';
  scrollDirection: 'normal' | 'reverse';
  base62Mode: 'auto' | '16' | '36' | '62';
  volume: number; // 0 to 100
  lnWriteMode: 'lnobj' | 'channel';

  // Visual Options
  theme: 'dark' | 'light' | 'cyberpunk' | 'sunset' | 'ocean' | 'sakura' | 'forest' | 'nebula' | 'midnight' | 'peach' | 'lavender' | 'mint' | 'crimson';
  noteSkin: 'flat' | 'gradient' | '3d';
  gridOpacity: number; // 격자선 투명도 (0 to 1)
  auxGridOpacity: number; // 보조격자선 투명도 (0 to 1)
  measureLineOpacity: number; // 마디선 투명도 (0 to 1)
  verticalLineOpacity: number; // 세로선 투명도 (0 to 1)
  subVerticalLineOpacity: number; // 세부세로선 투명도 (0 to 1)
  auxGridColor: string; // 'gray' | 'green' | 'blue' | 'red';
  noteHeight: number; // 픽셀 단위 키음 박스 높이 (기본 12)
  fontSize: number; // 픽셀 단위 글꼴 크기 (기본 10)
  customLaneColors: CustomLaneColors; // 각 레인별 커스텀 배경색 & 글꼴색 설정
}

const SETTINGS_LOCAL_STORAGE_KEY = 'kBMSE_editor_settings';

export const DEFAULT_LANE_COLORS: CustomLaneColors = {
  MSR: { bg: '#000000', bgAlpha: 0.0, fg: '#ffffff', fgAlpha: 1.0, width: 25, gridBg: '#000000', gridBgAlpha: 0.0 },
  BPM: { bg: '#000000', bgAlpha: 0.0, fg: '#eab308', fgAlpha: 1.0, width: 25, gridBg: '#000000', gridBgAlpha: 0.0 },
  STOP: { bg: '#000000', bgAlpha: 0.0, fg: '#3b82f6', fgAlpha: 1.0, width: 25, gridBg: '#000000', gridBgAlpha: 0.0 },
  SCR: { bg: '#000000', bgAlpha: 0.0, fg: '#a855f7', fgAlpha: 1.0, width: 25, gridBg: '#000000', gridBgAlpha: 0.0 },
  BGA: { bg: '#10b981', bgAlpha: 1.0, fg: '#ffffff', fgAlpha: 1.0, width: 25, gridBg: '#10b981', gridBgAlpha: 0.15 },
  LYR: { bg: '#10b981', bgAlpha: 1.0, fg: '#ffffff', fgAlpha: 1.0, width: 25, gridBg: '#10b981', gridBgAlpha: 0.15 },
  POR: { bg: '#10b981', bgAlpha: 1.0, fg: '#ffffff', fgAlpha: 1.0, width: 25, gridBg: '#10b981', gridBgAlpha: 0.15 },
  S1: { bg: '#ef4444', bgAlpha: 1.0, fg: '#ffffff', fgAlpha: 1.0, width: 25, gridBg: '#ef4444', gridBgAlpha: 0.15 },
  A1: { bg: '#ffffff', bgAlpha: 1.0, fg: '#000000', fgAlpha: 1.0, width: 25, gridBg: '#ffffff', gridBgAlpha: 0.15 },
  A2: { bg: '#4b5563', bgAlpha: 1.0, fg: '#ffffff', fgAlpha: 1.0, width: 25, gridBg: '#4b5563', gridBgAlpha: 0.15 },
  A3: { bg: '#ffffff', bgAlpha: 1.0, fg: '#000000', fgAlpha: 1.0, width: 25, gridBg: '#ffffff', gridBgAlpha: 0.15 },
  A4: { bg: '#4b5563', bgAlpha: 1.0, fg: '#ffffff', fgAlpha: 1.0, width: 25, gridBg: '#4b5563', gridBgAlpha: 0.15 },
  A5: { bg: '#ffffff', bgAlpha: 1.0, fg: '#000000', fgAlpha: 1.0, width: 25, gridBg: '#ffffff', gridBgAlpha: 0.15 },
  A6: { bg: '#4b5563', bgAlpha: 1.0, fg: '#ffffff', fgAlpha: 1.0, width: 25, gridBg: '#4b5563', gridBgAlpha: 0.15 },
  A7: { bg: '#ffffff', bgAlpha: 1.0, fg: '#000000', fgAlpha: 1.0, width: 25, gridBg: '#ffffff', gridBgAlpha: 0.15 },
  D1: { bg: '#ffffff', bgAlpha: 1.0, fg: '#000000', fgAlpha: 1.0, width: 25, gridBg: '#ffffff', gridBgAlpha: 0.15 },
  D2: { bg: '#4b5563', bgAlpha: 1.0, fg: '#ffffff', fgAlpha: 1.0, width: 25, gridBg: '#4b5563', gridBgAlpha: 0.15 },
  D3: { bg: '#ffffff', bgAlpha: 1.0, fg: '#000000', fgAlpha: 1.0, width: 25, gridBg: '#ffffff', gridBgAlpha: 0.15 },
  D4: { bg: '#4b5563', bgAlpha: 1.0, fg: '#ffffff', fgAlpha: 1.0, width: 25, gridBg: '#4b5563', gridBgAlpha: 0.15 },
  D5: { bg: '#ffffff', bgAlpha: 1.0, fg: '#000000', fgAlpha: 1.0, width: 25, gridBg: '#ffffff', gridBgAlpha: 0.15 },
  D6: { bg: '#4b5563', bgAlpha: 1.0, fg: '#ffffff', fgAlpha: 1.0, width: 25, gridBg: '#4b5563', gridBgAlpha: 0.15 },
  D7: { bg: '#ffffff', bgAlpha: 1.0, fg: '#000000', fgAlpha: 1.0, width: 25, gridBg: '#ffffff', gridBgAlpha: 0.15 },
  S2: { bg: '#ef4444', bgAlpha: 1.0, fg: '#ffffff', fgAlpha: 1.0, width: 25, gridBg: '#ef4444', gridBgAlpha: 0.15 },
  B: { bg: '#e4e4e7', bgAlpha: 1.0, fg: '#000000', fgAlpha: 1.0, width: 25, gridBg: '#e4e4e7', gridBgAlpha: 0.15 },
  
  // 특수 상태 4종
  MINE: { bg: '#991b1b', bgAlpha: 1.0, fg: '#ffffff', fgAlpha: 1.0 },
  INV: { bg: '#f4f4f5', bgAlpha: 0.4, fg: '#000000', fgAlpha: 0.4 },
  OVERLAP: { bg: '#ffffaa', bgAlpha: 1.0, fg: '#bbbb00', fgAlpha: 1.0 },
  SELECT: { bg: '#ffaaaa', bgAlpha: 1.0, fg: '#ff0000', fgAlpha: 1.0 }
};

const DEFAULT_SETTINGS: EditorSettings = {
  playNotePreview: true,
  showKeySoundFileName: false,
  scratchOnRight: false,
  encoding: 'shift-jis',
  maxGridResolution: 10000,
  wheelScrollSize: 'pixel',
  wheelClickBehavior: 'drag',
  language: 'en',
  scrollDirection: 'normal',
  base62Mode: 'auto',
  volume: 80,
  lnWriteMode: 'lnobj',
  
  theme: 'dark',
  noteSkin: 'flat',
  gridOpacity: 0.15,
  auxGridOpacity: 0.10,
  measureLineOpacity: 0.30,
  verticalLineOpacity: 0.20,
  subVerticalLineOpacity: 0.10,
  auxGridColor: 'gray',
  noteHeight: 12,
  fontSize: 10,
  customLaneColors: DEFAULT_LANE_COLORS
};


const getInitialSettings = (): EditorSettings => {
  try {
    const stored = localStorage.getItem(SETTINGS_LOCAL_STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error("Failed to load settings from localStorage:", e);
  }
  return DEFAULT_SETTINGS;
};

const getInitialLockVerticalPosition = (): boolean => {
  try {
    const stored = localStorage.getItem('kBMSE_lock_vertical_position');
    if (stored !== null) {
      return JSON.parse(stored) === true;
    }
  } catch (e) {
    console.error("Failed to load lockVerticalPosition from localStorage:", e);
  }
  return false;
};

const RIGHT_SIDEBAR_SETTINGS_LOCAL_STORAGE_KEY = 'kBMSE_right_sidebar_settings';

const getInitialRightSidebarSettings = () => {
  const defaults = {
    gridSnap: 16,
    auxGridSnap: 4,
    zoomX: 1.0,
    zoomY: 1.0
  };
  try {
    const stored = localStorage.getItem(RIGHT_SIDEBAR_SETTINGS_LOCAL_STORAGE_KEY);
    if (stored) {
      return { ...defaults, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error("Failed to load right sidebar settings from localStorage:", e);
  }
  return defaults;
};

const initialRightSidebarSettings = getInitialRightSidebarSettings();

let currentLoadingSessionId = 0;

interface EditorState {
  // Settings Config
  settings: EditorSettings;
  updateSettings: (updates: Partial<EditorSettings>) => void;

  // Settings
  useBase62: 16 | 36 | 62;
  setUseBase62: (val: 16 | 36 | 62) => void;
  
  // Editor State
  activeTool: string;
  setActiveTool: (tool: string) => void;
  
  gridSnap: number;
  setGridSnap: (snap: number) => void;
  
  auxGridSnap: number;
  setAuxGridSnap: (snap: number) => void;

  selectedNotes: string[];
  setSelectedNotes: (ids: string[]) => void;

  currentNoteValue: number;
  setCurrentNoteValue: (val: number) => void;
  
  clipboard: BmsNote[];
  setClipboard: (notes: BmsNote[]) => void;
  
  // Project State
  fileName: string | null;
  setFileName: (name: string) => void;
  fileHandle: any | null; // FileSystemFileHandle
  setFileHandle: (handle: any | null) => void;
  bmsData: BmsData | null;
  setBmsData: (data: BmsData | null, fileName?: string) => void;
  lockVerticalPosition: boolean;
  setLockVerticalPosition: (locked: boolean) => void;
  updateHeader: (updates: Partial<BmsData['header']>) => void;
  updateWav: (index: number, filename: string) => void;
  updateBmp: (index: number, filename: string) => void;
  updateMeasureLength: (measure: number, length: number) => void;
  rawBmsContent: string | null;
  setRawBmsContent: (content: string | null) => void;

  // History State
  history: HistoryEntry[];
  historyIndex: number;
  lastSavedHistoryIndex: number;
  setLastSaved: () => void;
  commitHistory: () => void;
  undo: () => void;
  redo: () => void;

  // Actions for Notes
  addNote: (note: BmsNote) => void;
  addNotes: (notes: BmsNote[]) => void;
  removeNote: (id: string) => void;
  removeNotes: (ids: string[]) => void;
  updateNote: (id: string, updates: Partial<BmsNote>) => void;
  updateNotes: (updatesArray: { id: string, updates: Partial<BmsNote> }[]) => void;

  zoomX: number;
  setZoomX: (val: number) => void;
  zoomY: number;
  setZoomY: (val: number) => void;

  viewSettings: {
    showLeftSidebar: boolean;
    showRightSidebar: boolean;
    showGrid: boolean;
    showAuxGrid: boolean;
    showMeasureLine: boolean;
    showMeasureNumber: boolean;
    showVerticalLine: boolean;
    showColumnHeader: boolean;
    showBpm: boolean;
    showStop: boolean;
    showScroll: boolean;
    showBga: boolean;
  };
  toggleViewSetting: (key: keyof EditorState['viewSettings']) => void;

  // Playback State
  isPlaying: boolean;
  playFromBeginning: boolean;
  playStartTime: number;
  playElapsedTime: number;
  playbackSpeed: number;
  isStopRequested: boolean;
  audioBuffers: Record<string, AudioBuffer>;
  audioProgress: { loaded: number; total: number; name: string } | null;
  
  setIsPlaying: (val: boolean) => void;
  setPlayStartTime: (val: number) => void;
  setPlayElapsedTime: (val: number) => void;
  setPlaybackSpeed: (val: number) => void;
  loadAudioFromFiles: (files: File[]) => Promise<void>;
  setAudioBuffers: (buffers: Record<string, AudioBuffer>) => void;
  updateExpansion: (text: string) => void;
  
  startPlay: (fromBeginning?: boolean) => void;
  pausePlay: () => void;
  stopPlay: () => void;

  keyMode: KeyMode;
  setKeyMode: (mode: KeyMode) => void;
  migrateNotesForKeyMode: (prevMode: KeyMode, nextMode: KeyMode) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  settings: getInitialSettings(),
  updateSettings: (updates) => set((state) => {
    const newSettings = { ...state.settings, ...updates };
    try {
      localStorage.setItem(SETTINGS_LOCAL_STORAGE_KEY, JSON.stringify(newSettings));
    } catch (e) {
      console.error("Failed to save settings to localStorage:", e);
    }

    // Sync useBase62 based on base62Mode change
    let base62Update = {};
    if (updates.base62Mode !== undefined) {
      if (updates.base62Mode === '16') {
        base62Update = { useBase62: 16 };
      } else if (updates.base62Mode === '36') {
        base62Update = { useBase62: 36 };
      } else if (updates.base62Mode === '62') {
        base62Update = { useBase62: 62 };
      } else if (updates.base62Mode === 'auto' && state.rawBmsContent) {
        base62Update = { useBase62: detectBase62Needed(state.rawBmsContent) ? 62 : 36 };
      }
    }

    // Sync volume immediately to Master Gain Node
    if (updates.volume !== undefined) {
      if (typeof window !== 'undefined') {
        const gainNode = (window as any).__kbmse_masterGain;
        if (gainNode) {
          gainNode.gain.value = updates.volume / 100;
        }
      }
    }

    return { 
      settings: newSettings, 
      ...base62Update
    };
  }),

  useBase62: 62, // Default to base 62
  setUseBase62: (val) => set({ useBase62: val }),
  
  lockVerticalPosition: getInitialLockVerticalPosition(),
  setLockVerticalPosition: (val) => set(() => {
    try {
      localStorage.setItem('kBMSE_lock_vertical_position', JSON.stringify(val));
    } catch (e) {
      console.error("Failed to save lockVerticalPosition to localStorage:", e);
    }
    return { lockVerticalPosition: val };
  }),
  
  activeTool: 'select',
  setActiveTool: (tool) => set({ activeTool: tool }),
  
  gridSnap: initialRightSidebarSettings.gridSnap,
  setGridSnap: (snap) => set((state) => {
    try {
      localStorage.setItem(
        RIGHT_SIDEBAR_SETTINGS_LOCAL_STORAGE_KEY,
        JSON.stringify({
          gridSnap: snap,
          auxGridSnap: state.auxGridSnap,
          zoomX: state.zoomX,
          zoomY: state.zoomY
        })
      );
    } catch (e) {
      console.error(e);
    }
    return { gridSnap: snap };
  }),
  
  auxGridSnap: initialRightSidebarSettings.auxGridSnap,
  setAuxGridSnap: (snap) => set((state) => {
    try {
      localStorage.setItem(
        RIGHT_SIDEBAR_SETTINGS_LOCAL_STORAGE_KEY,
        JSON.stringify({
          gridSnap: state.gridSnap,
          auxGridSnap: snap,
          zoomX: state.zoomX,
          zoomY: state.zoomY
        })
      );
    } catch (e) {
      console.error(e);
    }
    return { auxGridSnap: snap };
  }),

  selectedNotes: [],
  setSelectedNotes: (ids) => set({ selectedNotes: ids }),

  currentNoteValue: 1, // Default note value to write
  setCurrentNoteValue: (val) => set({ currentNoteValue: val }),
  
  clipboard: [],
  setClipboard: (notes) => set({ clipboard: notes }),
  
  fileName: null,
  setFileName: (name) => set({ fileName: name }),

  fileHandle: null,
  setFileHandle: (handle) => set({ fileHandle: handle }),
  
  bmsData: null,
  setBmsData: (data, fileName) => set(() => {
    if (!data) {
      return {
        bmsData: null,
        history: [],
        historyIndex: 0,
        lastSavedHistoryIndex: 0,
        selectedNotes: [],
        keyMode: '7K1S'
      };
    }

    const isNoteInLanes = (bms: BmsData, laneNames: string[]): boolean => {
      const channelMap: Record<string, number[]> = {
        'S1': [0x16, 0x56, 0x36, 0xD6],
        'A6': [0x18, 0x58, 0x38, 0xD8],
        'A7': [0x19, 0x59, 0x39, 0xD9],
        'S2': [0x26, 0x66, 0x46, 0xE6],
        'D6': [0x28, 0x68, 0x48, 0xE8],
        'D7': [0x29, 0x69, 0x49, 0xE9]
      };
      const targetChannels = laneNames.flatMap(name => channelMap[name] || []);
      return bms.notes.some(note => targetChannels.includes(note.channel));
    };

    const determineKeyMode = (bms: BmsData, fName?: string): KeyMode => {
      if (fName && fName.toLowerCase().endsWith('.pms')) {
        return '9K';
      }
      const lines = (bms.expansion || '').split('\n').map(l => l.trim());
      if (lines.includes('#4K')) return '4K';
      if (lines.includes('#6K')) return '6K';
      if (lines.includes('#8K')) return '8K';

      const player = bms.header.player || 1;
      if (player === 3) {
        const hasS1_A6_A7_S2_D6_D7 = isNoteInLanes(bms, ['S1', 'A6', 'A7', 'S2', 'D6', 'D7']);
        const hasA6_A7_D6_D7 = isNoteInLanes(bms, ['A6', 'A7', 'D6', 'D7']);
        if (!hasS1_A6_A7_S2_D6_D7) return '10K';
        if (!hasA6_A7_D6_D7) return '10K2S';
        return '14K2S';
      } else {
        const hasS1_A6_A7 = isNoteInLanes(bms, ['S1', 'A6', 'A7']);
        const hasA6_A7 = isNoteInLanes(bms, ['A6', 'A7']);
        if (!hasS1_A6_A7) return '5K';
        if (!hasA6_A7) return '5K1S';
        return '7K1S';
      }
    };

    const computedKeyMode = determineKeyMode(data, fileName);
    return {
      bmsData: data,
      history: [{
        notes: data.notes,
        keyMode: computedKeyMode,
        expansion: data.expansion || '',
        player: data.header.player || 1
      }],
      historyIndex: 0,
      lastSavedHistoryIndex: 0,
      selectedNotes: [],
      keyMode: computedKeyMode
    };
  }),

  updateHeader: (updates) => set((state) => {
    if (!state.bmsData) return state;
    return {
      bmsData: {
        ...state.bmsData,
        header: { ...state.bmsData.header, ...updates }
      }
    };
  }),

  updateWav: (index, filename) => set((state) => {
    if (!state.bmsData) return state;
    return {
      bmsData: {
        ...state.bmsData,
        wavs: { ...state.bmsData.wavs, [index]: filename }
      }
    };
  }),

  updateBmp: (index, filename) => set((state) => {
    if (!state.bmsData) return state;
    return {
      bmsData: {
        ...state.bmsData,
        bmps: { ...state.bmsData.bmps, [index]: filename }
      }
    };
  }),

  updateMeasureLength: (measure, length) => set((state) => {
    if (!state.bmsData) return state;
    return {
      bmsData: {
        ...state.bmsData,
        measureLengths: { ...state.bmsData.measureLengths, [measure]: length }
      }
    };
  }),

  rawBmsContent: null,
  setRawBmsContent: (content) => set({ rawBmsContent: content }),

  history: [],
  historyIndex: 0,
  lastSavedHistoryIndex: 0,

  setLastSaved: () => set((state) => ({ lastSavedHistoryIndex: state.historyIndex })),
  
  commitHistory: () => set((state) => {
    if (!state.bmsData) return state;
    const currentNotes = state.bmsData.notes;
    const currentKeyMode = state.keyMode;
    const currentExpansion = state.bmsData.expansion || '';
    const currentPlayer = state.bmsData.header.player || 1;
    const currentMeasureLengths = { ...state.bmsData.measureLengths };
    const currentStops = { ...state.bmsData.stops };
    const currentBpms = { ...state.bmsData.bpms };
    const currentHeader = { ...state.bmsData.header };
    const currentWavs = { ...state.bmsData.wavs };
    const currentBmps = { ...state.bmsData.bmps };
    
    const lastHistory = state.history[state.historyIndex];
    if (
      lastHistory &&
      lastHistory.notes === currentNotes &&
      lastHistory.keyMode === currentKeyMode &&
      lastHistory.expansion === currentExpansion &&
      lastHistory.player === currentPlayer &&
      JSON.stringify(lastHistory.measureLengths) === JSON.stringify(currentMeasureLengths) &&
      JSON.stringify(lastHistory.stops) === JSON.stringify(currentStops) &&
      JSON.stringify(lastHistory.bpms) === JSON.stringify(currentBpms) &&
      JSON.stringify(lastHistory.header) === JSON.stringify(currentHeader) &&
      JSON.stringify(lastHistory.wavs) === JSON.stringify(currentWavs) &&
      JSON.stringify(lastHistory.bmps) === JSON.stringify(currentBmps)
    ) {
      return state;
    }
    
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push({
      notes: currentNotes,
      keyMode: currentKeyMode,
      expansion: currentExpansion,
      player: currentPlayer,
      measureLengths: currentMeasureLengths,
      stops: currentStops,
      bpms: currentBpms,
      header: currentHeader,
      wavs: currentWavs,
      bmps: currentBmps
    });
    
    let nextLastSaved = state.lastSavedHistoryIndex;
    if (newHistory.length > 50) {
      newHistory.shift();
      if (nextLastSaved > 0) {
        nextLastSaved -= 1;
      } else {
        nextLastSaved = -1;
      }
    }
    
    return { 
      history: newHistory, 
      historyIndex: newHistory.length - 1,
      lastSavedHistoryIndex: nextLastSaved
    };
  }),

  undo: () => set((state) => {
    if (!state.bmsData || state.historyIndex <= 0) return state;
    const newIndex = state.historyIndex - 1;
    const entry = state.history[newIndex];
    return {
      historyIndex: newIndex,
      keyMode: entry.keyMode,
      bmsData: { 
        ...state.bmsData, 
        notes: entry.notes,
        expansion: entry.expansion,
        measureLengths: entry.measureLengths ? { ...entry.measureLengths } : state.bmsData.measureLengths,
        stops: entry.stops ? { ...entry.stops } : state.bmsData.stops,
        bpms: entry.bpms ? { ...entry.bpms } : state.bmsData.bpms,
        header: entry.header ? { ...entry.header } : {
          ...state.bmsData.header,
          player: entry.player
        },
        wavs: entry.wavs ? { ...entry.wavs } : state.bmsData.wavs,
        bmps: entry.bmps ? { ...entry.bmps } : state.bmsData.bmps
      },
      selectedNotes: []
    };
  }),

  redo: () => set((state) => {
    if (!state.bmsData || state.historyIndex >= state.history.length - 1) return state;
    const newIndex = state.historyIndex + 1;
    const entry = state.history[newIndex];
    return {
      historyIndex: newIndex,
      keyMode: entry.keyMode,
      bmsData: { 
        ...state.bmsData, 
        notes: entry.notes,
        expansion: entry.expansion,
        measureLengths: entry.measureLengths ? { ...entry.measureLengths } : state.bmsData.measureLengths,
        stops: entry.stops ? { ...entry.stops } : state.bmsData.stops,
        bpms: entry.bpms ? { ...entry.bpms } : state.bmsData.bpms,
        header: entry.header ? { ...entry.header } : {
          ...state.bmsData.header,
          player: entry.player
        },
        wavs: entry.wavs ? { ...entry.wavs } : state.bmsData.wavs,
        bmps: entry.bmps ? { ...entry.bmps } : state.bmsData.bmps
      },
      selectedNotes: []
    };
  }),

  addNote: (note) => set((state) => {
    if (!state.bmsData) return state;
    return {
      bmsData: {
        ...state.bmsData,
        notes: [...state.bmsData.notes, note]
      }
    };
  }),

  addNotes: (notes) => set((state) => {
    if (!state.bmsData) return state;
    return {
      bmsData: {
        ...state.bmsData,
        notes: [...state.bmsData.notes, ...notes]
      }
    };
  }),

  removeNote: (id) => set((state) => {
    if (!state.bmsData) return state;
    const lnObjStr = state.bmsData.header.lnobj;
    const lnObjVal = lnObjStr ? decodeBmsValue(lnObjStr, state.useBase62) : 0;
    return {
      bmsData: {
        ...state.bmsData,
        notes: getNotesAfterRemoval(state.bmsData.notes, [id], lnObjVal)
      }
    };
  }),

  removeNotes: (ids) => set((state) => {
    if (!state.bmsData) return state;
    const lnObjStr = state.bmsData.header.lnobj;
    const lnObjVal = lnObjStr ? decodeBmsValue(lnObjStr, state.useBase62) : 0;
    return {
      bmsData: {
        ...state.bmsData,
        notes: getNotesAfterRemoval(state.bmsData.notes, ids, lnObjVal)
      }
    };
  }),

  updateNote: (id, updates) => set((state) => {
    if (!state.bmsData) return state;
    let updatedNotes = state.bmsData.notes.map(n => n.id === id ? { ...n, ...updates } : n);
    
    const lnObjStr = state.bmsData.header.lnobj;
    if (lnObjStr) {
      const lnObjVal = decodeBmsValue(lnObjStr, state.useBase62);
      if (lnObjVal > 0) {
        updatedNotes = fixLongNoteValuePairings(updatedNotes, lnObjVal);
      }
    }
    
    return {
      bmsData: {
        ...state.bmsData,
        notes: updatedNotes
      }
    };
  }),

  updateNotes: (updatesArray) => set((state) => {
    if (!state.bmsData) return state;
    const updateMap = new Map(updatesArray.map(u => [u.id, u.updates]));
    let updatedNotes = state.bmsData.notes.map(n => {
      const updates = updateMap.get(n.id);
      return updates ? { ...n, ...updates } : n;
    });
    
    const lnObjStr = state.bmsData.header.lnobj;
    if (lnObjStr) {
      const lnObjVal = decodeBmsValue(lnObjStr, state.useBase62);
      if (lnObjVal > 0) {
        updatedNotes = fixLongNoteValuePairings(updatedNotes, lnObjVal);
      }
    }
    
    return {
      bmsData: {
        ...state.bmsData,
        notes: updatedNotes
      }
    };
  }),

  zoomX: initialRightSidebarSettings.zoomX,
  setZoomX: (val) => set((state) => {
    try {
      localStorage.setItem(
        RIGHT_SIDEBAR_SETTINGS_LOCAL_STORAGE_KEY,
        JSON.stringify({
          gridSnap: state.gridSnap,
          auxGridSnap: state.auxGridSnap,
          zoomX: val,
          zoomY: state.zoomY
        })
      );
    } catch (e) {
      console.error(e);
    }
    return { zoomX: val };
  }),
  zoomY: initialRightSidebarSettings.zoomY,
  setZoomY: (val) => set((state) => {
    try {
      localStorage.setItem(
        RIGHT_SIDEBAR_SETTINGS_LOCAL_STORAGE_KEY,
        JSON.stringify({
          gridSnap: state.gridSnap,
          auxGridSnap: state.auxGridSnap,
          zoomX: state.zoomX,
          zoomY: val
        })
      );
    } catch (e) {
      console.error(e);
    }
    return { zoomY: val };
  }),

  viewSettings: {
    showLeftSidebar: true,
    showRightSidebar: true,
    showGrid: true,
    showAuxGrid: true,
    showMeasureLine: true,
    showMeasureNumber: true,
    showVerticalLine: true,
    showColumnHeader: true,
    showBpm: true,
    showStop: true,
    showScroll: true,
    showBga: true,
  },
  toggleViewSetting: (key) => set((state) => ({
    viewSettings: {
      ...state.viewSettings,
      [key]: !state.viewSettings[key]
    }
  })),

  // Playback State Implementation
  isPlaying: false,
  playFromBeginning: false,
  playStartTime: 0,
  playElapsedTime: 0,
  playbackSpeed: 1.0,
  isStopRequested: false,
  audioBuffers: {},
  audioProgress: null,

  setIsPlaying: (val) => set({ isPlaying: val }),
  setPlayStartTime: (val) => set({ playStartTime: val }),
  setPlayElapsedTime: (val) => set({ playElapsedTime: val }),
  setPlaybackSpeed: (val) => set({ playbackSpeed: val }),
  setAudioBuffers: (buffers) => set({ audioBuffers: buffers }),
  updateExpansion: (text) => set((state) => {
    if (!state.bmsData) return state;
    return {
      bmsData: {
        ...state.bmsData,
        expansion: text
      }
    };
  }),

  loadAudioFromFiles: async (files: File[]) => {
    const mySessionId = ++currentLoadingSessionId;
    
    set({ audioProgress: null });
    if (files.length === 0) {
      set({ audioBuffers: {} });
      return;
    }
    
    // Filter audio files
    const audioFiles = files.filter(file => {
      const lowerName = file.name.toLowerCase();
      return (
        lowerName.endsWith('.wav') ||
        lowerName.endsWith('.ogg') ||
        lowerName.endsWith('.mp3') ||
        lowerName.endsWith('.flac')
      );
    });

    if (audioFiles.length === 0) {
      console.warn("No valid audio files selected.");
      return;
    }

    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch (e) {
        console.error("Failed to resume AudioContext:", e);
      }
    }

    const buffers: Record<string, AudioBuffer> = {};
    let loadedCount = 0;
    
    // 동시 디코딩 개수를 사용자의 실환경 최적 수치인 25개로 세팅
    const CONCURRENCY_LIMIT = 25;
    let currentIndex = 0;
    let lastUpdateTime = 0;
    const THROTTLE_MS = 150; // Throttle React state updates to 150ms interval

    set({ audioProgress: { loaded: 0, total: audioFiles.length, name: `Starting optimized loading...` } });

    // 슬라이딩 윈도우 구조로 유휴 스레드 없이 지속 비동기 처리 가동
    const runWorker = async () => {
      while (currentIndex < audioFiles.length) {
        if (mySessionId !== currentLoadingSessionId) return;

        const index = currentIndex++;
        const file = audioFiles[index];
        if (!file) break;

        try {
          const arrayBuffer = await file.arrayBuffer();
          if (mySessionId !== currentLoadingSessionId) return;
          
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
          buffers[file.name.toLowerCase()] = audioBuffer;
        } catch (e) {
          console.error(`Failed to decode audio file: ${file.name}`, e);
        }

        if (mySessionId !== currentLoadingSessionId) return;

        loadedCount++;
        const now = Date.now();
        if (now - lastUpdateTime > THROTTLE_MS || loadedCount === audioFiles.length) {
          lastUpdateTime = now;
          set({ 
            audioProgress: { 
              loaded: Math.min(loadedCount, audioFiles.length), 
              total: audioFiles.length, 
              name: `Loaded ${file.name}` 
            } 
          });
        }
      }
    };

    const workers = Array.from({ length: Math.min(CONCURRENCY_LIMIT, audioFiles.length) }, runWorker);
    await Promise.all(workers);

    if (mySessionId === currentLoadingSessionId) {
      set({ audioBuffers: buffers, audioProgress: null });
      console.log(`[AudioLoader] Audio loading session ${mySessionId} completed successfully.`);
    }
  },

  startPlay: (fromBeginning = false) => {
    const actx = getAudioContext();
    if (actx.state === 'suspended') {
      actx.resume().then(() => {
        console.log(`[Store] AudioContext successfully resumed inside startPlay. State: ${actx.state}`);
      }).catch(e => {
        console.error(`[Store] Failed to resume AudioContext inside startPlay:`, e);
      });
    } else {
      console.log(`[Store] startPlay called. AudioContext is already in state: ${actx.state}`);
    }
    
    set((state) => {
      if (!state.bmsData) return state;
      return { isPlaying: true, playFromBeginning: fromBeginning };
    });
  },

  pausePlay: () => {
    stopAllSounds();
    set({ isPlaying: false });
  },

  stopPlay: () => {
    stopAllSounds();
    set({ isPlaying: false, playElapsedTime: 0, isStopRequested: true });
  },

  keyMode: '7K1S',
  setKeyMode: (mode) => set((state) => {
    if (!state.bmsData) return { keyMode: mode };
    
    const currentExp = state.bmsData.expansion || '';
    const lines = currentExp.split('\n').map(l => l.trim());
    const filteredLines = lines.filter(l => l !== '#4K' && l !== '#6K' && l !== '#8K' && l !== '');
    
    if (mode === '4K') filteredLines.push('#4K');
    else if (mode === '6K') filteredLines.push('#6K');
    else if (mode === '8K') filteredLines.push('#8K');
    
    const nextExpansion = filteredLines.join('\n').trim();
    const updatedBmsData = {
      ...state.bmsData,
      expansion: nextExpansion
    };
    
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push({
      notes: state.bmsData.notes,
      keyMode: mode,
      expansion: nextExpansion,
      player: state.bmsData.header.player || 1
    });
    if (newHistory.length > 50) newHistory.shift();
    
    return {
      keyMode: mode,
      bmsData: updatedBmsData,
      history: newHistory,
      historyIndex: newHistory.length - 1
    };
  }),
  migrateNotesForKeyMode: (_prevMode, nextMode) => set((state) => {
    if (!state.bmsData) return {};
    
    const player = state.bmsData.header.player || 1;
    
    const p1Lanes = ['S1', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7'];
    const p2Lanes = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'S2'];
    const activeLanes = player === 1 ? p1Lanes : [...p1Lanes, ...p2Lanes];
    
    const hiddenInNext = HIDDEN_LANES[nextMode] || [];
    const actualHidden = hiddenInNext.filter(lane => activeLanes.includes(lane));
    const N = actualHidden.length;
    
    const currentExp = state.bmsData.expansion || '';
    const lines = currentExp.split('\n').map(l => l.trim());
    const filteredLines = lines.filter(l => l !== '#4K' && l !== '#6K' && l !== '#8K' && l !== '');
    
    if (nextMode === '4K') filteredLines.push('#4K');
    else if (nextMode === '6K') filteredLines.push('#6K');
    else if (nextMode === '8K') filteredLines.push('#8K');
    
    const nextExpansion = filteredLines.join('\n').trim();
    
    if (N === 0) {
      const updatedBmsData = {
        ...state.bmsData,
        expansion: nextExpansion
      };
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push({
        notes: state.bmsData.notes,
        keyMode: nextMode,
        expansion: nextExpansion,
        player: player
      });
      if (newHistory.length > 50) newHistory.shift();
      return {
        keyMode: nextMode,
        bmsData: updatedBmsData,
        history: newHistory,
        historyIndex: newHistory.length - 1
      };
    }
    
    const shiftedNotes = state.bmsData.notes.map((note) => {
      if (note.channel === 0x01) {
        return {
          ...note,
          index: Math.min(note.index + N, 99)
        };
      }
      return note;
    });
    
    const laneChannelMap: Record<string, number> = {
      'S1': 0x16, 'A1': 0x11, 'A2': 0x12, 'A3': 0x13, 'A4': 0x14, 'A5': 0x15, 'A6': 0x18, 'A7': 0x19,
      'D1': 0x21, 'D2': 0x22, 'D3': 0x23, 'D4': 0x24, 'D5': 0x25, 'D6': 0x28, 'D7': 0x29, 'S2': 0x26
    };
    
    const hiddenChannels = actualHidden.map(lane => laneChannelMap[lane]).filter(Boolean);
    
    const getBaseChannel = (channel: number): number => {
      if (channel >= 0x51 && channel <= 0x59) return channel - 0x40;
      if (channel >= 0x61 && channel <= 0x69) return channel - 0x40;
      if (channel >= 0x31 && channel <= 0x39) return channel - 0x20;
      if (channel >= 0x41 && channel <= 0x49) return channel - 0x20;
      if (channel >= 0xD1 && channel <= 0xD9) return channel - 0xC0;
      if (channel >= 0xE1 && channel <= 0xE9) return channel - 0xC0;
      return channel;
    };
    
    const finalNotes = shiftedNotes.map((note) => {
      const baseChan = getBaseChannel(note.channel);
      const hiddenIdx = hiddenChannels.indexOf(baseChan);
      if (hiddenIdx !== -1) {
        return {
          ...note,
          channel: 0x01,
          index: hiddenIdx
        };
      }
      return note;
    });
    
    const updatedBmsData = {
      ...state.bmsData,
      notes: finalNotes,
      expansion: nextExpansion,
      header: {
        ...state.bmsData.header,
        player: player
      }
    };
    
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push({
      notes: finalNotes,
      keyMode: nextMode,
      expansion: nextExpansion,
      player: player
    });
    if (newHistory.length > 50) newHistory.shift();
    
    return {
      keyMode: nextMode,
      bmsData: updatedBmsData,
      history: newHistory,
      historyIndex: newHistory.length - 1
    };
  }),
}));
