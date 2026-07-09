import { BmsData, decodeBmsValue, encodeBmsValue } from '../parser/bmsParser';
import { calculateTimeline } from './timelineCalculator';

export interface BmsValidationError {
  id: string;
  type: 'overlap' | 'near_overlap' | 'ln_pair' | 'ln_overlap' | 'ln_length' | 'lnobj' | 'bpm' | 'stop' | 'scroll' | 'measure' | 'header';
  measure?: number;
  laneName?: string;
  message: string;
  position?: number;
}

/**
 * Validate BMS Data for critical structural integrity and logic violations before save
 * @returns Array of detailed BmsValidationError objects. If empty, validation passed successfully.
 */
export function validateBmsData(bmsData: BmsData, useBase62: 16 | 36 | 62 | boolean): BmsValidationError[] {
  const errors: BmsValidationError[] = [];
  if (!bmsData) return errors;

  const notes = bmsData.notes;
  const timeline = calculateTimeline(bmsData);
  const timeMap = timeline.noteTimeMap;

  // 0. 헤더 및 기본 수치 무결성 검증
  if (!bmsData.header.bpm || bmsData.header.bpm <= 0 || isNaN(bmsData.header.bpm)) {
    errors.push({
      id: crypto.randomUUID(),
      type: 'header',
      message: `[기본 BPM 오류] 헤더의 기본 BPM 값(${bmsData.header.bpm})이 0 이하이거나 유효하지 않습니다.`
    });
  }

  // #BPMxx 목록 검증
  if (bmsData.bpms) {
    for (const kStr in bmsData.bpms) {
      const k = parseInt(kStr);
      if (bmsData.bpms[k] <= 0 || isNaN(bmsData.bpms[k])) {
        errors.push({
          id: crypto.randomUUID(),
          type: 'bpm',
          message: `[BPM 값 오류] #BPM${encodeBmsValue(k, useBase62)}에 정의된 BPM 값(${bmsData.bpms[k]})이 0 이하로 유효하지 않습니다.`
        });
      }
    }
  }

  // #STOPxx 목록 검증
  if (bmsData.stops) {
    for (const kStr in bmsData.stops) {
      const k = parseInt(kStr);
      if (bmsData.stops[k] < 0 || isNaN(bmsData.stops[k])) {
        errors.push({
          id: crypto.randomUUID(),
          type: 'stop',
          message: `[STOP 값 오류] #STOP${encodeBmsValue(k, useBase62)}에 정의된 STOP 값(${bmsData.stops[k]})이 음수이거나 유효하지 않습니다.`
        });
      }
    }
  }

  // 마디 배율 검증
  if (bmsData.measureLengths) {
    for (const mStr in bmsData.measureLengths) {
      const m = parseInt(mStr);
      if (bmsData.measureLengths[m] <= 0 || isNaN(bmsData.measureLengths[m])) {
        errors.push({
          id: crypto.randomUUID(),
          type: 'measure',
          measure: m,
          message: `[마디 배율 오류] 마디 ${m}의 배율 값(${bmsData.measureLengths[m]})이 0 이하로 유효하지 않습니다.`
        });
      }
    }
  }

  // 1. 완전 겹침 (Perfect Overlap) 및 5ms 근접 경고 (Near Overlap) 검사
  const sortedByChannel = [...notes].map(n => ({
    ...n,
    time: timeMap[n.id] ?? 0
  })).sort((a, b) => {
    if (a.channel !== b.channel) return a.channel - b.channel;
    if (a.measure !== b.measure) return a.measure - b.measure;
    if (Math.abs(a.position - b.position) > 1e-9) return a.position - b.position;
    return a.time - b.time;
  });

  for (let i = 0; i < sortedByChannel.length - 1; i++) {
    const a = sortedByChannel[i];
    const b = sortedByChannel[i + 1];
    
    if (a.channel === b.channel) {
      // BGM 채널인 경우 가상 BGM 레이어(index % 100)가 동일할 때만 검사
      if (a.channel === 0x01 && (a.index % 100) !== (b.index % 100)) {
        continue;
      }
      
      const isPerfectOverlap = a.measure === b.measure && Math.abs(a.position - b.position) < 1e-9;
      
      if (isPerfectOverlap) {
        const channelName = getChannelName(a.channel);
        errors.push({
          id: crypto.randomUUID(),
          type: 'overlap',
          measure: a.measure,
          laneName: channelName,
          position: a.position,
          message: `[완전 겹침] 마디 ${a.measure}의 ${channelName} 레인에 동일 위치에 완전히 포개어진 중복 노트가 존재합니다.`
        });
      } else {
        // 플레이 영역 중 '일반' 연주 채널인 경우에만 5ms 이내 근접 검사 (숨김/지뢰 채널 제외)
        const isNormalPlayable = 
          (a.channel >= 0x11 && a.channel <= 0x19) || 
          (a.channel >= 0x21 && a.channel <= 0x29) || 
          (a.channel >= 0x51 && a.channel <= 0x59) || 
          (a.channel >= 0x61 && a.channel <= 0x69);
          
        if (isNormalPlayable) {
          const timeDiff = Math.abs(b.time - a.time);
          if (timeDiff <= 0.005) {
            const channelName = getChannelName(a.channel);
            errors.push({
              id: crypto.randomUUID(),
              type: 'near_overlap' as any,
              measure: a.measure,
              laneName: channelName,
              position: a.position,
              message: `[5ms 이내 근접] 마디 ${a.measure}의 ${channelName} 레인에 매우 가깝게 배치된 일반 노트 쌍이 존재합니다. (시간차: ${(timeDiff * 1000).toFixed(1)}ms)`
            });
          }
        }
      }
    }
  }

  // 2. 전통적 롱노트 채널(51~59, 61~69) 페어 및 시간 구간 정합성 검증
  // 각 롱노트 채널별로 노트가 짝수(시작 노드 - 끝 노드 쌍)를 형성해야 함
  const lnChannels = [
    0x51, 0x52, 0x53, 0x54, 0x55, 0x56, 0x58, 0x59, // 1P 롱노트
    0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x68, 0x69  // 2P 롱노트
  ];
  
  for (const chan of lnChannels) {
    const chanNotes = notes.filter(n => n.channel === chan).sort((a, b) => {
      if (a.measure !== b.measure) return a.measure - b.measure;
      if (Math.abs(a.position - b.position) > 1e-9) return a.position - b.position;
      const timeA = timeMap[a.id] ?? 0;
      const timeB = timeMap[b.id] ?? 0;
      return timeA - timeB;
    });
    
    const laneName = getChannelName(chan);
    if (chanNotes.length % 2 !== 0) {
      errors.push({
        id: crypto.randomUUID(),
        type: 'ln_pair',
        laneName: laneName,
        message: `[롱노트 페어 오류] ${laneName} 레인의 롱노트가 올바르게 닫히지 않았습니다. (총 노트 수가 홀수 개입니다.)`
      });
    } else {
      // 짝수 개일 때, 개별 롱노트 구간의 정상 동작 여부 검사
      for (let i = 0; i < chanNotes.length; i += 2) {
        const startNode = chanNotes[i];
        const endNode = chanNotes[i + 1];
        const startTime = timeMap[startNode.id] ?? 0;
        const endTime = timeMap[endNode.id] ?? 0;

        if (endTime - startTime <= 0.0001) {
          errors.push({
            id: crypto.randomUUID(),
            type: 'ln_length',
            measure: startNode.measure,
            laneName: laneName,
            position: startNode.position,
            message: `[롱노트 길이 오류] 마디 ${startNode.measure}의 ${laneName} 레인 롱노트 길이가 0초 이하로 겹쳐 있거나 극단적으로 짧습니다.`
          });
        }

        if (i > 0) {
          const prevEndNode = chanNotes[i - 1];
          const prevEndTime = timeMap[prevEndNode.id] ?? 0;
          if (startTime < prevEndTime - 0.0001) {
            errors.push({
              id: crypto.randomUUID(),
              type: 'ln_overlap',
              measure: startNode.measure,
              laneName: laneName,
              position: startNode.position,
              message: `[롱노트 구간 중첩] 마디 ${startNode.measure}의 ${laneName} 레인에 서로 오버랩되거나 꼬인 롱노트 구간이 존재합니다.`
            });
          }
        }
      }
    }
  }

  // 3. LNOBJ 무결성 검증 (플레이블 & Invisible 레인)
  const lnObjStr = bmsData.header.lnobj;
  if (lnObjStr) {
    const lnObjVal = decodeBmsValue(lnObjStr, useBase62);
    if (lnObjVal > 0) {
      // 일반 플레이블 및 Invisible 채널 포함
      const playableChannels = [
        0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x18, 0x19, // 1P 플레이블
        0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x28, 0x29, // 2P 플레이블
        0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x38, 0x39, // 1P Invisible
        0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x48, 0x49  // 2P Invisible
      ];
      
      for (const chan of playableChannels) {
        const chanNotes = notes.filter(n => n.channel === chan).sort((a, b) => {
          if (a.measure !== b.measure) return a.measure - b.measure;
          if (Math.abs(a.position - b.position) > 1e-9) return a.position - b.position;
          const timeA = timeMap[a.id] ?? 0;
          const timeB = timeMap[b.id] ?? 0;
          return timeA - timeB;
        });
        
        let lastWasNormal = false;
        
        for (let i = 0; i < chanNotes.length; i++) {
          const note = chanNotes[i];
          const isLnObj = note.value === lnObjVal;
          const laneName = getChannelName(chan);
          
          if (isLnObj) {
            if (!lastWasNormal) {
              errors.push({
                id: crypto.randomUUID(),
                type: 'lnobj',
                measure: note.measure,
                laneName: laneName,
                position: note.position,
                message: `[LNOBJ 논리 오류] 마디 ${note.measure}의 ${laneName} 레인에 선행 시작 노트가 없는 롱노트 종료 LNOBJ 노트가 잘못 배치되어 있습니다.`
              });
            }
            lastWasNormal = false; // LNOBJ 가 왔으므로 다음 노트는 반드시 일반 노트여야 시작점으로 기능함
          } else {
            lastWasNormal = true; // 일반 노트가 왔으므로 다음 LNOBJ 와 페어를 이룰 준비 완료
          }
        }
      }
    }
  }

  // 4. 정의되지 않은 외부 리소스 참조 오류 검증 (BPM / STOP / SCROLL)
  for (const note of notes) {
    // BPM 변경(08) 누락 검사
    if (note.channel === 0x08) {
      if (!bmsData.bpms || bmsData.bpms[note.value] === undefined) {
        errors.push({
          id: crypto.randomUUID(),
          type: 'bpm',
          measure: note.measure,
          position: note.position,
          message: `[BPM 정의 누락] 마디 ${note.measure}에 정의되지 않은 BPM 변경 인덱스 ${encodeBmsValue(note.value, useBase62)}가 사용되었습니다.`
        });
      }
    }

    // STOP(09) 누락 검사
    if (note.channel === 0x09) {
      if (!bmsData.stops || bmsData.stops[note.value] === undefined) {
        errors.push({
          id: crypto.randomUUID(),
          type: 'stop',
          measure: note.measure,
          position: note.position,
          message: `[STOP 정의 누락] 마디 ${note.measure}에 정의되지 않은 STOP 인덱스 ${encodeBmsValue(note.value, useBase62)}가 사용되었습니다.`
        });
      }
    }

    // SCROLL(256 / 0x100) 누락 검사
    if (note.channel === 256) {
      if (!bmsData.scrolls || bmsData.scrolls[note.value] === undefined) {
        errors.push({
          id: crypto.randomUUID(),
          type: 'scroll',
          measure: note.measure,
          position: note.position,
          message: `[SCROLL 정의 누락] 마디 ${note.measure}에 정의되지 않은 SCROLL 인덱스 ${encodeBmsValue(note.value, useBase62)}가 사용되었습니다.`
        });
      }
    }
  }

  return errors;
}

// 채널 ID에 맞춰 한글 레인 명칭을 반환해 주는 헬퍼 함수
function getChannelName(channel: number): string {
  if (channel === 0x01) return "BGM";
  if (channel === 0x16) return "1P 스크래치(S1)";
  if (channel >= 0x11 && channel <= 0x15) return `1P ${channel - 0x10}번 건반`;
  if (channel === 0x18) return "1P 6번 건반";
  if (channel === 0x19) return "1P 7번 건반";
  
  if (channel === 0x26) return "2P 스크래치(S2)";
  if (channel >= 0x21 && channel <= 0x25) return `2P ${channel - 0x20}번 건반`;
  if (channel === 0x28) return "2P 6번 건반";
  if (channel === 0x29) return "2P 7번 건반";

  // Invisible
  if (channel === 0x36) return "1P Invisible 스크래치(S1)";
  if (channel >= 0x31 && channel <= 0x35) return `1P Invisible ${channel - 0x30}번 건반`;
  if (channel === 0x38) return "1P Invisible 6번 건반";
  if (channel === 0x39) return "1P Invisible 7번 건반";
  
  if (channel === 0x46) return "2P Invisible 스크래치(S2)";
  if (channel >= 0x41 && channel <= 0x45) return `2P Invisible ${channel - 0x40}번 건반`;
  if (channel === 0x48) return "2P Invisible 6번 건반";
  if (channel === 0x49) return "2P Invisible 7번 건반";
  
  // 롱노트
  if (channel === 0x56) return "1P 롱 스크래치(LN S1)";
  if (channel >= 0x51 && channel <= 0x55) return `1P 롱 ${channel - 0x50}번 건반`;
  if (channel === 0x58) return "1P 롱 6번 건반";
  if (channel === 0x59) return "1P 롱 7번 건반";
  
  if (channel === 0x66) return "2P 롱 스크래치(LN S2)";
  if (channel >= 0x61 && channel <= 0x65) return `2P 롱 ${channel - 0x60}번 건반`;
  if (channel === 0x68) return "2P 롱 6번 건반";
  if (channel === 0x69) return "2P 롱 7번 건반";
  
  return `채널 ${channel.toString(16).toUpperCase()}`;
}
