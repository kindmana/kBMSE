import { useEffect, useRef } from 'react';
import { BmsData } from '../parser/bmsParser';
import { getAudioContext, stopAllSounds, updateActiveSourcesPlaybackRate } from '../utils/audioPlayer';
import { calculateTimeline } from '../utils/timelineCalculator';
import { useEditorStore } from '../store/editorStore';

const BASE_MEASURE_HEIGHT = 192;
const MIN_SCROLL_Y = -120;

export function usePlaybackController(
  state: {
    isPlaying: boolean;
    playFromBeginning: boolean;
    bmsData: BmsData | null;
    playbackSpeed: number;
    measureOffsets: any;
    zoomY: number;
  },
  actions: {
    scrollY: React.MutableRefObject<number>;
    requestRender: () => void;
  }
) {
  const timelineRef = useRef<any>(null);
  const sortedNotesRef = useRef<any[]>([]);
  const playedNoteIdsRef = useRef<Set<string>>(new Set());
  const isPlayingRef = useRef(false);
  const playStartRealTimeRef = useRef(0);
  const playStartTimeOffsetRef = useRef(0);
  const playbackSpeedRef = useRef(1.0);
  const playStartScrollYRef = useRef(0);

  const { isPlaying, playFromBeginning, bmsData, playbackSpeed, measureOffsets, zoomY } = state;
  const { scrollY, requestRender } = actions;

  // Sync playback status state to ref
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Adjust playback speed on active frame
  useEffect(() => {
    if (isPlayingRef.current) {
      const actx = getAudioContext();
      const now = actx.currentTime;
      
      const elapsed = (now - playStartRealTimeRef.current) * playbackSpeedRef.current + playStartTimeOffsetRef.current;
      
      playStartRealTimeRef.current = now;
      playStartTimeOffsetRef.current = elapsed;
      playbackSpeedRef.current = playbackSpeed;
      
      updateActiveSourcesPlaybackRate(playbackSpeed);
    } else {
      playbackSpeedRef.current = playbackSpeed;
    }
  }, [playbackSpeed]);

  // Recalculate timeline on BMS data change
  useEffect(() => {
    if (bmsData) {
      const timeline = calculateTimeline(bmsData);
      timelineRef.current = timeline;
      
      const sorted = [...bmsData.notes]
        .map(note => ({
          ...note,
          absoluteTime: timeline.noteTimeMap[note.id] ?? 0
        }))
        .sort((a, b) => a.absoluteTime - b.absoluteTime);
      
      sortedNotesRef.current = sorted;
    } else {
      timelineRef.current = null;
      sortedNotesRef.current = [];
    }
    playedNoteIdsRef.current.clear();
  }, [bmsData]);

  // Handle play/pause state transitions
  useEffect(() => {
    if (isPlaying) {
      const actx = getAudioContext();
      if (actx.state === 'suspended') {
        actx.resume();
      }
      
      let startOffset = 0;
      if (playFromBeginning) {
        startOffset = -0.5;
        scrollY.current = MIN_SCROLL_Y;
        requestRender();
      } else {
        const currentMeasureHeight = BASE_MEASURE_HEIGHT * zoomY;
        const targetY = scrollY.current + 80;
        const absolutePosition = targetY / currentMeasureHeight;
        
        let targetMeasure = 0;
        while (targetMeasure < measureOffsets.offsets.length - 1 && measureOffsets.offsets[targetMeasure + 1] <= absolutePosition) {
          targetMeasure++;
        }
        const measureStart = measureOffsets.offsets[targetMeasure];
        const measureLen = bmsData?.measureLengths?.[targetMeasure] ?? 1;
        const position = (absolutePosition - measureStart) / measureLen;
        
        if (timelineRef.current) {
          startOffset = timelineRef.current.positionToTime(targetMeasure, Math.max(0, Math.min(1, position)));
        }
      }
      
      playStartScrollYRef.current = scrollY.current;
      playStartTimeOffsetRef.current = startOffset;
      playStartRealTimeRef.current = -1;
      playedNoteIdsRef.current.clear();
      
      const sorted = sortedNotesRef.current;
      for (const note of sorted) {
        if (note.absoluteTime < startOffset) {
          playedNoteIdsRef.current.add(note.id);
        }
      }
      
      requestRender();
    } else {
      stopAllSounds();
      const state = useEditorStore.getState();
      if (state.isStopRequested) {
        scrollY.current = playStartScrollYRef.current;
        requestRender();
        useEditorStore.setState({ isStopRequested: false });
      }
    }
  }, [isPlaying, playFromBeginning]);

  return {
    timelineRef,
    sortedNotesRef,
    playedNoteIdsRef,
    isPlayingRef,
    playStartRealTimeRef,
    playStartTimeOffsetRef,
    playbackSpeedRef,
    playStartScrollYRef,
  };
}
