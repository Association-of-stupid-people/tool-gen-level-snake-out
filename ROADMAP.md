# Lộ trình dự án: Snake Level Generator 🐍

Lộ trình này phác thảo kế hoạch phát triển cho công cụ Snake Level Generator. Các giai đoạn 1-3 đã hoàn thành, tập trung vào Grid Editor, Generator, và Thuật toán thông minh. Giai đoạn 4-5 sẽ giới thiệu các tính năng nâng cao và tích hợp hệ sinh thái.

---

### 🧩 **Phase 1 — Smart Region Editor (Panel 1)**

**Status: ✅ Complete**

#### **1.1 — Grid Canvas System**

- [x] Interactive canvas with zoom/pan.
- [x] Cell drawing with mouse events.
- [x] Real-time grid state updates.
- [x] Responsive layout & sizing.

#### **1.2 — Drawing Tools**

- [x] Pen tool (draw cells).
- [x] Eraser tool (remove cells).
- [x] Shape tools: Rectangle, Circle, Line.
- [x] Advanced shapes: Triangle, Diamond, Frame.
- [x] Bulk cell toggle for performance.

#### **1.3 — Image Import & Auto-Trace**

- [x] Upload mask image.
- [x] Multiple processing methods (auto, silhouette, dark_regions).
- [x] Threshold configuration.
- [x] Convert image to grid cells.

#### **1.4 — Layer System**

- [x] Background reference layer.
- [x] Grid data layer (editable).
- [x] Visual separation of layers.

#### **1.5 — JSON Editor (Grid Data)**

- [x] View grid as JSON (0/1 matrix).
- [x] Parse & validate JSON input.
- [x] Apply changes to canvas.
- [x] Format & copy functionality.

---

### 🎯 **Phase 2 — Generator & Obstacles (Panel 2)**

**Status: ✅ Complete**

#### **2.1 — Generation Parameters**

- [x] Arrow count configuration.
- [x] Min/Max arrow length.
- [x] Min/Max bends (turns).
- [x] Color palette management.
- [x] Generate button with loading state.

#### **2.2 — Obstacle System**

- [x] Wall (static obstacle).
- [x] Breakable wall (with counter).
- [x] Hole (void cells).
- [x] Tunnel pairs (teleport).
- [x] Frozen snake.
- [x] Locked snake (with key).

#### **2.3 — Manual Arrow Drawing**

- [x] Draw arrows directly on grid.
- [x] Path validation (adjacency, length, bends).
- [x] Color assignment from palette.
- [x] Direction auto-detection.

#### **2.4 — Level Output**

- [x] JSON output for game engine.
- [x] Download JSON file.
- [x] Download level preview image.
- [x] Level ID with Prefix/Suffix naming.
- [x] Copy JSON to clipboard.

#### **2.5 — Validation & Review**

- [x] Solvability check.
- [x] Validation logs display.
- [x] Warning for stuck snakes.
- [x] Coverage percentage.

---

### ⚙️ **Phase 3 — Server Refactor & Smart Algorithms**

**Status: ✅ Complete**

#### **3.1 — Custom Grid Input**

- [x] Accept JSON grid (True/False array) from client.
- [x] Parse boolean, integer (0/1), and string formats.
- [x] Dynamic ROWS/COLS calculation.

#### **3.2 — Obstacle Processing**

- [x] Process obstacle list from client.
- [x] Exclude obstacle cells from valid space.
- [x] Tunnel pair linking.
- [x] Support multi-cell obstacles.

#### **3.3 — Fill Strategies (9 Algorithms)**

- [x] **SMART_DYNAMIC**: Balanced, optimized coverage.
- [x] **RANDOM_ADAPTIVE**: Random with space adaptation.
- [x] **MAX_CLUMP**: Greedy, prioritize large regions.
- [x] **MIN_FRAGMENT**: Prioritize small regions first.
- [x] **EDGE_HUGGER**: Fill from grid edges.
- [x] **LAYERED**: Layer-by-layer fill pattern.
- [x] **SPIRAL_FILL**: Spiral inward pattern.
- [x] **SYMMETRY**: Symmetrical snake placement.
- [x] Strategy registry for easy extension.

#### **3.4 — Smart Fill Gaps**

- [x] Detect remaining empty cells.
- [x] Simulation-based gap filling.
- [x] Respect complexity constraints.
- [x] Bonus fill toggle option.

#### **3.5 — Logging & Quality Metrics**

- [x] Coverage percentage calculation.
- [x] Solvability validation.
- [x] Attempt retry system (up to 20 retries).
- [x] Large grid optimization (reduced retries).
- [x] Detailed warning logs.

#### **3.6 — Difficulty Calculator**

- [x] Calculate level difficulty score.
- [x] Consider snake complexity.
- [x] Consider obstacle density.
- [x] API endpoint for difficulty.

---

### 🎮 **Phase 4 — Developer Experience & Utilities**

**Status: 🚧 In Progress**

#### **4.1 — Simulation Mode**

- [x] Mini Snake Engine in browser.
- [x] Click-to-move snake interaction.
- [x] Exit detection & animation.
- [x] Collision detection.
- [x] Zoom/pan in simulation.
- [x] Autoplay button.
- [x] Visual path highlighting.

#### **4.2 — Undo/Redo System**

- [x] History hook implementation.
- [x] Keyboard shortcuts (Ctrl+Z / Ctrl+Y).

#### **4.3 — Enhanced Arrow Drawing Toolkit**

- [x] Arrow selection (click to select).
- [x] Multi-select with Shift+click.
- [x] Bulk operations (delete, recolor, flip).
- [x] Edit existing arrow path, Extend/shorten arrow from head/tail (drag nodes).
- [x] Marquee selection (right-drag to create selection box).



