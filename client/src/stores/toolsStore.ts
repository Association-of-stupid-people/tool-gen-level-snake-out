import { create } from 'zustand'

type Tool = 'pen' | 'eraser' | 'shape'
type Shape = 'rectangle' | 'circle' | 'line' | 'triangle' | 'diamond' | 'frame'
type GeneratorTool = 'arrow' | 'obstacle' | 'eraser' | 'none'
type View = 'grid' | 'generator'
type Panel = 'panel1' | 'panel2' | 'settings'

interface GeneratorSettings {
    arrowColor: string
    obstacleType: string
    obstacleColor: string
    obstacleCount: number
    tunnelDirection: string
}

interface ToolsState {
    // Navigation
    activeView: View
    activeSidebar: Panel
    setActiveView: (view: View) => void
    setActiveSidebar: (panel: Panel) => void

    // Grid Editor Tools
    currentTool: Tool
    currentShape: Shape
    setCurrentTool: (tool: Tool) => void
    setCurrentShape: (shape: Shape) => void

    // Generator Tools
    generatorTool: GeneratorTool
    generatorSettings: GeneratorSettings
    setGeneratorTool: (tool: GeneratorTool) => void
    setGeneratorSettings: (settings: Partial<GeneratorSettings>) => void

    // Generator State
    isGenerating: boolean
    generatedImage: string | null
    levelJson: any | null
    levelId: number
    setIsGenerating: (generating: boolean) => void
    setGeneratedImage: (image: string | null) => void
    setLevelJson: (json: any | null) => void
    setLevelId: (id: number) => void
}

export const useToolsStore = create<ToolsState>((set) => ({
    // Navigation
    activeView: 'grid',
    activeSidebar: 'panel1',
    setActiveView: (view) => set({ activeView: view }),
    setActiveSidebar: (panel) => set({ activeSidebar: panel }),

    // Grid Editor Tools
    currentTool: 'pen',
    currentShape: 'rectangle',
    setCurrentTool: (tool) => set({ currentTool: tool }),
    setCurrentShape: (shape) => set({ currentShape: shape }),

    // Generator Tools
    generatorTool: 'arrow',
    generatorSettings: {
        arrowColor: 'random',
        obstacleType: 'wall',
        obstacleColor: 'random',
        obstacleCount: 3,
        tunnelDirection: 'right',
    },
    setGeneratorTool: (tool) => set({ generatorTool: tool }),
    setGeneratorSettings: (settings) =>
        set((state) => ({
            generatorSettings: { ...state.generatorSettings, ...settings },
        })),

    // Generator State
    isGenerating: false,
    generatedImage: null,
    levelJson: null,
    levelId: 1,
    setIsGenerating: (generating) => set({ isGenerating: generating }),
    setGeneratedImage: (image) => set({ generatedImage: image }),
    setLevelJson: (json) => set({ levelJson: json }),
    setLevelId: (id) => set({ levelId: id }),
}))
