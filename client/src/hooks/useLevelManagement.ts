import { useState } from 'react'
import { apiRequest, apiRequestFormData } from '../utils/api'
import { useSettings, useNotification, useToolsStore, useGridHistoryStore, useOverlaysHistoryStore } from '../stores'
import { useLanguage } from '../i18n'

export function useLevelManagement() {
    const { t } = useLanguage()
    const { addNotification } = useNotification()
    const {
        gridSize,
        snakePalette,
        autoResizeGridOnImport,
        autoFillDrawOnImport,
        lengthRange, bendsRange
    } = useSettings()

    const {
        setIsGenerating,
        setGeneratedImage,
        setLevelJson,
        setActiveView
    } = useToolsStore()

    const { gridData, setGridData } = useGridHistoryStore()
    const {
        arrows,
        obstacles,
        setOverlays: setGeneratorOverlays,
        setNextItemId
    } = useOverlaysHistoryStore()

    const [jsonInput, setJsonInput] = useState('')

    // Refs needed for coordinated grid resizing (handled in App.tsx typically, 
    // but we can pass them back or manage them here if we include the useEffect)
    // For now, we'll return the signals needed.

    const handleImportJson = (json: string, shouldAutoFill: boolean = true, sourceGridSize?: { rows: number, cols: number }) => {
        try {
            const levelData = JSON.parse(json)
            if (!Array.isArray(levelData)) {
                addNotification('error', 'Invalid JSON format: Root must be an array')
                return
            }

            const getColor = (id: number | null) => {
                if (id === null || id === -1 || id === undefined) return undefined
                return snakePalette[id] || snakePalette[0]
            }

            const allRawPositions: { x: number, y: number }[] = []
            levelData.forEach((item: any) => {
                if (item.itemType === 'icedSnake' || item.itemType === 'keySnake') return
                if (!item.position || !Array.isArray(item.position)) return
                item.position.forEach((p: { x: number, y: number }) => {
                    allRawPositions.push(p)
                })
            })

            let newWidth = sourceGridSize ? sourceGridSize.cols : gridSize.width
            let newHeight = sourceGridSize ? sourceGridSize.rows : gridSize.height
            let offsetRow = 0
            let offsetCol = 0

            if (shouldAutoFill && autoResizeGridOnImport && allRawPositions.length > 0) {
                const minX = Math.min(...allRawPositions.map(p => p.x))
                const maxX = Math.max(...allRawPositions.map(p => p.x))
                const minY = Math.min(...allRawPositions.map(p => p.y))
                const maxY = Math.max(...allRawPositions.map(p => p.y))

                const contentWidth = maxX - minX + 1
                const contentHeight = maxY - minY + 1
                const padding = 1
                newWidth = contentWidth + padding * 2
                newHeight = contentHeight + padding * 2

                const contentCenterX = (minX + maxX) / 2
                const contentCenterY = (minY + maxY) / 2

                offsetRow = contentCenterY
                offsetCol = -contentCenterX
            }

            const centerR = Math.floor(newHeight / 2)
            const centerC = Math.floor(newWidth / 2)

            const fromPos = (p: { x: number, y: number }) => ({
                row: Math.round(centerR - p.y + offsetRow),
                col: Math.round(p.x + centerC + offsetCol)
            })

            const newArrows: any[] = []
            const newObstacles: any[] = []
            let maxId = 0

            levelData.forEach((item: any) => {
                if (item.itemID !== null && item.itemID !== undefined) {
                    maxId = Math.max(maxId, item.itemID)
                }

                if (item.itemType === 'icedSnake') {
                    newObstacles.push({
                        id: item.itemID,
                        type: 'iced_snake',
                        row: 0, col: 0,
                        snakeId: item.itemValueConfig?.snakeID,
                        countdown: item.itemValueConfig?.count
                    })
                    return
                }
                if (item.itemType === 'keySnake') {
                    newObstacles.push({
                        id: item.itemID,
                        type: 'key_snake',
                        row: 0, col: 0,
                        keySnakeId: item.itemValueConfig?.keyID,
                        lockedSnakeId: item.itemValueConfig?.lockID
                    })
                    return
                }

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

            let newGrid: boolean[][] | null = null
            if (shouldAutoFill && autoFillDrawOnImport && newArrows.length > 0) {
                newGrid = Array(newHeight).fill(null).map(() => Array(newWidth).fill(false))
                newArrows.forEach(arrow => {
                    if (arrow.path) {
                        arrow.path.forEach((cell: { row: number, col: number }) => {
                            if (cell.row >= 0 && cell.row < newHeight && cell.col >= 0 && cell.col < newWidth) {
                                newGrid![cell.row][cell.col] = true
                            }
                        })
                    }
                })
                newObstacles.forEach(obs => {
                    if (obs.cells) {
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

            if (autoResizeGridOnImport && allRawPositions.length > 0) {
                // Signals needed for sync resize
                return {
                    newWidth, newHeight, newGrid, newArrows, newObstacles, maxId,
                    type: 'RESIZE' as const
                }
            } else {
                if (newGrid) setGridData(() => newGrid!)
                setGeneratorOverlays({ arrows: newArrows, obstacles: newObstacles })
                setNextItemId(maxId + 1)
                setActiveView('generator')
                addNotification('success', t('importSuccess' as any))
                return { type: 'SUCCESS' as const }
            }

        } catch (e) {
            console.error(e)
            addNotification('error', t('importError' as any))
            return { type: 'ERROR' as const }
        }
    }

    const handleGenerate = async (params: any) => {
        setIsGenerating(true)
        setGeneratedImage(null)
        setLevelJson(null)

        try {
            const formData = new FormData()
            formData.append('arrow_count', params.arrowCount)
            formData.append('min_arrow_length', params.minLen)
            formData.append('max_arrow_length', params.maxLen)
            formData.append('min_bends', params.minBends)
            formData.append('max_bends', params.maxBends)
            formData.append('colors', JSON.stringify(params.palette))
            formData.append('obstacles', JSON.stringify(params.obstacles))
            if (params.distributionStrategy) formData.append('strategy', params.distributionStrategy)
            formData.append('bonus_fill', params.bonusFill !== undefined ? String(params.bonusFill) : 'true')
            formData.append('shape_input', 'RECTANGLE_SHAPE')
            if (params.customInput) formData.append('custom_grid', params.customInput)

            const response = await apiRequestFormData('/generate', formData)
            const data = await response.json()

            if (data.error) {
                addNotification('error', 'Error: ' + data.error)
            } else {
                const sourceGridSize = data.grid_rows && data.grid_cols
                    ? { rows: data.grid_rows, cols: data.grid_cols }
                    : undefined

                setGeneratedImage(data.base64_image)
                setLevelJson(data.level_json)

                if (data.is_solvable === false) {
                    addNotification('warning', `Level is STUCK! ${data.stuck_count} snakes cannot exit.`)
                } else {
                    addNotification('success', 'Level generated successfully!')
                }
                return { levelJson: data.level_json, sourceGridSize }
            }
        } catch (error) {
            console.error('Generation failed:', error)
            addNotification('error', 'Failed to connect to server')
        } finally {
            setIsGenerating(false)
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
                    snakes: arrows.map(a => ({
                        path: a.path || [{ row: a.row, col: a.col }],
                        color: a.color
                    })),
                    obstacles: obstacles,
                    grid: gridData,
                    colors: snakePalette,
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

            if (result.level_json) {
                const sourceGridSize = result.grid_rows && result.grid_cols
                    ? { rows: result.grid_rows, cols: result.grid_cols }
                    : undefined
                addNotification('success', `Added ${result.snakes_added} snakes to fill gaps!`)
                return { levelJson: result.level_json, sourceGridSize }
            }
        } catch (error) {
            console.error('Fill gaps error:', error)
            addNotification('error', 'Failed to fill gaps. Is the server running?')
        }
    }

    const handleExportJson = () => {
        const rows = gridSize.height
        const cols = gridSize.width
        const centerR = Math.floor(rows / 2)
        const centerC = Math.floor(cols / 2)

        const toPos = (p: { row: number, col: number }) => ({
            x: p.col - centerC,
            y: centerR - p.row
        })

        const levelData = [
            ...arrows.map(a => ({
                itemID: a.id,
                itemType: 'snake',
                position: (a.path || [{ row: a.row, col: a.col }]).slice().reverse().map(toPos),
                colorID: snakePalette.indexOf(a.color || '') !== -1 ? snakePalette.indexOf(a.color || '') : 0
            })),
            ...obstacles.map(o => {
                const base = {
                    itemID: o.id,
                    position: o.cells ? o.cells.map(toPos) : [toPos({ row: o.row, col: o.col })],
                    colorID: o.color ? (snakePalette.indexOf(o.color) !== -1 ? snakePalette.indexOf(o.color) : 0) : 0
                }
                if (o.type === 'wall') return { ...base, itemType: 'wall' }
                if (o.type === 'wall_break') return { ...base, itemType: 'wallBreak', itemValueConfig: { count: o.count || 1 } }
                if (o.type === 'hole') return { ...base, itemType: 'hole' }
                if (o.type === 'tunnel') {
                    let dx = 1, dy = 0
                    if (o.direction === 'left') { dx = -1; dy = 0 }
                    else if (o.direction === 'up') { dx = 0; dy = 1 }
                    else if (o.direction === 'down') { dx = 0; dy = -1 }
                    return { ...base, itemType: 'tunel', itemValueConfig: { directX: dx, directY: dy } }
                }
                if (o.type === 'iced_snake') return { ...base, itemType: 'icedSnake', itemValueConfig: { snakeID: o.snakeId, count: o.countdown } }
                if (o.type === 'key_snake') return { ...base, itemType: 'keySnake', itemValueConfig: { keyID: o.keySnakeId, lockID: o.lockedSnakeId } }
                return { ...base, itemType: 'wall' }
            })
        ]

        const blob = new Blob([JSON.stringify(levelData, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `level_${new Date().getTime()}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        addNotification('success', 'Level JSON exported successfully!')
    }

    return {
        jsonInput,
        setJsonInput,
        handleImportJson,
        handleExportJson,
        handleGenerate,
        handleFillGaps
    }
}
