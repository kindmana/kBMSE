import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Scale, FileText, CheckCircle2, AlertTriangle, Eye } from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import { BmsData, BmsNote, parseBms, encodeBmsValue } from '../../parser/bmsParser';
import { calculateTimeline } from '../../utils/timelineCalculator';

interface BmsDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGoToMeasure: (measure: number) => void;
  baseBms: BmsData | null;
  setBaseBms: (bms: BmsData | null) => void;
  baseFileName: string;
  setBaseFileName: (name: string) => void;
  diffResults: DiffResultItem[];
  setDiffResults: (results: DiffResultItem[]) => void;
  isCompared: boolean;
  setIsCompared: (compared: boolean) => void;
  diffCheckHistoryIndex: React.MutableRefObject<number | null>;
}

interface DiffResultItem {
  id: string;
  measure: number;
  beat: number;
  time: number;
  status: 'misaligned' | 'only_base' | 'only_diff';
  baseNote?: {
    channel: number;
    value: number;
    wavName: string;
    position: number;
    fractionStr?: string;
  };
  diffNote?: {
    channel: number;
    value: number;
    wavName: string;
    position: number;
    fractionStr?: string;
  };
  beatDifference?: number;
  timeDifference?: number;
}

const normalizeFilename = (f: string): string => {
  if (!f) return '';
  return f.trim().replace(/^.*[\\/]/, '').toLowerCase();
};

const getNaturalDenominator = (pos: number): number => {
  if (pos === 0) return 4;
  const possibleDenominators = [4, 8, 12, 16, 24, 32, 48, 64, 96, 192];
  for (const d of possibleDenominators) {
    if (Math.abs(pos * d - Math.round(pos * d)) < 0.0001) {
      return d;
    }
  }
  return 192;
};

const gcd = (a: number, b: number): number => {
  while (b !== 0) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
};

const lcm = (a: number, b: number): number => {
  if (a === 0 || b === 0) return 0;
  return Math.abs(a * b) / gcd(a, b);
};

const getArrayLcm = (arr: number[]): number => {
  if (arr.length === 0) return 4;
  let result = arr[0];
  for (let i = 1; i < arr.length; i++) {
    result = lcm(result, arr[i]);
  }
  return result;
};

const formatFraction = (pos: number, lcmVal: number): string => {
  const numerator = Math.round(pos * lcmVal);
  return `${numerator}/${lcmVal}`;
};

const resolveBaseBmsMode = (mode: 'auto' | '16' | '36' | '62', filename: string): 16 | 36 | 62 => {
  if (mode === '16') return 16;
  if (mode === '36') return 36;
  if (mode === '62') return 62;
  return filename.toLowerCase().endsWith('.bml') ? 62 : 36;
};

const calculateNoteBeats = (bmsData: BmsData, useBase62: 16 | 36 | 62 | boolean): { note: BmsNote; beat: number; time: number; wavName: string }[] => {
  const result: { note: BmsNote; beat: number; time: number; wavName: string }[] = [];
  
  const timeline = calculateTimeline(bmsData);
  
  const maxMeasure = Math.max(
    0,
    ...bmsData.notes.map(n => n.measure),
    ...Object.keys(bmsData.measureLengths).map(Number)
  );
  
  const measureStartBeats: number[] = new Array(maxMeasure + 2).fill(0);
  let currentBeat = 0;
  for (let m = 0; m <= maxMeasure + 1; m++) {
    measureStartBeats[m] = currentBeat;
    const len = bmsData.measureLengths[m] !== undefined ? bmsData.measureLengths[m] : 1.0;
    currentBeat += 4 * len;
  }

  // Group notes on long note channels by channel to identify starts (even indices)
  const lnStarts = new Set<string>();
  const lnChannels = [
    0x51, 0x52, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59,
    0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69
  ];
  
  const lnNotesByChannel: Record<number, BmsNote[]> = {};
  for (const ch of lnChannels) {
    lnNotesByChannel[ch] = [];
  }
  
  for (const note of bmsData.notes) {
    if (lnChannels.includes(note.channel)) {
      lnNotesByChannel[note.channel].push(note);
    }
  }
  
  for (const ch of lnChannels) {
    const notes = lnNotesByChannel[ch];
    if (notes.length === 0) continue;
    
    // Sort notes by measure and position to ensure correct sequential order
    notes.sort((a, b) => {
      if (a.measure !== b.measure) return a.measure - b.measure;
      return a.position - b.position;
    });
    
    // Even indices are starts, odd indices are ends
    for (let i = 0; i < notes.length; i += 2) {
      const startNote = notes[i];
      lnStarts.add(startNote.id);
    }
  }
  
  for (const note of bmsData.notes) {
    const isBgaResource = 
      note.channel === 0x04 || // BGA
      note.channel === 0x06 || // POR
      note.channel === 0x07;   // LYR

    const isNormalKeysound = 
      note.channel === 1 || 
      (note.channel >= 11 && note.channel <= 29) || 
      (note.channel >= 31 && note.channel <= 49) ||
      isBgaResource;
      
    const isLnStartKeysound = 
      lnChannels.includes(note.channel) && 
      lnStarts.has(note.id);
      
    if (!isNormalKeysound && !isLnStartKeysound) continue;

    // Exclude LNOBJ ending notes
    const isLnobjEnd = bmsData.header.lnobj && 
      encodeBmsValue(note.value, useBase62).toLowerCase() === bmsData.header.lnobj.toLowerCase();
      
    if (isLnobjEnd) continue;
    
    // For BGA/POOR/LAYER, query resource name from bmps. For keysounds, query from wavs.
    const wavName = isBgaResource 
      ? (bmsData.bmps[note.value] || '') 
      : (bmsData.wavs[note.value] || '');
      
    if (!wavName) continue;
    
    const measureLen = bmsData.measureLengths[note.measure] !== undefined ? bmsData.measureLengths[note.measure] : 1.0;
    const noteBeat = measureStartBeats[note.measure] + 4 * measureLen * note.position;
    const time = timeline.noteTimeMap[note.id] ?? 0.0;
    
    result.push({
      note,
      beat: noteBeat,
      time,
      wavName
    });
  }
  
  return result.sort((a, b) => a.time - b.time);
};

const runMisalignmentCheck = (
  baseBms: BmsData, 
  currentBms: BmsData, 
  baseBmsUseBase62: 16 | 36 | 62 | boolean, 
  useBase62: 16 | 36 | 62 | boolean
): DiffResultItem[] => {
  const basePrecomputed = calculateNoteBeats(baseBms, baseBmsUseBase62);
  const currentPrecomputed = calculateNoteBeats(currentBms, useBase62);
  
  // Precompute Least Common Multiple (LCM) of natural denominators for each measure
  const measureDenominators: Record<number, Set<number>> = {};
  
  const addPrecomputedToMeasureDenom = (item: { note: BmsNote }) => {
    const m = item.note.measure;
    if (!measureDenominators[m]) {
      measureDenominators[m] = new Set<number>([4]); // Default to 4
    }
    const d = getNaturalDenominator(item.note.position);
    measureDenominators[m].add(d);
  };
  
  basePrecomputed.forEach(addPrecomputedToMeasureDenom);
  currentPrecomputed.forEach(addPrecomputedToMeasureDenom);
  
  const measureLcm: Record<number, number> = {};
  for (const mStr in measureDenominators) {
    const m = Number(mStr);
    const denoms = Array.from(measureDenominators[m]);
    measureLcm[m] = getArrayLcm(denoms);
  }

  const baseGroups: Record<string, typeof basePrecomputed> = {};
  for (const item of basePrecomputed) {
    const norm = normalizeFilename(item.wavName);
    if (!baseGroups[norm]) baseGroups[norm] = [];
    baseGroups[norm].push(item);
  }
  
  const currentGroups: Record<string, typeof currentPrecomputed> = {};
  for (const item of currentPrecomputed) {
    const norm = normalizeFilename(item.wavName);
    if (!currentGroups[norm]) currentGroups[norm] = [];
    currentGroups[norm].push(item);
  }
  
  const allWavKeys = Array.from(new Set([
    ...Object.keys(baseGroups),
    ...Object.keys(currentGroups)
  ]));
  
  const diffItems: DiffResultItem[] = [];
  
  for (const wavKey of allWavKeys) {
    const baseList = baseGroups[wavKey] || [];
    const currentList = currentGroups[wavKey] || [];
    
    const matchedBaseIndexes = new Set<number>();
    const matchedCurrentIndexes = new Set<number>();
    const perfectMatchTimes: number[] = [];
    
    // Pass 1: 완벽 일치 (Perfect Match) 우선 처리 (오차 0.001초 이하)
    for (let bIdx = 0; bIdx < baseList.length; bIdx++) {
      const bItem = baseList[bIdx];
      let bestMatchIdx = -1;
      let minTimeDiff = Infinity;
      
      for (let cIdx = 0; cIdx < currentList.length; cIdx++) {
        if (matchedCurrentIndexes.has(cIdx)) continue;
        const cItem = currentList[cIdx];
        const diff = Math.abs(bItem.time - cItem.time);
        
        if (diff <= 0.001 && diff < minTimeDiff) {
          minTimeDiff = diff;
          bestMatchIdx = cIdx;
        }
      }
      
      if (bestMatchIdx !== -1) {
        matchedBaseIndexes.add(bIdx);
        matchedCurrentIndexes.add(bestMatchIdx);
        perfectMatchTimes.push(bItem.time);
      }
    }
    
    // 완벽 일치 타임스탬프 정렬
    perfectMatchTimes.sort((a, b) => a - b);
    
    // Pass 2: 엇갈림 매칭 (경계선 제약 적용)
    for (let bIdx = 0; bIdx < baseList.length; bIdx++) {
      if (matchedBaseIndexes.has(bIdx)) continue;
      
      const bItem = baseList[bIdx];
      let bestMatchIdx = -1;
      let minTimeDiff = Infinity;
      
      for (let cIdx = 0; cIdx < currentList.length; cIdx++) {
        if (matchedCurrentIndexes.has(cIdx)) continue;
        
        const cItem = currentList[cIdx];
        const diff = Math.abs(bItem.time - cItem.time);
        
        // 경계선 침범 검사 (bItem.time과 cItem.time 사이에 완벽 일치 정박 키음이 있다면 매칭 배제)
        const minT = Math.min(bItem.time, cItem.time);
        const maxT = Math.max(bItem.time, cItem.time);
        const hasBoundaryBetween = perfectMatchTimes.some(t => t > minT + 0.001 && t < maxT - 0.001);
        
        if (hasBoundaryBetween) {
          continue;
        }
        
        if (diff < minTimeDiff) {
          minTimeDiff = diff;
          bestMatchIdx = cIdx;
        }
      }
      
      const lcmVal = measureLcm[bItem.note.measure] ?? 4;
      const baseFraction = formatFraction(bItem.note.position, lcmVal);

      // Compare by physical time difference (threshold of 2.0 seconds)
      if (bestMatchIdx !== -1 && minTimeDiff <= 2.0) {
        matchedBaseIndexes.add(bIdx);
        matchedCurrentIndexes.add(bestMatchIdx);
        const cItem = currentList[bestMatchIdx];
        const diffFraction = formatFraction(cItem.note.position, lcmVal);
        
        diffItems.push({
          id: crypto.randomUUID(),
          measure: bItem.note.measure,
          beat: bItem.beat,
          time: bItem.time,
          status: 'misaligned',
          baseNote: {
            channel: bItem.note.channel,
            value: bItem.note.value,
            wavName: bItem.wavName,
            position: bItem.note.position,
            fractionStr: baseFraction
          },
          diffNote: {
            channel: cItem.note.channel,
            value: cItem.note.value,
            wavName: cItem.wavName,
            position: cItem.note.position,
            fractionStr: diffFraction
          },
          beatDifference: cItem.beat - bItem.beat,
          timeDifference: cItem.time - bItem.time
        });
      } else {
        diffItems.push({
          id: crypto.randomUUID(),
          measure: bItem.note.measure,
          beat: bItem.beat,
          time: bItem.time,
          status: 'only_base',
          baseNote: {
            channel: bItem.note.channel,
            value: bItem.note.value,
            wavName: bItem.wavName,
            position: bItem.note.position,
            fractionStr: baseFraction
          }
        });
      }
    }
    
    // 남은 차분 노트들 처리 (only_diff)
    for (let cIdx = 0; cIdx < currentList.length; cIdx++) {
      if (matchedCurrentIndexes.has(cIdx)) continue;
      const cItem = currentList[cIdx];
      const lcmVal = measureLcm[cItem.note.measure] ?? 4;
      const diffFraction = formatFraction(cItem.note.position, lcmVal);

      diffItems.push({
        id: crypto.randomUUID(),
        measure: cItem.note.measure,
        beat: cItem.beat,
        time: cItem.time,
        status: 'only_diff',
        diffNote: {
          channel: cItem.note.channel,
          value: cItem.note.value,
          wavName: cItem.wavName,
          position: cItem.note.position,
          fractionStr: diffFraction
        }
      });
    }
  }
  
  return diffItems.sort((a, b) => a.time - b.time);
};


const getLaneName = (channel: number, lang: 'ko' | 'en' | 'ja') => {
  if (channel === 1) return lang === 'ko' ? 'BGM' : 'BGM';
  if (channel === 256) return lang === 'ko' ? '1P 스크래치' : '1P Scratch';
  if (channel === 0x16) return lang === 'ko' ? '1P 스크래치' : '1P Scratch';
  if (channel === 0x26) return lang === 'ko' ? '2P 스크래치' : '2P Scratch';
  
  if (channel >= 0x11 && channel <= 0x15) {
    const keyNum = channel - 0x10;
    return `1P Key ${keyNum}`;
  }
  if (channel >= 0x18 && channel <= 0x19) {
    const keyNum = channel - 0x17 + 5;
    return `1P Key ${keyNum}`;
  }

  if (channel >= 0x21 && channel <= 0x25) {
    const keyNum = channel - 0x20;
    return `2P Key ${keyNum}`;
  }
  if (channel >= 0x28 && channel <= 0x29) {
    const keyNum = channel - 0x27 + 5;
    return `2P Key ${keyNum}`;
  }

  if (channel >= 0x51 && channel <= 0x55) {
    const keyNum = channel - 0x50;
    return `1P Key ${keyNum} (LN)`;
  }
  if (channel >= 0x58 && channel <= 0x59) {
    const keyNum = channel - 0x57 + 5;
    return `1P Key ${keyNum} (LN)`;
  }

  if (channel >= 0x61 && channel <= 0x65) {
    const keyNum = channel - 0x60;
    return `2P Key ${keyNum} (LN)`;
  }
  if (channel >= 0x68 && channel <= 0x69) {
    const keyNum = channel - 0x67 + 5;
    return `2P Key ${keyNum} (LN)`;
  }

  return `Ch ${channel.toString(16).toUpperCase()}`;
};

const getBmsTitleString = (bms: BmsData | null, defaultLabel: string) => {
  if (!bms) return defaultLabel;
  const title = bms.header.title || '';
  const subtitle = bms.header.subtitle || '';
  if (title && subtitle) {
    return `${title} ${subtitle}`;
  }
  return title || subtitle || defaultLabel;
};

export const BmsDiffModal = ({ 
  isOpen, 
  onClose, 
  onGoToMeasure,
  baseBms,
  setBaseBms,
  baseFileName,
  setBaseFileName,
  diffResults,
  setDiffResults,
  isCompared,
  setIsCompared,
  diffCheckHistoryIndex
}: BmsDiffModalProps) => {
  const { bmsData, settings, useBase62, historyIndex } = useEditorStore();
  const [filterType, setFilterType] = useState<'all' | 'misaligned' | 'only_base' | 'only_diff'>('all');

  const lang = settings.language || 'en';

  const t = (ko: string, en: string, ja?: string) => {
    if (lang === 'ko') return ko;
    if (lang === 'ja') return ja || en;
    return en;
  };

  useEffect(() => {
    if (baseBms && bmsData) {
      const baseBmsUseBase62 = resolveBaseBmsMode(settings.base62Mode, baseFileName);
      const results = runMisalignmentCheck(baseBms, bmsData, baseBmsUseBase62, useBase62);
      setDiffResults(results);
      setIsCompared(true);
      diffCheckHistoryIndex.current = historyIndex;
    } else {
      setDiffResults([]);
      setIsCompared(false);
    }
  }, [baseBms, bmsData, baseFileName, settings, useBase62, historyIndex]);

  if (!isOpen) return null;

  const handleOpenFileClick = async (e: React.MouseEvent) => {
    e.preventDefault();

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
          if (result.dir_path) {
            localStorage.setItem('kBMSE_last_opened_dir', result.dir_path);
          }
          const activeEncoding = settings.encoding || 'shift-jis';
          const decoder = new TextDecoder(activeEncoding);
          const text = decoder.decode(new Uint8Array(result.content_bytes));
          const parsed = parseBms(text, resolveBaseBmsMode(settings.base62Mode, result.file_name));
          setBaseBms(parsed);
          setBaseFileName(result.file_name);
        }
        return;
      } catch (err) {
        console.error("Tauri open diff failed, falling back to browser picker:", err);
      }
    }

    if (typeof (window as any).showOpenFilePicker === 'function') {
      try {
        const lastHandle = (window as any)._kBMSE_lastFileHandle || undefined;
        const [handle] = await (window as any).showOpenFilePicker({
          startIn: lastHandle,
          types: [{ description: 'BMS Files', accept: { 'text/plain': ['.bms', '.bme', '.bml', '.pms'] } }]
        });
        (window as any)._kBMSE_lastFileHandle = handle;
        const file = await handle.getFile();
        
        setBaseFileName(file.name);
        const reader = new FileReader();
        reader.onload = (evt) => {
          const content = evt.target?.result as string;
          try {
            const parsed = parseBms(content, resolveBaseBmsMode(settings.base62Mode, file.name));
            setBaseBms(parsed);
          } catch (err) {
            console.error(err);
            alert(t("비교군 BMS 파일을 파싱하는 데 실패했습니다.", "Failed to parse base BMS file."));
          }
        };
        const encoding = settings.encoding || 'shift-jis';
        reader.readAsText(file, encoding);
        return;
      } catch (err) {
        console.log("showOpenFilePicker cancelled or failed, falling back to html input:", err);
      }
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.bms,.bme,.bml,.pms';
    input.onchange = (evt: any) => {
      const file = evt.target.files?.[0];
      if (file) {
        setBaseFileName(file.name);
        const reader = new FileReader();
        reader.onload = (readerEvt) => {
          const content = readerEvt.target?.result as string;
          try {
            const parsed = parseBms(content, resolveBaseBmsMode(settings.base62Mode, file.name));
            setBaseBms(parsed);
          } catch (err) {
            console.error(err);
            alert(t("비교군 BMS 파일을 파싱하는 데 실패했습니다.", "Failed to parse base BMS file."));
          }
        };
        const encoding = settings.encoding || 'shift-jis';
        reader.readAsText(file, encoding);
      }
    };
    input.click();
  };

  const filteredResults = diffResults.filter(item => {
    if (filterType === 'all') return true;
    return item.status === filterType;
  });

  const misalignedCount = diffResults.filter(r => r.status === 'misaligned').length;
  const onlyBaseCount = diffResults.filter(r => r.status === 'only_base').length;
  const onlyDiffCount = diffResults.filter(r => r.status === 'only_diff').length;

  return createPortal(
    <div 
      className="modal-overlay" 
      style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1100,
        backdropFilter: 'blur(4px)'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className="modal-content glass-effect" 
        style={{ 
          width: '1040px', 
          maxHeight: '90vh', 
          display: 'flex', 
          flexDirection: 'column',
          padding: '0',
          border: '1px solid var(--glass-border)',
          borderRadius: '12px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          background: 'rgba(18, 18, 22, 0.97)',
          backdropFilter: 'blur(20px)'
        }}
      >
        {/* Header */}
        <div 
          style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            padding: '16px 20px', 
            borderBottom: '1px solid rgba(255,255,255,0.08)' 
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Scale size={18} style={{ color: 'var(--accent-color)' }} />
            <h3 style={{ margin: '0', fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {t("BMS 키음 엇갈림 검사", "BMS Keysound Misalignment Diff", "BMSキー音ズレ検出")}
            </h3>
          </div>
          <button 
            onClick={onClose} 
            style={{ 
              background: 'transparent', 
              border: 'none', 
              color: 'var(--text-secondary)', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '4px'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, overflowY: 'auto' }}>
          
          {/* File Picker Section */}
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '8px',
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '20px'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {t("비교군 원본 BMS 파일", "Base BMS File to Compare", "比較元のBMSファイル")}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {baseFileName 
                  ? `${t("선택된 파일: ", "Selected File: ")} ${baseFileName}`
                  : t("현재 작업중인 차분과 타이밍을 비교할 동봉 원본 BMS 파일을 불러오세요.", "Load the base BMS file to check note timing alignment against.", "現在の差分と比較する同梱の比較元BMSファイルを読み込んでください。")}
              </span>
            </div>
            
            <div 
              onClick={handleOpenFileClick}
              style={{
                background: 'var(--accent-color)',
                color: '#ffffff',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                transition: 'transform 0.1s ease-in-out'
              }}
            >
              <FileText size={14} />
              {t("원본 BMS 열기", "Open Base File", "Baseファイルを開く")}
            </div>
          </div>

          {/* 곡 정보 요약 영역 (Bms Metadata Summary Box) */}
          {(baseBms || bmsData) && (
            <div style={{
              background: 'rgba(255,255,255,0.01)',
              border: '1px solid rgba(255,255,255,0.04)',
              borderRadius: '8px',
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              fontSize: '0.8rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 500, width: '45px' }}>{t("원본:", "Base:")}</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                  {getBmsTitleString(baseBms, t("-- 불러오지 않음 --", "-- Not Loaded --"))}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '6px' }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 500, width: '45px' }}>{t("차분:", "Diff:")}</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                  {getBmsTitleString(bmsData, t("-- 작업 중 없음 --", "-- Empty --"))}
                </span>
              </div>
            </div>
          )}

          {isCompared && (
            <>
              {/* Metrics Summary Dashboard */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>{t("검출된 차이점", "Total Mismatches")}</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: diffResults.length > 0 ? 'var(--accent-color)' : '#22c55e' }}>
                    {diffResults.length}
                  </div>
                </div>
                
                <div 
                  onClick={() => setFilterType('misaligned')}
                  style={{ 
                    background: 'rgba(234, 179, 8, 0.05)', 
                    border: '1px solid rgba(234, 179, 8, 0.15)', 
                    borderRadius: '8px', 
                    padding: '12px', 
                    textAlign: 'center',
                    cursor: 'pointer',
                    boxShadow: filterType === 'misaligned' ? 'inset 0 0 0 1px var(--accent-color)' : 'none'
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: '#eab308', marginBottom: '4px' }}>{t("엇갈린 키음 (Zore/Shift)", "Misaligned Notes")}</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#eab308' }}>
                    {misalignedCount}
                  </div>
                </div>

                <div 
                  onClick={() => setFilterType('only_base')}
                  style={{ 
                    background: 'rgba(239, 68, 68, 0.05)', 
                    border: '1px solid rgba(239, 68, 68, 0.15)', 
                    borderRadius: '8px', 
                    padding: '12px', 
                    textAlign: 'center',
                    cursor: 'pointer',
                    boxShadow: filterType === 'only_base' ? 'inset 0 0 0 1px #ef4444' : 'none'
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: '#ef4444', marginBottom: '4px' }}>{t("Base에만 존재 (누락)", "Missing in Diff")}</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ef4444' }}>
                    {onlyBaseCount}
                  </div>
                </div>

                <div 
                  onClick={() => setFilterType('only_diff')}
                  style={{ 
                    background: 'rgba(34, 197, 94, 0.05)', 
                    border: '1px solid rgba(34, 197, 94, 0.15)', 
                    borderRadius: '8px', 
                    padding: '12px', 
                    textAlign: 'center',
                    cursor: 'pointer',
                    boxShadow: filterType === 'only_diff' ? 'inset 0 0 0 1px #22c55e' : 'none'
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: '#22c55e', marginBottom: '4px' }}>{t("차분에만 존재 (추가)", "Added in Diff")}</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#22c55e' }}>
                    {onlyDiffCount}
                  </div>
                </div>
              </div>

              {/* Filter Tabs */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button 
                    onClick={() => setFilterType('all')}
                    className={`tool-button ${filterType === 'all' ? 'active' : ''}`}
                    style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                  >
                    {t("전체", "All")} ({diffResults.length})
                  </button>
                  <button 
                    onClick={() => setFilterType('misaligned')}
                    className={`tool-button ${filterType === 'misaligned' ? 'active' : ''}`}
                    style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                  >
                    {t("엇갈림", "Misaligned")} ({misalignedCount})
                  </button>
                  <button 
                    onClick={() => setFilterType('only_base')}
                    className={`tool-button ${filterType === 'only_base' ? 'active' : ''}`}
                    style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                  >
                    {t("Base에만 있음", "Only in Base")} ({onlyBaseCount})
                  </button>
                  <button 
                    onClick={() => setFilterType('only_diff')}
                    className={`tool-button ${filterType === 'only_diff' ? 'active' : ''}`}
                    style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                  >
                    {t("차분에만 있음", "Only in Diff")} ({onlyDiffCount})
                  </button>
                </div>

                {filteredResults.length === 0 && (
                  <span style={{ fontSize: '0.75rem', color: '#22c55e', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <CheckCircle2 size={12} /> {t("조건에 엇갈리는 노트가 존재하지 않습니다.", "No misaligned notes in this category.")}
                  </span>
                )}
              </div>

              {/* Side-by-Side Comparison Container */}
              <div style={{ flex: 1, border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'rgba(0,0,0,0.1)' }}>
                {/* Headers */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '40px 120px 370px 370px 50px',
                  padding: '10px 12px',
                  background: 'rgba(255,255,255,0.02)',
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  textAlign: 'center'
                }}>
                  <div>#</div>
                  <div>{t("마디 / 타이밍", "Measure / Beat")}</div>
                  <div>{t("원본", "Base")}</div>
                  <div>{t("차분", "Diff")}</div>
                  <div>{t("이동", "Jump")}</div>
                </div>

                {/* Rows List */}
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', height: '320px' }}>
                  {filteredResults.map((item, index) => {
                    let rowBg = 'transparent';
                    let statusColor = 'var(--text-primary)';
                    let borderLeftColor = 'transparent';

                    if (item.status === 'misaligned') {
                      rowBg = 'rgba(234, 179, 8, 0.03)';
                      statusColor = '#eab308';
                      borderLeftColor = '#eab308';
                    } else if (item.status === 'only_base') {
                      rowBg = 'rgba(239, 68, 68, 0.03)';
                      statusColor = '#ef4444';
                      borderLeftColor = '#ef4444';
                    } else if (item.status === 'only_diff') {
                      rowBg = 'rgba(34, 197, 94, 0.03)';
                      statusColor = '#22c55e';
                      borderLeftColor = '#22c55e';
                    }

                    const baseBmsUseBase62 = resolveBaseBmsMode(settings.base62Mode, baseFileName);
                    const baseKeyId = item.baseNote ? encodeBmsValue(item.baseNote.value, baseBmsUseBase62) : '';
                    const diffKeyId = item.diffNote ? encodeBmsValue(item.diffNote.value, useBase62) : '';

                    return (
                      <div 
                        key={item.id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '40px 120px 370px 370px 50px',
                          alignItems: 'center',
                          padding: '8px 12px',
                          background: rowBg,
                          borderBottom: '1px solid rgba(255,255,255,0.04)',
                          fontSize: '0.78rem',
                          textAlign: 'center',
                          borderLeft: `3px solid ${borderLeftColor}`,
                          color: 'var(--text-primary)'
                        }}
                      >
                        {/* Index */}
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.72rem' }}>{index + 1}</div>

                        {/* Timing details */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center' }}>
                          <span style={{ fontWeight: 600 }}>{String(item.measure).padStart(3, '0')}{t("마디", " M")}</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                            {item.status === 'misaligned' 
                              ? `${item.baseNote?.fractionStr} → ${item.diffNote?.fractionStr}`
                              : item.status === 'only_base'
                                ? item.baseNote?.fractionStr
                                : item.diffNote?.fractionStr
                            }
                          </span>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', opacity: 0.8 }}>
                            ({item.time.toFixed(2)}s)
                          </span>
                        </div>

                        {/* Left Side: Base Note */}
                        <div style={{ padding: '0 8px', textAlign: 'left' }}>
                          {item.baseNote ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ 
                                padding: '2px 6px', 
                                borderRadius: '4px', 
                                background: 'rgba(255,255,255,0.06)', 
                                border: '1px solid rgba(255,255,255,0.1)',
                                fontSize: '0.72rem',
                                color: 'var(--accent-color)',
                                fontWeight: 500
                              }}>
                                {getLaneName(item.baseNote.channel, lang)}
                              </span>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px' }} title={`${baseKeyId}(${item.baseNote.wavName})`}>
                                <strong style={{ color: 'var(--text-secondary)', marginRight: '2px' }}>{baseKeyId}</strong>({item.baseNote.wavName})
                              </span>
                            </div>
                          ) : (
                            <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.72rem' }}>
                              -- {t("없음", "Empty")} --
                            </div>
                          )}
                        </div>

                        {/* Right Side: Diff Note */}
                        <div style={{ padding: '0 8px', textAlign: 'left' }}>
                          {item.diffNote ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ 
                                padding: '2px 6px', 
                                borderRadius: '4px', 
                                background: 'rgba(255,255,255,0.06)', 
                                border: '1px solid rgba(255,255,255,0.1)',
                                fontSize: '0.72rem',
                                color: 'var(--accent-color)',
                                fontWeight: 500
                              }}>
                                {getLaneName(item.diffNote.channel, lang)}
                              </span>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px' }} title={`${diffKeyId}(${item.diffNote.wavName})`}>
                                <strong style={{ color: 'var(--text-secondary)', marginRight: '2px' }}>{diffKeyId}</strong>({item.diffNote.wavName})
                              </span>
                              {item.timeDifference !== undefined && (
                                <span style={{ fontSize: '0.7rem', color: statusColor, fontWeight: 500 }}>
                                  ({item.timeDifference > 0 ? '+' : ''}${(item.timeDifference * 1000).toFixed(1)}ms)
                                </span>
                              )}
                            </div>
                          ) : (
                            <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.72rem' }}>
                              -- {t("없음", "Empty")} --
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div>
                          <button
                            onClick={() => onGoToMeasure(item.measure)}
                            style={{
                              background: 'rgba(255,255,255,0.05)',
                              border: '1px solid rgba(255,255,255,0.1)',
                              color: 'var(--text-primary)',
                              padding: '6px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '32px',
                              height: '32px',
                              margin: '0 auto'
                            }}
                            className="hover-highlight"
                            title={t("해당 마디로 이동", "Jump to Measure")}
                          >
                            <Eye size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {!isCompared && (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px 20px',
              border: '1px dashed rgba(255,255,255,0.1)',
              borderRadius: '8px',
              background: 'rgba(255,255,255,0.01)',
              gap: '12px'
            }}>
              <AlertTriangle size={32} style={{ color: 'var(--text-secondary)', opacity: 0.6 }} />
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                {t("검사를 수행하려면 먼저 상단 패널에서 비교군 원본(Base) BMS 파일을 불러오세요.", "Please load the base BMS file in the panel above to perform the alignment check.")}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div 
          style={{ 
            padding: '12px 20px', 
            borderTop: '1px solid rgba(255,255,255,0.06)', 
            display: 'flex', 
            justifyContent: 'flex-end',
            background: 'rgba(0,0,0,0.15)'
          }}
        >
          <button
            onClick={onClose}
            className="tool-button active"
            style={{
              padding: '6px 18px',
              borderRadius: '6px',
              fontSize: '0.8rem',
              fontWeight: 600
            }}
          >
            {t("닫기", "Close", "閉じる")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
