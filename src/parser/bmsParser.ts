/**
 * BMS Data structures and parsing logic
 */

export interface BmsHeader {
  title: string;
  subtitle?: string;
  artist: string;
  subartist?: string;
  genre: string;
  bpm: number;
  player: number;
  rank: number;
  playLevel: string;
  difficulty?: number;
  total: number;
  lnmode?: number;
  lnobj?: string;
  defexrank?: number;
  comment?: string;
  stagefile?: string;
  banner?: string;
  backbmp?: string;
  wav00?: string;
  bmp00?: string;
  preview?: string;
  [key: string]: any; // for other generic tags
}

export interface BmsNote {
  id: string;       // Unique identifier for editor interactions
  measure: number;
  channel: number;
  index: number;    // The nth occurrence of this channel in this measure
  position: number; // 0.0 to 1.0 (relative position within the measure)
  value: number;    // The decoded integer value of the note
}

export interface BmsData {
  header: BmsHeader;
  notes: BmsNote[];
  wavs: Record<number, string>;
  bmps: Record<number, string>;
  bpms: Record<number, number>;
  stops: Record<number, number>;
  scrolls: Record<number, number>;
  measureLengths: Record<number, number>;
  expansion?: string;
}

const BASE36_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const BASE62_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export function decodeBmsValueWithBase(valStr: string, base: number): number {
  if (valStr === "00") return 0;
  
  const fullChars = base === 62 ? BASE62_CHARS : BASE36_CHARS;
  const chars = fullChars.substring(0, base);
  
  let result = 0;
  for (let i = 0; i < valStr.length; i++) {
    const char = valStr[i];
    const index = chars.indexOf(char);
    if (index === -1) {
      return 0;
    }
    result = result * base + index;
  }
  return result;
}

export function decodeBmsValue(valStr: string, baseMode: 16 | 36 | 62 | boolean): number {
  const base = typeof baseMode === 'boolean' ? (baseMode ? 62 : 36) : baseMode;
  return decodeBmsValueWithBase(valStr, base);
}

export function encodeBmsValueWithBase(value: number, base: number): string {
  if (value === 0) return "00";
  
  const fullChars = base === 62 ? BASE62_CHARS : BASE36_CHARS;
  const chars = fullChars.substring(0, base);
  
  let result = "";
  let temp = value;
  
  while (temp > 0) {
    const remainder = temp % base;
    result = chars[remainder] + result;
    temp = Math.floor(temp / base);
  }
  
  return result.padStart(2, "0");
}

export function encodeBmsValue(value: number, baseMode: 16 | 36 | 62 | boolean): string {
  const base = typeof baseMode === 'boolean' ? (baseMode ? 62 : 36) : baseMode;
  return encodeBmsValueWithBase(value, base);
}

export function parseBms(bmsContent: string, baseMode: 16 | 36 | 62 | boolean): BmsData {
  const base = typeof baseMode === 'boolean' ? (baseMode ? 62 : 36) : baseMode;
  const lines = bmsContent.split(/\r?\n/);
  
  const bmsData: BmsData = {
    header: {
      title: "",
      artist: "",
      genre: "",
      bpm: 120,
      player: 1,
      rank: 3,
      playLevel: "1",
      total: 160
    },
    notes: [],
    wavs: {},
    bmps: {},
    bpms: {},
    stops: {},
    scrolls: {},
    measureLengths: {},
    expansion: ""
  };

  const channelRegex = /^#([0-9]{3})([0-9A-Z]{2}):(.+)$/i;
  const headerRegex = /^#([A-Z0-9]+)\s+(.+)$/i;
  const defRegex = /^#(WAV|BMP|BPM|STOP|SCROLL)([0-9A-Z]{2})\s+(.+)$/i;

  const measureChannelCount: Record<string, number> = {};
  
  let inExpansion = false;
  const expansionLines: string[] = [];

  // Determine the base to use for timing channels (08, 09, SC)
  // Default is base 16 (hex). If any active timing index contains non-hex characters (G-Z or g-z), we use base 36/62.
  let timingUseBase36 = false;
  const timingHeaderRegex = /^#(?:BPM|STOP|SCROLL)([0-9A-Z]{2})\s+/i;
  const timingChannelRegex = /^#[0-9]{3}(?:08|09|SC):([0-9A-Z]+)/i;
  const nonHexRegex = /[G-Zg-z]/;

  for (const line of lines) {
    const trimmed = line.trim();
    const headerMatch = trimmed.match(timingHeaderRegex);
    if (headerMatch) {
      if (nonHexRegex.test(headerMatch[1])) {
        timingUseBase36 = true;
        break;
      }
    }
    const channelMatch = trimmed.match(timingChannelRegex);
    if (channelMatch) {
      const dataStr = channelMatch[1];
      for (let i = 0; i < dataStr.length; i += 2) {
        const pair = dataStr.substring(i, i + 2);
        if (pair !== "00" && nonHexRegex.test(pair)) {
          timingUseBase36 = true;
          break;
        }
      }
      if (timingUseBase36) break;
    }
  }
  const timingBase = base === 16 ? 16 : (timingUseBase36 ? base : 16);

  for (const line of lines) {
    const trimmed = line.trim();
    
    // Check for expansion field boundary
    if (trimmed.toUpperCase().includes("EXPANSION FIELD")) {
      inExpansion = true;
      continue;
    }

    if (inExpansion) {
      // Main data channel (#00111:xx) or measure length (#00102 xx) detection
      const isChannelData = channelRegex.test(trimmed);
      const isSpaceMeasure = /^#([0-9]{3})02\s+(.+)$/i.test(trimmed);
      
      if (isChannelData || isSpaceMeasure) {
        inExpansion = false; // Expansion field is complete, main data has started
      }
    }

    if (inExpansion) {
      if (trimmed.startsWith("#")) {
        expansionLines.push(trimmed);
        
        // Also parse standard headers even within expansion field to sync with editor properties
        const headerMatch = trimmed.match(headerRegex);
        if (headerMatch) {
          const key = headerMatch[1].toUpperCase();
          const val = headerMatch[2];
          
          switch (key) {
            case "TITLE": bmsData.header.title = val; break;
            case "SUBTITLE": bmsData.header.subtitle = val; break;
            case "ARTIST": bmsData.header.artist = val; break;
            case "SUBARTIST": bmsData.header.subartist = val; break;
            case "GENRE": bmsData.header.genre = val; break;
            case "BPM": bmsData.header.bpm = parseFloat(val); break;
            case "PLAYER": bmsData.header.player = parseInt(val, 10); break;
            case "RANK": bmsData.header.rank = parseInt(val, 10); break;
            case "PLAYLEVEL": bmsData.header.playLevel = val; break;
            case "DIFFICULTY": bmsData.header.difficulty = parseInt(val, 10); break;
            case "TOTAL": bmsData.header.total = parseFloat(val); break;
            case "LNMODE": bmsData.header.lnmode = parseInt(val, 10); break;
            case "LNOBJ": bmsData.header.lnobj = val; break;
            case "DEFEXRANK": bmsData.header.defexrank = parseFloat(val); break;
            case "COMMENT": bmsData.header.comment = val; break;
            case "STAGEFILE": bmsData.header.stagefile = val; break;
            case "BANNER": bmsData.header.banner = val; break;
            case "BACKBMP": bmsData.header.backbmp = val; break;
            case "WAV00": bmsData.header.wav00 = val; break;
            case "BMP00": bmsData.header.bmp00 = val; break;
            case "PREVIEW": bmsData.header.preview = val; break;
            default: bmsData.header[key] = val; break;
          }
        }
      }
      continue;
    }

    if (!trimmed.startsWith("#")) continue;

    // Check Definition (#WAV01, #BMP01, #BPM01, #STOP01, #SCROLL01)
    const defMatch = trimmed.match(defRegex);
    if (defMatch) {
      const type = defMatch[1].toUpperCase();
      const idStr = defMatch[2];
      const val = defMatch[3];
      const isTimingType = type === "BPM" || type === "STOP" || type === "SCROLL";
      const id = isTimingType ? decodeBmsValueWithBase(idStr, timingBase) : decodeBmsValue(idStr, base);
      
      if (type === "WAV") bmsData.wavs[id] = val;
      else if (type === "BMP") bmsData.bmps[id] = val;
      else if (type === "BPM") bmsData.bpms[id] = parseFloat(val);
      else if (type === "STOP") bmsData.stops[id] = parseFloat(val);
      else if (type === "SCROLL") bmsData.scrolls[id] = parseFloat(val);
      continue;
    }

    // Check Measure Length with space instead of colon (e.g. #00102 0.5)
    const spaceMeasureMatch = trimmed.match(/^#([0-9]{3})02\s+(.+)$/i);
    if (spaceMeasureMatch) {
      const measure = parseInt(spaceMeasureMatch[1], 10);
      bmsData.measureLengths[measure] = parseFloat(spaceMeasureMatch[2]);
      continue;
    }

    const channelMatch = trimmed.match(channelRegex);
    if (channelMatch) {
      const measure = parseInt(channelMatch[1], 10);
      const channelStr = channelMatch[2].toUpperCase();
      const dataStr = channelMatch[3];
      
      // Parse measure lengths (channel 02)
      if (channelStr === "02") {
        bmsData.measureLengths[measure] = parseFloat(dataStr);
        continue;
      }
      
      const channel = channelStr === "SC" ? 256 : parseInt(channelStr, 16); // Channel is conventionally read as hex

      const key = `${measure}_${channel}`;
      const index = measureChannelCount[key] || 0;
      measureChannelCount[key] = index + 1;
      
      const objCount = dataStr.length / 2;
      const isTimingChan = channel === 0x08 || channel === 0x09 || channel === 256;
      for (let i = 0; i < objCount; i++) {
        const objStr = dataStr.substr(i * 2, 2);
        const objVal = channel === 0x03              ? parseInt(objStr, 16) 
              : (isTimingChan 
                 ? decodeBmsValueWithBase(objStr, timingBase) 
                 : decodeBmsValue(objStr, base));
        
        if (objVal > 0) {
          bmsData.notes.push({
            id: crypto.randomUUID(),
            measure,
            channel,
            index,
            position: i / objCount,
            value: objVal
          });
        }
      }
      continue;
    }

    // Check Header (#TITLE xxxx)
    const headerMatch = trimmed.match(headerRegex);
    if (headerMatch) {
      const key = headerMatch[1].toUpperCase();
      const val = headerMatch[2];
      
      switch (key) {
        case "TITLE": bmsData.header.title = val; break;
        case "SUBTITLE": bmsData.header.subtitle = val; break;
        case "ARTIST": bmsData.header.artist = val; break;
        case "SUBARTIST": bmsData.header.subartist = val; break;
        case "GENRE": bmsData.header.genre = val; break;
        case "BPM": bmsData.header.bpm = parseFloat(val); break;
        case "PLAYER": bmsData.header.player = parseInt(val, 10); break;
        case "RANK": bmsData.header.rank = parseInt(val, 10); break;
        case "PLAYLEVEL": bmsData.header.playLevel = val; break;
        case "DIFFICULTY": bmsData.header.difficulty = parseInt(val, 10); break;
        case "TOTAL": bmsData.header.total = parseFloat(val); break;
        case "LNMODE": bmsData.header.lnmode = parseInt(val, 10); break;
        case "LNOBJ": bmsData.header.lnobj = val; break;
        case "DEFEXRANK": bmsData.header.defexrank = parseFloat(val); break;
        case "COMMENT": bmsData.header.comment = val; break;
        case "STAGEFILE": bmsData.header.stagefile = val; break;
        case "BANNER": bmsData.header.banner = val; break;
        case "BACKBMP": bmsData.header.backbmp = val; break;
        case "WAV00": bmsData.header.wav00 = val; break;
        case "BMP00": bmsData.header.bmp00 = val; break;
        case "PREVIEW": bmsData.header.preview = val; break;
        default: bmsData.header[key] = val; break;
      }
    }
  }

  bmsData.expansion = expansionLines.join("\n");
  return bmsData;
}

export function encodeBms(bmsData: BmsData, baseMode: 16 | 36 | 62 | boolean): string {
  const base = typeof baseMode === 'boolean' ? (baseMode ? 62 : 36) : baseMode;
  const lines: string[] = [];
  lines.push("*---------------------- HEADER FIELD");
  
  // Track custom expansion headers to avoid duplicate printing in standard header section
  const expansionHeaderKeys = new Set<string>();
  if (bmsData.expansion) {
    const expLines = bmsData.expansion.split(/\r?\n/);
    for (const el of expLines) {
      const trimmed = el.trim();
      if (trimmed.startsWith("#")) {
        const match = trimmed.match(/^#([A-Z0-9_-]+)/i);
        if (match) {
          expansionHeaderKeys.add(match[1].toUpperCase());
        }
      }
    }
  }

  // Smart BPM Partitioning & Re-indexing
  const processedNotes: BmsNote[] = [];
  
  // Set of actual values we need to export for expansion channels
  const activeBpmValues: number[] = [];
  const activeStopValues: number[] = [];
  const activeScrollValues: number[] = [];

  // Temporary storage to map notes to their original float values
  const noteOriginalValues: Record<string, { type: 'bpm'|'stop'|'scroll', val: number }> = {};

  for (const note of bmsData.notes) {
    if (note.channel === 0x08) {
      const bpmVal = bmsData.bpms?.[note.value];
      if (bpmVal !== undefined) {
        const isInteger = Number.isInteger(bpmVal);
        const inRange = bpmVal >= 1 && bpmVal <= 255;
        if (isInteger && inRange) {
          // 03번 일반 BPM 채널로 스마트 강등 전환 및 16진수 인코딩을 위해 정수형 적용
          processedNotes.push({
            ...note,
            channel: 0x03,
            value: Math.round(bpmVal)
          });
          continue;
        } else {
          if (!activeBpmValues.includes(bpmVal)) {
            activeBpmValues.push(bpmVal);
          }
          noteOriginalValues[note.id] = { type: 'bpm', val: bpmVal };
        }
      }
    } else if (note.channel === 0x09) {
      const stopVal = bmsData.stops?.[note.value];
      if (stopVal !== undefined) {
        if (!activeStopValues.includes(stopVal)) {
          activeStopValues.push(stopVal);
        }
        noteOriginalValues[note.id] = { type: 'stop', val: stopVal };
      }
    } else if (note.channel === 256) {
      const scrollVal = bmsData.scrolls?.[note.value];
      if (scrollVal !== undefined) {
        if (!activeScrollValues.includes(scrollVal)) {
          activeScrollValues.push(scrollVal);
        }
        noteOriginalValues[note.id] = { type: 'scroll', val: scrollVal };
      }
    }
    processedNotes.push(note);
  }

  // Sort values sequentially to maintain visual/functional order in file
  activeBpmValues.sort((a, b) => a - b);
  activeStopValues.sort((a, b) => a - b);
  activeScrollValues.sort((a, b) => a - b);

  // Determine whether to use base 36/62 or base 16 (hex) for timing channels
  // Default is base 16. If index exceeds 255 (FF), we switch to base 36 (or base 62 if useBase62 is true).
  const maxTimingIndex = Math.max(activeBpmValues.length, activeStopValues.length, activeScrollValues.length);
  const timingBase = base === 16 ? 16 : (maxTimingIndex > 255 ? base : 16);

  // Create clean, contiguous 1-based sequential index mappings
  const exportedBpms: Record<number, number> = {};
  const exportedStops: Record<number, number> = {};
  const exportedScrolls: Record<number, number> = {};

  activeBpmValues.forEach((val, idx) => { exportedBpms[idx + 1] = val; });
  activeStopValues.forEach((val, idx) => { exportedStops[idx + 1] = val; });
  activeScrollValues.forEach((val, idx) => { exportedScrolls[idx + 1] = val; });

  // Re-map the processed notes to point to the new sequential indices
  const finalNotes = processedNotes.map(n => {
    const originalInfo = noteOriginalValues[n.id];
    if (originalInfo) {
      if (originalInfo.type === 'bpm') {
        const newIdx = activeBpmValues.indexOf(originalInfo.val) + 1;
        return { ...n, value: newIdx };
      } else if (originalInfo.type === 'stop') {
        const newIdx = activeStopValues.indexOf(originalInfo.val) + 1;
        return { ...n, value: newIdx };
      } else if (originalInfo.type === 'scroll') {
        const newIdx = activeScrollValues.indexOf(originalInfo.val) + 1;
        return { ...n, value: newIdx };
      }
    }
    return n;
  });

  // 1. Header
  const writeHeader = (key: string, value: any) => {
    if (expansionHeaderKeys.has(key.toUpperCase())) return; // Do not print here if it is under the expansion field
    if (value !== undefined && value !== null && value !== "") {
      lines.push(`#${key.toUpperCase()} ${value}`);
    }
  };

  writeHeader("TITLE", bmsData.header.title);
  writeHeader("SUBTITLE", bmsData.header.subtitle);
  writeHeader("ARTIST", bmsData.header.artist);
  writeHeader("SUBARTIST", bmsData.header.subartist);
  writeHeader("GENRE", bmsData.header.genre);
  writeHeader("BPM", bmsData.header.bpm);
  writeHeader("PLAYER", bmsData.header.player);
  writeHeader("RANK", bmsData.header.rank);
  writeHeader("PLAYLEVEL", bmsData.header.playLevel);
  writeHeader("DIFFICULTY", bmsData.header.difficulty);
  writeHeader("TOTAL", bmsData.header.total);
  writeHeader("LNMODE", bmsData.header.lnmode);
  writeHeader("LNOBJ", bmsData.header.lnobj);
  writeHeader("DEFEXRANK", bmsData.header.defexrank);
  writeHeader("COMMENT", bmsData.header.comment);
  
  lines.push("");
  writeHeader("STAGEFILE", bmsData.header.stagefile);
  writeHeader("BANNER", bmsData.header.banner);
  writeHeader("BACKBMP", bmsData.header.backbmp);
  writeHeader("WAV00", bmsData.header.wav00);
  writeHeader("BMP00", bmsData.header.bmp00);
  writeHeader("PREVIEW", bmsData.header.preview);

  // Other dynamic headers
  const knownKeys = [
    "title", "subtitle", "artist", "subartist", "genre", "bpm", 
    "player", "rank", "playlevel", "difficulty", "total", 
    "lnmode", "lnobj", "defexrank", "comment",
    "stagefile", "banner", "backbmp", "wav00", "bmp00", "preview"
  ];
  for (const key in bmsData.header) {
    if (!knownKeys.includes(key.toLowerCase())) {
      writeHeader(key, bmsData.header[key]);
    }
  }

  lines.push("");

  // 1.5 Header Field - WAVs and BMPs
  const writeDict = (prefix: string, dict: Record<number, string>) => {
    if (!dict) return;
    const keys = Object.keys(dict).map(k => parseInt(k.toString())).sort((a, b) => a - b);
    for (const k of keys) {
      lines.push(`#${prefix}${encodeBmsValue(k, base)} ${dict[k]}`);
    }
  };

  const writeDictFloat = (prefix: string, dict: Record<number, number>) => {
    if (!dict) return;
    const keys = Object.keys(dict).map(k => parseInt(k.toString())).sort((a, b) => a - b);
    for (const k of keys) {
      const isTiming = prefix === "BPM" || prefix === "STOP" || prefix === "SCROLL";
      const baseVal = isTiming ? timingBase : base;
      lines.push(`#${prefix}${encodeBmsValueWithBase(k, baseVal)} ${dict[k]}`);
    }
  };

  writeDict("WAV", bmsData.wavs);
  lines.push("");
  writeDict("BMP", bmsData.bmps);
  lines.push("");
  
  // 동적 확장 매핑 헤더 정의들 순차 출력
  writeDictFloat("BPM", exportedBpms);
  if (Object.keys(exportedBpms).length > 0) lines.push("");
  writeDictFloat("STOP", exportedStops);
  if (Object.keys(exportedStops).length > 0) lines.push("");
  writeDictFloat("SCROLL", exportedScrolls);
  if (Object.keys(exportedScrolls).length > 0) lines.push("");

  // 2. Expansion Field (Header Field 바로 뒤, Main Data Field 직전)
  if (bmsData.expansion && bmsData.expansion.trim() !== "") {
    lines.push("*---------------------- EXPANSION FIELD");
    lines.push(bmsData.expansion.trim());
    lines.push("");
  }

  // 3. Main Data Field (Measure Lengths and Notes)
  lines.push("*---------------------- MAIN DATA FIELD");
  lines.push("");

  // Group notes by measure, channel, and index using finalNotes
  const groups: Record<string, BmsNote[]> = {};
  for (const note of finalNotes) {
    const key = `${note.measure}_${note.channel}_${note.index}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(note);
  }

  // 마디 길이 데이터와 노트 데이터에 존재하는 모든 마디 번호를 고유 수집하여 정렬
  const activeMeasures = new Set<number>();
  Object.keys(bmsData.measureLengths).map(Number).forEach(m => activeMeasures.add(m));
  finalNotes.forEach(n => activeMeasures.add(n.measure));
  const sortedMeasures = Array.from(activeMeasures).sort((a, b) => a - b);

  const getBestResolution = (positions: number[]): number => {
    if (positions.length === 0) return 4;

    // 1부터 10000까지 돌며 모든 position이 정확히(오차 0.0001 이내) 정수가 되는 최소 해상도를 탐색
    for (let res = 1; res <= 10000; res++) {
      let allFit = true;
      for (const p of positions) {
        const product = p * res;
        if (Math.abs(product - Math.round(product)) > 0.0001) {
          allFit = false;
          break;
        }
      }
      if (allFit) {
        const finalRes = res % 2 !== 0 ? res * 2 : res;
        console.log(`[getBestResolution] Found optimal dynamic resolution: ${finalRes} (search res: ${res}) for ${positions.length} notes`);
        return finalRes;
      }
    }

    // 대표적인 고해상도 commonRes에서 검사 (최종 안전 9216 해상도 검사 및 폴백)
    const commonRes = [192, 384, 768, 1536, 9216];
    for (const res of commonRes) {
      let allFit = true;
      for (const p of positions) {
        if (Math.abs(p * res - Math.round(p * res)) > 0.0001) {
          allFit = false;
          break;
        }
      }
      if (allFit) {
        console.log(`[getBestResolution] Found resolution in commonRes: ${res} for ${positions.length} notes`);
        return res;
      }
    }

    console.warn(`[getBestResolution] Fallback to 9216. Positions:`, positions);
    return 9216; // fallback
  };

  // 마디 오름차순 순서로 정비된 출력
  for (const m of sortedMeasures) {
    let hasOutputForThisMeasure = false;

    // 1. 해당 마디의 마디 길이 채널 (02) 기입
    const len = bmsData.measureLengths[m];
    if (len !== undefined && len !== 1.0) {
      lines.push(`#${m.toString().padStart(3, "0")}02:${len}`);
      hasOutputForThisMeasure = true;
    }

    // 2. 해당 마디에 존재하는 일반 연주 채널 정렬 기입
    const measureKeys = Object.keys(groups).filter(key => {
      const [measure] = key.split('_').map(Number);
      return measure === m;
    }).sort((a, b) => {
      const [_ma, ca, ia] = a.split('_').map(Number);
      const [_mb, cb, ib] = b.split('_').map(Number);
      if (ca !== cb) return ca - cb;
      return ia - ib;
    });

    for (const key of measureKeys) {
      const notes = groups[key];
      if (notes.length === 0) continue;
      
      const [_measure, channel, _index] = key.split('_').map(Number);
      
      const res = getBestResolution(notes.map(n => n.position));
      const arr = new Array(res).fill("00");
      
      for (const n of notes) {
        const idx = Math.round(n.position * res);
        if (idx >= 0 && idx < res) {
          const isTimingChan = channel === 0x08 || channel === 0x09 || channel === 256;
          arr[idx] = channel === 0x03 
            ? n.value.toString(16).toUpperCase().padStart(2, '0') 
            : (isTimingChan 
               ? encodeBmsValueWithBase(n.value, timingBase) 
               : encodeBmsValue(n.value, base));
        }
      }
      
      const measureStr = m.toString().padStart(3, "0");
      const channelStr = channel === 256 ? "SC" : channel.toString(16).padStart(2, "0").toUpperCase();
      lines.push(`#${measureStr}${channelStr}:${arr.join("")}`);
      hasOutputForThisMeasure = true;
    }

    // 마디 블록 사이 구분을 위한 빈 줄 삽입
    if (hasOutputForThisMeasure) {
      lines.push("");
    }
  }

  // 최하단의 잔여 빈 줄 다듬기 보정
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  return lines.join("\r\n") + "\r\n";
}
