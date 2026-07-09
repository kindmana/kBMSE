import { useState, useRef, useEffect } from 'react';
import { FileCode2, Music, Image } from 'lucide-react';
import { BmsData, encodeBmsValue } from '../../parser/bmsParser';
import { TextInput, TextAreaInput, NumberInput, SelectInput, FileInput, LnObjInput } from '../ui/PropertyInputs';
import { useEditorStore } from '../../store/editorStore';
import { MeasureLengthModal } from '../ui/MeasureLengthModal';
import { getAudioContext, playSoloSound, findAudioBuffer } from '../../utils/audioPlayer';

interface RightSidebarProps {
  bmsData: BmsData | null;
  updateHeader: (header: Partial<BmsData['header']>) => void;
  updateWav: (index: number, filename: string) => void;
  updateBmp: (index: number, filename: string) => void;
  useBase62: 16 | 36 | 62;
  gridSnap: number;
  setGridSnap: (snap: number) => void;
  zoomX: number;
  setZoomX: (zoom: number) => void;
  zoomY: number;
  setZoomY: (zoom: number) => void;
}

const KNOWN_HEADER_KEYS = [
  "title", "subtitle", "artist", "subartist", "genre", "bpm", 
  "player", "rank", "playlevel", "difficulty", "total", 
  "lnmode", "lnobj", "defexrank", "comment",
  "stagefile", "banner", "backbmp", "wav00", "bmp00", "preview"
];

const shouldHideLine = (line: string): boolean => {
  const trimmed = line.trim();
  if (!trimmed.startsWith('#')) return false;

  // 1. #WAVxx, #BMPxx, #BPMxx, #STOPxx, #SCROLLxx 정의 형태 (xx는 2자리 숫자/알파벳)
  const defRegex = /^#(WAV|BMP|BPM|STOP|SCROLL)([0-9A-Z]{2})\s+(.+)$/i;
  if (defRegex.test(trimmed)) return true;

  // 2. 채널 데이터 (#00111:xx)
  const channelRegex = /^#([0-9]{3})([0-9A-Z]{2}):(.+)$/i;
  if (channelRegex.test(trimmed)) return true;

  // 3. 마디 데이터 (#00102 xx)
  const spaceMeasureRegex = /^#([0-9]{3})02\s+(.+)$/i;
  if (spaceMeasureRegex.test(trimmed)) return true;

  // 4. KNOWN_HEADER_KEYS 에 정의된 표준 헤더 키들
  const headerMatch = trimmed.match(/^#([A-Z0-9_-]+)(?:\s+(.+))?$/i);
  if (headerMatch) {
    const key = headerMatch[1].toLowerCase();
    if (KNOWN_HEADER_KEYS.includes(key)) {
      return true;
    }
    // wavxx, bmpxx 형태 등 (예: wav01, bmp01 등)의 헤더 키가 있는 경우도 숨김
    if (/^(wav|bmp|bpm|stop|scroll)[0-9a-z]{2}$/i.test(key)) {
      return true;
    }
  }

  return false;
};

const getLineIdentifier = (line: string): string | null => {
  const trimmed = line.trim();
  if (!trimmed.startsWith('#')) return null;

  // 1. 채널 데이터 (#00111:xx)
  const channelMatch = trimmed.match(/^#([0-9]{3})([0-9A-Z]{2}):/i);
  if (channelMatch) return `${channelMatch[1]}${channelMatch[2].toUpperCase()}:`;

  // 2. 마디 데이터 (#00102 xx)
  const spaceMeasureMatch = trimmed.match(/^#([0-9]{3})02\s+/i);
  if (spaceMeasureMatch) return `${spaceMeasureMatch[1]}02`;

  // 3. 정의형태 (#WAVxx, #BMPxx, #BPMxx, #STOPxx, #SCROLLxx 등)
  const defMatch = trimmed.match(/^#(WAV|BMP|BPM|STOP|SCROLL)([0-9A-Z]{2})/i);
  if (defMatch) return `${defMatch[1].toUpperCase()}${defMatch[2].toUpperCase()}`;

  // 4. 일반 헤더
  const headerMatch = trimmed.match(/^#([A-Z0-9_-]+)/i);
  if (headerMatch) return headerMatch[1].toUpperCase();

  return null;
};


export const RightSidebar = ({
  bmsData,
  updateHeader,
  updateWav,
  updateBmp,
  useBase62,
  gridSnap,
  setGridSnap,
  zoomX,
  setZoomX,
  zoomY,
  setZoomY
}: RightSidebarProps) => {
  const { 
    currentNoteValue, 
    setCurrentNoteValue, 
    updateMeasureLength, 
    auxGridSnap, 
    setAuxGridSnap,
    settings,
    updateExpansion,
    commitHistory
  } = useEditorStore();

  const lang = settings.language || 'en';

  const getRightSidebarTexts = () => {
    if (lang === 'ko') {
      return {
        headerInfo: '헤더 정보',
        keysoundBgaList: '키음 / BGA 리스트',
        measureLength: '마디 길이 설정',
        displaySettings: '격자 설정',
        gridSnap: '격자 박자',
        auxGridSnap: '보조 격자 박자',
        zoom: '배율',
        horizontal: '가로 배율 (X)',
        vertical: '세로 배율 (Y)',
        noBms: '로드된 BMS 파일이 없습니다.',
        keySoundTab: '키음',
        bgaTab: 'BGA',
        expansionCode: '확장 명령',
        expansionPlaceholder: '#VOLWAV 100\n#PATH_WAV "../"\n#BGA 01-00-0-0-0-0',
        expansionHelp: '#명령어 값 형태로 한 줄씩 기입하세요.'
      };
    }
    if (lang === 'ja') {
      return {
        headerInfo: 'ヘッダー情報',
        keysoundBgaList: 'キー音 / BGA リスト',
        measureLength: '小節長設定',
        displaySettings: 'グリッド設定',
        gridSnap: 'グリッドスナップ',
        auxGridSnap: '補助グリッドスナップ',
        zoom: '倍率',
        horizontal: '横倍率 (X)',
        vertical: '縦倍率 (Y)',
        noBms: '読み込まれたBMSファイルがありません。',
        keySoundTab: 'キー音',
        bgaTab: 'BGA',
        expansionCode: '拡張命令',
        expansionPlaceholder: '#VOLWAV 100\n#PATH_WAV "../"\n#BGA 01-00-0-0-0-0',
        expansionHelp: '#命令 値 の形式で一行ずつ入力してください。'
      };
    }
    return {
      headerInfo: 'Header Info',
      keysoundBgaList: 'Key Sound / BGA List',
      measureLength: 'Measure Length',
      displaySettings: 'Grid Settings',
      gridSnap: 'Grid Snap',
      auxGridSnap: 'Aux Grid Snap',
      zoom: 'Zoom',
      horizontal: 'Horizontal (X)',
      vertical: 'Vertical (Y)',
      noBms: 'No BMS file loaded.',
      keySoundTab: 'Key Sound',
      bgaTab: 'BGA',
      expansionCode: 'Expansion Code',
      expansionPlaceholder: '#VOLWAV 100\n#PATH_WAV "../"\n#BGA 01-00-0-0-0-0',
      expansionHelp: 'Enter one command per line in the format "#COMMAND VALUE".'
    };
  };

  const getHeaderLabels = () => {
    if (lang === 'ko') {
      return {
        title: '곡 제목 (TITLE)',
        subtitle: '부제목 (SUBTITLE)',
        artist: '아티스트 (ARTIST)',
        subartist: '공동 아티스트 (SUBARTIST)',
        genre: '장르 (GENRE)',
        bpm: '기본 템포 (BPM)',
        player: '플레이 모드 (PLAYER)',
        rank: '판정 난이도 (RANK)',
        playlevel: '레벨 (PLAYLEVEL)',
        difficulty: '난이도 (DIFFICULTY)',
        total: '게이지 총량 (TOTAL)',
        lnmode: '롱노트 모드 (LNMODE)',
        lnobj: '롱노트 채널 (LNOBJ)',
        defexrank: '확장 판정 (DEFEXRANK)',
        comment: '코멘트 (COMMENT)'
      };
    }
    if (lang === 'ja') {
      return {
        title: 'タイトル (TITLE)',
        subtitle: 'サブタイトル (SUBTITLE)',
        artist: 'アーティスト (ARTIST)',
        subartist: 'サブアーティスト (SUBARTIST)',
        genre: 'ジャンル (GENRE)',
        bpm: 'テンポ (BPM)',
        player: 'プレイモード (PLAYER)',
        rank: '判定難易度 (RANK)',
        playlevel: 'レベル (PLAYLEVEL)',
        difficulty: '難易度 (DIFFICULTY)',
        total: '演奏トータル値 (TOTAL)',
        lnmode: 'ロングノートモード (LNMODE)',
        lnobj: 'ロングノート終端 (LNOBJ)',
        defexrank: '拡張判定 (DEFEXRANK)',
        comment: 'コメント (COMMENT)'
      };
    }
    return {
      title: 'TITLE',
      subtitle: 'SUBTITLE',
      artist: 'ARTIST',
      subartist: 'SUBARTIST',
      genre: 'GENRE',
      bpm: 'BPM',
      player: 'PLAYER',
      rank: 'JUDGE RANK (RANK)',
      playlevel: 'LEVEL (PLAYLEVEL)',
      difficulty: 'DIFFICULTY',
      total: 'TOTAL',
      lnmode: 'LNMODE',
      lnobj: 'LNOBJ',
      defexrank: 'DEFEXRANK',
      comment: 'COMMENT'
    };
  };

  const rTxt = getRightSidebarTexts();
  const hLabels = getHeaderLabels();

  const [activeSection, setActiveSection] = useState<'header' | 'wavbmp' | 'measure' | 'display' | 'expansion'>('header');

  const getTabLabels = () => {
    if (lang === 'ko') {
      return {
        header: '헤더',
        wavbmp: '리스트',
        measure: '마디',
        display: '격자',
        expansion: '확장'
      };
    }
    if (lang === 'ja') {
      return {
        header: 'ヘッダー',
        wavbmp: 'リスト',
        measure: '小節',
        display: 'グリッド',
        expansion: '拡張'
      };
    }
    return {
      header: 'Header',
      wavbmp: 'List',
      measure: 'Measure',
      display: 'Grid',
      expansion: 'Expansion'
    };
  };

  const tabLabels = getTabLabels();

  const [activeTab, setActiveTab] = useState<'wav' | 'bmp'>('wav');
  
  const [maxVisibleMeasure, setMaxVisibleMeasure] = useState(100);
  const [editingMeasureIndex, setEditingMeasureIndex] = useState<number | null>(null);

  const [expansionText, setExpansionText] = useState('');
  const isExpansionFocused = useRef(false);
  const hiddenExpansionLines = useRef<string[]>([]);

  useEffect(() => {
    if (bmsData && !isExpansionFocused.current) {
      const fullText = bmsData.expansion || '';
      const lines = fullText.split(/\r?\n/);
      const visibleLines: string[] = [];
      const hiddenLines: string[] = [];

      for (const line of lines) {
        if (shouldHideLine(line)) {
          hiddenLines.push(line);
        } else {
          visibleLines.push(line);
        }
      }
      setExpansionText(visibleLines.join('\n'));
      hiddenExpansionLines.current = hiddenLines;
    } else if (!bmsData) {
      setExpansionText('');
      hiddenExpansionLines.current = [];
    }
  }, [bmsData?.expansion]);

  const handleExpansionCodeChange = (text: string) => {
    if (!bmsData) return;

    const userLines = text.split(/\r?\n/);
    const userDefinedKeys = new Set<string>();

    for (const line of userLines) {
      const ident = getLineIdentifier(line);
      if (ident) {
        userDefinedKeys.add(ident);
      }
    }

    const hiddenToAppend = hiddenExpansionLines.current.filter(line => {
      const ident = getLineIdentifier(line);
      return ident ? !userDefinedKeys.has(ident) : true;
    });

    const combinedText = [...userLines, ...hiddenToAppend].join('\n');

    // 1. Update the expansion text in the store so it persists on save
    updateExpansion(combinedText);

    // 2. Parse and append custom expansion tags to bmsData.header for editor reactivity
    const newHeader: Record<string, any> = {};
    for (const key in bmsData.header) {
      if (KNOWN_HEADER_KEYS.includes(key.toLowerCase())) {
        newHeader[key] = bmsData.header[key];
      }
    }

    const lines = combinedText.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('#')) continue;

      const match = trimmed.match(/^#([A-Z0-9_-]+)\s+(.+)$/i);
      if (match) {
        const key = match[1].toUpperCase();
        const val = match[2];

        if (!KNOWN_HEADER_KEYS.includes(key.toLowerCase())) {
          newHeader[key] = val;
        }
      }
    }

    updateHeader(newHeader);
  };

  // Initialize maxVisibleMeasure based on used measures
  useEffect(() => {
    if (bmsData) {
      let maxUsed = 0;
      for (const note of bmsData.notes) {
        if (note.measure > maxUsed) maxUsed = note.measure;
      }
      setMaxVisibleMeasure(Math.min(999, Math.max(100, maxUsed + 20)));
    }
  }, [bmsData]);

  const handleMeasureListScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollHeight - target.scrollTop <= target.clientHeight + 50) {
      setMaxVisibleMeasure(prev => Math.min(999, prev + 50));
    }
  };

  // Hidden file inputs
  const wavInputRef = useRef<HTMLInputElement>(null);
  const bmpInputRef = useRef<HTMLInputElement>(null);
  const [editingWavIndex, setEditingWavIndex] = useState<number | null>(null);
  const [editingBmpIndex, setEditingBmpIndex] = useState<number | null>(null);

  const handleWavClick = (index: number) => {
    setCurrentNoteValue(index);
    if (bmsData) {
      const filename = bmsData.wavs[index];
      if (filename) {
        const currentBuffers = useEditorStore.getState().audioBuffers;
        const buffer = findAudioBuffer(filename, currentBuffers);
        if (buffer) {
          const actx = getAudioContext();
          if (actx.state === 'suspended') {
            actx.resume().catch(err => console.error(err));
          }
          playSoloSound(buffer, actx.currentTime);
        } else {
          // [Lazy Load]: 버퍼 캐시에 없으면 비동기로 Tauri에서 즉시 읽어 디코딩 후 재생
          const isTauri = 
            typeof (window as any).__TAURI_METADATA__ !== 'undefined' || 
            typeof (window as any).__TAURI__ !== 'undefined' || 
            typeof (window as any).__TAURI_INTERNALS__ !== 'undefined' ||
            typeof (window as any).__tauri_ipc__ !== 'undefined';
            
          if (isTauri) {
            const lastDir = localStorage.getItem('kBMSE_last_opened_dir');
            if (lastDir) {
              const separator = lastDir.includes('\\') ? '\\' : '/';
              const fullPath = lastDir.endsWith(separator) ? `${lastDir}${filename}` : `${lastDir}${separator}${filename}`;
              
              (async () => {
                try {
                  const { invoke } = await import('@tauri-apps/api/core');
                  const arrayBuffer = await invoke<ArrayBuffer>('read_local_file', { path: fullPath });
                  
                  const actx = getAudioContext();
                  const decoded = await actx.decodeAudioData(arrayBuffer);
                  
                  // 캐시에 등록
                  useEditorStore.setState({
                    audioBuffers: {
                      ...currentBuffers,
                      [filename.toLowerCase()]: decoded
                    }
                  });
                  
                  // 즉시 재생
                  if (actx.state === 'suspended') {
                    await actx.resume();
                  }
                  playSoloSound(decoded, actx.currentTime);
                  console.log(`[TauriLazyAudio] Lazy loaded and played keysound: ${filename}`);
                } catch (e) {
                  console.error(`[TauriLazyAudio] Failed to lazy load audio: ${filename}`, e);
                }
              })();
            }
          }
        }
      }
    }
  };

  const handleWavDoubleClick = (index: number) => {
    setEditingWavIndex(index);
    if (wavInputRef.current) wavInputRef.current.click();
  };

  const handleWavFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && editingWavIndex !== null) {
      updateWav(editingWavIndex, e.target.files[0].name);
      commitHistory();
    }
    if (wavInputRef.current) wavInputRef.current.value = '';
    setEditingWavIndex(null);
  };

  const handleBmpClick = (index: number) => {
    setCurrentNoteValue(index);
  };

  const handleBmpDoubleClick = (index: number) => {
    setEditingBmpIndex(index);
    if (bmpInputRef.current) bmpInputRef.current.click();
  };

  const handleBmpFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && editingBmpIndex !== null) {
      updateBmp(editingBmpIndex, e.target.files[0].name);
      commitHistory();
    }
    if (bmpInputRef.current) bmpInputRef.current.value = '';
    setEditingBmpIndex(null);
  };

  const renderWavBmpList = () => {
    if (!bmsData) return null;
    const itemsCount = useBase62 === 62 ? 3843 : (useBase62 === 36 ? 1295 : 255);
    const items = [];
    
    const isWav = activeTab === 'wav';
    const dict = isWav ? bmsData.wavs : bmsData.bmps;
    
    for (let i = 1; i <= itemsCount; i++) {
      const hexIndex = encodeBmsValue(i, useBase62);
      const filename = dict[i] || '';
      items.push(
        <div 
          key={i} 
          onClick={() => isWav ? handleWavClick(i) : handleBmpClick(i)}
          onDoubleClick={() => isWav ? handleWavDoubleClick(i) : handleBmpDoubleClick(i)}
          style={{ 
            display: 'flex', 
            borderBottom: '1px solid var(--border-color)', 
            cursor: 'pointer',
            padding: '4px 8px',
            fontSize: '0.8rem',
            alignItems: 'center',
            contentVisibility: 'auto',
            containIntrinsicSize: '26px',
            background: currentNoteValue === i ? 'rgba(255,255,255,0.15)' : (filename ? 'rgba(255,255,255,0.02)' : 'transparent')
          }}
          onMouseEnter={(e) => { if (currentNoteValue !== i) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
          onMouseLeave={(e) => { if (currentNoteValue !== i) e.currentTarget.style.background = filename ? 'rgba(255,255,255,0.02)' : 'transparent' }}
          className="list-item-hover"
        >
          <span style={{ width: '30px', color: 'var(--text-secondary)' }}>{hexIndex}</span>
          <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: filename ? 'var(--text-primary)' : 'rgba(255,255,255,0.2)' }}>
            {filename || '(empty)'}
          </span>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
          <button 
            style={{ flex: 1, padding: '5px', background: isWav ? 'var(--bg-secondary)' : 'transparent', color: isWav ? 'var(--text-primary)' : 'var(--text-secondary)', border: 'none', cursor: 'pointer', fontSize: '0.85rem' }}
            onClick={() => setActiveTab('wav')}
          >
            <Music size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> {rTxt.keySoundTab}
          </button>
          <button 
            style={{ flex: 1, padding: '5px', background: !isWav ? 'var(--bg-secondary)' : 'transparent', color: !isWav ? 'var(--text-primary)' : 'var(--text-secondary)', border: 'none', cursor: 'pointer', fontSize: '0.85rem' }}
            onClick={() => setActiveTab('bmp')}
          >
            <Image size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> {rTxt.bgaTab}
          </button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, userSelect: 'none' }}>
          {items}
        </div>
      </div>
    );
  };

  const decimalToFractionStr = (decimal: number) => {
    const commonDenoms = [4, 8, 16, 32, 64, 128, 192, 256, 384];
    for (const den of commonDenoms) {
      const num = Math.round(decimal * den);
      if (Math.abs(num / den - decimal) < 1e-6) {
        return `${num} / ${den}`;
      }
    }
    let bestNum = 1, bestDen = 1;
    let minError = Math.abs(decimal - 1);
    for (let den = 1; den <= 1000; den++) {
      const num = Math.round(decimal * den);
      const error = Math.abs(num / den - decimal);
      if (error < minError) {
        bestNum = num;
        bestDen = den;
        minError = error;
        if (error < 1e-10) break;
      }
    }
    return `${bestNum} / ${bestDen}`;
  };

  const renderMeasureList = () => {
    if (!bmsData) return null;
    const items = [];
    for (let i = 0; i <= maxVisibleMeasure; i++) {
      const length = bmsData.measureLengths[i] ?? 1;
      const fracStr = decimalToFractionStr(length);
      items.push(
        <div 
          key={i} 
          onDoubleClick={() => setEditingMeasureIndex(i)}
          style={{ 
            display: 'flex', 
            borderBottom: '1px solid var(--border-color)', 
            cursor: 'pointer',
            padding: '4px 8px',
            fontSize: '0.8rem',
            alignItems: 'center',
            contentVisibility: 'auto',
            containIntrinsicSize: '26px',
            background: length !== 1 ? 'rgba(255,255,255,0.02)' : 'transparent'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
          onMouseLeave={(e) => e.currentTarget.style.background = length !== 1 ? 'rgba(255,255,255,0.02)' : 'transparent'}
          className="list-item-hover"
        >
          <span style={{ width: '35px', color: 'var(--text-secondary)' }}>{i.toString().padStart(3, '0')}</span>
          <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)' }}>
            {length} <span style={{ color: 'var(--text-secondary)' }}>({fracStr})</span>
          </span>
        </div>
      );
    }
    return (
      <div 
        style={{ overflowY: 'auto', flex: 1, height: '100%', userSelect: 'none' }}
        onScroll={handleMeasureListScroll}
      >
        {items}
      </div>
    );
  };

  return (
    <aside className="right-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '15px', padding: '15px', boxSizing: 'border-box', overflowY: 'hidden' }}>
      {/* Hidden file inputs for WAV/BMP lists */}
      <input type="file" ref={wavInputRef} style={{ display: 'none' }} onChange={handleWavFileChange} />
      <input type="file" ref={bmpInputRef} style={{ display: 'none' }} onChange={handleBmpFileChange} />

      {/* 5-Tab Buttons Grid (2-row layout: 2 + 3) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
        {/* Row 1 (Header, List) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px' }}>
          {(['header', 'wavbmp'] as const).map((key) => (
            <button
              key={key}
              onClick={() => setActiveSection(key)}
              style={{
                padding: '8px 2px',
                fontSize: '0.75rem',
                fontWeight: '600',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                background: activeSection === key ? 'var(--accent-color)' : 'rgba(255, 255, 255, 0.05)',
                color: activeSection === key ? '#fff' : 'var(--text-secondary)',
                textAlign: 'center',
                transition: 'all 0.2s',
                outline: 'none',
                whiteSpace: 'nowrap'
              }}
            >
              {tabLabels[key]}
            </button>
          ))}
        </div>
        {/* Row 2 (Measure, Grid, Expansion) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
          {(['measure', 'display', 'expansion'] as const).map((key) => (
            <button
              key={key}
              onClick={() => setActiveSection(key)}
              style={{
                padding: '8px 2px',
                fontSize: '0.75rem',
                fontWeight: '600',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                background: activeSection === key ? 'var(--accent-color)' : 'rgba(255, 255, 255, 0.05)',
                color: activeSection === key ? '#fff' : 'var(--text-secondary)',
                textAlign: 'center',
                transition: 'all 0.2s',
                outline: 'none',
                whiteSpace: 'nowrap'
              }}
            >
              {tabLabels[key]}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Panels */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {/* 1. Header Info Section */}
        {activeSection === 'header' && (
          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '2px' }}>
            {bmsData ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <TextInput label={hLabels.title} value={bmsData.header.title} onChange={(val: string) => updateHeader({ title: val })} onBlur={() => commitHistory()} />
                <TextInput label={hLabels.subtitle} value={bmsData.header.subtitle} onChange={(val: string) => updateHeader({ subtitle: val })} onBlur={() => commitHistory()} />
                <TextInput label={hLabels.artist} value={bmsData.header.artist} onChange={(val: string) => updateHeader({ artist: val })} onBlur={() => commitHistory()} />
                <TextInput label={hLabels.subartist} value={bmsData.header.subartist} onChange={(val: string) => updateHeader({ subartist: val })} onBlur={() => commitHistory()} />
                <TextInput label={hLabels.genre} value={bmsData.header.genre} onChange={(val: string) => updateHeader({ genre: val })} onBlur={() => commitHistory()} />
                
                <NumberInput label={hLabels.bpm} value={bmsData.header.bpm} isFloat={true} onChange={(val: number) => updateHeader({ bpm: val })} onBlur={() => commitHistory()} />
                
                <SelectInput label={hLabels.player} value={bmsData.header.player} onChange={(val: number) => { updateHeader({ player: val }); commitHistory(); }} options={[
                  { value: 1, label: lang === 'ko' ? '1 - 싱글 플레이' : (lang === 'ja' ? '1 - シングルプレイ' : '1 - Single Play') },
                  { value: 2, label: lang === 'ko' ? '2 - 커플 플레이' : (lang === 'ja' ? '2 - カップルプレイ' : '2 - Couple Play') },
                  { value: 3, label: lang === 'ko' ? '3 - 더블 플레이' : (lang === 'ja' ? '3 - ダブルプレイ' : '3 - Double Play') }
                ]} />
                
                <SelectInput label={hLabels.rank} value={bmsData.header.rank} onChange={(val: number) => { updateHeader({ rank: val }); commitHistory(); }} options={[
                  { value: 0, label: lang === 'ko' ? '0 - 매우 어려움 (Very Hard)' : (lang === 'ja' ? '0 - 非常に厳しい (Very Hard)' : '0 - Very Hard') },
                  { value: 1, label: lang === 'ko' ? '1 - 어려움 (Hard)' : (lang === 'ja' ? '1 - 厳しい (Hard)' : '1 - Hard') },
                  { value: 2, label: lang === 'ko' ? '2 - 보통 (Normal)' : (lang === 'ja' ? '2 - 普通 (Normal)' : '2 - Normal') },
                  { value: 3, label: lang === 'ko' ? '3 - 쉬움 (Easy)' : (lang === 'ja' ? '3 - 易しい (Easy)' : '3 - Easy') },
                  { value: 4, label: lang === 'ko' ? '4 - 매우 쉬움 (Very Easy)' : (lang === 'ja' ? '4 - 非常に易しい (Very Easy)' : '4 - Very Easy') }
                ]} />
                
                <TextInput label={hLabels.playlevel} value={bmsData.header.playLevel} onChange={(val: string) => updateHeader({ playLevel: val })} onBlur={() => commitHistory()} />
                
                <SelectInput label={hLabels.difficulty} value={bmsData.header.difficulty} onChange={(val: number) => { updateHeader({ difficulty: val }); commitHistory(); }} options={[
                  { value: 0, label: '0 - None' },
                  { value: 1, label: '1 - Beginner' },
                  { value: 2, label: '2 - Normal' },
                  { value: 3, label: '3 - Hyper' },
                  { value: 4, label: '4 - Another' },
                  { value: 5, label: '5 - Legendaria' }
                ]} />
                
                <NumberInput label={hLabels.total} value={bmsData.header.total} isFloat={true} onChange={(val: number) => updateHeader({ total: val })} onBlur={() => commitHistory()} />
                
                <SelectInput label={hLabels.lnmode} value={bmsData.header.lnmode ?? ''} onChange={(val: number | undefined) => { updateHeader({ lnmode: val }); commitHistory(); }} options={[
                  { value: '', label: lang === 'ko' ? '없음' : (lang === 'ja' ? 'なし' : 'None') },
                  { value: 1, label: '1 - LN' },
                  { value: 2, label: '2 - CN' },
                  { value: 3, label: '3 - HCN' }
                ]} />
                
                <LnObjInput label={hLabels.lnobj} value={bmsData.header.lnobj} onChange={(val: string) => updateHeader({ lnobj: val })} onBlur={() => commitHistory()} />
                
                <NumberInput label={hLabels.defexrank} value={bmsData.header.defexrank} isFloat={true} onChange={(val: number) => updateHeader({ defexrank: val })} onBlur={() => commitHistory()} />
                
                <TextAreaInput label={hLabels.comment} value={bmsData.header.comment} onChange={(val: string) => updateHeader({ comment: val })} onBlur={() => commitHistory()} rows={2} />
                
                <div className="dropdown-divider" style={{ margin: '5px 0' }}></div>
                
                <FileInput label="STAGEFILE" value={bmsData.header.stagefile} onChange={(val: string) => updateHeader({ stagefile: val })} onBlur={() => commitHistory()} />
                <FileInput label="BANNER" value={bmsData.header.banner} onChange={(val: string) => updateHeader({ banner: val })} onBlur={() => commitHistory()} />
                <FileInput label="BACKBMP" value={bmsData.header.backbmp} onChange={(val: string) => updateHeader({ backbmp: val })} onBlur={() => commitHistory()} />
                <FileInput label="WAV00" value={bmsData.header.wav00} onChange={(val: string) => updateHeader({ wav00: val })} onBlur={() => commitHistory()} />
                <FileInput label="BMP00" value={bmsData.header.bmp00} onChange={(val: string) => updateHeader({ bmp00: val })} onBlur={() => commitHistory()} />
                <FileInput label="PREVIEW" value={bmsData.header.preview} onChange={(val: string) => updateHeader({ preview: val })} onBlur={() => commitHistory()} />
              </div>
            ) : (
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center', marginTop: '10px' }}>
                <FileCode2 size={32} style={{ opacity: 0.5, margin: '0 auto 10px' }} />
                <p>{rTxt.noBms}</p>
              </div>
            )}
          </div>
        )}

        {/* 2. WAV / BMP List Section */}
        {activeSection === 'wavbmp' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {bmsData ? renderWavBmpList() : (
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>
                {rTxt.noBms}
              </div>
            )}
          </div>
        )}

        {/* 3. Measure Length List Section */}
        {activeSection === 'measure' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {bmsData ? renderMeasureList() : (
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>
                {rTxt.noBms}
              </div>
            )}
          </div>
        )}

        {/* 4. Display Section (Grid Snap & Zoom) */}
        {activeSection === 'display' && (
          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '2px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Grid Snap Sub-section */}
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                {rTxt.gridSnap}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
            </div>

            {/* Aux Grid Snap Sub-section */}
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                {rTxt.auxGridSnap}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}>
                  <span>1/</span>
                  <input 
                    type="number"
                    defaultValue={auxGridSnap}
                    key={`auxsnap-${auxGridSnap}`}
                    onBlur={(e) => {
                      let val = parseInt(e.target.value);
                      if (isNaN(val)) val = auxGridSnap;
                      if (val < 1) val = 1;
                      if (val > 10000) val = 10000;
                      setAuxGridSnap(val);
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
                    onClick={() => setAuxGridSnap(Math.max(1, Math.floor(auxGridSnap / 2)))}
                  >
                    -
                  </button>
                  <button 
                    className="tool-button" 
                    style={{ padding: '2px 8px', minWidth: '30px', justifyContent: 'center' }}
                    onClick={() => setAuxGridSnap(Math.min(10000, auxGridSnap * 2))}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Zoom Sub-section */}
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                {rTxt.zoom}
              </div>
              
              <div style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  <span>{rTxt.horizontal}</span>
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
                  <span>{rTxt.vertical}</span>
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
                  min="0.5" max="10" step="0.1" 
                  value={zoomY} 
                  onChange={(e) => setZoomY(parseFloat(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          </div>
        )}

        {/* 5. Expansion Code Section */}
        {activeSection === 'expansion' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {bmsData ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px', minHeight: 0 }}>
                <textarea
                  value={expansionText}
                  onChange={(e) => setExpansionText(e.target.value)}
                  onFocus={() => { isExpansionFocused.current = true; }}
                  onBlur={() => { 
                    isExpansionFocused.current = false; 
                    handleExpansionCodeChange(expansionText); 
                    commitHistory();
                  }}
                  style={{
                    width: '100%',
                    flex: 1,
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    borderRadius: '4px',
                    padding: '8px',
                    fontSize: '0.8rem',
                    fontFamily: 'monospace',
                    resize: 'vertical',
                    outline: 'none',
                    lineHeight: '1.4'
                  }}
                />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  {rTxt.expansionHelp}
                </span>
              </div>
            ) : (
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>
                {rTxt.noBms}
              </div>
            )}
          </div>
        )}
      </div>

      {bmsData && editingMeasureIndex !== null && (
        <MeasureLengthModal
          isOpen={true}
          measure={editingMeasureIndex}
          currentLength={bmsData.measureLengths[editingMeasureIndex] ?? 1}
          onClose={() => setEditingMeasureIndex(null)}
          onApply={(m, l) => { updateMeasureLength(m, l); commitHistory(); }}
        />
      )}
    </aside>
  );
};
