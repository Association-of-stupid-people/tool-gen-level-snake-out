# Project Roadmap: Snake Level Generator

This roadmap outlines the development plan for the Snake Level Generator tool, divided into 4 phases. Phase 1 & 2 focus on core level editing and generation capabilities as requested. Phase 3 & 4 introduce advanced features and ecosystem integration.

## Phase 1: Smart Region Editor (Panel 1)
**Focus:** Building a robust Grid Editor for defining the playable area.

### Features
-   **Grid System**: Interactive grid (Cell-based) where users can paint/erase cells.
-   **Image Import & Auto-Trace**:
    -   Upload an image (Mask).
    -   Algorithm to detect non-white pixels and convert them into grid cells.
    -   **Editability**: Users can manually refine (add/remove cells) the auto-generated region.
-   **Drawing Tools**:
    -   *Pen*: Toggle individual cells on/off.
    -   **Rectangle/Brush**: Select larger areas.
    -   *Erase*: Remove cells.
-   **Layers**: Separate "Background Image" layer (reference) vs "Grid" layer (active data).

## Phase 2: Advanced Generation & Logic (Panel 2)
**Focus:** Parametric generation with complex gameplay elements and strict data validation.

### Features
-   **Generation Parameters**:
    -   Basic: Level ID, Arrow Count.
    -   Ranges: Arrow Length (Min-Max), Bends (Min-Max).
-   **Advanced Obstacles System**:
    -   **Wall**: Standard blocker.
    -   **Wallbreak**: Destructible wall with custom *Countdown Value*.
    -   **Hole**: Void spaces with custom *Color ID*.
    -   **Iced / Frozen Snake**: Specify *Snake ID* (snake starts frozen).
    -   **Key & Lock**: Pair a *Key Snake ID* with a *Locked Snake ID*.
-   **Scene Settings / Global Config**:
    -   **Snake Color Palette**: Global management of available snake colors.
    -   **Background Color/Theme**: Visual settings for the level.
    -   **Grid Size Config**: Adjust rows/cols dynamic sizing.
-   **Validation & Review**:
    -   **Data Review Step**: After generation, show a "Review Mode" where users can inspect properties of every generated item (click on an arrow to see its ID, length, color).
    -   **Manual Override**: Allow dragging/moving generated snakes or changing their properties before export.

## Phase 3: Developer Experience & Quality of Life (Proposed)
**Focus:** Making the tool faster to use and safer to experiment with.

### Features
-   **Simulation Mode**:
    -   "Play" button to test the generated level directly in the browser using simple snake movement logic.
    -   Verify unsolvable scenarios (e.g., key trapped behind its own lock).
-   **Undo/Redo System**:
    -   History stack for all drawing and generation actions.
-   **Templates & Presets**:
    -   Save functionality for "Generation Presets" (e.g., "Hard Mode", "Easy Mazes").
    -   Built-in shape library (Heart, Star, Letters) extendable by user.
-   **Batch Generation**:
    -   Generate multiple variants of the same level config (Seed-based) and pick the best one.

## Phase 4: Ecosystem & Cloud Integration (Proposed)
**Focus:** Scaling the tool for team production and game engine integration.

### Features
-   **Direct Game Engine Export**:
    -   **Unity/Godot Plugin Integration**: One-click export that updates the scriptable objects or JSON files directly in the game project folder.
-   **Cloud Storage & Collaboration**:
    -   Save levels to a backend database (Supabase/Firebase).
    -   Share level URLs with teammates for review.
-   **Analytics**:
    -   Track "solvability" metrics (estimated difficulty score based on path complexity).
-   **AI Assistant**:
    -   "Smart Fill": Use AI to suggest obstacle placements to increase difficulty without making it impossible.
