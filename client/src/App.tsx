import { useState } from 'react'
import { LeftSidebar } from './components/LeftSidebar'
import { RightSidebar } from './components/RightSidebar'
import { GridCanvas } from './components/GridCanvas'

function App() {
  const [activePanel, setActivePanel] = useState<'panel1' | 'panel2' | 'settings'>('panel1')
  const [currentTool, setCurrentTool] = useState<'pen' | 'eraser' | 'shape'>('pen')
  const [currentShape, setCurrentShape] = useState<'rectangle' | 'circle' | 'line' | 'triangle' | 'diamond' | 'frame'>('rectangle')
  const [rows, setRows] = useState(50)
  const [cols, setCols] = useState(50)
  const [gridData, setGridData] = useState<boolean[][]>(() =>
    Array(rows).fill(null).map(() => Array(cols).fill(false))
  )

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

  const handleImageUpload = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        // Create a temporary canvas to read pixel data
        const canvas = document.createElement('canvas')
        canvas.width = cols
        canvas.height = rows
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        ctx.drawImage(img, 0, 0, cols, rows)
        const imageData = ctx.getImageData(0, 0, cols, rows)

        const newGrid = Array(rows).fill(null).map(() => Array(cols).fill(false))

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const idx = (r * cols + c) * 4
            const brightness = (imageData.data[idx] + imageData.data[idx + 1] + imageData.data[idx + 2]) / 3
            // If pixel is dark enough (< 200), mark as active
            if (brightness < 200) {
              newGrid[r][c] = true
            }
          }
        }

        setGridData(newGrid)
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  const handleClearGrid = () => {
    setGridData(Array(rows).fill(null).map(() => Array(cols).fill(false)))
  }

  const handleGridSizeChange = (newRows: number, newCols: number) => {
    setRows(newRows)
    setCols(newCols)
    setGridData(Array(newRows).fill(null).map(() => Array(newCols).fill(false)))
  }

  return (
    <div className="h-screen flex bg-gray-900 text-white">
      {/* Left Sidebar - Panel Selection & Grid Settings */}
      <LeftSidebar
        activePanel={activePanel}
        onPanelChange={setActivePanel}
        rows={rows}
        cols={cols}
        onGridSizeChange={handleGridSizeChange}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Header - now simpler since panels are in sidebar */}
        <div className="h-14 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-6">
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
            {activePanel === 'panel1' && '📐 Grid Editor'}
            {activePanel === 'panel2' && '🎮 Level Generator'}
            {activePanel === 'settings' && '⚙️ Settings'}
          </h1>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden relative">
          {activePanel === 'panel1' && (
            <GridCanvas
              gridData={gridData}
              onCellToggle={handleCellToggle}
              onBulkCellToggle={handleBulkCellToggle}
              rows={rows}
              cols={cols}
              currentTool={currentTool}
              currentShape={currentShape}
            />
          )}
          {activePanel === 'panel2' && (
            <div className="flex items-center justify-center h-full text-gray-500 bg-gray-900/50">
              <div className="text-center p-8 bg-gray-800 rounded-2xl shadow-xl">
                <p className="text-2xl mb-4">🚧 Generator Panel</p>
                <p className="text-gray-400">Coming in Phase 2</p>
              </div>
            </div>
          )}
          {activePanel === 'settings' && (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center p-8 bg-gray-800 rounded-2xl shadow-xl">
                <p className="text-2xl mb-4">⚙️ Settings Panel</p>
                <p className="text-gray-400">Coming soon</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Sidebar - Tools (only show for panel1) */}
      {activePanel === 'panel1' && (
        <RightSidebar
          currentTool={currentTool}
          onToolChange={setCurrentTool}
          currentShape={currentShape}
          onShapeChange={setCurrentShape}
          onImageUpload={handleImageUpload}
          onClearGrid={handleClearGrid}
        />
      )}
    </div>
  )
}

export default App
