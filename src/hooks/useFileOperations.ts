import { useEffect } from 'react';
import { useEditorStore, detectBase62Needed } from '../store/editorStore';
import { parseBms, BmsData, encodeBms } from '../parser/bmsParser';
import { validateBmsData, BmsValidationError } from '../utils/bmsValidator';
import { getRecentFiles, addRecentFile, loadRecentFileHandle, RecentFile, verifyPermission } from '../utils/fileSystem';
import { getAudioContext } from '../utils/audioPlayer';

// Global loading session tracking for Tauri native audio loader to prevent race conditions
let currentTauriLoadingSessionId = 0;

interface FileOperationsOptions {
  isDirty: boolean;
  bmsDataRef: React.MutableRefObject<BmsData | null>;
  useBase62Ref: React.MutableRefObject<boolean>;
  scrollY: React.MutableRefObject<number>;
  scrollX: React.MutableRefObject<number>;
  fileName: string | null;
  fileHandle: any;
  
  setBmsData: (data: BmsData | null, fileName?: string) => void;
  setRawBmsContent: (content: string | null) => void;
  setFileName: (name: string) => void;
  setFileHandle: (handle: any) => void;
  setLastSaved: () => void;
  setIsFileMenuOpen: (open: boolean) => void;
  setRecentFiles: (files: RecentFile[]) => void;
  setBmsFilesToSelect: (files: File[]) => void;
  setIsBmsSelectionOpen: (open: boolean) => void;
  onValidationError?: (errors: BmsValidationError[]) => void;
}

export const useFileOperations = ({
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
  onValidationError
}: FileOperationsOptions) => {

  const resolveBase62Mode = (text: string) => {
    const { settings, setUseBase62 } = useEditorStore.getState();
    const mode = settings.base62Mode || 'auto';
    let isB62 = true;
    
    if (mode === '36') {
      isB62 = false;
    } else if (mode === '62') {
      isB62 = true;
    } else {
      // 'auto' mode
      isB62 = detectBase62Needed(text);
    }
    
    setUseBase62(isB62);
    useBase62Ref.current = isB62;
    return isB62;
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

  const loadBmsFromFile = async (file: File, handle?: any) => {
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const text = event.target?.result as string;
          setRawBmsContent(text);
          const parsedUseBase62 = resolveBase62Mode(text);
          const parsedData = parseBms(text, parsedUseBase62);
          
          scrollY.current = 0;
          scrollX.current = 0;
          setBmsData(parsedData, file.name);
          setFileName(file.name);
          setFileHandle(handle || null);
          setLastSaved();
          
          if (handle) {
            const recents = await addRecentFile(handle);
            setRecentFiles(recents);
          }
        } catch (err) {
          console.error("Failed to parse BMS", err);
          alert("Failed to parse BMS file.");
        }
      };
      const activeEncoding = useEditorStore.getState().settings.encoding || 'shift-jis';
      reader.readAsText(file, activeEncoding);
    } catch (e) {
      console.error(e);
      alert("Failed to read file.");
    }
  };

  const loadFileFromHandle = async (handle: any) => {
    try {
      const file = await handle.getFile();
      await loadBmsFromFile(file, handle);
    } catch (e) {
      console.error(e);
      alert("Failed to read file. It may have been moved or permissions denied.");
    }
  };

  const loadAudioFromTauriPaths = async (audioFiles: { name: string, path: string }[]) => {
    const mySessionId = ++currentTauriLoadingSessionId;
    
    useEditorStore.setState({ audioBuffers: {}, audioProgress: null });
    
    if (audioFiles.length === 0) return;

    useEditorStore.setState({ 
      audioProgress: { loaded: 0, total: audioFiles.length, name: 'Starting optimized loading (Tauri)...' } 
    });

    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch (e) {
        console.error("Failed to resume AudioContext:", e);
      }
    }

    try {
      const buffers: Record<string, AudioBuffer> = {};
      let loadedCount = 0;

      // 동시 디코딩 개수를 사용자의 실환경 최적 수치인 25개로 세팅
      const CONCURRENCY_LIMIT = 25;
      let currentIndex = 0;
      let lastUpdateTime = 0;
      const THROTTLE_MS = 150; // Throttle React state updates to 150ms interval

      const totalStart = performance.now();
      let totalFetchTime = 0;
      let totalDecodeTime = 0;
      let totalFilesProcessed = 0;

      // 슬라이딩 윈도우 구조로 유휴 스레드 없이 지속 비동기 처리 가동
      const runWorker = async () => {
        while (currentIndex < audioFiles.length) {
          if (mySessionId !== currentTauriLoadingSessionId) return;

          const index = currentIndex++;
          const fileInfo = audioFiles[index];
          if (!fileInfo) break;

          const singleStart = performance.now();
          let fetchEnd = 0;

          try {
            // [초고속 바이너리 IPC]: JSON 직렬화 오버헤드가 제로인 원시 ArrayBuffer 직접 수신
            const { invoke } = await import('@tauri-apps/api/core');
            const arrayBuffer = await invoke<ArrayBuffer>('read_local_file', { path: fileInfo.path });
            
            fetchEnd = performance.now();
            const fetchDuration = fetchEnd - singleStart;
            totalFetchTime += fetchDuration;

            if (mySessionId !== currentTauriLoadingSessionId) return;
            const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
            
            const decodeEnd = performance.now();
            const decodeDuration = decodeEnd - fetchEnd;
            totalDecodeTime += decodeDuration;
            
            totalFilesProcessed++;
            
            // 개별 파일 처리 고밀도 프로파일링 로그 출력
            console.log(`[AudioProfiler] ${fileInfo.name} -> Size: ${(arrayBuffer.byteLength/1024).toFixed(1)}KB | Fetch: ${fetchDuration.toFixed(1)}ms | Decode: ${decodeDuration.toFixed(1)}ms | Total: ${(decodeEnd - singleStart).toFixed(1)}ms`);

            buffers[fileInfo.name.toLowerCase()] = audioBuffer;
          } catch (e) {
            console.error(`[TauriAudio] Failed to load/decode: ${fileInfo.name}`, e);
          }

          if (mySessionId !== currentTauriLoadingSessionId) return;

          loadedCount++;
          const now = Date.now();
          if (now - lastUpdateTime > THROTTLE_MS || loadedCount === audioFiles.length) {
            lastUpdateTime = now;
            useEditorStore.setState({
              audioProgress: {
                loaded: Math.min(loadedCount, audioFiles.length),
                total: audioFiles.length,
                name: `Loaded ${fileInfo.name}`
              }
            });
          }
        }
      };

      const workers = Array.from({ length: Math.min(CONCURRENCY_LIMIT, audioFiles.length) }, runWorker);
      await Promise.all(workers);

      if (mySessionId === currentTauriLoadingSessionId) {
        const totalDuration = performance.now() - totalStart;
        useEditorStore.setState({ audioBuffers: buffers, audioProgress: null });
        
        console.warn(`
================ [ AUDIO LOAD PERFORMANCE REPORT ] ================
* 로딩 파일 수: ${totalFilesProcessed} 개
* 전체 실제 로딩 시간: ${(totalDuration / 1000).toFixed(2)} 초
* 누적 Fetch 시간 (로컬 파일 읽기): ${(totalFetchTime / 1000).toFixed(2)} 초 (${((totalFetchTime / (totalFetchTime + totalDecodeTime || 1)) * 100).toFixed(1)}%)
* 누적 Decode 시간 (오디오 디코딩): ${(totalDecodeTime / 1000).toFixed(2)} 초 (${((totalDecodeTime / (totalFetchTime + totalDecodeTime || 1)) * 100).toFixed(1)}%)
* 평균 단일 파일 처리 속도: ${totalFilesProcessed > 0 ? ((totalFetchTime + totalDecodeTime) / totalFilesProcessed).toFixed(1) : 0} ms
* 병렬 가속 효율 배율: ${totalFilesProcessed > 0 ? ((totalFetchTime + totalDecodeTime) / totalDuration).toFixed(2) : 0} 배
====================================================================
        `);
      }
    } catch (err) {
      console.error("Failed to load audio files via Tauri:", err);
      if (mySessionId === currentTauriLoadingSessionId) {
        useEditorStore.setState({ audioProgress: null });
      }
    }
  };

  const loadBmsAndAudioFromFiles = async (files: File[]) => {
    const bmsFiles = files.filter(f => {
      const name = f.name.toLowerCase();
      return name.endsWith('.bms') || name.endsWith('.bme') || name.endsWith('.bml') || name.endsWith('.pms');
    });

    const audioFiles = files.filter(f => {
      const name = f.name.toLowerCase();
      return name.endsWith('.wav') || name.endsWith('.ogg') || name.endsWith('.mp3') || name.endsWith('.flac');
    });

    console.log(`[FolderLoad] Found ${bmsFiles.length} BMS files and ${audioFiles.length} audio files.`);

    // 1. Load BMS files first to gather active keysounds
    if (bmsFiles.length === 0) {
      alert("No BMS files (.bms, .bme, .bml, .pms) found in the selected folder.");
      return;
    }

    if (bmsFiles.length === 1) {
      const bmsFile = bmsFiles[0];
      try {
        const text = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(reader.error);
          const activeEncoding = useEditorStore.getState().settings.encoding || 'shift-jis';
          reader.readAsText(bmsFile, activeEncoding);
        });

        setRawBmsContent(text);
        const parsedUseBase62 = resolveBase62Mode(text);
        const parsedData = parseBms(text, parsedUseBase62);
        
        scrollY.current = 0;
        scrollX.current = 0;
        setBmsData(parsedData, bmsFile.name);
        setFileName(bmsFile.name);
        setFileHandle(null);
        setLastSaved();

        // [최적화]: 사용되는 키음들만 필터링해서 Eager Load
        if (audioFiles.length > 0) {
          const activeWavIndices = new Set<number>();
          if (parsedData.header.wav00) activeWavIndices.add(0);
          
          const nonAudioChannels = [0x02, 0x03, 0x08, 0x09, 256];
          for (const note of parsedData.notes) {
            if (!nonAudioChannels.includes(note.channel)) {
              activeWavIndices.add(note.value);
            }
          }
          
          const activeWavNames = new Set<string>();
          const activeBaseNames = new Set<string>();
          
          for (const idx of activeWavIndices) {
            const filename = parsedData.wavs[idx];
            if (filename) {
              const normalized = filename.toLowerCase().normalize('NFC');
              activeWavNames.add(normalized);
              
              const baseName = normalized.substring(Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\')) + 1);
              activeBaseNames.add(baseName);
            }
          }

          let filteredAudio = audioFiles.filter(f => {
            const nameLower = f.name.toLowerCase().normalize('NFC');
            if (activeWavNames.has(nameLower) || activeBaseNames.has(nameLower)) return true;
            for (const wavName of activeWavNames) {
              if (wavName.endsWith(nameLower) || nameLower.endsWith(wavName)) return true;
            }
            return false;
          });

          // [안전장치]: 필터 결과 0개 검출 시 매칭 누락으로 판단하고 전체 폴더 파일 로드로 폴백
          if (filteredAudio.length === 0) {
            console.warn(`[FolderLoad] Active audio filter returned 0 files. Falling back to loading ALL ${audioFiles.length} audio files.`);
            filteredAudio = audioFiles;
          } else {
            console.log(`[FolderLoad] Filtered active audio: ${filteredAudio.length} of ${audioFiles.length} files.`);
          }

          await useEditorStore.getState().loadAudioFromFiles(filteredAudio);
        } else {
          useEditorStore.getState().setAudioBuffers({});
        }
      } catch (err) {
        console.error("Failed to load drag & drop folder", err);
        alert("Failed to load folder.");
      }
    } else {
      setBmsFilesToSelect(bmsFiles);
      setIsBmsSelectionOpen(true);
      // 다수 BMS 일 경우 임시 폴백으로 audioFiles 전체 리스팅을 넘기거나 보존
      if (audioFiles.length > 0) {
        await useEditorStore.getState().loadAudioFromFiles(audioFiles);
      } else {
        useEditorStore.getState().setAudioBuffers({});
      }
    }
  };

  const handleOpen = async () => {
    setIsFileMenuOpen(false);
    if (isDirty) {
      if (!window.confirm("You have unsaved changes. Are you sure you want to open a different file?")) return;
    }
    
    // Check if running in Tauri environment
    const isTauri = 
      typeof (window as any).__TAURI_METADATA__ !== 'undefined' || 
      typeof (window as any).__TAURI__ !== 'undefined' || 
      typeof (window as any).__TAURI_INTERNALS__ !== 'undefined' ||
      typeof (window as any).__tauri_ipc__ !== 'undefined';

    if (isTauri) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const lastOpenedDir = localStorage.getItem('kBMSE_last_opened_dir') || null;
        const result = await invoke<any>('open_bms_dialog', { defaultPath: lastOpenedDir });
        if (result) {
          console.log(`[TauriOpen] Loading BMS file via Tauri native dialog: ${result.file_name}`);
          if (result.dir_path) {
            localStorage.setItem('kBMSE_last_opened_dir', result.dir_path);
          }
          const activeEncoding = useEditorStore.getState().settings.encoding || 'shift-jis';
          const decoder = new TextDecoder(activeEncoding);
          const text = decoder.decode(new Uint8Array(result.content_bytes));
          setRawBmsContent(text);
          const parsedUseBase62 = resolveBase62Mode(text);
          const parsedData = parseBms(text, parsedUseBase62);
          
          const separator = result.dir_path.includes('\\') ? '\\' : '/';
          const fullPath = result.dir_path.endsWith(separator)
            ? `${result.dir_path}${result.file_name}`
            : `${result.dir_path}${separator}${result.file_name}`;

          scrollY.current = 0;
          scrollX.current = 0;
          setBmsData(parsedData, result.file_name);
          setFileName(result.file_name);
          setFileHandle(fullPath);
          setLastSaved();
          
          // Automatically load audio files in parallel from same directory!
          if (result.audio_files && result.audio_files.length > 0) {
            // [최적화]: 실제 노트 데이터 및 헤더에서 등장하는 키음들만 매칭하여 Eager Loading 수행
            const activeWavIndices = new Set<number>();
            if (parsedData.header.wav00) activeWavIndices.add(0);
            
            const nonAudioChannels = [0x02, 0x03, 0x08, 0x09, 256];
            for (const note of parsedData.notes) {
              if (!nonAudioChannels.includes(note.channel)) {
                activeWavIndices.add(note.value);
              }
            }
            
            const activeWavNames = new Set<string>();
            const activeBaseNames = new Set<string>();
            
            for (const idx of activeWavIndices) {
              const filename = parsedData.wavs[idx];
              if (filename) {
                const normalized = filename.toLowerCase().normalize('NFC');
                activeWavNames.add(normalized);
                
                const baseName = normalized.substring(Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\')) + 1);
                activeBaseNames.add(baseName);
              }
            }
            
            let filteredAudioFiles = result.audio_files.filter((file: any) => {
              const nameLower = file.name.toLowerCase().normalize('NFC');
              if (activeWavNames.has(nameLower) || activeBaseNames.has(nameLower)) return true;
              for (const wavName of activeWavNames) {
                if (wavName.endsWith(nameLower) || nameLower.endsWith(wavName)) return true;
              }
              return false;
            });
            
            // [안전장치]: 필터 결과 0개 검출 시 매칭 누락으로 판단하고 전체 폴더 파일 로드로 폴백
            if (filteredAudioFiles.length === 0) {
              console.warn(`[TauriOpen] Active audio filter returned 0 files. Falling back to loading ALL ${result.audio_files.length} audio files.`);
              filteredAudioFiles = result.audio_files;
            } else {
              console.log(`[TauriOpen] Filtered active audio files: ${filteredAudioFiles.length} of ${result.audio_files.length} total files.`);
            }
            
            await loadAudioFromTauriPaths(filteredAudioFiles);
          } else {
            useEditorStore.getState().setAudioBuffers({});
          }

          // Update recent files list in Tauri
          const recents = await addRecentFile(fullPath);
          setRecentFiles(recents);
        }
        return;
      } catch (err) {
        console.error("Tauri file open failed, falling back to browser picker:", err);
      }
    }

    if (typeof (window as any).showOpenFilePicker === 'function') {
      try {
        const lastHandle = (window as any)._kBMSE_lastFileHandle || fileHandle || undefined;
        const [handle] = await (window as any).showOpenFilePicker({
          startIn: lastHandle,
          types: [{ description: 'BMS Files', accept: { 'text/plain': ['.bms', '.bme', '.bml', '.pms'] } }]
        });
        (window as any)._kBMSE_lastFileHandle = handle;
        await loadFileFromHandle(handle);
        return;
      } catch (e) {
        console.log('showOpenFilePicker cancelled or failed, trying fallback input', e);
      }
    }

    // Fallback: Using dynamic <input type="file" />
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.bms,.bme,.bml,.pms';
      input.onchange = async (e: any) => {
        const file = e.target.files?.[0];
        if (file) {
          console.log(`[UI] File fallback input selected: ${file.name}`);
          await loadBmsFromFile(file);
        }
      };
      input.click();
    } catch (err) {
      console.error("Fallback file input failed:", err);
    }
  };

  const handleSave = async () => {
    setIsFileMenuOpen(false);
    if (!isDirty || !bmsDataRef.current) return;

    // [저장 무결성 검증 추가]
    const validationErrors = validateBmsData(bmsDataRef.current, useBase62Ref.current);
    if (validationErrors.length > 0) {
      if (onValidationError) {
        onValidationError(validationErrors);
      } else {
        const errorMsgs = validationErrors.map(e => e.message).join('\n');
        alert(`저장 중 다음과 같은 치명적인 구조적 정합성 오류가 검출되어 저장이 완전히 차단되었습니다:\n\n${errorMsgs}`);
      }
      return;
    }

    if (!fileHandle) {
      handleSaveAs();
      return;
    }

    const isTauri = 
      typeof (window as any).__TAURI_METADATA__ !== 'undefined' || 
      typeof (window as any).__TAURI__ !== 'undefined' || 
      typeof (window as any).__TAURI_INTERNALS__ !== 'undefined' ||
      typeof (window as any).__tauri_ipc__ !== 'undefined';

    if (isTauri) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const bmsString = encodeBms(bmsDataRef.current, useBase62Ref.current);
        const { settings } = useEditorStore.getState();
        await invoke('write_local_file', { path: fileHandle, content: bmsString, encoding: settings.encoding });
        setLastSaved();
        return;
      } catch (err) {
        console.error('Tauri save failed:', err);
        alert('Failed to save file. Check console for details.');
        return;
      }
    }

    try {
      const hasPermission = await verifyPermission(fileHandle, true);
      if (!hasPermission) {
        alert("Cannot save file because write permission was denied by the user.");
        return;
      }
      
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

    // [저장 무결성 검증 추가]
    const validationErrors = validateBmsData(bmsDataRef.current, useBase62Ref.current);
    if (validationErrors.length > 0) {
      if (onValidationError) {
        onValidationError(validationErrors);
      } else {
        const errorMsgs = validationErrors.map(e => e.message).join('\n');
        alert(`저장 중 다음과 같은 치명적인 구조적 정합성 오류가 검출되어 저장이 완전히 차단되었습니다:\n\n${errorMsgs}`);
      }
      return;
    }

    const isTauri = 
      typeof (window as any).__TAURI_METADATA__ !== 'undefined' || 
      typeof (window as any).__TAURI__ !== 'undefined' || 
      typeof (window as any).__TAURI_INTERNALS__ !== 'undefined' ||
      typeof (window as any).__tauri_ipc__ !== 'undefined';

    if (isTauri) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        let lastOpenedDir = localStorage.getItem('kBMSE_last_opened_dir') || null;
        if (!lastOpenedDir && fileHandle && typeof fileHandle === 'string') {
          const separator = fileHandle.includes('\\') ? '\\' : '/';
          lastOpenedDir = fileHandle.substring(0, fileHandle.lastIndexOf(separator));
        }

        const suggestedName = fileName || 'untitled.bms';
        const savedPath = await invoke<string | null>('save_bms_dialog', { 
          defaultPath: lastOpenedDir, 
          suggestedName 
        });

        if (savedPath) {
          const separator = savedPath.includes('\\') ? '\\' : '/';
          const dirPath = savedPath.substring(0, savedPath.lastIndexOf(separator));
          const name = savedPath.substring(savedPath.lastIndexOf(separator) + 1);

          localStorage.setItem('kBMSE_last_opened_dir', dirPath);

          const bmsString = encodeBms(bmsDataRef.current, useBase62Ref.current);
          const { settings } = useEditorStore.getState();
          await invoke('write_local_file', { path: savedPath, content: bmsString, encoding: settings.encoding });

          setFileName(name);
          setFileHandle(savedPath);
          setLastSaved();

          const recents = await addRecentFile(savedPath);
          setRecentFiles(recents);
        }
        return;
      } catch (err) {
        console.error('Tauri Save As failed:', err);
        alert('Failed to save file. Check console for details.');
        return;
      }
    }

    try {
      const lastHandle = (window as any)._kBMSE_lastFileHandle || fileHandle || undefined;
      const handle = await (window as any).showSaveFilePicker({
        startIn: lastHandle,
        suggestedName: fileName || 'untitled.bms',
        types: [{ description: 'BMS Files', accept: { 'text/plain': ['.bms', '.bme', '.bml', '.pms'] } }]
      });
      (window as any)._kBMSE_lastFileHandle = handle;
      
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
    
    const recents = getRecentFiles();
    const recentItem = recents.find(r => r.id === id);
    if (!recentItem) return;

    if (recentItem.path) {
      // Tauri environment: load by absolute path
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const result = await invoke<any>('load_bms_by_path', { filePath: recentItem.path });
        if (result) {
          console.log(`[TauriRecent] Loading BMS file: ${result.file_name}`);
          const activeEncoding = useEditorStore.getState().settings.encoding || 'shift-jis';
          const decoder = new TextDecoder(activeEncoding);
          const text = decoder.decode(new Uint8Array(result.content_bytes));
          setRawBmsContent(text);
          const parsedUseBase62 = resolveBase62Mode(text);
          const parsedData = parseBms(text, parsedUseBase62);
          
          scrollY.current = 0;
          scrollX.current = 0;
          setBmsData(parsedData, result.file_name);
          setFileName(result.file_name);
          setFileHandle(recentItem.path);
          setLastSaved();
          
          if (result.dir_path) {
            localStorage.setItem('kBMSE_last_opened_dir', result.dir_path);
          }
          
          // Automatically load audio files in parallel from same directory!
          if (result.audio_files && result.audio_files.length > 0) {
            // [최적화]: 실제 노트 데이터 및 헤더에서 등장하는 키음들만 매칭하여 Eager Loading 수행
            const activeWavIndices = new Set<number>();
            if (parsedData.header.wav00) activeWavIndices.add(0);
            
            const nonAudioChannels = [0x02, 0x03, 0x08, 0x09, 256];
            for (const note of parsedData.notes) {
              if (!nonAudioChannels.includes(note.channel)) {
                activeWavIndices.add(note.value);
              }
            }
            
            const activeWavNames = new Set<string>();
            const activeBaseNames = new Set<string>();
            
            for (const idx of activeWavIndices) {
              const filename = parsedData.wavs[idx];
              if (filename) {
                const normalized = filename.toLowerCase().normalize('NFC');
                activeWavNames.add(normalized);
                
                const baseName = normalized.substring(Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\')) + 1);
                activeBaseNames.add(baseName);
              }
            }
            
            let filteredAudioFiles = result.audio_files.filter((file: any) => {
              const nameLower = file.name.toLowerCase().normalize('NFC');
              if (activeWavNames.has(nameLower) || activeBaseNames.has(nameLower)) return true;
              for (const wavName of activeWavNames) {
                if (wavName.endsWith(nameLower) || nameLower.endsWith(wavName)) return true;
              }
              return false;
            });
            
            // [안전장치]: 필터 결과 0개 검출 시 매칭 누락으로 판단하고 전체 폴더 파일 로드로 폴백
            if (filteredAudioFiles.length === 0) {
              console.warn(`[TauriRecent] Active audio filter returned 0 files. Falling back to loading ALL ${result.audio_files.length} audio files.`);
              filteredAudioFiles = result.audio_files;
            } else {
              console.log(`[TauriRecent] Filtered active audio files: ${filteredAudioFiles.length} of ${result.audio_files.length} total files.`);
            }
            
            await loadAudioFromTauriPaths(filteredAudioFiles);
          } else {
            useEditorStore.getState().setAudioBuffers({});
          }

          // Move this file to the top of recent files list
          const updatedRecents = await addRecentFile(recentItem.path);
          setRecentFiles(updatedRecents);
        }
      } catch (err) {
        console.error("Tauri load recent failed:", err);
        alert("Cannot open recent file. The file may have been moved or deleted.");
        // Clear invalid item from recent files list
        const filtered = recents.filter(r => r.id !== id);
        localStorage.setItem('kBMSE_recent_files', JSON.stringify(filtered));
        setRecentFiles(filtered);
      }
    } else {
      // Web environment: load by file handle
      const handle = await loadRecentFileHandle(id);
      if (handle) {
        (window as any)._kBMSE_lastFileHandle = handle;
        await loadFileFromHandle(handle);
      } else {
        alert("Cannot open recent file. Permissions might have expired or file was deleted.");
        const filtered = recents.filter(r => r.id !== id);
        localStorage.setItem('kBMSE_recent_files', JSON.stringify(filtered));
        setRecentFiles(filtered);
      }
    }
  };

  // Bind global drag & drop listener
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      const items = e.dataTransfer?.items;
      if (!items) return;

      const files: File[] = [];

      const traverseFileTree = async (item: any, path = "") => {
        if (item.isFile) {
          const file = await new Promise<File>((resolve, reject) => {
            item.file(resolve, reject);
          });
          files.push(file);
        } else if (item.isDirectory) {
          const dirReader = item.createReader();
          const entries = await new Promise<any[]>((resolve) => {
            const allEntries: any[] = [];
            const readEntries = () => {
              dirReader.readEntries((results: any[]) => {
                if (results.length) {
                  allEntries.push(...results);
                  readEntries();
                } else {
                  resolve(allEntries);
                }
              });
            };
            readEntries();
          });
          for (const entry of entries) {
            await traverseFileTree(entry, path + entry.name + "/");
          }
        }
      };

      const promises = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i].webkitGetAsEntry?.();
        if (item) {
          promises.push(traverseFileTree(item));
        }
      }

      if (promises.length > 0) {
        try {
          await Promise.all(promises);
          if (files.length > 0) {
            if (isDirty) {
              if (!window.confirm("You have unsaved changes. Are you sure you want to drop and load this folder/file?")) return;
            }
            await loadBmsAndAudioFromFiles(files);
          }
        } catch (err) {
          console.error("Failed to read dropped files:", err);
        }
      }
    };

    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);
    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, [isDirty]);

  return {
    handleNew,
    handleOpen,
    handleSave,
    handleSaveAs,
    handleRecentClick,
    loadBmsFromFile,
    loadBmsAndAudioFromFiles,
    loadAudioFromTauriPaths
  };
};
