import { BmsData, BmsNote } from '../parser/bmsParser';
import { useEditorStore } from '../store/editorStore';
import { getAbsTime, getBmsPosFromAbsTime } from '../utils/coordinateCalculator';

export interface TimeEditContext {
  bmsData: BmsData | null;
  timeSelection: { start: number; end: number } | null;
  measureOffsets: { offsets: number[]; totalLen: number; maxM: number };
  longNotePairs: { start: BmsNote; end: BmsNote }[];
  hasNotesInsideStopArea: boolean;
}

export interface TimeEditActions {
  commitHistory: () => void;
  setTimeSelection: (sel: { start: number; end: number } | null) => void;
  requestRender: () => void;
}

/**
 * 시간편집(Time Edit, F1) 모드 전용 3종 비즈니스 알고리즘 커스텀 훅
 * - 공간 삽입/삭제 (Space)
 * - BPM 고무줄 스트레칭 (BPM Stretch)
 * - STOP 구간 추가 및 유동 마디 삭감 (STOP Add)
 * 
 * 가변 마디 absolute beat snap 기믹 및 이력 상태 저장 구조가 안전하게 유지되도록
 * deep copy 불변성 규칙을 완벽하게 수호합니다.
 */
export function useTimeEditOperations(
  ctx: TimeEditContext,
  actions: TimeEditActions
) {
  const { bmsData, timeSelection, measureOffsets, longNotePairs, hasNotesInsideStopArea } = ctx;
  const { commitHistory, setTimeSelection, requestRender } = actions;

  // 1. 공간 삽입/삭제 (Space Option)
  const handleApplyTimeSpace = (mode: 'insert' | 'remove') => {
    if (!timeSelection || !bmsData) return;
    const { start: startAbs, end: endAbs } = timeSelection;
    const duration = endAbs - startAbs;
    const offsets = measureOffsets.offsets;
    const measureLengths = bmsData.measureLengths || {};

    const notes = bmsData.notes;
    const newBmsData: BmsData = {
      ...bmsData,
      measureLengths: { ...(bmsData.measureLengths || {}) }
    };
    const newNotes: BmsNote[] = [];

    if (mode === 'insert') {
      notes.forEach(note => {
        const noteAbs = getAbsTime(note.measure, note.position, measureLengths, offsets);
        if (noteAbs >= startAbs - 1e-9) {
          const newAbs = noteAbs + duration;
          const newPos = getBmsPosFromAbsTime(newAbs, measureLengths, offsets);
          newNotes.push({
            ...note,
            measure: newPos.measure,
            position: newPos.position
          });
        } else {
          newNotes.push(note);
        }
      });
    } else {
      // 공간 삭제 (Remove Space)
      const candidateRemoveIds = new Set<string>();
      notes.forEach(note => {
        const noteAbs = getAbsTime(note.measure, note.position, measureLengths, offsets);
        if (noteAbs > startAbs + 1e-9 && noteAbs <= endAbs + 1e-9) {
          candidateRemoveIds.add(note.id);
        }
      });

      // 롱노트 고아(Orphan) 방지 연쇄 클렌징
      const finalRemoveIds = new Set<string>(candidateRemoveIds);
      let beforeSize: number;
      do {
        beforeSize = finalRemoveIds.size;
        longNotePairs.forEach(pair => {
          if (finalRemoveIds.has(pair.start.id) || finalRemoveIds.has(pair.end.id)) {
            finalRemoveIds.add(pair.start.id);
            finalRemoveIds.add(pair.end.id);
          }
        });
      } while (finalRemoveIds.size !== beforeSize);

      notes.forEach(note => {
        if (finalRemoveIds.has(note.id)) return;

        const noteAbs = getAbsTime(note.measure, note.position, measureLengths, offsets);
        if (noteAbs > endAbs - 1e-9) {
          const newAbs = Math.max(startAbs, noteAbs - duration);
          const newPos = getBmsPosFromAbsTime(newAbs, measureLengths, offsets);
          newNotes.push({
            ...note,
            measure: newPos.measure,
            position: newPos.position
          });
        } else {
          newNotes.push(note);
        }
      });
    }

    newBmsData.notes = newNotes;
    useEditorStore.setState({ bmsData: newBmsData });
    commitHistory();
    setTimeSelection(null);
    requestRender();
  };

  // 2. BPM 일괄 변경 (BPM 고무줄 타임 스트레칭)
  const handleApplyTimeBpm = (multiplyMode: boolean, value: number) => {
    if (!timeSelection || !bmsData) return;
    const { start: startAbs, end: endAbs } = timeSelection;
    const duration = endAbs - startAbs;
    if (duration <= 0) return;

    const offsets = measureOffsets.offsets;
    const measureLengths = bmsData.measureLengths || {};

    // 특정 absTime 시점의 유효한 실시간 BPM을 획득하는 내부 헬퍼
    const getActiveBpmAt = (absTime: number, bms: BmsData): number => {
      let activeBpm = bms.header.bpm || 130;
      let bestAbs = -1;
      bms.notes.forEach(note => {
        if (note.channel !== 0x03 && note.channel !== 0x08) return;
        const noteAbs = getAbsTime(note.measure, note.position, measureLengths, offsets);
        if (noteAbs <= absTime + 1e-9 && noteAbs > bestAbs) {
          bestAbs = noteAbs;
          if (note.channel === 0x03) {
            activeBpm = note.value;
          } else {
            activeBpm = bms.bpms?.[note.value] ?? activeBpm;
          }
        }
      });
      return activeBpm;
    };

    const originalStartBpm = getActiveBpmAt(startAbs, bmsData);
    const originalEndBpm = getActiveBpmAt(endAbs, bmsData);

    const ratio = multiplyMode ? value : (value / originalStartBpm);
    if (ratio <= 0 || isNaN(ratio)) return;

    const newDuration = duration * ratio;
    const diff = newDuration - duration;

    const updatesArray: { id: string, updates: Partial<BmsNote> }[] = [];
    const notesToAdd: BmsNote[] = [];
    const newBmsData: BmsData = { 
      ...bmsData,
      bpms: { ...(bmsData.bpms || {}) }
    };

    const registerBpmValue = (bms: BmsData, val: number): number => {
      let targetIdx = -1;
      const entries = Object.entries(bms.bpms || {});
      for (const [k, v] of entries) {
        if (Math.abs(v - val) < 1e-7) {
          targetIdx = parseInt(k);
          break;
        }
      }
      if (targetIdx === -1) {
        let nextIdx = 1;
        while (bms.bpms[nextIdx] !== undefined) {
          nextIdx++;
        }
        bms.bpms[nextIdx] = val;
        targetIdx = nextIdx;
      }
      return targetIdx;
    };

    const existingBpmAbsTimes = new Set<string>();
    const rawNotes = bmsData.notes;

    rawNotes.forEach(note => {
      const noteAbs = getAbsTime(note.measure, note.position, measureLengths, offsets);

      if (noteAbs < startAbs - 1e-9) {
        return;
      }

      if (noteAbs >= startAbs - 1e-9 && noteAbs <= endAbs + 1e-9) {
        // 드래그 내부 구간: 고무줄 스트레칭 연산
        const newAbs = startAbs + (noteAbs - startAbs) * ratio;
        const newPos = getBmsPosFromAbsTime(newAbs, measureLengths, offsets);

        if (note.channel === 0x03 || note.channel === 0x08) {
          let curBpm = 0;
          if (note.channel === 0x03) {
            curBpm = note.value;
          } else {
            curBpm = bmsData.bpms?.[note.value] ?? 0;
          }

          if (curBpm > 0) {
            const newBpm = curBpm * ratio;
            if (Number.isInteger(newBpm) && newBpm >= 1 && newBpm <= 255) {
              updatesArray.push({
                id: note.id,
                updates: {
                  measure: newPos.measure,
                  position: newPos.position,
                  channel: 0x03,
                  value: newBpm
                }
              });
            } else {
              const newIdx = registerBpmValue(newBmsData, newBpm);
              updatesArray.push({
                id: note.id,
                updates: {
                  measure: newPos.measure,
                  position: newPos.position,
                  channel: 0x08,
                  value: newIdx
                }
              });
            }
            existingBpmAbsTimes.add(newAbs.toFixed(6));
          }
        } else {
          updatesArray.push({
            id: note.id,
            updates: {
              measure: newPos.measure,
              position: newPos.position
            }
          });
        }
      } else {
        // 드래그 이후 구간: 밀려난 길이만큼 오프셋 가산
        const newAbs = noteAbs + diff;
        const newPos = getBmsPosFromAbsTime(newAbs, measureLengths, offsets);
        updatesArray.push({
          id: note.id,
          updates: {
            measure: newPos.measure,
            position: newPos.position
          }
        });
      }
    });

    // 시작점에 배속 가중치용 신규 BPM 생성 배치
    if (!existingBpmAbsTimes.has(startAbs.toFixed(6))) {
      const newBpm = originalStartBpm * ratio;
      const startPos = getBmsPosFromAbsTime(startAbs, measureLengths, offsets);
      
      let startChan = 0x03;
      let startVal = newBpm;
      if (!Number.isInteger(newBpm) || newBpm < 1 || newBpm > 255) {
        startChan = 0x08;
        startVal = registerBpmValue(newBmsData, newBpm);
      }

      notesToAdd.push({
        id: crypto.randomUUID(),
        measure: startPos.measure,
        position: startPos.position,
        channel: startChan,
        index: 0,
        value: startVal
      });
    }

    // 끝점에 원래 템포로의 복원용 BPM 배치
    const endRestoredAbs = startAbs + newDuration;
    const endPos = getBmsPosFromAbsTime(endRestoredAbs, measureLengths, offsets);
    
    let endChan = 0x03;
    let endVal = originalEndBpm;
    if (!Number.isInteger(originalEndBpm) || originalEndBpm < 1 || originalEndBpm > 255) {
      endChan = 0x08;
      endVal = registerBpmValue(newBmsData, originalEndBpm);
    }

    notesToAdd.push({
      id: crypto.randomUUID(),
      measure: endPos.measure,
      position: endPos.position,
      channel: endChan,
      index: 0,
      value: endVal
    });

    const updateMap = new Map(updatesArray.map(u => [u.id, u.updates]));
    const finalNotes = newBmsData.notes.map(n => {
      const updates = updateMap.get(n.id);
      return updates ? { ...n, ...updates } : n;
    });
    newBmsData.notes = [...finalNotes, ...notesToAdd];

    useEditorStore.setState({ bmsData: newBmsData });
    commitHistory();
    setTimeSelection(null);
    requestRender();
  };

  // 3. STOP 구간 추가 (유동적 마디 삭감 및 STOP 이벤트 배치)
  const handleApplyTimeStop = () => {
    if (!timeSelection || !bmsData) return;
    if (hasNotesInsideStopArea) return;
    const { start: startAbs, end: endAbs } = timeSelection;
    const duration = endAbs - startAbs;
    if (duration <= 0) return;

    const offsets = measureOffsets.offsets;
    const measureLengths = bmsData.measureLengths || {};

    const notes = bmsData.notes;
    const newBmsData: BmsData = { 
      ...bmsData,
      measureLengths: { ...(bmsData.measureLengths || {}) },
      stops: { ...(bmsData.stops || {}) }
    };

    const registerStopValue = (bms: BmsData, value: number): number => {
      let targetIdx = -1;
      const entries = Object.entries(bms.stops || {});
      for (const [k, v] of entries) {
        if (Math.abs(v - value) < 1e-7) {
          targetIdx = parseInt(k);
          break;
        }
      }
      if (targetIdx === -1) {
        let nextIdx = 1;
        while (bms.stops[nextIdx] !== undefined) {
          nextIdx++;
        }
        bms.stops[nextIdx] = value;
        targetIdx = nextIdx;
      }
      return targetIdx;
    };

    if (!newBmsData.measureLengths) newBmsData.measureLengths = {};
    const noteMax = bmsData.notes.length > 0 ? Math.max(...bmsData.notes.map(n => n.measure)) : 0;
    const lengthMax = Object.keys(bmsData.measureLengths).length > 0 ? Math.max(...Object.keys(bmsData.measureLengths).map(Number)) : 0;
    const maxM = Math.max(100, noteMax, lengthMax);

    // 겹쳐지는 구간만큼 마디 크기 유동적 감축
    for (let m = 0; m <= maxM; m++) {
      const currentLen = bmsData.measureLengths[m] ?? 1.0;
      const mStart = offsets[m] ?? 0;
      const mEnd = mStart + currentLen;

      const interStart = Math.max(mStart, startAbs);
      const interEnd = Math.min(mEnd, endAbs);
      const overlapLen = Math.max(0, interEnd - interStart);

      if (overlapLen > 1e-9) {
        const newLen = Math.max(0, currentLen - overlapLen);
        if (newLen < 1e-6) {
          newBmsData.measureLengths[m] = 0.0;
        } else {
          newBmsData.measureLengths[m] = newLen;
        }
      }
    }

    const newOffsets: number[] = [];
    let newCurrentOffset = 0;
    for (let m = 0; m <= maxM + 10; m++) {
      newOffsets.push(newCurrentOffset);
      const len = newBmsData.measureLengths[m] ?? 1.0;
      newCurrentOffset += len;
    }

    const candidateRemoveIds = new Set<string>();
    notes.forEach(note => {
      const noteAbs = getAbsTime(note.measure, note.position, measureLengths, offsets);
      if (noteAbs > startAbs + 1e-9 && noteAbs <= endAbs + 1e-9) {
        candidateRemoveIds.add(note.id);
      }
    });

    const finalRemoveIds = new Set<string>(candidateRemoveIds);
    let beforeSize: number;
    do {
      beforeSize = finalRemoveIds.size;
      longNotePairs.forEach(pair => {
        if (finalRemoveIds.has(pair.start.id) || finalRemoveIds.has(pair.end.id)) {
          finalRemoveIds.add(pair.start.id);
          finalRemoveIds.add(pair.end.id);
        }
      });
    } while (finalRemoveIds.size !== beforeSize);

    const newNotes: BmsNote[] = [];

    // 뒤쪽 노트들을 당기고 새로운 마디 오프셋 맵(newOffsets) 기준 재매핑
    notes.forEach(note => {
      if (finalRemoveIds.has(note.id)) return;

      const noteAbs = getAbsTime(note.measure, note.position, measureLengths, offsets);
      if (noteAbs > endAbs - 1e-9) {
        const newAbs = Math.max(startAbs, noteAbs - duration);
        const newPos = getBmsPosFromAbsTime(newAbs, newBmsData.measureLengths, newOffsets);
        newNotes.push({
          ...note,
          measure: newPos.measure,
          position: newPos.position
        });
      } else {
        newNotes.push(note);
      }
    });

    const stopValue = duration * 192;
    const stopIdx = registerStopValue(newBmsData, stopValue);

    // 09 STOP 채널 노트 신규 삽입
    const startPos = getBmsPosFromAbsTime(startAbs, newBmsData.measureLengths, newOffsets);
    const newStopNote: BmsNote = {
      id: crypto.randomUUID(),
      measure: startPos.measure,
      position: startPos.position,
      channel: 0x09,
      index: 0,
      value: stopIdx
    };
    newNotes.push(newStopNote);

    newBmsData.notes = newNotes;

    console.log("[Diagnostic] handleApplyTimeStop. original measureLengths:", bmsData.measureLengths, "new measureLengths:", newBmsData.measureLengths);

    useEditorStore.setState({ bmsData: newBmsData });
    commitHistory();
    setTimeSelection(null);
    requestRender();
  };

  return {
    handleApplyTimeSpace,
    handleApplyTimeBpm,
    handleApplyTimeStop
  };
}
