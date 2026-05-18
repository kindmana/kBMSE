export interface LaneConfig {
  name: string;
  type: 'measure' | 'channel' | 'bgm';
  channel?: number;
  width: number;
  color: string;
  isGroupEnd?: boolean;
}

export const DEFAULT_LANE_WIDTH = 25;

export const getTargetLaneIndex = (layout: LaneConfig[], channel: number, bgmIndex: number) => {
  if (channel === 0x01) {
    return layout.findIndex(l => l.type === 'bgm' && l.name === `B${(bgmIndex % 100) + 1}`);
  }
  if (channel === 0x03) {
    return layout.findIndex(l => l.name === 'BPM');
  }
  let targetChannel = channel;
  if (channel >= 0x51 && channel <= 0x59) targetChannel = channel - 0x40; // 0x51 -> 0x11
  if (channel >= 0x61 && channel <= 0x69) targetChannel = channel - 0x40; // 0x61 -> 0x21
  
  return layout.findIndex(l => l.channel === targetChannel);
};

export const getLaneCategory = (channel: number) => {
  if (channel >= 0x11 && channel <= 0x19) return '1P';
  if (channel >= 0x21 && channel <= 0x29) return '2P';
  if (channel >= 0x51 && channel <= 0x59) return '1P_LN';
  if (channel >= 0x61 && channel <= 0x69) return '2P_LN';
  if (channel === 0x01) return 'BGM';
  return 'other';
};

export const LAYOUT: LaneConfig[] = [
  // 1. Measure
  { name: 'MSR', type: 'measure', width: DEFAULT_LANE_WIDTH, color: '#050505', isGroupEnd: true },
  // 2. Timing
  { name: 'BPM', type: 'channel', channel: 0x08, width: DEFAULT_LANE_WIDTH, color: '#0a0a0a' },
  { name: 'STOP', type: 'channel', channel: 0x09, width: DEFAULT_LANE_WIDTH, color: '#0a0a0a' },
  { name: 'SCR', type: 'channel', channel: 256, width: DEFAULT_LANE_WIDTH, color: '#0a0a0a', isGroupEnd: true }, // SCROLL
  // 3. Video
  { name: 'BGA', type: 'channel', channel: 0x04, width: DEFAULT_LANE_WIDTH, color: '#080808' },
  { name: 'LYR', type: 'channel', channel: 0x07, width: DEFAULT_LANE_WIDTH, color: '#080808' },
  { name: 'POR', type: 'channel', channel: 0x06, width: DEFAULT_LANE_WIDTH, color: '#080808', isGroupEnd: true },
  // 4. 1P Notes (11-19)
  { name: 'S1', type: 'channel', channel: 0x16, width: DEFAULT_LANE_WIDTH, color: '#140c0c' },
  { name: 'A1', type: 'channel', channel: 0x11, width: DEFAULT_LANE_WIDTH, color: '#0a0a0a' },
  { name: 'A2', type: 'channel', channel: 0x12, width: DEFAULT_LANE_WIDTH, color: '#111114' },
  { name: 'A3', type: 'channel', channel: 0x13, width: DEFAULT_LANE_WIDTH, color: '#0a0a0a' },
  { name: 'A4', type: 'channel', channel: 0x14, width: DEFAULT_LANE_WIDTH, color: '#111114' },
  { name: 'A5', type: 'channel', channel: 0x15, width: DEFAULT_LANE_WIDTH, color: '#0a0a0a' },
  { name: 'A6', type: 'channel', channel: 0x18, width: DEFAULT_LANE_WIDTH, color: '#111114' },
  { name: 'A7', type: 'channel', channel: 0x19, width: DEFAULT_LANE_WIDTH, color: '#0a0a0a', isGroupEnd: true },
  // 5. 2P Notes (21-29)
  { name: 'D1', type: 'channel', channel: 0x21, width: DEFAULT_LANE_WIDTH, color: '#0a0a0a' },
  { name: 'D2', type: 'channel', channel: 0x22, width: DEFAULT_LANE_WIDTH, color: '#111114' },
  { name: 'D3', type: 'channel', channel: 0x23, width: DEFAULT_LANE_WIDTH, color: '#0a0a0a' },
  { name: 'D4', type: 'channel', channel: 0x24, width: DEFAULT_LANE_WIDTH, color: '#111114' },
  { name: 'D5', type: 'channel', channel: 0x25, width: DEFAULT_LANE_WIDTH, color: '#0a0a0a' },
  { name: 'D6', type: 'channel', channel: 0x28, width: DEFAULT_LANE_WIDTH, color: '#111114' },
  { name: 'D7', type: 'channel', channel: 0x29, width: DEFAULT_LANE_WIDTH, color: '#0a0a0a' },
  { name: 'S2', type: 'channel', channel: 0x26, width: DEFAULT_LANE_WIDTH, color: '#140c0c', isGroupEnd: true },
  // 6. BGM (Generic 100 lanes)
  ...Array.from({ length: 100 }).map((_, i) => ({
    name: `B${i + 1}`,
    type: 'bgm' as const,
    channel: 0x01,
    width: DEFAULT_LANE_WIDTH,
    color: i % 2 === 0 ? '#0a0a0a' : '#0f0f0f'
  }))
];

export const BASE_MEASURE_HEIGHT = 192;
