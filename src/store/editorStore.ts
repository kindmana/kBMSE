import { create } from 'zustand';
import { BmsData } from '../parser/bmsParser';

interface EditorState {
  // Settings
  useBase62: boolean;
  setUseBase62: (val: boolean) => void;
  
  // Editor State
  activeTool: string;
  setActiveTool: (tool: string) => void;
  
  // Project State
  fileName: string | null;
  setFileName: (name: string) => void;
  bmsData: BmsData | null;
  setBmsData: (data: BmsData | null) => void;
  rawBmsContent: string | null;
  setRawBmsContent: (content: string | null) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  useBase62: true, // Default to true as per user request
  setUseBase62: (val) => set({ useBase62: val }),
  
  activeTool: 'select',
  setActiveTool: (tool) => set({ activeTool: tool }),
  
  fileName: null,
  setFileName: (name) => set({ fileName: name }),
  
  bmsData: null,
  setBmsData: (data) => set({ bmsData: data }),

  rawBmsContent: null,
  setRawBmsContent: (content) => set({ rawBmsContent: content }),
}));
