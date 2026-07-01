import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useEditorStore, EditorSettings, DEFAULT_LANE_COLORS, CustomLaneColors } from '../../store/editorStore';
import { X, Sliders, Eye, Palette, Plus, Trash2 } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'general' | 'visual';
}

interface ColorPreset {
  id: string;
  nameKo: string;
  nameEn: string;
  colors: CustomLaneColors;
  isBuiltIn: boolean;
}

const BUILT_IN_PRESETS: ColorPreset[] = [
  {
    id: 'default',
    nameKo: 'kBMSE 기본값',
    nameEn: 'kBMSE Default',
    colors: DEFAULT_LANE_COLORS,
    isBuiltIn: true
  },
  {
    id: 'iidx',
    nameKo: 'IIDX 클래식',
    nameEn: 'IIDX Classic',
    isBuiltIn: true,
    colors: {
      MSR: { bg: '#000000', bgAlpha: 0.0, fg: '#ffffff', fgAlpha: 1.0, width: 25 },
      BPM: { bg: '#000000', bgAlpha: 0.0, fg: '#eab308', fgAlpha: 1.0, width: 25 },
      STOP: { bg: '#000000', bgAlpha: 0.0, fg: '#3b82f6', fgAlpha: 1.0, width: 25 },
      SCR: { bg: '#000000', bgAlpha: 0.0, fg: '#a855f7', fgAlpha: 1.0, width: 25 },
      BGA: { bg: '#10b981', bgAlpha: 1.0, fg: '#ffffff', fgAlpha: 1.0, width: 25 },
      LYR: { bg: '#10b981', bgAlpha: 1.0, fg: '#ffffff', fgAlpha: 1.0, width: 25 },
      POR: { bg: '#10b981', bgAlpha: 1.0, fg: '#ffffff', fgAlpha: 1.0, width: 25 },
      S1: { bg: '#ef4444', bgAlpha: 1.0, fg: '#ffffff', fgAlpha: 1.0, width: 25 },
      A1: { bg: '#ffffff', bgAlpha: 1.0, fg: '#000000', fgAlpha: 1.0, width: 25 },
      A2: { bg: '#1e40af', bgAlpha: 1.0, fg: '#ffffff', fgAlpha: 1.0, width: 25 },
      A3: { bg: '#ffffff', bgAlpha: 1.0, fg: '#000000', fgAlpha: 1.0, width: 25 },
      A4: { bg: '#1e40af', bgAlpha: 1.0, fg: '#ffffff', fgAlpha: 1.0, width: 25 },
      A5: { bg: '#ffffff', bgAlpha: 1.0, fg: '#000000', fgAlpha: 1.0, width: 25 },
      A6: { bg: '#1e40af', bgAlpha: 1.0, fg: '#ffffff', fgAlpha: 1.0, width: 25 },
      A7: { bg: '#ffffff', bgAlpha: 1.0, fg: '#000000', fgAlpha: 1.0, width: 25 },
      D1: { bg: '#ffffff', bgAlpha: 1.0, fg: '#000000', fgAlpha: 1.0, width: 25 },
      D2: { bg: '#1e40af', bgAlpha: 1.0, fg: '#ffffff', fgAlpha: 1.0, width: 25 },
      D3: { bg: '#ffffff', bgAlpha: 1.0, fg: '#000000', fgAlpha: 1.0, width: 25 },
      D4: { bg: '#1e40af', bgAlpha: 1.0, fg: '#ffffff', fgAlpha: 1.0, width: 25 },
      D5: { bg: '#ffffff', bgAlpha: 1.0, fg: '#000000', fgAlpha: 1.0, width: 25 },
      D6: { bg: '#1e40af', bgAlpha: 1.0, fg: '#ffffff', fgAlpha: 1.0, width: 25 },
      D7: { bg: '#ffffff', bgAlpha: 1.0, fg: '#000000', fgAlpha: 1.0, width: 25 },
      S2: { bg: '#ef4444', bgAlpha: 1.0, fg: '#ffffff', fgAlpha: 1.0, width: 25 },
      B: { bg: '#1f2937', bgAlpha: 1.0, fg: '#ffffff', fgAlpha: 1.0, width: 25 },
      MINE: { bg: '#991b1b', bgAlpha: 1.0, fg: '#ffffff', fgAlpha: 1.0 },
      INV: { bg: '#f4f4f5', bgAlpha: 0.4, fg: '#000000', fgAlpha: 0.4 },
      OVERLAP: { bg: '#ffffaa', bgAlpha: 1.0, fg: '#bbbb00', fgAlpha: 1.0 },
      SELECT: { bg: '#ffaaaa', bgAlpha: 1.0, fg: '#ff0000', fgAlpha: 1.0 }
    }
  },
  {
    id: 'pms',
    nameKo: 'PMS (팝픈 9키)',
    nameEn: 'PMS (Pop\'n 9K)',
    isBuiltIn: true,
    colors: {
      MSR: { bg: '#000000', bgAlpha: 0.0, fg: '#ffffff', fgAlpha: 1.0, width: 25 },
      BPM: { bg: '#000000', bgAlpha: 0.0, fg: '#bd00ff', fgAlpha: 1.0, width: 25 },
      STOP: { bg: '#000000', bgAlpha: 0.0, fg: '#3b82f6', fgAlpha: 1.0, width: 25 },
      SCR: { bg: '#000000', bgAlpha: 0.0, fg: '#71717a', fgAlpha: 0.3, width: 25 },
      BGA: { bg: '#27272a', bgAlpha: 0.3, fg: '#71717a', fgAlpha: 0.3, width: 25 },
      LYR: { bg: '#27272a', bgAlpha: 0.3, fg: '#71717a', fgAlpha: 0.3, width: 25 },
      POR: { bg: '#27272a', bgAlpha: 0.3, fg: '#71717a', fgAlpha: 0.3, width: 25 },
      
      A1: { bg: '#ffffff', bgAlpha: 1.0, fg: '#000000', fgAlpha: 1.0, width: 25 },
      A2: { bg: '#eab308', bgAlpha: 1.0, fg: '#000000', fgAlpha: 1.0, width: 25 },
      A3: { bg: '#22c55e', bgAlpha: 1.0, fg: '#ffffff', fgAlpha: 1.0, width: 25 },
      A4: { bg: '#3b82f6', bgAlpha: 1.0, fg: '#ffffff', fgAlpha: 1.0, width: 25 },
      A5: { bg: '#ef4444', bgAlpha: 1.0, fg: '#ffffff', fgAlpha: 1.0, width: 25 },
      D2: { bg: '#3b82f6', bgAlpha: 1.0, fg: '#ffffff', fgAlpha: 1.0, width: 25 },
      D3: { bg: '#22c55e', bgAlpha: 1.0, fg: '#ffffff', fgAlpha: 1.0, width: 25 },
      D4: { bg: '#eab308', bgAlpha: 1.0, fg: '#000000', fgAlpha: 1.0, width: 25 },
      D5: { bg: '#ffffff', bgAlpha: 1.0, fg: '#000000', fgAlpha: 1.0, width: 25 },
      
      S1: { bg: '#27272a', bgAlpha: 0.2, fg: '#71717a', fgAlpha: 0.2, width: 25 },
      A6: { bg: '#27272a', bgAlpha: 0.2, fg: '#71717a', fgAlpha: 0.2, width: 25 },
      A7: { bg: '#27272a', bgAlpha: 0.2, fg: '#71717a', fgAlpha: 0.2, width: 25 },
      D1: { bg: '#27272a', bgAlpha: 0.2, fg: '#71717a', fgAlpha: 0.2, width: 25 },
      D6: { bg: '#27272a', bgAlpha: 0.2, fg: '#71717a', fgAlpha: 0.2, width: 25 },
      D7: { bg: '#27272a', bgAlpha: 0.2, fg: '#71717a', fgAlpha: 0.2, width: 25 },
      S2: { bg: '#27272a', bgAlpha: 0.2, fg: '#71717a', fgAlpha: 0.2, width: 25 },
      
      B: { bg: '#18181b', bgAlpha: 0.8, fg: '#71717a', fgAlpha: 0.8, width: 25 },
      MINE: { bg: '#991b1b', bgAlpha: 1.0, fg: '#ffffff', fgAlpha: 1.0 },
      INV: { bg: '#f4f4f5', bgAlpha: 0.4, fg: '#000000', fgAlpha: 0.4 },
      OVERLAP: { bg: '#ffffaa', bgAlpha: 1.0, fg: '#bbbb00', fgAlpha: 1.0 },
      SELECT: { bg: '#ffaaaa', bgAlpha: 1.0, fg: '#ff0000', fgAlpha: 1.0 }
    }
  },
  {
    id: 'cyberpunk',
    nameKo: '네온',
    nameEn: 'Neon Cyberpunk',
    isBuiltIn: true,
    colors: {
      MSR: { bg: '#000000', bgAlpha: 0.0, fg: '#39ff14', fgAlpha: 1.0, width: 25 },
      BPM: { bg: '#000000', bgAlpha: 0.0, fg: '#00f0ff', fgAlpha: 1.0, width: 25 },
      STOP: { bg: '#000000', bgAlpha: 0.0, fg: '#00f0ff', fgAlpha: 1.0, width: 25 },
      SCR: { bg: '#000000', bgAlpha: 0.0, fg: '#bd00ff', fgAlpha: 1.0, width: 25 },
      BGA: { bg: '#eab308', bgAlpha: 1.0, fg: '#000000', fgAlpha: 1.0, width: 25 },
      LYR: { bg: '#eab308', bgAlpha: 1.0, fg: '#000000', fgAlpha: 1.0, width: 25 },
      POR: { bg: '#eab308', bgAlpha: 1.0, fg: '#000000', fgAlpha: 1.0, width: 25 },
      S1: { bg: '#ff007f', bgAlpha: 1.0, fg: '#ffffff', fgAlpha: 1.0, width: 25 },
      A1: { bg: '#39ff14', bgAlpha: 1.0, fg: '#000000', fgAlpha: 1.0, width: 25 },
      A2: { bg: '#0f172a', bgAlpha: 1.0, fg: '#39ff14', fgAlpha: 1.0, width: 25 },
      A3: { bg: '#39ff14', bgAlpha: 1.0, fg: '#000000', fgAlpha: 1.0, width: 25 },
      A4: { bg: '#0f172a', bgAlpha: 1.0, fg: '#39ff14', fgAlpha: 1.0, width: 25 },
      A5: { bg: '#39ff14', bgAlpha: 1.0, fg: '#000000', fgAlpha: 1.0, width: 25 },
      A6: { bg: '#0f172a', bgAlpha: 1.0, fg: '#39ff14', fgAlpha: 1.0, width: 25 },
      A7: { bg: '#39ff14', bgAlpha: 1.0, fg: '#000000', fgAlpha: 1.0, width: 25 },
      D1: { bg: '#39ff14', bgAlpha: 1.0, fg: '#000000', fgAlpha: 1.0, width: 25 },
      D2: { bg: '#0f172a', bgAlpha: 1.0, fg: '#39ff14', fgAlpha: 1.0, width: 25 },
      D3: { bg: '#39ff14', bgAlpha: 1.0, fg: '#000000', fgAlpha: 1.0, width: 25 },
      D4: { bg: '#0f172a', bgAlpha: 1.0, fg: '#39ff14', fgAlpha: 1.0, width: 25 },
      D5: { bg: '#39ff14', bgAlpha: 1.0, fg: '#000000', fgAlpha: 1.0, width: 25 },
      D6: { bg: '#0f172a', bgAlpha: 1.0, fg: '#39ff14', fgAlpha: 1.0, width: 25 },
      D7: { bg: '#39ff14', bgAlpha: 1.0, fg: '#000000', fgAlpha: 1.0, width: 25 },
      S2: { bg: '#ff007f', bgAlpha: 1.0, fg: '#ffffff', fgAlpha: 1.0, width: 25 },
      B: { bg: '#020617', bgAlpha: 0.9, fg: '#94a3b8', fgAlpha: 0.9, width: 25 },
      MINE: { bg: '#9d174d', bgAlpha: 1.0, fg: '#ffffff', fgAlpha: 1.0 },
      INV: { bg: '#f4f4f5', bgAlpha: 0.4, fg: '#000000', fgAlpha: 0.4 },
      OVERLAP: { bg: '#ffffaa', bgAlpha: 1.0, fg: '#bbbb00', fgAlpha: 1.0 },
      SELECT: { bg: '#ffaaaa', bgAlpha: 1.0, fg: '#ff0000', fgAlpha: 1.0 }
    }
  },
  {
    id: 'slate',
    nameKo: '차분한 슬레이트',
    nameEn: 'Slate Gray',
    isBuiltIn: true,
    colors: {
      MSR: { bg: '#000000', bgAlpha: 0.0, fg: '#cbd5e1', fgAlpha: 1.0, width: 25 },
      BPM: { bg: '#000000', bgAlpha: 0.0, fg: '#64748b', fgAlpha: 1.0, width: 25 },
      STOP: { bg: '#000000', bgAlpha: 0.0, fg: '#64748b', fgAlpha: 1.0, width: 25 },
      SCR: { bg: '#000000', bgAlpha: 0.0, fg: '#475569', fgAlpha: 1.0, width: 25 },
      BGA: { bg: '#475569', bgAlpha: 1.0, fg: '#ffffff', fgAlpha: 1.0, width: 25 },
      LYR: { bg: '#475569', bgAlpha: 1.0, fg: '#ffffff', fgAlpha: 1.0, width: 25 },
      POR: { bg: '#475569', bgAlpha: 1.0, fg: '#ffffff', fgAlpha: 1.0, width: 25 },
      S1: { bg: '#475569', bgAlpha: 1.0, fg: '#ffffff', fgAlpha: 1.0, width: 25 },
      A1: { bg: '#cbd5e1', bgAlpha: 1.0, fg: '#0f172a', fgAlpha: 1.0, width: 25 },
      A2: { bg: '#334155', bgAlpha: 1.0, fg: '#cbd5e1', fgAlpha: 1.0, width: 25 },
      A3: { bg: '#cbd5e1', bgAlpha: 1.0, fg: '#0f172a', fgAlpha: 1.0, width: 25 },
      A4: { bg: '#334155', bgAlpha: 1.0, fg: '#cbd5e1', fgAlpha: 1.0, width: 25 },
      A5: { bg: '#cbd5e1', bgAlpha: 1.0, fg: '#0f172a', fgAlpha: 1.0, width: 25 },
      A6: { bg: '#334155', bgAlpha: 1.0, fg: '#cbd5e1', fgAlpha: 1.0, width: 25 },
      A7: { bg: '#cbd5e1', bgAlpha: 1.0, fg: '#0f172a', fgAlpha: 1.0, width: 25 },
      D1: { bg: '#cbd5e1', bgAlpha: 1.0, fg: '#0f172a', fgAlpha: 1.0, width: 25 },
      D2: { bg: '#334155', bgAlpha: 1.0, fg: '#cbd5e1', fgAlpha: 1.0, width: 25 },
      D3: { bg: '#cbd5e1', bgAlpha: 1.0, fg: '#0f172a', fgAlpha: 1.0, width: 25 },
      D4: { bg: '#334155', bgAlpha: 1.0, fg: '#cbd5e1', fgAlpha: 1.0, width: 25 },
      D5: { bg: '#cbd5e1', bgAlpha: 1.0, fg: '#0f172a', fgAlpha: 1.0, width: 25 },
      D6: { bg: '#334155', bgAlpha: 1.0, fg: '#cbd5e1', fgAlpha: 1.0, width: 25 },
      D7: { bg: '#cbd5e1', bgAlpha: 1.0, fg: '#0f172a', fgAlpha: 1.0, width: 25 },
      S2: { bg: '#475569', bgAlpha: 1.0, fg: '#ffffff', fgAlpha: 1.0, width: 25 },
      B: { bg: '#1e293b', bgAlpha: 1.0, fg: '#94a3b8', fgAlpha: 1.0, width: 25 },
      MINE: { bg: '#991b1b', bgAlpha: 1.0, fg: '#ffffff', fgAlpha: 1.0 },
      INV: { bg: '#f4f4f5', bgAlpha: 0.4, fg: '#000000', fgAlpha: 0.4 },
      OVERLAP: { bg: '#ffffaa', bgAlpha: 1.0, fg: '#bbbb00', fgAlpha: 1.0 },
      SELECT: { bg: '#ffaaaa', bgAlpha: 1.0, fg: '#ff0000', fgAlpha: 1.0 }
    }
  }
];

export const SettingsModal = ({ isOpen, onClose, initialTab }: SettingsModalProps) => {
  const { settings, updateSettings } = useEditorStore();
  const [activeTab, setActiveTab] = useState<'general' | 'visual'>('general');
  const [customPresets, setCustomPresets] = useState<ColorPreset[]>([]);
  const [newPresetName, setNewPresetName] = useState('');
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState('custom_active');

  useEffect(() => {
    try {
      const stored = localStorage.getItem('kBMSE_custom_color_presets');
      if (stored) {
        setCustomPresets(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to parse custom presets:", e);
    }
  }, []);

  useEffect(() => {
    if (!settings.customLaneColors) return;
    const allPresets = [...BUILT_IN_PRESETS, ...customPresets];
    const match = allPresets.find(p => {
      if (!p.colors) return false;
      const keys = Object.keys(DEFAULT_LANE_COLORS);
      return keys.every(key => {
        const c1 = settings.customLaneColors[key];
        const c2 = p.colors[key];
        if (!c1 || !c2) return false;
        return (
          c1.bg === c2.bg &&
          c1.bgAlpha === c2.bgAlpha &&
          c1.fg === c2.fg &&
          c1.fgAlpha === c2.fgAlpha
        );
      });
    });

    if (match) {
      setSelectedPresetId(match.id);
    } else {
      setSelectedPresetId('custom_active');
    }
  }, [settings.customLaneColors, customPresets]);

  const handleSavePreset = () => {
    if (!newPresetName.trim()) return;
    const newPresetId = 'custom_' + Date.now();
    const newPreset: ColorPreset = {
      id: newPresetId,
      nameKo: newPresetName.trim(),
      nameEn: newPresetName.trim(),
      colors: settings.customLaneColors,
      isBuiltIn: false
    };
    const updated = [...customPresets, newPreset];
    setCustomPresets(updated);
    localStorage.setItem('kBMSE_custom_color_presets', JSON.stringify(updated));
    setNewPresetName('');
    setIsSavingPreset(false);
    setSelectedPresetId(newPresetId);
  };

  const handleDeletePreset = (id: string) => {
    if (window.confirm(t("이 프리셋을 삭제하시겠습니까?", "Are you sure you want to delete this preset?", "このプリセットを削除しますか？"))) {
      const updated = customPresets.filter(p => p.id !== id);
      setCustomPresets(updated);
      localStorage.setItem('kBMSE_custom_color_presets', JSON.stringify(updated));
      if (selectedPresetId === id) {
        setSelectedPresetId('');
      }
    }
  };

  const handleApplyPreset = (preset: ColorPreset) => {
    const currentColors = settings.customLaneColors || {};
    const updatedColors = { ...preset.colors };

    Object.keys(updatedColors).forEach(key => {
      if (currentColors[key] && currentColors[key].width !== undefined) {
        updatedColors[key] = {
          ...updatedColors[key],
          width: currentColors[key].width
        };
      }
    });

    updateSettings({ customLaneColors: updatedColors });
    setSelectedPresetId(preset.id);
  };

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  if (!isOpen) return null;

  const lang = settings.language;

  // Translation helpers
  const t = (koStr: string, enStr: string, jaStr?: string) => {
    if (lang === 'ko') return koStr;
    if (lang === 'ja') return jaStr || enStr;
    return enStr;
  };

  const handleToggle = (key: keyof EditorSettings) => {
    updateSettings({ [key]: !settings[key] });
  };

  const handleSelect = (key: keyof EditorSettings, val: any) => {
    updateSettings({ [key]: val });
  };

  const handleNumberInput = (key: keyof EditorSettings, val: string, max: number) => {
    if (val === '') {
      updateSettings({ [key]: 0 });
      return;
    }
    let parsed = parseInt(val);
    if (isNaN(parsed)) return;
    if (parsed > max) parsed = max;
    updateSettings({ [key]: parsed });
  };

  const handleNumberBlur = (key: keyof EditorSettings, min: number, max: number) => {
    let currentVal = settings[key] as number;
    if (isNaN(currentVal) || currentVal < min) currentVal = min;
    if (currentVal > max) currentVal = max;
    updateSettings({ [key]: currentVal });
  };

  const laneKeys = [
    // 마디 레인
    { key: 'MSR', label: t('마디 (MEASURE)', 'Measure (MEASURE)', '小節 (MEASURE)') },
    
    // 특수 레인
    { key: 'BPM', label: t('템포 (BPM)', 'Tempo (BPM)', 'テンポ (BPM)') },
    { key: 'STOP', label: t('정지 (STOP)', 'Stop (STOP)', 'ストップ (STOP)') },
    { key: 'SCR', label: t('스크롤 (SCROLL)', 'Scroll (SCROLL)', 'スクロール (SCROLL)') },
    { key: 'BGA', label: t('영상 (BGA)', 'BGA', '画像 (BGA)') },
    { key: 'LYR', label: t('레이어 (LYR)', 'Layer (LYR)', 'レイヤー (LYR)') },
    { key: 'POR', label: t('푸어 (POR)', 'Poor (POR)', 'プア (POR)') },
    
    // 1P 건반
    { key: 'S1', label: t('1P 스크래치 (S1)', '1P Scratch (S1)', '1P 皿 (S1)') },
    { key: 'A1', label: '1P Key 1 (A1)' },
    { key: 'A2', label: '1P Key 2 (A2)' },
    { key: 'A3', label: '1P Key 3 (A3)' },
    { key: 'A4', label: '1P Key 4 (A4)' },
    { key: 'A5', label: '1P Key 5 (A5)' },
    { key: 'A6', label: '1P Key 6 (A6)' },
    { key: 'A7', label: '1P Key 7 (A7)' },
    
    // 2P 건반
    { key: 'D1', label: '2P Key 1 (D1)' },
    { key: 'D2', label: '2P Key 2 (D2)' },
    { key: 'D3', label: '2P Key 3 (D3)' },
    { key: 'D4', label: '2P Key 4 (D4)' },
    { key: 'D5', label: '2P Key 5 (D5)' },
    { key: 'D6', label: '2P Key 6 (D6)' },
    { key: 'D7', label: '2P Key 7 (D7)' },
    { key: 'S2', label: t('2P 스크래치 (S2)', '2P Scratch (S2)', '2P 皿 (S2)') },
    
    // BGM
    { key: 'B', label: t('배경음 (BGM)', 'Background (BGM)', '背景音 (BGM)') },
    
    // 특수 상태 4종
    { key: 'MINE', label: t('지뢰노트 (MINE)', 'Mine Note (MINE)', '지뢰노트 (MINE)') },
    { key: 'INV', label: t('숨김노트 (INV)', 'Invisible Note (INV)', '숨김노트 (INV)') },
    { key: 'OVERLAP', label: t('오류키음색상 (OVERLAP)', 'Overlapping Color (OVERLAP)', '重複ノーツ色 (OVERLAP)') },
    { key: 'SELECT', label: t('선택키음색상 (SELECT)', 'Selected Color (SELECT)', '選択ノーツ色 (SELECT)') }
  ];

  const handleColorChange = (laneKey: string, type: 'bg' | 'fg' | 'gridBg', color: string) => {
    const updatedColors = {
      ...settings.customLaneColors,
      [laneKey]: {
        ...settings.customLaneColors[laneKey],
        [type]: color
      }
    };
    updateSettings({ customLaneColors: updatedColors });
  };

  const handleAlphaChange = (laneKey: string, type: 'bgAlpha' | 'fgAlpha' | 'gridBgAlpha', alphaVal: number) => {
    const updatedColors = {
      ...settings.customLaneColors,
      [laneKey]: {
        ...settings.customLaneColors[laneKey],
        [type]: alphaVal
      }
    };
    updateSettings({ customLaneColors: updatedColors });
  };

  const handleAlphaChangePercent = (laneKey: string, type: 'bgAlpha' | 'fgAlpha' | 'gridBgAlpha', percentStr: string) => {
    if (percentStr === '') {
      handleAlphaChange(laneKey, type, 0);
      return;
    }
    let val = parseInt(percentStr);
    if (isNaN(val)) return;
    if (val < 0) val = 0;
    if (val > 100) val = 100;
    handleAlphaChange(laneKey, type, val / 100);
  };

  const handleAlphaBlurPercent = (laneKey: string, type: 'bgAlpha' | 'fgAlpha' | 'gridBgAlpha') => {
    const currentVal = settings.customLaneColors[laneKey]?.[type] ?? 1.0;
    let clamped = currentVal;
    if (isNaN(clamped) || clamped < 0) clamped = 0;
    if (clamped > 1) clamped = 1;
    handleAlphaChange(laneKey, type, clamped);
  };

  const handleResetColors = () => {
    if (window.confirm(t("모든 레인의 키음 박스 색상을 기본값으로 복원하시겠습니까?", "Are you sure you want to reset all box colors to default?", "すべてのノーツ色をデフォルトにリセットしますか？"))) {
      updateSettings({ customLaneColors: DEFAULT_LANE_COLORS });
    }
  };

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
          width: activeTab === 'visual' ? '920px' : '580px', 
          maxHeight: '85vh', 
          display: 'flex', 
          flexDirection: 'column',
          padding: '0',
          border: '1px solid var(--glass-border)',
          borderRadius: '12px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          background: 'rgba(18, 18, 22, 0.97)',
          backdropFilter: 'blur(20px)',
          transition: 'width 0.2s ease-in-out'
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
            <Sliders size={18} style={{ color: 'var(--accent-color)' }} />
            <h3 style={{ margin: '0', fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {t("설정", "Settings", "設定")}
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

        {/* Inner Content Area */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', height: '400px' }}>
          {/* Sidebar Tabs */}
          <div 
            style={{ 
              width: '160px', 
              borderRight: '1px solid rgba(255,255,255,0.08)', 
              padding: '12px 8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              background: 'rgba(255,255,255,0.01)'
            }}
          >
            <button 
              onClick={() => setActiveTab('general')}
              className={`tool-button ${activeTab === 'general' ? 'active' : ''}`}
              style={{ 
                justifyContent: 'flex-start', 
                gap: '8px', 
                width: '100%',
                padding: '10px 12px',
                fontSize: '0.85rem'
              }}
            >
              <Eye size={16} />
              {t("일반 설정", "General", "一般設定")}
            </button>
            <button 
              onClick={() => setActiveTab('visual')}
              className={`tool-button ${activeTab === 'visual' ? 'active' : ''}`}
              style={{ 
                justifyContent: 'flex-start', 
                gap: '8px', 
                width: '100%',
                padding: '10px 12px',
                fontSize: '0.85rem'
              }}
            >
              <Palette size={16} />
              {t("비주얼 설정", "Visual", "ビジュアル")}
            </button>
          </div>

          {/* Tab Content */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {activeTab === 'general' ? (
              <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Language Select */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                    {t("언어(Language)", "Language", "言語(Language)")}
                  </span>
                  <select
                    value={settings.language}
                    onChange={(e) => handleSelect('language', e.target.value)}
                    style={{
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="ko">한국어</option>
                    <option value="en">English</option>
                    <option value="ja">日本語</option>
                  </select>
                </div>

                {/* Base62 Mode Select */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                    {t("BMS 진법 인식", "BMS Base Mode", "BMS 進数認識")}
                  </span>
                  <select
                    value={settings.base62Mode}
                    onChange={(e) => handleSelect('base62Mode', e.target.value)}
                    style={{
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="auto">{t("자동 판정", "Auto Detect", "自動判定")}</option>
                    <option value="16">{t("16진법 고정 (16-Base)", "16-Base", "16進数固定 (16-Base)")}</option>
                    <option value="36">{t("36진법 고정 (36-Base)", "36-Base", "36進数固定 (36-Base)")}</option>
                    <option value="62">{t("62진법 고정 (62-Base)", "62-Base", "62進数固定 (62-Base)")}</option>
                  </select>
                </div>

                {/* Encoding */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                    {t("문자 인코더", "Text Encoder", "文字エンコーダ")}
                  </span>
                  <select
                    value={settings.encoding}
                    onChange={(e) => handleSelect('encoding', e.target.value)}
                    style={{
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="shift-jis">Shift-JIS (Japanese)</option>
                    <option value="euc-kr">EUC-KR (Korean)</option>
                    <option value="utf-8">UTF-8 (Unicode)</option>
                  </select>
                </div>

                {/* Mouse Wheel Scroll Speed */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                    {t("마우스 휠 스크롤 감도", "Wheel Scroll Amount", "マウスホイールのスク롤감도")}
                  </span>
                  <select
                    value={settings.wheelScrollSize}
                    onChange={(e) => handleSelect('wheelScrollSize', e.target.value)}
                    style={{
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="pixel">{t("픽셀 단위 스무스", "Pixel Smooth", "ピクセル単位スムーズ")}</option>
                    <option value="1">1 마디 (1 Measure)</option>
                    <option value="1/2">1/2 마디</option>
                    <option value="1/3">1/3 마디</option>
                    <option value="1/4">1/4 마디</option>
                    <option value="1/8">1/8 마디</option>
                    <option value="page">{t("화면 페이지 단위", "Page Height", "画面ページ単位")}</option>
                  </select>
                </div>

                {/* Mouse Wheel Click Behavior */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                    {t("마우스 휠버튼 클릭 동작", "Wheel Button Click Behavior", "マウスホイールクリックの動作")}
                  </span>
                  <select
                    value={settings.wheelClickBehavior}
                    onChange={(e) => handleSelect('wheelClickBehavior', e.target.value)}
                    style={{
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="drag">{t("화면 끌어 당기기 (Panning)", "Screen Panning", "画面のドラッグ移動")}</option>
                    <option value="autoscroll">{t("커서 위치 기반 자동 스크롤", "Guided Autoscroll", "カーソル位置に基づく自動スクロール")}</option>
                  </select>
                </div>

                {/* Mouse Wheel Scroll Direction */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                    {t("마우스 휠 스크롤 방향", "Wheel Scroll Direction", "マウスホイール스크ロールの方向")}
                  </span>
                  <select
                    value={settings.scrollDirection}
                    onChange={(e) => handleSelect('scrollDirection', e.target.value)}
                    style={{
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="normal">{t("정방향", "Normal", "正方向")}</option>
                    <option value="reverse">{t("역방향", "Reverse", "逆方向")}</option>
                  </select>
                </div>

                {/* Play preview sound on click */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                      {t("노트 배치/선택 시 키음 재생", "Play keysound on place/select", "ノーツ配置・選択時にキー音再生")}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {t("에디터 내에서 노트 작성 혹은 선택 시 음원을 실시간 출력합니다.", "Plays the corresponding audio preview sample.", "エディタ内でノーツ作成または選択時に音源をリアルタイムで出力します。")}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.playNotePreview}
                    onChange={() => handleToggle('playNotePreview')}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                </div>

                {/* Show keysound filename */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                      {t("건반 내 키음 파일명 텍스트 표시", "Display keysound filenames on notes", "ノーツ内にキー音ファイル名を表示")}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {t("노트 상단에 인덱스 대신 실제 매핑된 오디오 파일명을 표시합니다.", "Shows audio filename instead of value index.", "ノーツ上にインデックスの代わりに実際にマッピングされたオーディオファイル名を表示します。")}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.showKeySoundFileName}
                    onChange={() => handleToggle('showKeySoundFileName')}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                </div>

                {/* Show Scratch on Right */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                      {t("스크래치 레인 우측 배치 (우스크)", "Place Scratch on the right side", "スクラッチレーンを右側に配置")}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {t("1P 및 2P 스크래치 레인을 건반의 가장 우측에 배치합니다.", "Places the scratch lanes on the right of key lanes.", "1Pおよび2Pスクラッチレーンを鍵盤の一番右側に配置します。")}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.scratchOnRight}
                    onChange={() => handleToggle('scratchOnRight')}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                </div>

                {/* LN Write Mode when LNOBJ is defined */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                      {t("LNOBJ 사용 시 롱노트 입력 방식", "LN Write Mode with LNOBJ", "LNOBJ使用時のロングノーツ入力方式")}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {t("LNOBJ가 헤더에 지정되어 있을 때, 롱노트를 그릴 방식을 선택합니다.", "Select the LN method to write when LNOBJ is defined in the header.", "LNOBJがヘッダーに指定されている時、ロングノーツを入力する方式を選択します。")}
                    </span>
                  </div>
                  <select
                    value={settings.lnWriteMode}
                    onChange={(e) => handleSelect('lnWriteMode', e.target.value)}
                    style={{
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="lnobj">{t("LNOBJ 방식", "LNOBJ Mode", "LNOBJ方式")}</option>
                    <option value="channel">{t("채널 방식", "Channel Mode", "チャンネル (Channel) 方式")}</option>
                  </select>
                </div>

                {/* Volume slider */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                      {t("오디오 마스터 볼륨", "Audio Master Volume", "オーディオマスター音量")}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--accent-color)', fontWeight: 600 }}>
                      {settings.volume}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={settings.volume}
                    onChange={(e) => handleSelect('volume', parseInt(e.target.value))}
                    style={{ width: '100%', cursor: 'pointer' }}
                  />
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '20px 20px 10px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
                    {/* Theme select */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{t("에디터 디자인 테마", "Editor Skin Theme", "テーマスキン")}</span>
                      <select
                        value={settings.theme}
                        onChange={(e) => handleSelect('theme', e.target.value)}
                        style={{
                          background: 'var(--bg-secondary)',
                          color: 'var(--text-primary)',
                          border: '1px solid rgba(255,255,255,0.15)',
                          padding: '6px 8px',
                          borderRadius: '4px',
                          fontSize: '0.8rem',
                          outline: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="dark">{t("다크 네이티브", "Deep Dark", "ダーク")}</option>
                        <option value="light">{t("모던 화이트", "Modern Light", "ライト")}</option>
                        <option value="cyberpunk">{t("네온", "Cyberpunk", "ネオン")}</option>
                        <option value="sunset">{t("석양", "Sunset", "夕焼け")}</option>
                        <option value="ocean">{t("바다", "Ocean", "海")}</option>
                        <option value="sakura">{t("벚꽃", "Sakura", "桜")}</option>
                        <option value="forest">{t("숲", "Forest", "森")}</option>
                        <option value="nebula">{t("우주", "Nebula", "星雲")}</option>
                        <option value="midnight">{t("미드나잇 오로라", "Midnight", "極光")}</option>
                        <option value="peach">{t("피치", "Peach", "桃")}</option>
                        <option value="lavender">{t("라벤더", "Lavender", "ラベンダー")}</option>
                        <option value="mint">{t("민트", "Mint", "ミント")}</option>
                        <option value="crimson">{t("크림슨", "Crimson", "クリムゾン")}</option>
                      </select>
                    </div>

                    {/* Note Skin Select */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{t("키음 박스 디자인 입체감", "Note Style Skin", "ノーツの立体感")}</span>
                      <select
                        value={settings.noteSkin}
                        onChange={(e) => handleSelect('noteSkin', e.target.value)}
                        style={{
                          background: 'var(--bg-secondary)',
                          color: 'var(--text-primary)',
                          border: '1px solid rgba(255,255,255,0.15)',
                          padding: '6px 8px',
                          borderRadius: '4px',
                          fontSize: '0.8rem',
                          outline: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="flat">{t("평면 (Flat)", "Flat", "フラット (Flat)")}</option>
                        <option value="gradient">{t("그라데이션 (Gradient)", "Gradient", "グラデーション (Gradient)")}</option>
                        <option value="3d">{t("입체 베벨 (3D Bevel)", "3D Bevel", "立体ベベル (3D Bevel)")}</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    {/* Note Box Height & Font Size Inputs */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                          {t("키음 박스 높이 (픽셀)", "Keysound Box Height (px)", "キー音ボックスの高さ (px)")}
                        </span>
                        <input
                          type="number"
                          min="4"
                          max="40"
                          value={settings.noteHeight ?? 12}
                          onChange={(e) => handleNumberInput('noteHeight', e.target.value, 40)}
                          onBlur={() => handleNumberBlur('noteHeight', 4, 40)}
                          style={{
                            background: 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                            border: '1px solid rgba(255,255,255,0.15)',
                            padding: '5px 8px',
                            borderRadius: '4px',
                            fontSize: '0.8rem',
                            outline: 'none',
                            width: '100%'
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                          {t("박스 글자 크기 (픽셀)", "Font Size (px)", "ボックスの文字サイズ")}
                        </span>
                        <input
                          type="number"
                          min="6"
                          max="24"
                          value={settings.fontSize ?? 10}
                          onChange={(e) => handleNumberInput('fontSize', e.target.value, 24)}
                          onBlur={() => handleNumberBlur('fontSize', 6, 24)}
                          style={{
                            background: 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                            border: '1px solid rgba(255,255,255,0.15)',
                            padding: '5px 8px',
                            borderRadius: '4px',
                            fontSize: '0.8rem',
                            outline: 'none',
                            width: '100%'
                          }}
                        />
                      </div>
                    </div>
                    <div></div>
                  </div>

                  {/* 5가지 세부 격자 투명도 조절 섹션 */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px 16px', marginTop: '4px' }}>
                    {/* Grid Opacity */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                        {t("격자선 투명도", "Grid Line Opacity", "グリッド線の不透明度")} ({Math.round(settings.gridOpacity * 100)}%)
                      </span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={Math.round(settings.gridOpacity * 100)}
                        onChange={(e) => handleSelect('gridOpacity', parseInt(e.target.value) / 100)}
                        style={{ width: '100%', cursor: 'pointer' }}
                      />
                    </div>

                    {/* Aux Grid Opacity */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                        {t("보조격자선 투명도", "Aux Grid Line Opacity", "補助グリッド線の不透明度")} ({Math.round(settings.auxGridOpacity * 100)}%)
                      </span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={Math.round(settings.auxGridOpacity * 100)}
                        onChange={(e) => handleSelect('auxGridOpacity', parseInt(e.target.value) / 100)}
                        style={{ width: '100%', cursor: 'pointer' }}
                      />
                    </div>

                    {/* Measure Line Opacity */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                        {t("마디선 투명도", "Measure Line Opacity", "小節線の不透明度")} ({Math.round(settings.measureLineOpacity * 100)}%)
                      </span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={Math.round(settings.measureLineOpacity * 100)}
                        onChange={(e) => handleSelect('measureLineOpacity', parseInt(e.target.value) / 100)}
                        style={{ width: '100%', cursor: 'pointer' }}
                      />
                    </div>

                    {/* Vertical Line Opacity */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                        {t("세로선 투명도", "Vertical Line Opacity", "縦線の不透明度")} ({Math.round(settings.verticalLineOpacity * 100)}%)
                      </span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={Math.round(settings.verticalLineOpacity * 100)}
                        onChange={(e) => handleSelect('verticalLineOpacity', parseInt(e.target.value) / 100)}
                        style={{ width: '100%', cursor: 'pointer' }}
                      />
                    </div>

                    {/* Sub-Vertical Line Opacity */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                        {t("세부세로선 투명도", "Sub-Vertical Line Opacity", "細部縦線の不透明度")} ({Math.round(settings.subVerticalLineOpacity * 100)}%)
                      </span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={Math.round(settings.subVerticalLineOpacity * 100)}
                        onChange={(e) => handleSelect('subVerticalLineOpacity', parseInt(e.target.value) / 100)}
                        style={{ width: '100%', cursor: 'pointer' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Keysound Box Colors Presets Dropdown */}
                <div style={{ padding: '16px 20px 0 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Palette size={14} className="text-accent" style={{ color: 'var(--accent-color)' }} />
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {t("키음 박스 색상 설정", "Keysound Box Colors", "キー音ボックスの配色設定")}
                      </span>
                    </div>

                    {/* Preset Saving Flow */}
                    {!isSavingPreset ? (
                      <button
                        onClick={() => setIsSavingPreset(true)}
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.75rem'
                        }}
                      >
                        <Plus size={12} />
                        {t("프리셋 저장", "Save Preset", "新規保存")}
                      </button>
                    ) : (
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <input
                          type="text"
                          placeholder={t("프리셋 이름", "Preset Name", "プリセット名")}
                          value={newPresetName}
                          onChange={(e) => setNewPresetName(e.target.value)}
                          style={{
                            background: 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                            border: '1px solid rgba(255,255,255,0.15)',
                            padding: '3px 6px',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            outline: 'none',
                            width: '120px'
                          }}
                        />
                        <button
                          onClick={handleSavePreset}
                          style={{
                            background: 'var(--accent-color)',
                            border: 'none',
                            color: '#ffffff',
                            cursor: 'pointer',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '0.75rem'
                          }}
                        >
                          {t("확인", "Confirm", "確認")}
                        </button>
                        <button
                          onClick={() => setIsSavingPreset(false)}
                          style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '0.75rem'
                          }}
                        >
                          {t("취소", "Cancel", "キャンセル")}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Preset Selector Dropdown */}
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <select
                      value={selectedPresetId}
                      onChange={(e) => {
                        const allPresets = [...BUILT_IN_PRESETS, ...customPresets];
                        const found = allPresets.find(p => p.id === e.target.value);
                        if (found) handleApplyPreset(found);
                      }}
                      style={{
                        flex: 1,
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        padding: '6px 8px',
                        borderRadius: '4px',
                        fontSize: '0.8rem',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="custom_active">{t("사용자 지정 색상", "Custom Colors", "カスタムカラー")}</option>
                      {BUILT_IN_PRESETS.map(p => (
                        <option key={p.id} value={p.id}>{lang === 'ko' ? p.nameKo : p.nameEn}</option>
                      ))}
                      {customPresets.map(p => (
                        <option key={p.id} value={p.id}>{p.nameKo} ({t("사용자", "Custom", "ユーザー")})</option>
                      ))}
                    </select>
                    
                    {/* Delete Custom Preset Button */}
                    {selectedPresetId.startsWith('custom_') && selectedPresetId !== 'custom_active' && (
                      <button
                        onClick={() => handleDeletePreset(selectedPresetId)}
                        style={{
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.2)',
                          color: '#ef4444',
                          cursor: 'pointer',
                          padding: '6px',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Detailed Lane Colors List */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '10px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {laneKeys.map(({ key, label }) => {
                    const colorConfig = settings.customLaneColors?.[key] || DEFAULT_LANE_COLORS[key];
                    if (!colorConfig) return null;

                    return (
                      <div 
                        key={key} 
                        style={{ 
                          display: 'flex', 
                          flexDirection: 'column', 
                          gap: '6px', 
                          padding: '10px', 
                          background: 'rgba(255,255,255,0.02)', 
                          border: '1px solid rgba(255,255,255,0.04)', 
                          borderRadius: '6px' 
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-color)' }}>{label}</span>
                        </div>
                        
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center' }}>
                          {/* Box Background Color Picker & Alpha (박스색) */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              {t("박스색", "Box", "ボックス色")}
                            </span>
                            <div style={{ position: 'relative', width: '20px', height: '20px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.2)', backgroundColor: colorConfig.bg, cursor: 'pointer', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <input
                                type="color"
                                value={colorConfig.bg}
                                onChange={(e) => handleColorChange(key, 'bg', e.target.value)}
                                style={{ position: 'absolute', top: '-5px', left: '-5px', width: '30px', height: '30px', border: 'none', cursor: 'pointer', opacity: 0 }}
                              />
                            </div>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={Math.round(colorConfig.bgAlpha * 100)}
                              onChange={(e) => handleAlphaChangePercent(key, 'bgAlpha', e.target.value)}
                              onBlur={() => handleAlphaBlurPercent(key, 'bgAlpha')}
                              style={{
                                width: '38px',
                                background: 'rgba(255, 255, 255, 0.05)',
                                color: 'var(--text-primary)',
                                border: '1px solid rgba(255,255,255,0.15)',
                                borderRadius: '4px',
                                padding: '2px 0',
                                fontSize: '0.75rem',
                                textAlign: 'center',
                                outline: 'none'
                              }}
                            />
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>%</span>
                          </div>

                          {/* Font Color Picker & Alpha */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              {t("글꼴색", "Font", "フォント色")}
                            </span>
                            <div style={{ position: 'relative', width: '20px', height: '20px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.2)', backgroundColor: colorConfig.fg, cursor: 'pointer', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <input
                                type="color"
                                value={colorConfig.fg}
                                onChange={(e) => handleColorChange(key, 'fg', e.target.value)}
                                style={{ position: 'absolute', top: '-5px', left: '-5px', width: '30px', height: '30px', border: 'none', cursor: 'pointer', opacity: 0 }}
                              />
                            </div>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={Math.round(colorConfig.fgAlpha * 100)}
                              onChange={(e) => handleAlphaChangePercent(key, 'fgAlpha', e.target.value)}
                              onBlur={() => handleAlphaBlurPercent(key, 'fgAlpha')}
                              style={{
                                width: '38px',
                                background: 'rgba(255, 255, 255, 0.05)',
                                color: 'var(--text-primary)',
                                border: '1px solid rgba(255,255,255,0.15)',
                                borderRadius: '4px',
                                padding: '2px 0',
                                fontSize: '0.75rem',
                                textAlign: 'center',
                                outline: 'none'
                              }}
                            />
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>%</span>
                          </div>

                          {/* Grid Background Color Picker & Alpha */}
                          {!['MINE', 'INV', 'OVERLAP', 'SELECT'].includes(key) && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                {t("배경색", "BG", "背景色")}
                              </span>
                              <div style={{ position: 'relative', width: '20px', height: '20px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.2)', backgroundColor: colorConfig.gridBg ?? colorConfig.bg, cursor: 'pointer', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <input
                                  type="color"
                                  value={colorConfig.gridBg ?? colorConfig.bg}
                                  onChange={(e) => handleColorChange(key, 'gridBg', e.target.value)}
                                  style={{ position: 'absolute', top: '-5px', left: '-5px', width: '30px', height: '30px', border: 'none', cursor: 'pointer', opacity: 0 }}
                                />
                              </div>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={Math.round((colorConfig.gridBgAlpha ?? (['MSR', 'BPM', 'STOP', 'SCR'].includes(key) ? 0.0 : 0.15)) * 100)}
                                onChange={(e) => handleAlphaChangePercent(key, 'gridBgAlpha', e.target.value)}
                                onBlur={() => handleAlphaBlurPercent(key, 'gridBgAlpha')}
                                style={{
                                  width: '38px',
                                  background: 'rgba(255, 255, 255, 0.05)',
                                  color: 'var(--text-primary)',
                                  border: '1px solid rgba(255,255,255,0.15)',
                                  borderRadius: '4px',
                                  padding: '2px 0',
                                  fontSize: '0.75rem',
                                  textAlign: 'center',
                                  outline: 'none'
                                }}
                              />
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>%</span>
                            </div>
                          )}

                          {/* Lane Width Input (Only for normal lanes, exclude 4 special ones) */}
                          {!['MINE', 'INV', 'OVERLAP', 'SELECT'].includes(key) && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                {t("너비", "Width", "幅")}
                              </span>
                              <input
                                type="number"
                                min="1"
                                max="150"
                                value={colorConfig.width ?? 25}
                                onChange={(e) => {
                                  let val = parseInt(e.target.value);
                                  if (isNaN(val)) return;
                                  if (val < 1) val = 1;
                                  if (val > 150) val = 150;
                                  const updatedColors = {
                                    ...settings.customLaneColors,
                                    [key]: {
                                      ...settings.customLaneColors[key],
                                      width: val
                                    }
                                  };
                                  updateSettings({ customLaneColors: updatedColors });
                                }}
                                style={{
                                  width: '44px',
                                  background: 'rgba(255, 255, 255, 0.05)',
                                  color: 'var(--text-primary)',
                                  border: '1px solid rgba(255,255,255,0.15)',
                                  borderRadius: '4px',
                                  padding: '2px 0',
                                  fontSize: '0.75rem',
                                  textAlign: 'center',
                                  outline: 'none'
                                }}
                              />
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>px</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Footer Buttons (Reset Colors & Confirm) */}
                <div 
                  style={{ 
                    padding: '12px 20px', 
                    borderTop: '1px solid rgba(255,255,255,0.06)', 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'rgba(0,0,0,0.15)'
                  }}
                >
                  <button
                    onClick={handleResetColors}
                    style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      color: '#ef4444',
                      cursor: 'pointer',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 500
                    }}
                  >
                    {t("초기화", "Reset to Default", "初期化")}
                  </button>
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
                    {t("확인", "Confirm", "確認")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};