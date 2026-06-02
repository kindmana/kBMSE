/**
 * 가변 마디 및 절대 박자 그리드 환경을 고려한 좌표/시간/스냅 정밀 연산 유틸리티
 */

/**
 * 절대 마디 실수값(absTime)에 현재 격자 박자(gridSnap)를 적용하여 정교하게 스냅된 실수값을 구합니다.
 * Floating-point 오차 보정을 위해 1e-9 마진을 엄격히 고수합니다.
 */
export function getSnappedAbsTime(
  absTime: number,
  gridSnap: number,
  offsets: number[],
  measureLengths: Record<number, number>
): number {
  if (offsets.length === 0) return absTime;

  let m = 0;
  while (m < offsets.length - 1 && offsets[m + 1] <= absTime) {
    m++;
  }
  const start = offsets[m] ?? 0;
  const len = measureLengths[m] ?? 1;
  
  const snap = gridSnap;
  const offsetVal = absTime - start;
  let snappedOffset = Math.round(offsetVal * snap) / snap;
  
  if (snappedOffset >= len - 1e-9) {
    // 다음 마디의 시작점 앵커로 정밀 스냅
    return offsets[m + 1] ?? (start + len);
  }
  
  return start + snappedOffset;
}

/**
 * 특정 measure, position 위치를 가변 마디 환경을 고려한 절대 마디 길이(absTime) 실수로 구합니다.
 */
export function getAbsTime(
  measure: number,
  position: number,
  measureLengths: Record<number, number>,
  offsets: number[]
): number {
  const measureStart = offsets[measure] ?? 0;
  const measureLen = measureLengths[measure] ?? 1;
  return measureStart + position * measureLen;
}

/**
 * absoluteTime 실수(absTime)를 가변 마디 환경에 맞추어 { measure, position } 구조로 역변환합니다.
 */
export function getBmsPosFromAbsTime(
  absTime: number,
  measureLengths: Record<number, number>,
  offsets: number[]
): { measure: number; position: number } {
  if (offsets.length === 0) {
    return { measure: 0, position: 0 };
  }

  let m = 0;
  while (m < offsets.length - 1 && offsets[m + 1] <= absTime) {
    m++;
  }
  const start = offsets[m] ?? 0;
  const len = measureLengths[m] ?? 1;
  const rawPos = (absTime - start) / len;
  
  // 소수점 스냅 오차 보정 처리
  const position = Math.max(0, Math.min(1, rawPos));
  
  return { measure: m, position };
}
