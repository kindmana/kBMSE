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
}

const BASE36_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const BASE62_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export function decodeBmsValue(valStr: string, useBase62: boolean): number {
  if (valStr === "00") return 0;
  
  const chars = useBase62 ? BASE62_CHARS : BASE36_CHARS;
  const base = useBase62 ? 62 : 36;
  
  let result = 0;
  for (let i = 0; i < valStr.length; i++) {
    const char = valStr[i];
    const index = chars.indexOf(char);
    if (index === -1) {
      // Invalid character, fallback to 0 or handle error
      return 0;
    }
    result = result * base + index;
  }
  return result;
}

export function encodeBmsValue(value: number, useBase62: boolean): string {
  if (value === 0) return "00";
  
  const chars = useBase62 ? BASE62_CHARS : BASE36_CHARS;
  const base = useBase62 ? 62 : 36;
  
  let result = "";
  let temp = value;
  
  while (temp > 0) {
    const remainder = temp % base;
    result = chars[remainder] + result;
    temp = Math.floor(temp / base);
  }
  
  return result.padStart(2, "0");
}

export function parseBms(bmsContent: string, useBase62: boolean): BmsData {
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
    bmps: {}
  };

  const channelRegex = /^#([0-9]{3})([0-9A-Z]{2}):(.+)$/i;
  const headerRegex = /^#([A-Z0-9]+)\s+(.+)$/i;
  const defRegex = /^#(WAV|BMP)([0-9A-Z]{2})\s+(.+)$/i;

  const measureChannelCount: Record<string, number> = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("#")) continue;

    // Check Definition (#WAV01, #BMP01)
    const defMatch = trimmed.match(defRegex);
    if (defMatch) {
      const type = defMatch[1].toUpperCase();
      const idStr = defMatch[2];
      const val = defMatch[3];
      const id = decodeBmsValue(idStr, useBase62);
      
      if (type === "WAV") bmsData.wavs[id] = val;
      else if (type === "BMP") bmsData.bmps[id] = val;
      continue;
    }

    // Check Channel (#00111:00010001)
    const channelMatch = trimmed.match(channelRegex);
    if (channelMatch) {
      const measure = parseInt(channelMatch[1], 10);
      const channel = parseInt(channelMatch[2], 16); // Channel is conventionally read as hex
      const dataStr = channelMatch[3];
      
      const key = `${measure}_${channel}`;
      const index = measureChannelCount[key] || 0;
      measureChannelCount[key] = index + 1;
      
      const objCount = dataStr.length / 2;
      for (let i = 0; i < objCount; i++) {
        const objStr = dataStr.substr(i * 2, 2);
        const objVal = decodeBmsValue(objStr, useBase62);
        
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

  return bmsData;
}

export function encodeBms(bmsData: BmsData, useBase62: boolean): string {
  const lines: string[] = [];
  
  // 1. Header
  const writeHeader = (key: string, value: any) => {
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

  // 2. WAVs and BMPs
  const writeDict = (prefix: string, dict: Record<number, string>) => {
    const keys = Object.keys(dict).map(k => parseInt(k.toString())).sort((a, b) => a - b);
    for (const k of keys) {
      lines.push(`#${prefix}${encodeBmsValue(k, useBase62)} ${dict[k]}`);
    }
  };

  writeDict("WAV", bmsData.wavs);
  lines.push("");
  writeDict("BMP", bmsData.bmps);
  lines.push("");

  // 3. Notes
  // Group notes by measure, channel, and index
  const groups: Record<string, BmsNote[]> = {};
  for (const note of bmsData.notes) {
    const key = `${note.measure}_${note.channel}_${note.index}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(note);
  }

  const getBestResolution = (positions: number[]): number => {
    const commonRes = [4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192, 384, 768, 1536];
    for (const res of commonRes) {
      let allFit = true;
      for (const p of positions) {
        if (Math.abs(p * res - Math.round(p * res)) > 0.0001) {
          allFit = false;
          break;
        }
      }
      if (allFit) return res;
    }
    return 192; // fallback
  };

  const groupKeys = Object.keys(groups).sort((a, b) => {
    const [ma, ca, ia] = a.split('_').map(Number);
    const [mb, cb, ib] = b.split('_').map(Number);
    if (ma !== mb) return ma - mb;
    if (ca !== cb) return ca - cb;
    return ia - ib;
  });

  for (const key of groupKeys) {
    const notes = groups[key];
    if (notes.length === 0) continue;
    
    const [measure, channel, _index] = key.split('_').map(Number);
    
    const res = getBestResolution(notes.map(n => n.position));
    const arr = new Array(res).fill("00");
    
    for (const n of notes) {
      const idx = Math.round(n.position * res);
      if (idx >= 0 && idx < res) {
        arr[idx] = encodeBmsValue(n.value, useBase62);
      }
    }
    
    const measureStr = measure.toString().padStart(3, "0");
    const channelStr = channel.toString(16).padStart(2, "0").toUpperCase();
    lines.push(`#${measureStr}${channelStr}:${arr.join("")}`);
  }

  return lines.join("\r\n") + "\r\n";
}
