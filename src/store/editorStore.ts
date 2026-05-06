import { create } from 'zustand';
import { BmsData, BmsNote } from '../parser/bmsParser';

interface EditorState {
  // Settings
  useBase62: boolean;
  setUseBase62: (val: boolean) => void;
  
  // Editor State
  activeTool: string;
  setActiveTool: (tool: string) => void;
  
  gridSnap: number;
  setGridSnap: (snap: number) => void;

  selectedNotes: string[];
  setSelectedNotes: (ids: string[]) => void;

  currentNoteValue: number;
  setCurrentNoteValue: (val: number) => void;
  
  // Project State
  fileName: string | null;
  setFileName: (name: string) => void;
  fileHandle: any | null; // FileSystemFileHandle
  setFileHandle: (handle: any | null) => void;
  bmsData: BmsData | null;
  setBmsData: (data: BmsData | null) => void;
  updateHeader: (updates: Partial<BmsData['header']>) => void;
  rawBmsContent: string | null;
  setRawBmsContent: (content: string | null) => void;

  // History State
  history: BmsNote[][];
  historyIndex: number;
  lastSavedHistoryIndex: number;
  setLastSaved: () => void;
  commitHistory: () => void;
  undo: () => void;
  redo: () => void;

  // Actions for Notes
  addNote: (note: BmsNote) => void;
  removeNote: (id: string) => void;
  removeNotes: (ids: string[]) => void;
  updateNote: (id: string, updates: Partial<BmsNote>) => void;
  updateNotes: (updatesArray: { id: string, updates: Partial<BmsNote> }[]) => void;

  zoomX: number;
  setZoomX: (val: number) => void;
  zoomY: number;
  setZoomY: (val: number) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  useBase62: true, // Default to true as per user request
  setUseBase62: (val) => set({ useBase62: val }),
  
  activeTool: 'select',
  setActiveTool: (tool) => set({ activeTool: tool }),
  
  gridSnap: 16,
  setGridSnap: (snap) => set({ gridSnap: snap }),

  selectedNotes: [],
  setSelectedNotes: (ids) => set({ selectedNotes: ids }),

  currentNoteValue: 1, // Default note value to write
  setCurrentNoteValue: (val) => set({ currentNoteValue: val }),
  
  fileName: null,
  setFileName: (name) => set({ fileName: name }),

  fileHandle: null,
  setFileHandle: (handle) => set({ fileHandle: handle }),
  
  bmsData: null,
  setBmsData: (data) => set({ 
    bmsData: data,
    history: data ? [data.notes] : [],
    historyIndex: 0,
    lastSavedHistoryIndex: 0,
    selectedNotes: []
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

  rawBmsContent: null,
  setRawBmsContent: (content) => set({ rawBmsContent: content }),

  history: [],
  historyIndex: 0,
  lastSavedHistoryIndex: 0,

  setLastSaved: () => set((state) => ({ lastSavedHistoryIndex: state.historyIndex })),
  
  commitHistory: () => set((state) => {
    if (!state.bmsData) return state;
    const currentNotes = state.bmsData.notes;
    // Don't commit if same reference (no changes made)
    if (state.history[state.historyIndex] === currentNotes) return state;
    
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push(currentNotes);
    if (newHistory.length > 50) newHistory.shift();
    
    return { history: newHistory, historyIndex: newHistory.length - 1 };
  }),

  undo: () => set((state) => {
    if (!state.bmsData || state.historyIndex <= 0) return state;
    const newIndex = state.historyIndex - 1;
    return {
      historyIndex: newIndex,
      bmsData: { ...state.bmsData, notes: state.history[newIndex] },
      selectedNotes: []
    };
  }),

  redo: () => set((state) => {
    if (!state.bmsData || state.historyIndex >= state.history.length - 1) return state;
    const newIndex = state.historyIndex + 1;
    return {
      historyIndex: newIndex,
      bmsData: { ...state.bmsData, notes: state.history[newIndex] },
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

  removeNote: (id) => set((state) => {
    if (!state.bmsData) return state;
    return {
      bmsData: {
        ...state.bmsData,
        notes: state.bmsData.notes.filter(n => n.id !== id)
      }
    };
  }),

  removeNotes: (ids) => set((state) => {
    if (!state.bmsData) return state;
    return {
      bmsData: {
        ...state.bmsData,
        notes: state.bmsData.notes.filter(n => !ids.includes(n.id))
      }
    };
  }),

  updateNote: (id, updates) => set((state) => {
    if (!state.bmsData) return state;
    return {
      bmsData: {
        ...state.bmsData,
        notes: state.bmsData.notes.map(n => n.id === id ? { ...n, ...updates } : n)
      }
    };
  }),

  updateNotes: (updatesArray) => set((state) => {
    if (!state.bmsData) return state;
    const updateMap = new Map(updatesArray.map(u => [u.id, u.updates]));
    return {
      bmsData: {
        ...state.bmsData,
        notes: state.bmsData.notes.map(n => {
          const updates = updateMap.get(n.id);
          return updates ? { ...n, ...updates } : n;
        })
      }
    };
  }),

  zoomX: 1.0,
  setZoomX: (val) => set({ zoomX: val }),
  zoomY: 1.0,
  setZoomY: (val) => set({ zoomY: val }),
}));
