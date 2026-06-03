export type Language = 'en' | 'ko' | 'ja';

export const translations = {
  en: {
    // Topbar menus
    file: 'File',
    edit: 'Edit',
    view: 'View',
    play: 'Play',
    setting: 'Setting',
    help: 'Help',
    keyMode: 'Key Mode',
    
    // File dropdown
    new: 'New',
    openFile: 'Open File...',
    save: 'Save',
    saveAs: 'Save As',
    exit: 'Exit',
    
    // Edit dropdown
    undo: 'Undo',
    redo: 'Redo',
    cut: 'Cut',
    copy: 'Copy',
    paste: 'Paste',
    delete: 'Delete',
    selectAll: 'Select All',
    goToMeasure: 'Go to Measure',
    
    // View dropdown
    leftSidebar: 'Left Sidebar',
    rightSidebar: 'Right Sidebar',
    grid: 'Grid',
    auxGrid: 'Aux Grid',
    measureLine: 'Measure Line',
    measureNumber: 'Measure Number',
    verticalLine: 'Vertical Line',
    laneHeader: 'Lane Header',
    bpm: 'BPM',
    stop: 'STOP',
    scroll: 'SCROLL',
    bga: 'BGA / LAYER / POOR',
    mode: 'Mode',
    toggle: 'Toggle',
    
    // Play dropdown
    playBeginning: 'Play (Beginning)',
    playCurrent: 'Play (Current)',
    pause: 'Pause',
    stopPlay: 'Stop',
    
    // Setting dropdown
    generalSettings: 'General Settings',
    visualSettings: 'Visual Settings',
    scrollDirection: 'Scroll Direction',
    scrollDirectionNormal: 'Normal',
    scrollDirectionReverse: 'Reverse',
    base62Mode: 'BMS Base Mode',
    base62ModeAuto: 'Auto Detect',
    base62Mode16: '16-Base',
    base62Mode36: '36-Base',
    base62Mode62: '62-Base',

    // LeftSidebar panels
    actions: 'Actions',
    stats: 'Stats',
    playback: 'Playback',
    totalNotes: 'Total Notes',
    playableNotes: 'Playable Notes',
    
    // Keysound loading status
    loadingSounds: 'Loading: {loaded} / {total} ({name})',
    loadingComplete: '✓ Loading Complete ({count} sounds)',
    noSounds: 'No keysounds loaded',
    
    // RightSidebar panels
    headerInfo: 'Header Info',
    keysoundBgaList: 'Keysound / BGA List',
    keysoundTab: 'Keysound',
    bgaTab: 'BGA',
    
    // Header properties
    title: 'TITLE',
    subtitle: 'SUBTITLE',
    artist: 'ARTIST',
    genre: 'GENRE',
    playlevel: 'PLAYLEVEL',
    bpmProp: 'BPM',
    path: 'PATH',
    difficulty: 'DIFFICULTY',
    lnType: 'LN TYPE',
    lnObject: 'LN OBJECT',
    
    // Modal & Dialogs
    selectBmsFile: 'Select BMS File',
    multipleBmsDetected: 'Multiple BMS files detected in the folder. Please select a file to load:',
    cancel: 'Cancel',
    go: 'Go',
    goToMeasureTitle: 'Go to Measure',
    measureNumberLabel: 'Measure Number (0-999)',
    
    // Confirmation alerts
    confirmNew: 'You have unsaved changes. Are you sure you want to create a new file?',
    confirmOpenDifferent: 'You have unsaved changes. Are you sure you want to open a different file?',
    confirmOverlappingSave: 'Overlapping notes exist. Do you still want to save?',
    errPermissionDenied: 'Cannot save file because write permission was denied by the user.',
    errSaveFailed: 'Failed to save file. Check console for details.',
    confirmOpenRecent: 'You have unsaved changes. Are you sure you want to open a recent file?',
    errRecentOpenFailed: 'Cannot open recent file. The file may have been moved or deleted.',
    confirmDrop: 'You have unsaved changes. Are you sure you want to drop and load this folder/file?',
    confirmKeyModeMigration: 'Changing Key Mode will hide unused lanes and migrate their notes to the BGM area. This will shift existing BGM notes to the right to preserve all sound. Do you want to proceed?',
    noBmsFilesInFolder: 'No BMS files (.bms, .bme, .bml, .pms) found in the selected folder.',
    tools: 'Tools',
    selectTool: 'Select (F2)',
    writeTool: 'Write (F3)',
    timeTool: 'Time Edit (F1)',
    keysoundStatus: 'Key Sound Status'
  },
  ko: {
    // Topbar menus
    file: '파일',
    edit: '편집',
    view: '보기',
    play: '재생',
    setting: '설정',
    help: '도움말',
    keyMode: '키 모드',
    
    // File dropdown
    new: '새 파일',
    openFile: '파일 열기...',
    save: '저장',
    saveAs: '새로 저장',
    exit: '종료',
    
    // Edit dropdown
    undo: '실행 취소',
    redo: '다시 실행',
    cut: '잘라내기',
    copy: '복사',
    paste: '붙여넣기',
    delete: '삭제',
    selectAll: '모두 선택',
    goToMeasure: '마디로 이동',
    
    // View dropdown
    leftSidebar: '좌측 사이드바',
    rightSidebar: '우측 사이드바',
    grid: '주 격자선',
    auxGrid: '보조 격자선',
    measureLine: '마디선',
    measureNumber: '마디 번호',
    verticalLine: '세로 구분선',
    laneHeader: '레인 헤더',
    bpm: 'BPM 레인',
    stop: 'STOP 레인',
    scroll: 'SCROLL 레인',
    bga: 'BGA / LAYER / POOR 레인',
    mode: '모드',
    toggle: '전환',
    
    // Play dropdown
    playBeginning: '재생 (처음부터)',
    playCurrent: '재생 (현재 마디부터)',
    pause: '일시정지',
    stopPlay: '정지',
    
    // Setting dropdown
    generalSettings: '일반 옵션 설정',
    visualSettings: '비주얼 옵션 설정',
    scrollDirection: '휠 스크롤 방향',
    scrollDirectionNormal: '정방향',
    scrollDirectionReverse: '역방향',
    base62Mode: 'BMS 진법 인식',
    base62ModeAuto: '자동 판정',
    base62Mode16: '16진법 고정',
    base62Mode36: '36진법 고정',
    base62Mode62: '62진법 고정',

    // LeftSidebar panels
    actions: '파일',
    stats: '노트 정보',
    playback: '재생',
    totalNotes: '총 노트 수',
    playableNotes: '연주 노트 수',
    
    // Keysound loading status
    loadingSounds: '로딩 중: {loaded} / {total} ({name})',
    loadingComplete: '✓ 로딩 완료 ({count}개 키음)',
    noSounds: '로딩된 키음 없음',
    
    // RightSidebar panels
    headerInfo: '헤더 정보',
    keysoundBgaList: '키음 / BGA 리스트',
    keysoundTab: '키음',
    bgaTab: 'BGA',
    
    // Header properties
    title: '제목 (TITLE)',
    subtitle: '부제목 (SUBTITLE)',
    artist: '아티스트 (ARTIST)',
    genre: '장르 (GENRE)',
    playlevel: '난이도 수치 (PLAYLEVEL)',
    bpmProp: '기본 템포 (BPM)',
    path: '경로 (PATH)',
    difficulty: '표시 난이도 (DIFFICULTY)',
    lnType: '롱노트 타입 (LN TYPE)',
    lnObject: '롱노트 종단 (LN OBJECT)',
    
    // Modal & Dialogs
    selectBmsFile: 'BMS 파일 선택',
    multipleBmsDetected: '폴더 내 여러 개의 BMS 파일이 탐지되었습니다. 로드할 파일을 선택하세요:',
    cancel: '취소',
    go: '이동',
    goToMeasureTitle: '마디로 이동',
    measureNumberLabel: '마디 번호 (0-999)',
    
    // Confirmation alerts
    confirmNew: '저장되지 않은 변경사항이 있습니다. 정말 새 파일을 만드시겠습니까?',
    confirmOpenDifferent: '저장되지 않은 변경사항이 있습니다. 정말 다른 파일을 여시겠습니까?',
    confirmOverlappingSave: '중복 겹침 노드가 존재합니다. 그대로 저장하시겠습니까?',
    errPermissionDenied: '사용자가 쓰기 권한을 거부하여 파일을 저장할 수 없습니다.',
    errSaveFailed: '파일 저장에 실패했습니다. 콘솔을 확인해 주세요.',
    confirmOpenRecent: '저장되지 않은 변경사항이 있습니다. 정말 최근 파일을 여시겠습니까?',
    errRecentOpenFailed: '최근 파일을 열 수 없습니다. 파일이 이동되었거나 삭제되었을 수 있습니다.',
    confirmDrop: '저장되지 않은 변경사항이 있습니다. 정말 이 폴더/파일을 드롭하여 로드하시겠습니까?',
    confirmKeyModeMigration: '키 모드를 변경하면 사용하지 않는 레인이 숨겨지고, 해당 레인의 노트들이 BGM 영역의 앞쪽으로 마이그레이션됩니다. 기존 BGM 노트들은 소리 보존을 위해 우측으로 이동됩니다. 진행하시겠습니까?',
    noBmsFilesInFolder: '선택한 폴더에서 BMS 파일(.bms, .bme, .bml, .pms)을 찾을 수 없습니다.',
    tools: '도구',
    selectTool: '선택 (F2)',
    writeTool: '쓰기 (F3)',
    timeTool: '시간편집 (F1)',
    keysoundStatus: '키음 로딩 상태'
  },
  ja: {
    // Topbar menus
    file: 'ファイル',
    edit: '編集',
    view: '表示',
    play: '再生',
    setting: '設定',
    help: 'ヘルプ',
    keyMode: 'キーモード',
    
    // File dropdown
    new: '新規作成',
    openFile: 'ファイルを開く...',
    save: '上書き保存',
    saveAs: '新規保存',
    exit: '終了',
    
    // Edit dropdown
    undo: '元に戻す',
    redo: 'やり直し',
    cut: '切り取り',
    copy: 'コピー',
    paste: '貼り付け',
    delete: '削除',
    selectAll: 'すべて選択',
    goToMeasure: '小節へ移動',
    
    // View dropdown
    leftSidebar: '左サイドバー',
    rightSidebar: '右サイドバー',
    grid: '主グリッド線',
    auxGrid: '補助グリッド線',
    measureLine: '小節線',
    measureNumber: '小節番号',
    verticalLine: '垂直境界線',
    laneHeader: 'レーンヘッダー',
    bpm: 'BPMレーン',
    stop: 'STOPレーン',
    scroll: 'SCROLLレーン',
    bga: 'BGA / LAYER / POORレーン',
    mode: 'モード',
    toggle: '切り替え',
    
    // Play dropdown
    playBeginning: '最初から再生',
    playCurrent: '現在の小節から再生',
    pause: '一時停止',
    stopPlay: '停止',
    
    // Setting dropdown
    generalSettings: '一般オプション設定',
    visualSettings: 'ビジュアルオプション設定',
    scrollDirection: 'ホイールスクロール方向',
    scrollDirectionNormal: '正方向',
    scrollDirectionReverse: '逆方向',
    base62Mode: 'BMS 進数認識',
    base62ModeAuto: '自動判定',
    base62Mode16: '16進数固定',
    base62Mode36: '36進数固定',
    base62Mode62: '62進数固定',

    // LeftSidebar panels
    actions: 'アクション',
    stats: 'ノート情報',
    playback: '再生',
    totalNotes: '総ノーツ数',
    playableNotes: '演奏ノーツ数',
    
    // Keysound loading status
    loadingSounds: '読み込み中: {loaded} / {total} ({name})',
    loadingComplete: '✓ 読み込み完了 ({count}個のキー音)',
    noSounds: '読み込まれたキー音なし',
    
    // RightSidebar panels
    headerInfo: 'ヘッダー情報',
    keysoundBgaList: 'キー音 / BGA リスト',
    keysoundTab: 'キー音',
    bgaTab: 'BGA',
    
    // Header properties
    title: 'タイトル (TITLE)',
    subtitle: 'サブタイトル (SUBTITLE)',
    artist: 'アーティスト (ARTIST)',
    genre: 'ジャンル (GENRE)',
    playlevel: '難易度数値 (PLAYLEVEL)',
    bpmProp: '基本テンポ (BPM)',
    path: 'パス (PATH)',
    difficulty: '表示難易度 (DIFFICULTY)',
    lnType: 'ロングノーツ形式 (LN TYPE)',
    lnObject: 'ロングノーツ終端 (LN OBJECT)',
    
    // Modal & Dialogs
    selectBmsFile: 'BMSファイル選択',
    multipleBmsDetected: 'フォルダ内に複数のBMSファイルが検出されました。ロードするファイルを選択してください：',
    cancel: 'キャンセル',
    go: '移動',
    goToMeasureTitle: '小節へ移動',
    measureNumberLabel: '小節番号 (0-999)',
    
    // Confirmation alerts
    confirmNew: '保存されていない変更があります。本当に新規作成しますか？',
    confirmOpenDifferent: '保存されていない変更があります。本当に別のファイルを開きますか？',
    confirmOverlappingSave: '重複するノーツが存在します。このまま保存しますか？',
    errPermissionDenied: '書き込み権限が拒否されたため、ファイルを保存できません。',
    errSaveFailed: 'ファイルの保存に失敗しました。詳細はコンソールを確認してください。',
    confirmOpenRecent: '保存されていない変更があります。本当に最近開いたファイルを開きますか？',
    errRecentOpenFailed: '最近開いたファイルを開けません。ファイルが移動または削除された可能性があります。',
    confirmDrop: '保存されていない変更があります。本当にこのフォルダ/ファイルをドロップして読み込みますか？',
    confirmKeyModeMigration: 'キーモードを変更すると、未使用のレーンが非表示になり、それらのレーンのノーツがBGM領域の先頭に移行されます。既存のBGMノーツは音を保持するために右側にシフトされます。続行しますか？',
    noBmsFilesInFolder: '選択されたフォルダにBMSファイル(.bms, .bme, .bml, .pms)が見つかりません。',
    tools: 'ツール',
    selectTool: '選択 (F2)',
    writeTool: '書き込み (F3)',
    timeTool: '時間編集 (F1)',
    keysoundStatus: 'キー音読み込み状態'
  }
};
