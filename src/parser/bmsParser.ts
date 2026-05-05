/**
 * BMS Data structures and parsing logic
 */

export interface BmsHeader {
  player: number;
  genre: string;
  title: string;
  artist: string;
  bpm: number;
  playLevel: number;
  rank: number;
  total: number;
  [key: string]: any; // for other generic tags
}

export interface BmsNote {
  measure: number;
  channel: number;
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
      player: 1,
      genre: "",
      title: "",
      artist: "",
      bpm: 120,
      playLevel: 1,
      rank: 3,
      total: 160
    },
    notes: [],
    wavs: {},
    bmps: {}
  };

  const channelRegex = /^#([0-9]{3})([0-9A-Z]{2}):(.+)$/i;
  const headerRegex = /^#([A-Z0-9]+)\s+(.+)$/i;
  const defRegex = /^#(WAV|BMP)([0-9A-Z]{2})\s+(.+)$/i;

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
      
      const objCount = dataStr.length / 2;
      for (let i = 0; i < objCount; i++) {
        const objStr = dataStr.substr(i * 2, 2);
        const objVal = decodeBmsValue(objStr, useBase62);
        
        if (objVal > 0) {
          bmsData.notes.push({
            measure,
            channel,
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
        case "PLAYER": bmsData.header.player = parseInt(val, 10); break;
        case "GENRE": bmsData.header.genre = val; break;
        case "TITLE": bmsData.header.title = val; break;
        case "ARTIST": bmsData.header.artist = val; break;
        case "BPM": bmsData.header.bpm = parseFloat(val); break;
        case "PLAYLEVEL": bmsData.header.playLevel = parseInt(val, 10); break;
        case "RANK": bmsData.header.rank = parseInt(val, 10); break;
        case "TOTAL": bmsData.header.total = parseFloat(val); break;
        default: bmsData.header[key] = val; break;
      }
    }
  }

  return bmsData;
}
