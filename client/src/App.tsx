import { useState, useEffect } from 'react'
import { Grid, Wand2 } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import React from 'react'
import { LeftSidebar } from './components/LeftSidebar'
import { RightSidebar } from './components/RightSidebar'
import { GridCanvas } from './components/GridCanvas'
import { GeneratorPanel } from './components/GeneratorPanel'
import { useSettings } from './contexts/SettingsContext'
import { useNotification } from './contexts/NotificationContext'
import { useHistory } from './hooks/useHistory'

import { SimulationModal } from './components/SimulationModal'

function App() {
  // Navigation State
  const [activeSidebar, setActiveSidebar] = useState<'panel1' | 'panel2' | 'settings'>('panel1')
  const [activeView, setActiveView] = useState<'grid' | 'generator'>('grid')
  const [isSimulationOpen, setIsSimulationOpen] = useState(false) // Simulation State

  // Tool State
  const [currentTool, setCurrentTool] = useState<'pen' | 'eraser' | 'shape'>('pen')
  const [currentShape, setCurrentShape] = useState<'rectangle' | 'circle' | 'line' | 'triangle' | 'diamond' | 'frame'>('rectangle')

  // View State (Zoom/Pan Persistence)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isZoomInitialized, setIsZoomInitialized] = useState(false)

  // Global Settings
  const { gridSize, backgroundColor, snakePalette } = useSettings()

  // Grid Data State with History
  const [gridData, setGridData, undoGrid, redoGrid, canUndoGrid, canRedoGrid, resetGridData] = useHistory<boolean[][]>(
    Array(gridSize.height).fill(null).map(() => Array(gridSize.width).fill(false))
  )

  // Generator State
  const [generatedImage, setGeneratedImage] = useState<string | null>(null)
  const [levelJson, setLevelJson] = useState<any | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [levelId, setLevelId] = useState(1)
  const [jsonInput, setJsonInput] = useState('')

  // Generator Drawing Tools State
  const [generatorTool, setGeneratorTool] = useState<'arrow' | 'obstacle' | 'eraser' | 'none'>('arrow')
  const [generatorSettings, setGeneratorSettings] = useState({
    arrowColor: 'random', // 'random' or hex string
    obstacleType: 'wall',
    obstacleColor: 'random', // Added for colored obstacles
    obstacleCount: 3, // Added for Wall Break countdown
    tunnelDirection: 'right' // Direction for tunnel arrow
  })
  const [nextItemId, setNextItemId] = useState(0)

  // Generator Overlays with History
  const [generatorOverlays, setGeneratorOverlays, undoOverlays, redoOverlays, canUndoOverlays, canRedoOverlays] = useHistory<{
    arrows: { id: number, row: number, col: number, direction: string, color: string, path?: { row: number, col: number }[], type?: string, keyId?: number, lockId?: number, snakeId?: number, countdown?: number }[],
    obstacles: { id: number, row: number, col: number, type: string, color?: string, count?: number, cells?: { row: number, col: number }[], direction?: string, snakeId?: number, keySnakeId?: number, lockedSnakeId?: number, countdown?: number }[]
  }>({ arrows: [], obstacles: [] })

  // Callback ref to auto-add obstacle from LeftSidebar  
  const obstacleTypeUsedCallback = React.useRef<((data: { type: string, row: number, col: number, color?: string, count?: number, keySnakeId?: number, lockedSnakeId?: number }) => void) | null>(null)
  const obstacleUpdateCallback = React.useRef<((row: number, col: number, updates: any) => void) | null>(null)
  const obstacleDeleteCallback = React.useRef<((row: number, col: number) => void) | null>(null)

  const { addNotification } = useNotification()

  // Sync Grid Data when Grid Size changes (Reset logic)
  useEffect(() => {
    // Create new grid with new dimensions
    const newGrid = Array(gridSize.height).fill(null).map(() => Array(gridSize.width).fill(false))
    // We purposefully reset history here as resizing invalidates old coords
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

  const handleGenerate = async (params: any) => {
    setIsGenerating(true)
    setGeneratedImage(null)
    setLevelJson(null)

    try {
      // Form Data construction
      const formData = new FormData()
      formData.append('arrow_count', params.arrowCount)
      formData.append('min_arrow_length', params.minLen)
      formData.append('max_arrow_length', params.maxLen)
      formData.append('min_bends', params.minBends)
      formData.append('max_bends', params.maxBends)
      formData.append('colors', JSON.stringify(params.palette))

      // Pass the new obstacles list as JSON
      formData.append('obstacles', JSON.stringify(params.obstacles))
      if (params.distributionStrategy) {
        formData.append('strategy', params.distributionStrategy)
      }

      // Shape Input
      formData.append('shape_input', 'RECTANGLE_SHAPE')

      // Custom Grid Input (from JSON Paste)
      if (params.customInput) {
        formData.append('custom_grid', params.customInput)
      }

      const response = await fetch('/api/generate', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()
      if (data.error) {
        addNotification('error', 'Error: ' + data.error)
      } else {
        setGeneratedImage(data.base64_image)
        setLevelJson(data.level_json)

        // Auto-import to grid
        if (data.level_json) {
          handleImportJson(JSON.stringify(data.level_json))
        }

        if (data.is_solvable === false) {
          addNotification('warning', `Level is STUCK! ${data.stuck_count} snakes cannot exit.`)
        } else {
          addNotification('success', 'Level generated successfully!')
        }
      }
    } catch (error) {
      console.error('Generation failed:', error)
      addNotification('error', 'Failed to connect to server')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleValidateLevel = async () => {
    try {
      const response = await fetch('/api/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rows: gridSize.height,
          cols: gridSize.width,
          snakes: generatorOverlays.arrows,
          obstacles: generatorOverlays.obstacles
        }),
      })

      if (!response.ok) {
        throw new Error('Validation request failed')
      }

      const result = await response.json()
      return result
    } catch (error) {
      console.error('Validation error:', error)
      throw error
    }
  }

  const handleCellToggle = (row: number, col: number, mode: 'draw' | 'erase' = 'draw') => {
    setGridData(prev => {
      const newData = prev.map(r => [...r])
      if (mode === 'draw') {
        if (currentTool === 'pen') {
          newData[row][col] = true
        } else if (currentTool === 'eraser') {
          newData[row][col] = false
        }
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
    setJsonInput(jsonStr) // Auto-paste
    handlePanelChange('panel2')
  }

  const handleBulkCellToggle = (updates: { row: number, col: number }[], mode: 'draw' | 'erase' = 'draw') => {
    setGridData(prev => {
      const newData = prev.map(r => [...r])
      updates.forEach(({ row, col }) => {
        if (mode === 'draw') {
          newData[row][col] = true
        } else {
          newData[row][col] = false
        }
      })
      return newData
    })
  }

  const handleImageUpload = async (file: File) => {
    console.log('Image upload started:', file.name)

    try {
      addNotification('info', 'Processing image...')

      // Create form data
      const formData = new FormData()
      formData.append('image', file)
      formData.append('width', gridSize.width.toString())
      formData.append('height', gridSize.height.toString())
      formData.append('method', 'auto') // Use smart auto-detection

      // Call server API
      const response = await fetch('http://localhost:5000/api/process-image', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (result.error) {
        console.error('Server error:', result.error)
        addNotification('error', `Failed: ${result.error}`)
        return
      }

      // Apply the processed grid
      const processedGrid = result.grid as boolean[][]
      setGridData(() => processedGrid)

      const { stats } = result
      console.log('Image processed:', stats)

      setTimeout(() => {
        addNotification('success', `Image imported! ${stats.cell_count} cells (${stats.fill_ratio}%) - ${stats.method}`)
      }, 100)

    } catch (error) {
      console.error('Image upload error:', error)
      addNotification('error', 'Failed to process image. Is the server running?')
    }
  }

  const handleClearGrid = () => {
    setGridData(Array(gridSize.height).fill(null).map(() => Array(gridSize.width).fill(false)))
  }

  const handleClearOverlays = () => {
    setGeneratorOverlays({ arrows: [], obstacles: [] })
    addNotification('success', 'Overlays cleared!')
  }

  const handleObstacleDataUpdate = (id: string | number, updates: any) => {
    // If ID is numeric (or numeric string), check generatorOverlays
    const numericId = typeof id === 'number' ? id : parseInt(id as string)

    if (!isNaN(numericId)) {
      setGeneratorOverlays(prev => {
        // Check arrows
        const arrowIdx = prev.arrows.findIndex(a => a.id === numericId)
        if (arrowIdx !== -1) {
          const newArrows = [...prev.arrows]
          newArrows[arrowIdx] = { ...newArrows[arrowIdx], ...updates }
          return { ...prev, arrows: newArrows }
        }
        // Check obstacles
        const obsIdx = prev.obstacles.findIndex(o => o.id === numericId)
        if (obsIdx !== -1) {
          const newObs = [...prev.obstacles]
          newObs[obsIdx] = { ...newObs[obsIdx], ...updates }
          return { ...prev, obstacles: newObs }
        }
        return prev
      })
    }
  }

  // Handler for adding obstacles from LeftSidebar
  const handleAddObstacle = (data: { id?: number, type: string, row: number, col: number, color?: string, count?: number, cells?: { row: number, col: number }[], keyId?: number, lockId?: number, snakeId?: number, keySnakeId?: number, lockedSnakeId?: number, countdown?: number }) => {
    setGeneratorOverlays(prev => ({
      ...prev,
      obstacles: [...prev.obstacles, {
        id: data.id || nextItemId, // Should be passed from LeftSidebar which generated it
        row: data.row || 0,
        col: data.col || 0,
        type: data.type,
        color: data.color,
        count: data.count,
        cells: data.cells,
        snakeId: data.snakeId,
        keySnakeId: data.keySnakeId,
        lockedSnakeId: data.lockedSnakeId,
        countdown: data.countdown
      }]
    }))
    // Note: nextItemId is managed by LeftSidebar calling setNextItemId, so we don't increment here to avoid double increment?
    // Actually LeftSidebar calls setNextItemId. We just need to store the data.
  }



  const handleImportJson = (json: string) => {
    try {
      const levelData = JSON.parse(json)
      if (!Array.isArray(levelData)) {
        addNotification('error', 'Invalid JSON format: Root must be an array')
        return
      }

      const newArrows: any[] = []
      const newObstacles: any[] = []
      let maxId = 0

      // Coordinate transform helpers
      const centerR = Math.floor(gridSize.height / 2)
      const centerC = Math.floor(gridSize.width / 2)
      const fromPos = (p: { x: number, y: number }) => ({
        row: centerR - p.y,
        col: p.x + centerC
      })

      // Helper to map colorID to hex
      const getColor = (id: number | null) => {
        if (id === null || id === -1 || id === undefined) return undefined
        return snakePalette[id] || snakePalette[0]
      }

      levelData.forEach((item: any) => {
        if (item.itemID !== null && item.itemID !== undefined) {
          maxId = Math.max(maxId, item.itemID)
        }

        // Config-only items (no position)
        if (item.itemType === 'icedSnake') {
          newObstacles.push({
            id: item.itemID,
            type: 'iced_snake',
            row: 0, col: 0, // Dummy pos
            snakeId: item.itemValueConfig?.snakeID,
            countdown: item.itemValueConfig?.count
          })
          return
        }
        if (item.itemType === 'keySnake') {
          newObstacles.push({
            id: item.itemID,
            type: 'key_snake',
            row: 0, col: 0, // Dummy pos
            keySnakeId: item.itemValueConfig?.keyID,
            lockedSnakeId: item.itemValueConfig?.lockID
          })
          return
        }

        // Standard drawable items
        if (!item.position || !Array.isArray(item.position)) return
        const positions = item.position.map(fromPos)

        if (item.itemType === 'snake') {
          // JSON positions are Head -> Tail (or rather, exported as reversed path)
          // Internal path expects Tail -> Head.
          // Export: [...path].reverse(). So JSON[0] is End of path (Head).
          // We need to reverse back to get [Start...End]
          const path = [...positions].reverse()

          const head = path[path.length - 1]
          const neck = path[path.length - 2]

          let direction = 'right'
          if (neck) {
            const dx = head.col - neck.col
            const dy = head.row - neck.row
            if (dx === 1) direction = 'right'
            else if (dx === -1) direction = 'left'
            else if (dy === 1) direction = 'down'
            else if (dy === -1) direction = 'up'
          }

          newArrows.push({
            id: item.itemID,
            row: head.row,
            col: head.col,
            direction: direction,
            color: getColor(item.colorID) || snakePalette[0],
            path: path,
            type: 'snake'
          })
        } else if (item.itemType === 'wall') {
          newObstacles.push({
            id: item.itemID,
            type: 'wall',
            row: positions[0].row,
            col: positions[0].col,
            cells: positions
          })
        } else if (item.itemType === 'wallBreak') {
          newObstacles.push({
            id: item.itemID,
            type: 'wall_break',
            row: positions[0].row,
            col: positions[0].col,
            cells: positions,
            count: item.itemValueConfig?.count
          })
        } else if (item.itemType === 'hole') {
          newObstacles.push({
            id: item.itemID,
            type: 'hole',
            row: positions[0].row,
            col: positions[0].col,
            color: getColor(item.colorID)
          })
        } else if (item.itemType === 'tunel') {
          // Mapping direction {x,y} from directX/Y
          const dX = item.itemValueConfig?.directX
          const dY = item.itemValueConfig?.directY

          let dirStr = 'right'
          if (dX !== undefined && dY !== undefined) {
            if (dX === 1 && dY === 0) dirStr = 'right'
            else if (dX === -1 && dY === 0) dirStr = 'left'
            else if (dX === 0 && dY === 1) dirStr = 'up'
            else if (dX === 0 && dY === -1) dirStr = 'down'
          }

          // Tunnel splits into 2 items if export grouped them? 
          // Actually export separates them now properly as individual items with type 'tunel'.
          // Wait, my export logic:
          /*
            levelData.push({ ... itemType: "tunel", position: [toPos(obs.row, obs.col)] ... })
          */
          // So export is 1 item per tunnel end. Good. Simple mapping.

          newObstacles.push({
            id: item.itemID,
            type: 'tunnel',
            row: positions[0].row,
            col: positions[0].col,
            color: getColor(item.colorID),
            direction: dirStr
          })
        }
      })

      setGeneratorOverlays({ arrows: newArrows, obstacles: newObstacles })
      setNextItemId(maxId + 1)
      setActiveView('generator') // Switch view
      addNotification('success', `Imported ${newArrows.length} snakes and ${newObstacles.length} obstacles`)

    } catch (e) {
      console.error(e)
      addNotification('error', 'Failed to import JSON')
    }
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
        onObstacleTypeUsed={(callback) => { obstacleTypeUsedCallback.current = callback }}
        onObstacleUpdate={(callback) => { obstacleUpdateCallback.current = callback }}
        onObstacleDelete={(callback) => { obstacleDeleteCallback.current = callback }}
        onDataUpdate={handleObstacleDataUpdate}
        onObstacleAdd={handleAddObstacle}
        nextItemId={nextItemId}
        setNextItemId={setNextItemId}
        gridData={gridData}
        setGridData={setGridData}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="h-[72.5px] bg-gray-800 border-b border-gray-700 flex items-center justify-between px-6">
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600 flex items-center gap-3">
            {activeView === 'grid' && <><Grid className="text-purple-500" /> Grid Editor</>}
            {activeView === 'generator' && <><Wand2 className="text-purple-500" /> Level Generator</>}
          </h1>
        </div>

        <div className="flex-1 overflow-hidden relative">
          <AnimatePresence>
            {activeView === 'grid' && (
              <motion.div
                key="grid-view"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 h-full w-full"
              >
                <GridCanvas
                  gridData={gridData}
                  onCellToggle={handleCellToggle}
                  onBulkCellToggle={handleBulkCellToggle}
                  rows={gridSize.height}
                  cols={gridSize.width}
                  currentTool={currentTool}
                  currentShape={currentShape}
                  zoom={zoom}
                  setZoom={setZoom}
                  pan={pan}
                  setPan={setPan}
                  isZoomInitialized={isZoomInitialized}
                  setIsZoomInitialized={setIsZoomInitialized}
                />
              </motion.div>
            )}
            {activeView === 'generator' && (
              <motion.div
                key="generator-view"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 h-full w-full"
              >
                <GeneratorPanel
                  isGenerating={isGenerating}
                  jsonInput={jsonInput}
                  gridData={gridData}
                  setGridData={setGridData}
                  generatorTool={generatorTool}
                  generatorSettings={generatorSettings}
                  generatorOverlays={generatorOverlays as any}
                  setGeneratorOverlays={setGeneratorOverlays as any}
                  onObstacleTypeUsed={(data) => obstacleTypeUsedCallback.current?.(data)}
                  onObstacleUpdate={(row, col, updates) => obstacleUpdateCallback.current?.(row, col, updates)}
                  onObstacleDelete={(row, col) => obstacleDeleteCallback.current?.(row, col)}
                  nextItemId={nextItemId}
                  setNextItemId={setNextItemId}
                  onValidate={handleValidateLevel}
                  zoom={zoom}
                  setZoom={setZoom}
                  pan={pan}
                  setPan={setPan}
                  isZoomInitialized={isZoomInitialized}
                  setIsZoomInitialized={setIsZoomInitialized}
                />
              </motion.div>
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
