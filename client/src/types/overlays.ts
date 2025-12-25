// Shared Types for Generator Overlays

export interface Position {
    row: number
    col: number
}

export interface Arrow {
    id: number
    row: number
    col: number
    direction: string
    color: string
    path?: Position[]
    type?: string
    keyId?: number
    lockId?: number
    snakeId?: number
    countdown?: number
}

export interface Obstacle {
    id: number
    row: number
    col: number
    type: string
    color?: string
    count?: number
    cells?: Position[]
    direction?: string
    snakeId?: number
    keySnakeId?: number
    lockedSnakeId?: number
    countdown?: number
}

export interface GeneratorOverlays {
    arrows: Arrow[]
    obstacles: Obstacle[]
}

// Export Position type for level JSON
export interface ExportPosition {
    x: number
    y: number
}

export interface ExportItemConfig {
    count?: number
    snakeID?: number
    keyID?: number
    lockID?: number
    directX?: number
    directY?: number
}

export interface ExportLevelItem {
    itemID: number
    itemType: string
    position: ExportPosition[] | null
    itemValueConfig: ExportItemConfig | null
    colorID: number | null
}
