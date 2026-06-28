let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
const activeSources: { source: AudioBufferSourceNode; startTime: number; noteId?: string; wavIndex?: number }[] = [];
let activePreviewSource: AudioBufferSourceNode | null = null;

export function getAudioContext(): AudioContext {
  if (typeof window !== 'undefined') {
    const win = window as any;
    if (!win.__kbmse_audioCtx) {
      const actx = new (window.AudioContext || win.webkitAudioContext)();
      const gain = actx.createGain();
      // Load saved volume settings from localStorage
      let savedVolume = 0.8;
      try {
        const stored = localStorage.getItem('kBMSE_editor_settings');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && typeof parsed.volume === 'number') {
            savedVolume = parsed.volume / 100;
          }
        }
      } catch (e) {
        console.error("Failed to load saved volume:", e);
      }
      gain.gain.value = savedVolume;
      gain.connect(actx.destination);
      win.__kbmse_audioCtx = actx;
      win.__kbmse_masterGain = gain;
      console.log(`[AudioContext] Created global singleton AudioContext. State: ${actx.state}`);
    }
    audioCtx = win.__kbmse_audioCtx;
    masterGain = win.__kbmse_masterGain;
  }
  return audioCtx!;
}

export function getMasterGain(): GainNode | null {
  if (typeof window !== 'undefined') {
    return (window as any).__kbmse_masterGain || null;
  }
  return masterGain;
}

/**
 * Scan a user-provided FileSystemDirectoryHandle for audio files
 * and decode them into AudioBuffer objects.
 */
export async function loadAudioFromDirectory(
  dirHandle: FileSystemDirectoryHandle,
  onProgress?: (loaded: number, total: number, name: string) => void
): Promise<Record<string, AudioBuffer>> {
  const ctx = getAudioContext();
  console.log(`[AudioLoader] Starting to load audio from directory. AudioContext state: ${ctx.state}`);
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
      console.log(`[AudioLoader] Resumed AudioContext. Current state: ${ctx.state}`);
    } catch (e) {
      console.error(`[AudioLoader] Failed to resume AudioContext:`, e);
    }
  }

  const buffers: Record<string, AudioBuffer> = {};
  const fileHandles: FileSystemFileHandle[] = [];

  // Recursively collect all audio files
  async function collectFiles(handle: FileSystemDirectoryHandle) {
    for await (const entry of (handle as any).values()) {
      if (entry.kind === 'file') {
        const lowerName = entry.name.toLowerCase();
        if (
          lowerName.endsWith('.wav') ||
          lowerName.endsWith('.ogg') ||
          lowerName.endsWith('.mp3') ||
          lowerName.endsWith('.flac')
        ) {
          fileHandles.push(entry as FileSystemFileHandle);
        }
      } else if (entry.kind === 'directory') {
        await collectFiles(entry as FileSystemDirectoryHandle);
      }
    }
  }

  await collectFiles(dirHandle);

  const totalFiles = fileHandles.length;
  console.log(`[AudioLoader] Found ${totalFiles} audio files to decode.`);
  let loadedCount = 0;

  // Process files (in parallel chunks for performance)
  const CONCURRENCY = 25;
  const chunks: FileSystemFileHandle[][] = [];
  for (let i = 0; i < fileHandles.length; i += CONCURRENCY) {
    chunks.push(fileHandles.slice(i, i + CONCURRENCY));
  }

  for (const chunk of chunks) {
    await Promise.all(
      chunk.map(async (fileHandle) => {
        try {
          const file = await fileHandle.getFile();
          const arrayBuffer = await file.arrayBuffer();
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
          buffers[fileHandle.name.toLowerCase()] = audioBuffer;
        } catch (e) {
          console.error(`[AudioLoader] Failed to decode audio file: ${fileHandle.name}`, e);
        }
      })
    );
    loadedCount += chunk.length;
    if (onProgress) {
      const lastFileName = chunk[chunk.length - 1]?.name || '';
      onProgress(Math.min(loadedCount, totalFiles), totalFiles, lastFileName);
    }
  }

  console.log(`[AudioLoader] Completed decoding. Successfully loaded ${Object.keys(buffers).length} of ${totalFiles} files.`);
  return buffers;
}

/**
 * Play a specific sound buffer at a precise time (relative to AudioContext.currentTime)
 */
export function playSound(
  buffer: AudioBuffer,
  when: number,
  noteId?: string,
  wavIndex?: number,
  offset?: number,
  playbackRate?: number
): AudioBufferSourceNode | null {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    console.warn(`[AudioPlayer] playSound called but AudioContext is suspended. Trying to resume.`);
    ctx.resume().catch(e => console.error(`[AudioPlayer] Failed to resume inside playSound:`, e));
  }

  // Voice Stealing: If the same keysound (wavIndex) is already playing, stop it first
  if (wavIndex !== undefined && wavIndex !== null) {
    const existing = activeSources.find(item => item.wavIndex === wavIndex);
    if (existing) {
      try {
        existing.source.stop(when);
      } catch (e) {
        // Ignore if already stopped
      }
      const idx = activeSources.indexOf(existing);
      if (idx !== -1) {
        activeSources.splice(idx, 1);
      }
    }
  }

  try {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    if (playbackRate !== undefined) {
      source.playbackRate.value = playbackRate;
    }
    if (masterGain) {
      source.connect(masterGain);
    } else {
      source.connect(ctx.destination);
    }

    // Schedule playback with offset if provided
    if (offset !== undefined && offset > 0) {
      source.start(when, offset);
    } else {
      source.start(when);
    }
    
    const activeItem = { source, startTime: when, noteId, wavIndex };
    activeSources.push(activeItem);

    source.onended = () => {
      const idx = activeSources.indexOf(activeItem);
      if (idx !== -1) {
        activeSources.splice(idx, 1);
      }
    };

    return source;
  } catch (e) {
    console.error("Failed to play sound source", e);
    return null;
  }
}

/**
 * Play a preview sound exclusively. If another preview is currently playing,
 * it is stopped immediately before starting the new one.
 */
export function playSoloSound(
  buffer: AudioBuffer,
  when: number
): AudioBufferSourceNode | null {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    ctx.resume().catch(e => console.error(`[AudioPlayer] Failed to resume inside playSoloSound:`, e));
  }

  // Stop previous preview immediately
  if (activePreviewSource) {
    try {
      activePreviewSource.stop();
    } catch (e) {
      // Ignore if already stopped
    }
    activePreviewSource = null;
  }

  try {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    if (masterGain) {
      source.connect(masterGain);
    } else {
      source.connect(ctx.destination);
    }

    source.start(when);
    activePreviewSource = source;

    // Track in activeSources so that stopAllSounds can also stop it
    const activeItem = { source, startTime: when };
    activeSources.push(activeItem);

    source.onended = () => {
      // Remove from activePreviewSource if this is still the active one
      if (activePreviewSource === source) {
        activePreviewSource = null;
      }
      // Remove from activeSources
      const idx = activeSources.indexOf(activeItem);
      if (idx !== -1) {
        activeSources.splice(idx, 1);
      }
    };

    return source;
  } catch (e) {
    console.error("Failed to play solo preview sound source", e);
    return null;
  }
}

/**
 * Stop all active sound sources immediately
 */
export function stopAllSounds() {
  activeSources.forEach((item) => {
    try {
      item.source.stop();
    } catch (e) {
      // Source might have already stopped or not started
    }
  });
  activeSources.length = 0;
}

/**
 * Find an audio buffer matching the given filename.
 * Supports fallback checks (adding common extensions or ignoring casing/extensions).
 */
export function findAudioBuffer(filename: string, audioBuffers: Record<string, AudioBuffer>): AudioBuffer | null {
  const lower = filename.toLowerCase();
  
  // 1. Exact match (including extension)
  if (audioBuffers[lower]) return audioBuffers[lower];

  // 2. Try common extensions if missing
  const extensions = ['.wav', '.ogg', '.mp3', '.flac'];
  for (const ext of extensions) {
    if (audioBuffers[lower + ext]) return audioBuffers[lower + ext];
  }

  // 3. Try to strip extension and match
  const stripExt = (name: string) => {
    const idx = name.lastIndexOf('.');
    return idx !== -1 ? name.substring(0, idx) : name;
  };
  
  const strippedTarget = stripExt(lower);
  const keys = Object.keys(audioBuffers);
  for (const key of keys) {
    if (stripExt(key) === strippedTarget) {
      return audioBuffers[key];
    }
  }

  return null;
}

export function updateActiveSourcesPlaybackRate(speed: number) {
  activeSources.forEach((item) => {
    try {
      item.source.playbackRate.value = speed;
    } catch (e) {
      // Ignore if already stopped or failed
    }
  });
}
