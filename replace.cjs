const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const startIdx = content.indexOf('<header className="topbar">');
const endIdx = content.indexOf('export default App;');

if (startIdx !== -1 && endIdx !== -1) {
  const newContent = content.substring(0, startIdx) + 
`<Topbar 
  isFileMenuOpen={isFileMenuOpen} setIsFileMenuOpen={setIsFileMenuOpen} 
  handleNew={handleNew} handleOpen={handleOpen} handleSave={handleSave} 
  handleSaveAs={handleSaveAs} handleRecentClick={handleRecentClick} 
  handleExit={handleExit} isDirty={isDirty} hasBmsData={!!bmsData} 
  recentFiles={recentFiles} useBase62={useBase62} handleToggleMode={handleToggleMode} 
/>

<div className="main-area">
  <LeftSidebar 
    handleOpen={handleOpen} handleSave={handleSave} 
    isDirty={isDirty} hasBmsData={!!bmsData} 
    totalNotesCount={totalNotesCount} playableNotesCount={playableNotesCount} 
    activeTool={activeTool} setActiveTool={setActiveTool} 
  />

  <main className="canvas-container" ref={containerRef}>
    <canvas ref={canvasRef} onMouseDown={handleCanvasMouseDown} />
  </main>

  <RightSidebar 
    bmsData={bmsData} updateHeader={updateHeader} 
    gridSnap={gridSnap} setGridSnap={setGridSnap} 
    zoomX={zoomX} setZoomX={setZoomX} 
    zoomY={zoomY} setZoomY={setZoomY} 
  />
</div>
</div>
);
}
` + '\n' + content.substring(endIdx);
  fs.writeFileSync('src/App.tsx', newContent);
  console.log('Replaced');
} else {
  console.log('Not found: startIdx=', startIdx, 'endIdx=', endIdx);
}
