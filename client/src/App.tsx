import { useState, useEffect } from 'react'
import { Grid, Wand2, Loader2 } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import React from 'react'
import { LeftSidebar } from './components/LeftSidebar'
import { RightSidebar } from './components/RightSidebar'
import { GridCanvas } from './components/GridCanvas'
import { GeneratorContextMenu } from './components/GeneratorContextMenu'

import { useSettings, useNotification, useToolsStore, useGridStore, useGridHistoryStore, useOverlaysHistoryStore } from './stores'
import { useLanguage } from './i18n'
import { useAuth } from './contexts/AuthContext'
import { LogOut } from 'lucide-react'
import { apiRequest, apiRequestFormData } from './utils/api'
import { SimulationModal } from './components/SimulationModal'
import { useGeneratorInteraction } from './hooks/useGeneratorInteraction'
import { useLevelManagement } from './hooks/useLevelManagement'

function App() {
  // Navigation State - from Zustand store
  const {
    activeView, setActiveView,
    activeSidebar, setActiveSidebar,
    currentTool, setCurrentTool,
    currentShape, setCurrentShape,
    generatorTool, setGeneratorTool,
    generatorSettings, setGeneratorSettings,
    isGenerating, setIsGenerating,
    generatedImage, setGeneratedImage,
    levelJson, setLevelJson,
    levelId, setLevelId
  } = useToolsStore()

  const [isSimulationOpen, setIsSimulationOpen] = useState(false) // Simulation State
  const { language, setLanguage, t } = useLanguage() // Language from Context
  const { user, logout } = useAuth() // Auth context

  // View State (Zoom/Pan Persistence) - from Zustand store
  const { zoom, setZoom, pan, setPan, isZoomInitialized, setIsZoomInitialized } = useGridStore()

  // Global Settings
  const { gridSize, setGridSize, backgroundColor, snakePalette, checkerboardView } = useSettings()

  // Grid Data State with History - from Zustand historyStore
  const gridData = useGridHistoryStore((s) => s.gridData)
  const setGridData = useGridHistoryStore((s) => s.setGridData)
  const resetGridData = useGridHistoryStore((s) => s.resetGrid)
  const gridHistoryState = useGridHistoryStore.temporal.getState()
  const undoGrid = gridHistoryState.undo
  const redoGrid = gridHistoryState.redo
  const canUndoGrid = gridHistoryState.pastStates.length > 0
  const canRedoGrid = gridHistoryState.futureStates.length > 0

  // Generator Overlays with History - from Zustand historyStore
  const arrows = useOverlaysHistoryStore((s) => s.arrows)
  const obstacles = useOverlaysHistoryStore((s) => s.obstacles)
  const setOverlays = useOverlaysHistoryStore((s) => s.setOverlays)
  const storeSetNextItemId = useOverlaysHistoryStore((s) => s.setNextItemId)
  const nextItemId = useOverlaysHistoryStore((s) => s.nextItemId)

  const setNextItemId: React.Dispatch<React.SetStateAction<number>> = (valOrFn) => {
    if (typeof valOrFn === 'function') {
      storeSetNextItemId(valOrFn(useOverlaysHistoryStore.getState().nextItemId))
    } else {
      storeSetNextItemId(valOrFn)
    }
  }
  const generatorOverlays = { arrows, obstacles }

  const setGeneratorOverlays = (data: typeof generatorOverlays | ((prev: typeof generatorOverlays) => typeof generatorOverlays)) => {
    if (typeof data === 'function') {
      setOverlays(data({ arrows, obstacles }))
    } else {
      setOverlays(data)
    }
  }

  const overlaysHistoryState = useOverlaysHistoryStore.temporal.getState()
  const undoOverlays = overlaysHistoryState.undo
  const redoOverlays = overlaysHistoryState.redo
  const canUndoOverlays = overlaysHistoryState.pastStates.length > 0
  const canRedoOverlays = overlaysHistoryState.futureStates.length > 0

  // Arrow Selection State (for multi-select in Generator mode)
  const selectedArrowIds = useOverlaysHistoryStore((s) => s.selectedArrowIds)
  const setSelectedArrowIds = useOverlaysHistoryStore((s) => s.setSelectedArrowIds)
  const selectedArrows = new Set(selectedArrowIds)
  const setSelectedArrows: React.Dispatch<React.SetStateAction<Set<number>>> = (valueOrFn) => {
    if (typeof valueOrFn === 'function') {
      const currentSet = new Set(useOverlaysHistoryStore.getState().selectedArrowIds)
      const newSet = valueOrFn(currentSet)
      setSelectedArrowIds([...newSet])
    } else {
      setSelectedArrowIds([...valueOrFn])
    }
  }

  // Level Management Hook
  const {
    jsonInput, setJsonInput,
    handleImportJson: hookImportJson,
    handleExportJson,
    handleGenerate: hookGenerate,
    handleFillGaps: hookFillGaps
  } = useLevelManagement()

  // Generator Interaction Hook
  const generatorInteraction = useGeneratorInteraction({
    gridData,
    generatorTool,
    generatorSettings,
    generatorOverlays: generatorOverlays as any,
    setGeneratorOverlays: setGeneratorOverlays as any,
    setGridData,
    nextItemId,
    setNextItemId,
    selectedArrows,
    setSelectedArrows,
    onObstacleTypeUsed: () => { } // Managed by store now
  })

  // Ref to track if we're currently importing (to skip grid reset)
  const isImportingRef = React.useRef(false)
  const pendingGridDataRef = React.useRef<boolean[][] | null>(null)

  const { addNotification } = useNotification()

  const handleImportJson = (json: string, shouldAutoFill: boolean = true, sourceGridSize?: { rows: number, cols: number }) => {
    const result = hookImportJson(json, shouldAutoFill, sourceGridSize)
    if (result && result.type === 'RESIZE') {
      pendingGridDataRef.current = result.newGrid
      isImportingRef.current = true
      setGridSize({ width: result.newWidth, height: result.newHeight })

      // We still need to set overlays and nextItemId manually if we resized here
      setOverlays({ arrows: result.newArrows, obstacles: result.newObstacles })
      setNextItemId(result.maxId + 1)
      setActiveView('generator')
    }
  }

  const handleGenerate = async (params: any) => {
    setIsGenerating(true)
    setGeneratedImage(null)
    setLevelJson(null)
    try {
      const result = await hookGenerate(params) as any
      if (result && result.levelJson) {
        handleImportJson(JSON.stringify(result.levelJson), false, result.sourceGridSize)
      }
    } finally {
      setIsGenerating(false)
    }
  }

  const handleFillGaps = async () => {
    try {
      const result = await hookFillGaps() as any
      if (result && result.levelJson) {
        handleImportJson(JSON.stringify(result.levelJson), false, result.sourceGridSize)
      }
    } catch (error) {
      console.error(error)
    }
  }


  // Sync Grid Data when Grid Size changes (Reset logic)
  useEffect(() => {
    if (isImportingRef.current) {
      if (pendingGridDataRef.current) {
        resetGridData(pendingGridDataRef.current)
        pendingGridDataRef.current = null
      }
      isImportingRef.current = false
      return
    }
    const newGrid = Array(gridSize.height).fill(null).map(() => Array(gridSize.width).fill(false))
    resetGridData(newGrid)
  }, [gridSize.width, gridSize.height, resetGridData])


  // Global Undo/Redo Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl+Z or Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) {
          // Redo
          if (activeView === 'grid' && canRedoGrid) redoGrid()
          if (activeView === 'generator' && canRedoOverlays) redoOverlays()
        } else {
          // Undo
          if (activeView === 'grid' && canUndoGrid) undoGrid()
          if (activeView === 'generator' && canUndoOverlays) undoOverlays()
        }
      }
      // Check for Ctrl+Y or Cmd+Y (Redo alternative)
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault()
        if (activeView === 'grid' && canRedoGrid) redoGrid()
        if (activeView === 'generator' && canRedoOverlays) redoOverlays()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeView, canUndoGrid, canRedoGrid, canUndoOverlays, canRedoOverlays, undoGrid, redoGrid, undoOverlays, redoOverlays])

  const handlePanelChange = (panel: 'panel1' | 'panel2' | 'settings') => {
    setActiveSidebar(panel)
    if (panel === 'panel1') setActiveView('grid')
    if (panel === 'panel2') setActiveView('generator')
  }

  const handleValidateLevel = async () => {
    try {
      const response = await apiRequest('/validate', {
        method: 'POST',
        body: JSON.stringify({
          rows: gridSize.height,
          cols: gridSize.width,
          snakes: generatorOverlays.arrows,
          obstacles: generatorOverlays.obstacles
        }),
      })

      if (!response.ok) throw new Error('Validation request failed')
      const result = await response.json()
      return result
    } catch (error) {
      console.error('Validation error:', error)
      throw error
    }
  }

  const handleCellToggle = (row: number, col: number, mode: 'draw' | 'erase' = 'draw') => {
    setGridData(prev => {
      if (row < 0 || row >= prev.length || col < 0 || col >= (prev[0]?.length || 0)) return prev
      const newData = prev.map(r => [...r])
      if (mode === 'draw') {
        if (currentTool === 'pen') newData[row][col] = true
        else if (currentTool === 'eraser') newData[row][col] = false
      } else if (mode === 'erase') {
        newData[row][col] = false
      }
      return newData
    })
  }

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(gridData))
      addNotification('success', 'Grid JSON copied to clipboard!')
    } catch (err) {
      console.error('Failed to copy', err)
      addNotification('error', 'Failed to copy grid JSON')
    }
  }

  const handleCopyJsonToGenerator = async () => {
    await handleCopyJson()
    const jsonStr = JSON.stringify(gridData)
    setJsonInput(jsonStr)
    handlePanelChange('panel2')
  }

  const handleBulkCellToggle = (updates: { row: number, col: number }[], mode: 'draw' | 'erase' = 'draw') => {
    setGridData(prev => {
      const newData = prev.map(r => [...r])
      const maxRow = prev.length
      const maxCol = prev[0]?.length || 0
      updates.forEach(({ row, col }) => {
        if (row < 0 || row >= maxRow || col < 0 || col >= maxCol) return
        newData[row][col] = mode === 'draw'
      })
      return newData
    })
  }

  const handleImageUpload = async (file: File) => {
    try {
      addNotification('info', 'Processing image...')
      const formData = new FormData()
      formData.append('image', file)
      formData.append('width', gridSize.width.toString())
      formData.append('height', gridSize.height.toString())
      formData.append('method', 'auto')

      const response = await apiRequestFormData('/process-image', formData)
      const result = await response.json()
      if (result.error) {
        addNotification('error', `Failed: ${result.error}`)
        return
      }
      setGridData(() => result.grid as boolean[][])
      addNotification('success', `Image imported! ${result.stats.cell_count} cells`)
    } catch (error) {
      console.error('Image upload error:', error)
      addNotification('error', 'Failed to process image')
    }
  }

  const handleClearGrid = () => {
    setGridData(Array(gridSize.height).fill(null).map(() => Array(gridSize.width).fill(false)))
  }

  const handleClearOverlays = () => {
    setOverlays({ arrows: [], obstacles: [] })
    setSelectedArrowIds([])
    addNotification('success', 'Overlays cleared!')
  }

  const handleDeleteSelectedArrows = () => {
    if (selectedArrows.size === 0) return
    setOverlays({
      ...generatorOverlays,
      arrows: generatorOverlays.arrows.filter(a => !selectedArrows.has(a.id))
    })
    addNotification('success', `Deleted ${selectedArrows.size} arrow(s)`)
    setSelectedArrowIds([])
  }





  return (
    <div className="h-screen flex text-white" style={{ backgroundColor }}>
      {/* Left Sidebar - Panel Selection & Global Settings */}
      <LeftSidebar
        activePanel={activeSidebar}
        onPanelChange={handlePanelChange}
        onGenerate={handleGenerate}
        isGenerating={isGenerating}
        jsonInput={jsonInput}
        setJsonInput={setJsonInput}
        onImportJson={handleImportJson}
        onExportJson={handleExportJson}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="h-[72.5px] bg-gray-800 border-b border-gray-700 flex items-center justify-between px-6">
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600 flex items-center gap-3">
            {activeView === 'grid' && <><Grid className="text-purple-500" /> {t('gridEditor')}</>}
            {activeView === 'generator' && <><Wand2 className="text-purple-500" /> {t('levelGenerator')}</>}
          </h1>

          {/* Right side controls */}
          <div className="flex items-center gap-3">
            {/* User info */}
            {user && (
              <span className="text-sm text-gray-400 dark:text-gray-500">
                {user.username || user.email || 'User'}
              </span>
            )}

            {/* Language Toggle */}
            <div
              onClick={() => setLanguage(language === 'EN' ? 'VN' : 'EN')}
              className="relative w-20 h-7 bg-gray-700 rounded-full border border-gray-600 cursor-pointer select-none"
            >
              {/* Labels inside */}
              <span className={`absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-medium transition-colors duration-200 ${language === 'VN' ? 'text-gray-400' : 'text-transparent'}`}>EN</span>
              <span className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-medium transition-colors duration-200 ${language === 'EN' ? 'text-gray-400' : 'text-transparent'}`}>VN</span>
              {/* Sliding ball with text */}
              <div
                className={`absolute top-1/2 -translate-y-1/2 w-9 h-5 bg-purple-500 rounded-full shadow flex items-center justify-center transition-all duration-200
                  ${language === 'VN' ? 'left-[39px]' : 'left-1'}`}
              >
                <span className="text-xs font-bold text-white">{language}</span>
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={logout}
              className="p-1.5 text-gray-400 hover:text-red-400 dark:hover:text-red-500 transition-colors rounded-lg hover:bg-gray-700 dark:hover:bg-gray-800"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden relative bg-gray-900">
          <GridCanvas
            gridData={gridData}
            onCellToggle={activeView === 'generator' ? generatorInteraction.handleCellInteraction : handleCellToggle}
            onBulkCellToggle={handleBulkCellToggle}
            rows={gridSize.height}
            cols={gridSize.width}
            currentTool={activeView === 'generator'
              ? (generatorTool === 'eraser' ? 'eraser' : 'pen')
              : currentTool}
            currentShape={activeView === 'generator' ? 'rectangle' : currentShape}
            zoom={zoom}
            setZoom={setZoom}
            pan={pan}
            setPan={setPan}
            isZoomInitialized={isZoomInitialized}
            setIsZoomInitialized={setIsZoomInitialized}
            checkerboardView={checkerboardView}
            readOnlyGrid={activeView === 'generator'}
            overlayMode={activeView === 'generator' ? 'generator' : 'editor'}
            overlays={generatorOverlays}
            selectedArrows={activeView === 'generator' ? selectedArrows : undefined}

            // Map Generator Interactions
            onRightMouseDown={activeView === 'generator' ? generatorInteraction.handleRightMouseDown : undefined}
            onRightMouseMove={activeView === 'generator' ? generatorInteraction.handleRightMouseMove : undefined}
            onRightMouseUp={activeView === 'generator' ? generatorInteraction.handleRightMouseUp : undefined}

            previewPath={activeView === 'generator' ? generatorInteraction.previewPath : undefined}
            previewObstacle={activeView === 'generator' ? generatorInteraction.previewObstacle : undefined}

            marqueeSelection={activeView === 'generator' ? generatorInteraction.marqueeSelection : undefined}
            justFinishedMarquee={activeView === 'generator' ? generatorInteraction.justFinishedMarquee : undefined}

            editingArrowId={activeView === 'generator' ? generatorInteraction.editingArrowId : undefined}
            editingEnd={activeView === 'generator' ? generatorInteraction.editingEnd : undefined}
            editingPath={activeView === 'generator' ? generatorInteraction.editingPath : undefined}

            onNodeHandleClick={activeView === 'generator' ? generatorInteraction.handleNodeHandleClick : undefined}
            onPathEditMove={activeView === 'generator' ? generatorInteraction.handlePathEditMove : undefined}
            onPathEditCommit={activeView === 'generator' ? generatorInteraction.handlePathEditCommit : undefined}

            onValidate={handleValidateLevel}
            onItemContextMenu={(e, item) => {
              if (activeView === 'generator') {
                generatorInteraction.setContextMenu({
                  x: e.clientX,
                  y: e.clientY,
                  type: item.type,
                  data: item.type === 'bulk'
                    ? item.data
                    : {
                      ...item.data,
                      id: item.type === 'arrow'
                        ? generatorOverlays.arrows[item.index].id
                        : generatorOverlays.obstacles[item.index].id
                    },
                  index: item.index
                } as any)
              }
            }}
          />

          {/* Generator UI Overlays (Loading / Empty State) */}
          <AnimatePresence>
            {activeView === 'generator' && isGenerating && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/80 z-20 text-gray-400"
              >
                <Loader2 size={48} className="animate-spin mb-4 text-purple-500" />
                <p>{t('generatingLevel' as any)}</p>
              </motion.div>
            )}

            {activeView === 'generator' && !gridData && !isGenerating && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center z-10 bg-gray-900/50"
              >
                <div className="text-center p-8 bg-gray-800 rounded-2xl shadow-xl border border-gray-700">
                  <p className="text-2xl mb-2">{t('readyToGen' as any)}</p>
                  <p className="text-sm text-gray-400">{t('pasteJsonPrompt' as any)}</p>
                </div>
              </motion.div>
            )}

            {/* Context Menu */}
            {activeView === 'generator' && (
              <GeneratorContextMenu
                contextMenu={generatorInteraction.contextMenu}
                onClose={() => generatorInteraction.setContextMenu(null)}
                snakePalette={snakePalette}
                selectedCount={selectedArrows.size}
                // Arrow actions
                onDeleteArrow={(id) => {
                  setGeneratorOverlays(prev => ({
                    ...prev,
                    arrows: prev.arrows.filter(a => a.id !== id)
                  }))
                }}
                onReverseArrow={(id, arrow) => {
                  if (!arrow?.path || arrow.path.length < 2) return
                  const reversedPath = [...arrow.path].reverse()
                  const newEnd = reversedPath[reversedPath.length - 1]
                  const prevCell = reversedPath[reversedPath.length - 2]
                  let newDirection = arrow.direction
                  const dr = newEnd.row - prevCell.row
                  const dc = newEnd.col - prevCell.col
                  if (dr === -1) newDirection = 'up'
                  else if (dr === 1) newDirection = 'down'
                  else if (dc === -1) newDirection = 'left'
                  else if (dc === 1) newDirection = 'right'
                  setGeneratorOverlays(prev => ({
                    ...prev,
                    arrows: prev.arrows.map(a =>
                      a.id !== id ? a : {
                        ...a,
                        row: newEnd.row,
                        col: newEnd.col,
                        direction: newDirection,
                        path: reversedPath
                      }
                    )
                  }))
                }}
                onRecolorArrow={(id, color) => {
                  setGeneratorOverlays(prev => ({
                    ...prev,
                    arrows: prev.arrows.map(a =>
                      a.id !== id ? a : { ...a, color }
                    )
                  }))
                }}
                // Obstacle actions
                onDeleteObstacle={(id) => {
                  setGeneratorOverlays(prev => ({
                    ...prev,
                    obstacles: prev.obstacles.filter(o => o.id !== id)
                  }))
                }}
                onUpdateObstacle={(id, updates) => {
                  setGeneratorOverlays(prev => ({
                    ...prev,
                    obstacles: prev.obstacles.map(o =>
                      o.id !== id ? o : { ...o, ...updates }
                    )
                  }))
                }}
                // Bulk actions
                onFlipSelected={() => generatorInteraction.handleFlipSelected()}
                onRecolorSelected={(color) => generatorInteraction.handleRecolorSelected(color)}
                onDeleteSelected={handleDeleteSelectedArrows}
              />
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Right Sidebar - Tools (only show when Grid Editor is active View OR Generator View) */}
      {(activeView === 'grid' || activeView === 'generator') && (
        <RightSidebar
          mode={activeView === 'grid' ? 'editor' : 'generator'}
          // Editor Props
          currentTool={currentTool}
          onToolChange={setCurrentTool}
          currentShape={currentShape}
          onShapeChange={setCurrentShape}
          onCopyJson={handleCopyJson}
          onCopyJsonToGenerator={handleCopyJsonToGenerator}
          onImageUpload={handleImageUpload}
          onClearGrid={handleClearGrid}
          // Generator Props
          generatedImage={generatedImage}
          levelJson={levelJson}
          levelId={levelId}
          onLevelIdChange={setLevelId}
          // Generator Tools Props
          generatorTool={generatorTool}
          setGeneratorTool={setGeneratorTool}
          generatorSettings={generatorSettings}
          setGeneratorSettings={setGeneratorSettings}
          generatorOverlays={generatorOverlays}
          onClearOverlays={handleClearOverlays}
          onImportJson={handleImportJson}
          onSimulate={() => setIsSimulationOpen(true)}
          onFillGaps={handleFillGaps}
        />
      )}

      <SimulationModal
        isOpen={isSimulationOpen}
        onClose={() => setIsSimulationOpen(false)}
        rows={gridSize.height}
        cols={gridSize.width}
        gridData={gridData}
        snakes={generatorOverlays.arrows}
        obstacles={generatorOverlays.obstacles}
      />
    </div>
  )
}

export default App