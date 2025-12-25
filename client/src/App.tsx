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
  const { gridSize, setGridSize, backgroundColor, snakePalette, lengthRange, bendsRange, autoResizeGridOnImport, autoFillDrawOnImport, checkerboardView } = useSettings()

  // Grid Data State with History - from Zustand historyStore
  const gridData = useGridHistoryStore((s) => s.gridData)
  const setGridData = useGridHistoryStore((s) => s.setGridData)
  const resetGridData = useGridHistoryStore((s) => s.resetGrid)
  const gridHistoryState = useGridHistoryStore.temporal.getState()
  const undoGrid = gridHistoryState.undo
  const redoGrid = gridHistoryState.redo
  const canUndoGrid = gridHistoryState.pastStates.length > 0
  const canRedoGrid = gridHistoryState.futureStates.length > 0

  const [jsonInput, setJsonInput] = useState('')
  // nextItemId from store with wrapper for functional updates
  const nextItemId = useOverlaysHistoryStore((s) => s.nextItemId)
  const storeSetNextItemId = useOverlaysHistoryStore((s) => s.setNextItemId)
  const setNextItemId: React.Dispatch<React.SetStateAction<number>> = (valueOrFn) => {
    if (typeof valueOrFn === 'function') {
      const currentId = useOverlaysHistoryStore.getState().nextItemId
      storeSetNextItemId(valueOrFn(currentId))
    } else {
      storeSetNextItemId(valueOrFn)
    }
  }

  // Generator Overlays with History - from Zustand historyStore
  const arrows = useOverlaysHistoryStore((s) => s.arrows)
  const obstacles = useOverlaysHistoryStore((s) => s.obstacles)
  const setOverlays = useOverlaysHistoryStore((s) => s.setOverlays)
  const generatorOverlays = { arrows, obstacles }
  const setGeneratorOverlays = (data: typeof generatorOverlays | ((prev: typeof generatorOverlays) => typeof generatorOverlays)) => {
    if (typeof data === 'function') {
      const current = useOverlaysHistoryStore.getState()
      const newData = data({ arrows: current.arrows, obstacles: current.obstacles })
      setOverlays(newData)
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

  // Callback ref to auto-add obstacle from LeftSidebar  
  const obstacleTypeUsedCallback = React.useRef<((data: { type: string, row: number, col: number, color?: string, count?: number, keySnakeId?: number, lockedSnakeId?: number }) => void) | null>(null)
  const obstacleUpdateCallback = React.useRef<((row: number, col: number, updates: any) => void) | null>(null)
  const obstacleDeleteCallback = React.useRef<((row: number, col: number) => void) | null>(null)

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
    onObstacleTypeUsed: (data) => obstacleTypeUsedCallback.current?.(data)
  })

  // Ref to track if we're currently importing (to skip grid reset)
  const isImportingRef = React.useRef(false)
  const pendingGridDataRef = React.useRef<boolean[][] | null>(null)

  const { addNotification } = useNotification()

  // Sync Grid Data when Grid Size changes (Reset logic)
  useEffect(() => {
    // Skip reset if we're importing (import will set its own grid data)
    if (isImportingRef.current) {
      // Apply pending grid data if any
      if (pendingGridDataRef.current) {
        resetGridData(pendingGridDataRef.current)
        pendingGridDataRef.current = null
      }
      isImportingRef.current = false
      return
    }
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
      // Pass bonus fill option
      formData.append('bonus_fill', params.bonusFill !== undefined ? String(params.bonusFill) : 'true')

      // Shape Input
      formData.append('shape_input', 'RECTANGLE_SHAPE')

      // Custom Grid Input (from JSON Paste)
      if (params.customInput) {
        formData.append('custom_grid', params.customInput)
      }

      const response = await apiRequestFormData('/generate', formData)

      const data = await response.json()
      if (data.error) {
        addNotification('error', 'Error: ' + data.error)
      } else {
        setGeneratedImage(data.base64_image)
        setLevelJson(data.level_json)

        // Auto-import to grid (don't auto-fill draw layer when generating)
        // Use grid size from response to ensure correct coordinate transform
        if (data.level_json) {
          const sourceGridSize = data.grid_rows && data.grid_cols
            ? { rows: data.grid_rows, cols: data.grid_cols }
            : undefined
          handleImportJson(JSON.stringify(data.level_json), false, sourceGridSize)
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
      const response = await apiRequest('/validate', {
        method: 'POST',
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
      // Bounds check to prevent crash
      if (row < 0 || row >= prev.length || col < 0 || col >= (prev[0]?.length || 0)) {
        return prev
      }
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
      const maxRow = prev.length
      const maxCol = prev[0]?.length || 0
      updates.forEach(({ row, col }) => {
        // Bounds check to prevent crash
        if (row < 0 || row >= maxRow || col < 0 || col >= maxCol) return
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
      const response = await apiRequestFormData('/process-image', formData)

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
    setSelectedArrows(new Set()) // Clear selection too
    addNotification('success', 'Overlays cleared!')
  }

  // Delete selected arrows
  const handleDeleteSelectedArrows = () => {
    if (selectedArrows.size === 0) return
    setGeneratorOverlays(prev => ({
      ...prev,
      arrows: prev.arrows.filter(a => !selectedArrows.has(a.id))
    }))
    addNotification('success', `Deleted ${selectedArrows.size} arrow(s)`)
    setSelectedArrows(new Set())
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



  const handleImportJson = (json: string, shouldAutoFill: boolean = true, sourceGridSize?: { rows: number, cols: number }) => {
    try {
      const levelData = JSON.parse(json)
      if (!Array.isArray(levelData)) {
        addNotification('error', 'Invalid JSON format: Root must be an array')
        return
      }

      // Helper to map colorID to hex
      const getColor = (id: number | null) => {
        if (id === null || id === -1 || id === undefined) return undefined
        return snakePalette[id] || snakePalette[0]
      }

      // === PHASE 1: Collect all raw positions first (in original coordinate system) ===
      const allRawPositions: { x: number, y: number }[] = []

      levelData.forEach((item: any) => {
        if (item.itemType === 'icedSnake' || item.itemType === 'keySnake') return // No position
        if (!item.position || !Array.isArray(item.position)) return
        item.position.forEach((p: { x: number, y: number }) => {
          allRawPositions.push(p)
        })
      })

      // === PHASE 2: Calculate bounding box and determine grid size ===
      // If sourceGridSize is provided (from generate/fill gaps), use it to ensure correct coordinate transform
      let newWidth = sourceGridSize ? sourceGridSize.cols : gridSize.width
      let newHeight = sourceGridSize ? sourceGridSize.rows : gridSize.height
      let offsetRow = 0
      let offsetCol = 0

      // Only auto-resize when explicitly importing (not from generate/fill gaps)
      if (shouldAutoFill && autoResizeGridOnImport && allRawPositions.length > 0) {
        // Find min/max in the raw coordinate system (x, y where y is inverted)
        const minX = Math.min(...allRawPositions.map(p => p.x))
        const maxX = Math.max(...allRawPositions.map(p => p.x))
        const minY = Math.min(...allRawPositions.map(p => p.y))
        const maxY = Math.max(...allRawPositions.map(p => p.y))

        // Content dimensions
        const contentWidth = maxX - minX + 1
        const contentHeight = maxY - minY + 1

        // Add padding (1 cell on each side)
        const padding = 1
        newWidth = contentWidth + padding * 2
        newHeight = contentHeight + padding * 2

        // Calculate offsets to center content in the new grid
        // Content center in raw coords
        const contentCenterX = (minX + maxX) / 2
        const contentCenterY = (minY + maxY) / 2

        // Offsets to adjust coordinate transform so content is centered
        offsetRow = contentCenterY
        offsetCol = -contentCenterX
      }

      // === PHASE 3: Define coordinate transform using calculated offsets ===
      const centerR = Math.floor(newHeight / 2)
      const centerC = Math.floor(newWidth / 2)

      const fromPos = (p: { x: number, y: number }) => ({
        row: Math.round(centerR - p.y + offsetRow),
        col: Math.round(p.x + centerC + offsetCol)
      })

      // === PHASE 4: Parse all items with new coordinates ===
      const newArrows: any[] = []
      const newObstacles: any[] = []
      let maxId = 0

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
          const dX = item.itemValueConfig?.directX
          const dY = item.itemValueConfig?.directY

          let dirStr = 'right'
          if (dX !== undefined && dY !== undefined) {
            if (dX === 1 && dY === 0) dirStr = 'right'
            else if (dX === -1 && dY === 0) dirStr = 'left'
            else if (dX === 0 && dY === 1) dirStr = 'up'
            else if (dX === 0 && dY === -1) dirStr = 'down'
          }

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

      // === PHASE 5: Auto-fill draw layer from arrow positions ===
      // Only auto-fill when explicitly importing (not from generate or fill gaps)
      let newGrid: boolean[][] | null = null
      if (shouldAutoFill && autoFillDrawOnImport && newArrows.length > 0) {
        // Create new grid with arrow path cells marked as true
        newGrid = Array(newHeight).fill(null).map(() => Array(newWidth).fill(false))

        newArrows.forEach(arrow => {
          if (arrow.path && Array.isArray(arrow.path)) {
            arrow.path.forEach((cell: { row: number, col: number }) => {
              if (cell.row >= 0 && cell.row < newHeight && cell.col >= 0 && cell.col < newWidth) {
                newGrid![cell.row][cell.col] = true
              }
            })
          }
        })

        // Also mark obstacle cells
        newObstacles.forEach(obs => {
          if (obs.cells && Array.isArray(obs.cells)) {
            obs.cells.forEach((cell: { row: number, col: number }) => {
              if (cell.row >= 0 && cell.row < newHeight && cell.col >= 0 && cell.col < newWidth) {
                newGrid![cell.row][cell.col] = true
              }
            })
          } else if (obs.row !== undefined && obs.col !== undefined && obs.type !== 'iced_snake' && obs.type !== 'key_snake') {
            if (obs.row >= 0 && obs.row < newHeight && obs.col >= 0 && obs.col < newWidth) {
              newGrid![obs.row][obs.col] = true
            }
          }
        })
      }

      // === PHASE 6: Apply changes ===
      // If grid size changed, we need to handle grid reset carefully
      if (autoResizeGridOnImport && allRawPositions.length > 0) {
        // Set pending grid data BEFORE resizing so useEffect can apply it
        pendingGridDataRef.current = newGrid
        isImportingRef.current = true
        setGridSize({ width: newWidth, height: newHeight })
      } else if (newGrid) {
        // No resize needed, just set grid directly
        setGridData(() => newGrid!)
      }

      setGeneratorOverlays({ arrows: newArrows, obstacles: newObstacles })
      setNextItemId(maxId + 1)
      setActiveView('generator') // Switch view
      addNotification('success', `Imported ${newArrows.length} snakes and ${newObstacles.length} obstacles`)

    } catch (e) {
      console.error(e)
      addNotification('error', 'Failed to import JSON')
    }
  }

  const handleFillGaps = async () => {
    try {
      addNotification('info', 'Filling gaps...')

      const response = await apiRequest('/fill-gaps', {
        method: 'POST',
        body: JSON.stringify({
          rows: gridSize.height,
          cols: gridSize.width,
          snakes: generatorOverlays.arrows.map(a => ({
            path: a.path || [{ row: a.row, col: a.col }],
            color: a.color
          })),
          obstacles: generatorOverlays.obstacles,
          grid: gridData,
          colors: snakePalette,
          // Use complexity settings from LeftSidebar/Settings
          min_len: lengthRange.min,
          max_len: lengthRange.max,
          min_bends: bendsRange.min,
          max_bends: bendsRange.max
        }),
      })

      const result = await response.json()

      if (result.error) {
        addNotification('error', `Fill gaps failed: ${result.error}`)
        return
      }

      // Import the result to update overlays (don't auto-fill draw layer when filling gaps)
      // Use grid size from response to ensure correct coordinate transform
      if (result.level_json) {
        const sourceGridSize = result.grid_rows && result.grid_cols
          ? { rows: result.grid_rows, cols: result.grid_cols }
          : undefined
        handleImportJson(JSON.stringify(result.level_json), false, sourceGridSize)
        addNotification('success', `Added ${result.snakes_added} snakes to fill gaps!`)
      }
    } catch (error) {
      console.error('Fill gaps error:', error)
      addNotification('error', 'Failed to fill gaps. Is the server running?')
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
                  const obs = generatorOverlays.obstacles.find(o => o.id === id)
                  setGeneratorOverlays(prev => ({
                    ...prev,
                    obstacles: prev.obstacles.filter(o => o.id !== id)
                  }))
                  if (obs && obstacleDeleteCallback.current) {
                    obstacleDeleteCallback.current(obs.row, obs.col)
                  }
                }}
                onUpdateObstacle={(id, updates) => {
                  const obs = generatorOverlays.obstacles.find(o => o.id === id)
                  setGeneratorOverlays(prev => ({
                    ...prev,
                    obstacles: prev.obstacles.map(o =>
                      o.id !== id ? o : { ...o, ...updates }
                    )
                  }))
                  if (obs && obstacleUpdateCallback.current) {
                    obstacleUpdateCallback.current(obs.row, obs.col, updates)
                  }
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