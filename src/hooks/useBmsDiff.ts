import { useState, useEffect, useRef } from 'react';
import { BmsData } from '../parser/bmsParser';

/**
 * 엇갈림 검사(BMS Diff) 전용 상태 및 라이프사이클 초기화 캐시 훅
 * - 기준 BMS 데이터, 기준 파일명, 비교 결과 리스트, 비교 성공 플래그 관리
 * - 사용자가 에디터 수정을 가하여 historyIndex가 가변될 시 안전하게 기존 분석 캐시 무효화
 */
export function useBmsDiff(historyIndex: number) {
  const [diffBaseBms, setDiffBaseBms] = useState<BmsData | null>(null);
  const [diffBaseFileName, setDiffBaseFileName] = useState<string>('');
  const [diffResults, setDiffResults] = useState<any[]>([]);
  const [diffIsCompared, setDiffIsCompared] = useState<boolean>(false);
  const diffCheckHistoryIndex = useRef<number | null>(null);

  // 사용자가 수정을 가하여 historyIndex가 바뀔 때, 이전 분석 데이터를 무효화 초기화 처리
  useEffect(() => {
    if (diffIsCompared && diffCheckHistoryIndex.current !== null && historyIndex !== diffCheckHistoryIndex.current) {
      setDiffBaseBms(null);
      setDiffBaseFileName('');
      setDiffResults([]);
      setDiffIsCompared(false);
      diffCheckHistoryIndex.current = null;
    }
  }, [historyIndex, diffIsCompared]);

  // 강제 초기화 트리거
  const resetDiff = () => {
    setDiffBaseBms(null);
    setDiffBaseFileName('');
    setDiffResults([]);
    setDiffIsCompared(false);
    diffCheckHistoryIndex.current = null;
  };

  // 비교 완료 시점 앵커링 마크
  const markCompared = (currentHistoryIdx: number) => {
    setDiffIsCompared(true);
    diffCheckHistoryIndex.current = currentHistoryIdx;
  };

  return {
    diffBaseBms,
    setDiffBaseBms,
    diffBaseFileName,
    setDiffBaseFileName,
    diffResults,
    setDiffResults,
    diffIsCompared,
    setDiffIsCompared,
    diffCheckHistoryIndex,
    resetDiff,
    markCompared
  };
}
