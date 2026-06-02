import { BmsData } from '../parser/bmsParser';

export interface TimelineEvent {
  measure: number;
  position: number; // 0.0 ~ 1.0 within the measure
  beatOffset: number; // Cumulative beats from the beginning
  time: number; // Absolute time in seconds from the beginning
  type: 'bpm' | 'stop';
  value: number;
}

export interface MeasureTimeInfo {
  measure: number;
  startBeat: number;
  startTime: number;
  lengthScale: number;
  bpm: number;
}

export interface BmsTimeline {
  events: TimelineEvent[];
  measures: MeasureTimeInfo[];
  noteTimeMap: Record<string, number>; // Maps note.id -> absolute time in seconds
  totalDuration: number;
  
  // Helpers
  timeToPosition: (time: number) => { measure: number; position: number };
  positionToTime: (measure: number, position: number) => number;
}

/**
 * Calculates a complete timeline map for a given BMS data.
 * Translates grid coordinates (measure, position) into physical time (seconds).
 */
export function calculateTimeline(bmsData: BmsData): BmsTimeline {
  const defaultBpm = bmsData.header.bpm ?? 130.0;
  const measureLengths = bmsData.measureLengths ?? {};
  
  // Collect all BPM and STOP events
  interface RawEvent {
    measure: number;
    position: number;
    type: 'bpm' | 'stop';
    value: number;
  }

  const rawEvents: RawEvent[] = [];

  // Parse direct BPM changes (Channel 03) and custom BPM changes (Channel 08)
  bmsData.notes.forEach(note => {
    if (note.channel === 0x03) {
      // 16-base hex string in raw bms data, but let's assume it was parsed into numerical value in note.value
      // Note value is usually decimal or parsed float
      rawEvents.push({
        measure: note.measure,
        position: note.position,
        type: 'bpm',
        value: note.value
      });
    } else if (note.channel === 0x08) {
      // Extended BPM change (#BPMxx)
      // note.value refers to index, let's find float value in bmsData.header.bpms[value] or fallback to note.value if not mapped
      const bpmVal = bmsData.bpms?.[note.value] ?? note.value;
      rawEvents.push({
        measure: note.measure,
        position: note.position,
        type: 'bpm',
        value: bpmVal
      });
    } else if (note.channel === 0x09) {
      // STOP change (#STOPxx)
      const stopVal = bmsData.stops?.[note.value] ?? note.value;
      rawEvents.push({
        measure: note.measure,
        position: note.position,
        type: 'stop',
        value: stopVal
      });
    }
  });

  // Sort raw events chronologically (by measure, then by position)
  rawEvents.sort((a, b) => {
    if (a.measure !== b.measure) return a.measure - b.measure;
    return a.position - b.position;
  });

  // Unique chronological events list
  const events: TimelineEvent[] = [];
  const measures: MeasureTimeInfo[] = [];

  let currentBpm = defaultBpm;
  let currentTime = 0.0;
  let currentBeat = 0.0;

  // We will process measure by measure to build measureTimeMap
  const maxMeasure = Math.max(
    ...bmsData.notes.map(n => n.measure),
    100 // At least 100 measures
  );

  let eventIdx = 0;

  for (let m = 0; m <= maxMeasure + 10; m++) {
    const scale = measureLengths[m] ?? 1.0;
    const measureBeats = 4.0 * scale; // 4 beats per standard measure
    
    measures.push({
      measure: m,
      startBeat: currentBeat,
      startTime: currentTime,
      lengthScale: scale,
      bpm: currentBpm
    });

    // Find and process events that occur inside this measure
    const measureEvents: RawEvent[] = [];
    while (eventIdx < rawEvents.length && rawEvents[eventIdx].measure === m) {
      measureEvents.push(rawEvents[eventIdx]);
      eventIdx++;
    }

    // Sort events within this measure by position
    measureEvents.sort((a, b) => a.position - b.position);

    let lastPos = 0.0;

    measureEvents.forEach(evt => {
      const posDelta = evt.position - lastPos;
      if (posDelta > 0) {
        const beatDelta = posDelta * measureBeats;
        const timeDelta = beatDelta * (60.0 / currentBpm);
        currentTime += timeDelta;
        currentBeat += beatDelta;
      }
      lastPos = evt.position;

      if (evt.type === 'bpm') {
        currentBpm = evt.value;
        events.push({
          measure: evt.measure,
          position: evt.position,
          beatOffset: currentBeat,
          time: currentTime,
          type: 'bpm',
          value: currentBpm
        });
      } else if (evt.type === 'stop') {
        events.push({
          measure: evt.measure,
          position: evt.position,
          beatOffset: currentBeat,
          time: currentTime,
          type: 'stop',
          value: evt.value
        });
        // STOP stops time, standard definition: STOP value = 1 means 1/192nd of a standard bar.
        // Standard bar has 4 beats, so 1/192nd of a bar is 4/192 = 1/48th of a beat.
        // Time stoppage = (value / 192) * (4 * 60 / BPM)
        const stopTime = (evt.value / 192.0) * (4.0 * 60.0 / currentBpm);
        currentTime += stopTime;
      }
    });

    // Remainder of the measure
    const remainingPos = 1.0 - lastPos;
    if (remainingPos > 0) {
      const beatDelta = remainingPos * measureBeats;
      const timeDelta = beatDelta * (60.0 / currentBpm);
      currentTime += timeDelta;
      currentBeat += beatDelta;
    }
  }

  // Calculate note times
  const noteTimeMap: Record<string, number> = {};
  
  bmsData.notes.forEach(note => {
    noteTimeMap[note.id] = positionToTimeInternal(note.measure, note.position, measures, events);
  });

  function positionToTimeInternal(
    m: number,
    pos: number,
    measuresList: MeasureTimeInfo[],
    eventsList: TimelineEvent[]
  ): number {
    const mInfo = measuresList[m];
    if (!mInfo) return 0.0;

    const measureBeats = 4.0 * mInfo.lengthScale;
    let time = mInfo.startTime;
    let bpm = mInfo.bpm;

    // Filter events in the same measure that happen BEFORE this note's position
    const priorEvents = eventsList.filter(e => e.measure === m && e.position < pos);
    
    // Sort chronologically
    priorEvents.sort((a, b) => a.position - b.position);

    let lastP = 0.0;
    priorEvents.forEach(evt => {
      const deltaP = evt.position - lastP;
      const beatDelta = deltaP * measureBeats;
      time += beatDelta * (60.0 / bpm);
      
      if (evt.type === 'bpm') {
        bpm = evt.value;
      } else if (evt.type === 'stop') {
        const stopTime = (evt.value / 192.0) * (4.0 * 60.0 / bpm);
        time += stopTime;
      }
      lastP = evt.position;
    });

    const finalDeltaP = pos - lastP;
    if (finalDeltaP > 0) {
      const beatDelta = finalDeltaP * measureBeats;
      time += beatDelta * (60.0 / bpm);
    }

    return time;
  }

  // Build helper functions
  const positionToTime = (m: number, pos: number): number => {
    return positionToTimeInternal(m, pos, measures, events);
  };

  const timeToPosition = (t: number): { measure: number; position: number } => {
    if (t < 0) {
      const mInfo = measures[0] || { lengthScale: 1.0, bpm: 130.0 };
      const measureBeats = 4.0 * mInfo.lengthScale;
      const measureTime = measureBeats * (60.0 / mInfo.bpm);
      const position = t / measureTime;
      return { measure: 0, position };
    }

    // Linear search across measures to find where time 't' lies
    let targetM = 0;
    for (let i = 0; i < measures.length; i++) {
      if (i === measures.length - 1 || (t >= measures[i].startTime && t < measures[i + 1].startTime)) {
        targetM = i;
        break;
      }
    }

    const mInfo = measures[targetM];
    const measureBeats = 4.0 * mInfo.lengthScale;
    let accumulatedTime = mInfo.startTime;
    let currentBpmInMeasure = mInfo.bpm;
    
    // Events in this measure
    const measureEvents = events.filter(e => e.measure === targetM);
    measureEvents.sort((a, b) => a.position - b.position);

    let lastP = 0.0;
    for (const evt of measureEvents) {
      const deltaP = evt.position - lastP;
      const beatDelta = deltaP * measureBeats;
      const timeStep = beatDelta * (60.0 / currentBpmInMeasure);
      
      if (t < accumulatedTime + timeStep) {
        // Time lies in this step
        const ratio = (t - accumulatedTime) / timeStep;
        return {
          measure: targetM,
          position: lastP + deltaP * ratio
        };
      }
      accumulatedTime += timeStep;
      
      if (evt.type === 'bpm') {
        currentBpmInMeasure = evt.value;
      } else if (evt.type === 'stop') {
        const stopTime = (evt.value / 192.0) * (4.0 * 60.0 / currentBpmInMeasure);
        if (t < accumulatedTime + stopTime) {
          // Time lies within the STOP pause duration
          return { measure: targetM, position: evt.position };
        }
        accumulatedTime += stopTime;
      }
      lastP = evt.position;
    }

    // Remainder of the measure
    const remainingPos = 1.0 - lastP;
    const remainingBeats = remainingPos * measureBeats;
    const remainingTime = remainingBeats * (60.0 / currentBpmInMeasure);

    if (t >= accumulatedTime + remainingTime) {
      return { measure: targetM, position: 1.0 };
    }

    const ratio = (t - accumulatedTime) / remainingTime;
    return {
      measure: targetM,
      position: lastP + remainingPos * ratio
    };
  };

  return {
    events,
    measures,
    noteTimeMap,
    totalDuration: currentTime,
    timeToPosition,
    positionToTime
  };
}
