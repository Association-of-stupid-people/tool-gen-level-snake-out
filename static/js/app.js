let currentLevelJson = null; // Lưu JSON data để export

// ========== COLOR MANAGEMENT ==========
let colorList = []; // Initialize empty color list
let colorIndexCounter = 0;

// ========== JSON EXPORT FUNCTIONS ==========
function downloadJSON(jsonData, filename) {
  const jsonString = JSON.stringify(jsonData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ========== TAB SWITCHING ==========
document.querySelectorAll('.tab-button').forEach(button => {
  button.addEventListener('click', function() {
    const targetTab = this.getAttribute('data-tab');
    
    // Update buttons
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    this.classList.add('active');
    
    // Update content
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(targetTab).classList.add('active');
    
    // If switching to custom tab and we have a generated level, load it
    if (targetTab === 'custom-tab' && currentLevelJson && currentLevelJson.length > 0) {
      if (confirm('Load the generated level into Custom editor?')) {
        loadLevelIntoCustom(currentLevelJson);
      }
    }
  });
});

// ========== CUSTOM LEVEL DRAWING ==========
let gridRows = 20;
let gridCols = 20;
let gridData = {}; // {row_col: {type: 'snake'|'wall'|'hole'|'tunnel', data: ...}}
let currentTool = 'snake';
let currentSnakePath = []; // Temporary path while drawing
let snakes = []; // List of completed snakes
let tunnelFirst = null; // First click for tunnel pair
let isDragging = false; // Track drag state for snake drawing
let lastDragCell = null; // Prevent duplicate cells while dragging
let colorPickerVisible = false; // Track color picker visibility
let colorPickerTargetSnake = null; // Track which snake is being colored
let colorPickerTargetType = null; // Track target type: 'snake' or 'hole'
let colorPickerTargetHoleKey = null; // Track which hole is being colored

function createGrid(rows, cols, preserveData = false) {
  const oldRows = gridRows;
  const oldCols = gridCols;
  
  gridRows = rows;
  gridCols = cols;
  const canvas = document.getElementById('grid-canvas');
  const width = cols * 20;
  const height = rows * 20;
  
  // Check if we need to clear data when shrinking
  if (preserveData && (rows < oldRows || cols < oldCols)) {
    // Check if any data is outside new bounds
    let hasDataOutside = false;
    
    // Check snakes
    snakes.forEach(snake => {
      snake.path.forEach(([r, c]) => {
        if (r >= rows || c >= cols) {
          hasDataOutside = true;
        }
      });
    });
    
    // Check gridData
    Object.keys(gridData).forEach(key => {
      const [r, c] = key.split('_').map(Number);
      if (r >= rows || c >= cols) {
        hasDataOutside = true;
      }
    });
    
    if (hasDataOutside) {
      if (!confirm('New grid size is smaller and will delete some items. Continue?')) {
        return; // Cancel resize
      }
      clearGrid(); // Clear all data
      preserveData = false;
    }
  }
  
  // If preserving data, center it in new grid
  if (preserveData && (rows > oldRows || cols > oldCols)) {
    const offsetR = Math.floor((rows - oldRows) / 2);
    const offsetC = Math.floor((cols - oldCols) / 2);
    
    // Offset snakes
    const newSnakes = [];
    snakes.forEach(snake => {
      const newPath = snake.path.map(([r, c]) => [r + offsetR, c + offsetC]);
      newSnakes.push({ path: newPath, colorID: snake.colorID });
    });
    snakes = newSnakes;
    
    // Offset gridData
    const newGridData = {};
    Object.keys(gridData).forEach(key => {
      const [r, c] = key.split('_').map(Number);
      const newKey = getCellKey(r + offsetR, c + offsetC);
      newGridData[newKey] = { ...gridData[key] };
      
      // Update tunnel pairs
      if (gridData[key].type === 'tunnel' && gridData[key].pair) {
        newGridData[newKey].pair = {
          r: gridData[key].pair.r + offsetR,
          c: gridData[key].pair.c + offsetC
        };
      }
    });
    gridData = newGridData;
  }
  
  canvas.innerHTML = '';
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  
  // Create SVG overlay
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.id = 'grid-svg-overlay';
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  
  for (let r = 0; r < rows; r++) {
    const row = document.createElement('div');
    row.className = 'grid-row';
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement('div');
      cell.className = 'grid-cell';
      cell.dataset.row = r;
      cell.dataset.col = c;
      cell.addEventListener('click', handleCellClick);
      cell.addEventListener('contextmenu', handleCellRightClick);
      cell.addEventListener('mousedown', handleCellMouseDown);
      cell.addEventListener('mouseenter', handleCellMouseEnter);
      cell.addEventListener('mouseup', handleCellMouseUp);
      row.appendChild(cell);
    }
    canvas.appendChild(row);
  }
  
  canvas.appendChild(svg);
  
  if (preserveData) {
    updateGrid();
  }
}

function getCellKey(r, c) {
  return `${r}_${c}`;
}

function getCell(r, c) {
  return document.querySelector(`.grid-cell[data-row="${r}"][data-col="${c}"]`);
}

function handleCellMouseDown(e) {
  if (e.button !== 0) return; // Only left click
  
  const r = parseInt(e.target.dataset.row);
  const c = parseInt(e.target.dataset.col);
  const key = getCellKey(r, c);

  if (currentTool === 'snake') {
    // Start dragging snake
    isDragging = true;
    lastDragCell = key;
    currentSnakePath = [[r, c]];
    gridData[key] = { type: 'temp-snake' };
    updateGrid();
    e.preventDefault(); // Prevent text selection
  }
}

function handleCellMouseEnter(e) {
  if (!isDragging || currentTool !== 'snake') return;
  
  const r = parseInt(e.target.dataset.row);
  const c = parseInt(e.target.dataset.col);
  const key = getCellKey(r, c);

  // Avoid duplicate cells
  if (key === lastDragCell) return;
  
  // Check if cell already in current snake path (backtracking)
  const pathIndex = currentSnakePath.findIndex(([pr, pc]) => pr === r && pc === c);
  if (pathIndex !== -1) {
    // User is backtracking - remove cells from this index onward
    const cellsToRemove = currentSnakePath.slice(pathIndex);
    
    // Clean up gridData for removed cells
    cellsToRemove.forEach(([cellR, cellC]) => {
      const cellKey = getCellKey(cellR, cellC);
      delete gridData[cellKey];
    });
    
    // Truncate path at the backtrack point
    currentSnakePath = currentSnakePath.slice(0, pathIndex);
    
    // Update lastDragCell to the new end (or null if empty)
    if (currentSnakePath.length > 0) {
      const [lastR, lastC] = currentSnakePath[currentSnakePath.length - 1];
      lastDragCell = getCellKey(lastR, lastC);
    } else {
      lastDragCell = null;
    }
    
    updateGrid();
    return;
  }
  
  // Check if cell is already occupied by non-snake
  if (gridData[key] && gridData[key].type !== 'temp-snake') {
    return;
  }

  // Add to path
  currentSnakePath.push([r, c]);
  lastDragCell = key;
  gridData[key] = { type: 'temp-snake' };
  updateGrid();
}

function handleCellMouseUp(e) {
  if (e.button !== 0) return; // Only left click
  
  if (isDragging && currentTool === 'snake') {
    finishCurrentSnake();
    isDragging = false;
    lastDragCell = null;
  }
}

// Global mouseup to handle release outside grid
document.addEventListener('mouseup', function(e) {
  if (isDragging && currentTool === 'snake') {
    finishCurrentSnake();
    isDragging = false;
    lastDragCell = null;
  }
});

// Global click listener to close color picker when clicking outside
document.addEventListener('click', function(e) {
  if (colorPickerVisible) {
    const picker = document.getElementById('color-picker-popup');
    const clickedInsidePicker = picker && picker.contains(e.target);
    const clickedOnGrid = e.target.classList.contains('grid-cell');
    
    // Close picker if clicked outside of it and not on a grid cell (which shows picker)
    if (!clickedInsidePicker && !clickedOnGrid) {
      hideColorPicker();
    }
  }
});

function handleCellClick(e) {
  // For non-snake tools, use click
  const r = parseInt(e.target.dataset.row);
  const c = parseInt(e.target.dataset.col);
  const key = getCellKey(r, c);

  // If clicking on snake cell with snake tool, show color picker
  if (currentTool === 'snake') {
    const snakeIndex = snakes.findIndex(snake => 
      snake.path.some(([sr, sc]) => sr === r && sc === c)
    );
    
    if (snakeIndex !== -1) {
      // Show color picker
      if (colorList.length > 0) {
        const rect = e.target.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        showColorPicker(snakeIndex, x, y);
      }
      return;
    }
  }

  if (currentTool === 'wall') {
    if (gridData[key]) delete gridData[key];
    const counterValue = parseInt(document.getElementById('wall-counter-input').value) || 3;
    gridData[key] = { type: 'wall', counter: counterValue };
    updateGrid();
  } else if (currentTool === 'hole') {
    // If clicking on existing hole, show color picker
    if (gridData[key] && gridData[key].type === 'hole') {
      if (colorList.length > 0) {
        const rect = e.target.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        showColorPickerForHole(key, x, y);
      }
      return;
    }
    // Otherwise create new hole
    if (gridData[key]) delete gridData[key];
    // Assign default colorID (first color in list, or -1 if empty)
    const defaultColorID = colorList.length > 0 ? 0 : -1;
    gridData[key] = { type: 'hole', colorID: defaultColorID };
    updateGrid();
  } else if (currentTool === 'tunnel') {
    handleTunnelClick(r, c, key);
  } else if (currentTool === 'delete') {
    handleCellDelete(r, c, key);
  }
}

function handleCellRightClick(e) {
  e.preventDefault(); // Prevent context menu
  const r = parseInt(e.target.dataset.row);
  const c = parseInt(e.target.dataset.col);
  const key = getCellKey(r, c);
  handleCellDelete(r, c, key);
}

function handleCellDelete(r, c, key) {
  delete gridData[key];
  // Also remove from snakes if part of snake
  snakes = snakes.filter(snake => {
    return !snake.path.some(pos => pos[0] === r && pos[1] === c);
  });
  updateGrid();
}

function showColorPicker(snakeIndex, x, y) {
  const picker = document.getElementById('color-picker-popup');
  const swatchesContainer = document.getElementById('color-picker-swatches');
  
  // Clear previous swatches
  swatchesContainer.innerHTML = '';
  
  // Get current color of the snake
  const currentColorID = snakes[snakeIndex].colorID !== undefined ? snakes[snakeIndex].colorID : -1;
  
  // Create color swatches
  colorList.forEach((color, index) => {
    const swatch = document.createElement('div');
    swatch.className = 'color-swatch';
    if (index === currentColorID) {
      swatch.classList.add('selected');
    }
    swatch.style.backgroundColor = color;
    swatch.dataset.colorId = index;
    
    // Add click handler
    swatch.addEventListener('click', function(e) {
      e.stopPropagation();
      applyColorToTarget(index);
    });
    
    swatchesContainer.appendChild(swatch);
  });
  
  // Position the picker near the click location
  picker.style.display = 'block';
  colorPickerVisible = true;
  colorPickerTargetSnake = snakeIndex;
  colorPickerTargetType = 'snake';
  
  positionColorPicker(picker, x, y);
}

function showColorPickerForHole(holeKey, x, y) {
  const picker = document.getElementById('color-picker-popup');
  const swatchesContainer = document.getElementById('color-picker-swatches');
  
  // Clear previous swatches
  swatchesContainer.innerHTML = '';
  
  // Get current color of the hole
  const currentColorID = gridData[holeKey] && gridData[holeKey].colorID !== undefined 
    ? gridData[holeKey].colorID : -1;
  
  // Create color swatches
  colorList.forEach((color, index) => {
    const swatch = document.createElement('div');
    swatch.className = 'color-swatch';
    if (index === currentColorID) {
      swatch.classList.add('selected');
    }
    swatch.style.backgroundColor = color;
    swatch.dataset.colorId = index;
    
    // Add click handler
    swatch.addEventListener('click', function(e) {
      e.stopPropagation();
      applyColorToTarget(index);
    });
    
    swatchesContainer.appendChild(swatch);
  });
  
  // Position the picker near the click location
  picker.style.display = 'block';
  colorPickerVisible = true;
  colorPickerTargetHoleKey = holeKey;
  colorPickerTargetType = 'hole';
  
  positionColorPicker(picker, x, y);
}

function positionColorPicker(picker, x, y) {
  // Wait for the picker to render to get its dimensions
  setTimeout(() => {
    const pickerRect = picker.getBoundingClientRect();
    let left = x - pickerRect.width / 2;
    let top = y + 10; // Position below the click
    
    // Keep within viewport bounds
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    if (left < 10) left = 10;
    if (left + pickerRect.width > viewportWidth - 10) {
      left = viewportWidth - pickerRect.width - 10;
    }
    if (top + pickerRect.height > viewportHeight - 10) {
      top = y - pickerRect.height - 10; // Position above instead
    }
    if (top < 10) top = 10;
    
    picker.style.left = left + 'px';
    picker.style.top = top + 'px';
  }, 0);
}

function hideColorPicker() {
  const picker = document.getElementById('color-picker-popup');
  picker.style.display = 'none';
  colorPickerVisible = false;
  colorPickerTargetSnake = null;
  colorPickerTargetHoleKey = null;
  colorPickerTargetType = null;
}

function applyColorToTarget(colorID) {
  if (colorPickerTargetType === 'snake' && colorPickerTargetSnake !== null) {
    snakes[colorPickerTargetSnake].colorID = colorID;
    updateGrid();
  } else if (colorPickerTargetType === 'hole' && colorPickerTargetHoleKey !== null) {
    if (gridData[colorPickerTargetHoleKey]) {
      gridData[colorPickerTargetHoleKey].colorID = colorID;
      updateGrid();
    }
  }
  hideColorPicker();
}

function finishCurrentSnake() {
  if (currentSnakePath.length >= 2) {
    // Reverse so last added is head
    const reversedPath = [...currentSnakePath].reverse();
    
    // Assign random color from colorList
    const colorID = colorList.length > 0 
      ? Math.floor(Math.random() * colorList.length)
      : -1;
    
    snakes.push({ path: reversedPath, colorID: colorID });
    
    // Convert temp-snake to permanent
    currentSnakePath.forEach(([r, c]) => {
      const key = getCellKey(r, c);
      delete gridData[key];
    });
    
    currentSnakePath = [];
    isDragging = false;
    lastDragCell = null;
    updateGrid();
  } else if (currentSnakePath.length === 1) {
    // Remove single cell
    const [r, c] = currentSnakePath[0];
    delete gridData[getCellKey(r, c)];
    currentSnakePath = [];
    isDragging = false;
    lastDragCell = null;
    updateGrid();
  }
}

function generateRandomTunnelColor() {
  // Generate random RGB color
  const r = Math.floor(Math.random() * 150) + 50; // 50-200
  const g = Math.floor(Math.random() * 150) + 50;
  const b = Math.floor(Math.random() * 150) + 50;
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function handleTunnelClick(r, c, key) {
  if (gridData[key]) return; // Cell occupied
  
  if (!tunnelFirst) {
    // First tunnel of pair - generate new color
    const tunnelColor = generateRandomTunnelColor();
    tunnelFirst = { r, c, key, color: tunnelColor };
    gridData[key] = { type: 'tunnel', pair: null, color: tunnelColor };
    updateGrid();
  } else {
    // Create pair with same color
    const key1 = tunnelFirst.key;
    const key2 = key;
    const tunnelColor = tunnelFirst.color;
    gridData[key1] = { type: 'tunnel', pair: { r, c }, color: tunnelColor };
    gridData[key2] = { type: 'tunnel', pair: { r: tunnelFirst.r, c: tunnelFirst.c }, color: tunnelColor };
    tunnelFirst = null;
    updateGrid();
  }
}

function updateGrid() {
  // Clear all cells
  document.querySelectorAll('.grid-cell').forEach(cell => {
    cell.className = 'grid-cell';
    cell.textContent = '';
    cell.style.color = '';
    cell.style.fontWeight = '';
    cell.style.fontSize = '';
    cell.style.display = '';
    cell.style.alignItems = '';
    cell.style.justifyContent = '';
    cell.style.backgroundColor = '';
  });

  // Draw completed snakes
  snakes.forEach(snake => {
    snake.path.forEach(([r, c], idx) => {
      const cell = getCell(r, c);
      if (cell) {
        if (idx === 0) {
          cell.classList.add('snake-head'); // First in path is head
        } else {
          cell.classList.add('snake');
        }
      }
    });
  });

  // Draw obstacles and temp snake
  Object.keys(gridData).forEach(key => {
    const [r, c] = key.split('_').map(Number);
    const cell = getCell(r, c);
    if (cell && gridData[key]) {
      cell.classList.add(gridData[key].type);
      
      // Display counter for walls
      if (gridData[key].type === 'wall' && gridData[key].counter > 0) {
        cell.textContent = gridData[key].counter;
        cell.style.color = 'white';
        cell.style.fontWeight = 'bold';
        cell.style.fontSize = '14px';
        cell.style.display = 'flex';
        cell.style.alignItems = 'center';
        cell.style.justifyContent = 'center';
      }
      
      // Display color for holes
      if (gridData[key].type === 'hole') {
        const colorID = gridData[key].colorID !== undefined ? gridData[key].colorID : -1;
        if (colorID >= 0 && colorID < colorList.length) {
          cell.style.backgroundColor = colorList[colorID];
        } else {
          // Fallback to default blue if no valid colorID
          cell.style.backgroundColor = '#0000ff';
        }
      }
      
      // Display color for tunnels
      if (gridData[key].type === 'tunnel') {
        const tunnelColor = gridData[key].color;
        if (tunnelColor) {
          cell.style.backgroundColor = tunnelColor;
        } else {
          // Fallback to default cyan if no color specified
          cell.style.backgroundColor = '#00bcd4';
        }
      }
    }
  });

  // Draw arrows for snakes
  drawArrows();
}

function drawArrows() {
  const svg = document.getElementById('grid-svg-overlay');
  if (!svg) return;
  
  // Clear existing arrows
  svg.innerHTML = '';
  
  // Helper function to draw arrow
  function drawArrow(pathCoords, color, opacity) {
    if (pathCoords.length < 2) return;
    
    // Draw line through all points
    const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    const points = pathCoords.map(p => `${p.x},${p.y}`).join(' ');
    polyline.setAttribute('points', points);
    polyline.setAttribute('stroke', color);
    polyline.setAttribute('stroke-width', '3');
    polyline.setAttribute('stroke-opacity', opacity);
    polyline.setAttribute('fill', 'none');
    svg.appendChild(polyline);
    
    // Draw arrow head at the first point (head)
    const head = pathCoords[0];
    const neck = pathCoords[1];
    const dx = head.x - neck.x;
    const dy = head.y - neck.y;
    const angle = Math.atan2(dy, dx);
    const arrowSize = 6;
    
    const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    const point1 = {
      x: head.x,
      y: head.y
    };
    const point2 = {
      x: head.x - arrowSize * Math.cos(angle - Math.PI / 6),
      y: head.y - arrowSize * Math.sin(angle - Math.PI / 6)
    };
    const point3 = {
      x: head.x - arrowSize * Math.cos(angle + Math.PI / 6),
      y: head.y - arrowSize * Math.sin(angle + Math.PI / 6)
    };
    
    arrow.setAttribute('points', 
      `${point1.x},${point1.y} ${point2.x},${point2.y} ${point3.x},${point3.y}`);
    arrow.setAttribute('fill', color);
    arrow.setAttribute('fill-opacity', opacity);
    svg.appendChild(arrow);
  }
  
  // Draw completed snakes with their colors
  snakes.forEach(snake => {
    const pathCoords = snake.path.map(([r, c]) => ({
      x: c * 20 + 10,
      y: r * 20 + 10
    }));
    
    // Get color from colorList based on colorID
    const colorID = snake.colorID !== undefined ? snake.colorID : -1;
    const color = (colorID >= 0 && colorID < colorList.length) 
      ? colorList[colorID] 
      : '#000000';
    
    drawArrow(pathCoords, color, '1.0');
  });
  
  // Draw preview snake while dragging (gray, semi-transparent)
  if (isDragging && currentSnakePath.length >= 2) {
    const pathCoords = currentSnakePath.map(([r, c]) => ({
      x: c * 20 + 10,
      y: r * 20 + 10
    }));
    // Reverse for preview (last added is head)
    pathCoords.reverse();
    drawArrow(pathCoords, '#999', '0.6');
  }
}

function clearGrid() {
  gridData = {};
  currentSnakePath = [];
  snakes = [];
  tunnelFirst = null;
  isDragging = false;
  lastDragCell = null;
  updateGrid();
}

function exportCustomLevel() {
  const levelData = [];
  
  // 1. Collect all positions to calculate bounding box
  const allPositions = [];
  
  // From snakes
  snakes.forEach(snake => {
    snake.path.forEach(([r, c]) => allPositions.push({r, c}));
  });
  
  // From obstacles
  Object.keys(gridData).forEach(key => {
    const [r, c] = key.split('_').map(Number);
    allPositions.push({r, c});
  });
  
  // 2. Calculate bounding box center (rounded to integer)
  let centerR, centerC;
  if (allPositions.length === 0) {
    // Fallback to grid center if no items
    centerR = Math.floor(gridRows / 2);
    centerC = Math.floor(gridCols / 2);
  } else {
    const rows = allPositions.map(p => p.r);
    const cols = allPositions.map(p => p.c);
    const minR = Math.min(...rows);
    const maxR = Math.max(...rows);
    const minC = Math.min(...cols);
    const maxC = Math.max(...cols);
    centerR = Math.round((minR + maxR) / 2);
    centerC = Math.round((minC + maxC) / 2);
  }
  
  // 3. Helper function to convert grid position to center-origin
  // Origin (0,0) is at the center of bounding box containing all items
  function gridToPos(r, c) {
    return {
      x: c - centerC,
      y: centerR - r
    };
  }
  
  // 4. Export snakes
  snakes.forEach(snake => {
    const positions = snake.path.map(([r, c]) => gridToPos(r, c));
    const colorID = snake.colorID !== undefined ? snake.colorID : -1;
    levelData.push({
      position: positions,
      itemType: 'snake',
      itemValueConfig: 0,
      colorID: colorID
    });
  });

  // Export walls, holes, tunnels
  const processedTunnels = new Set();
  Object.keys(gridData).forEach(key => {
    const [r, c] = key.split('_').map(Number);
    const item = gridData[key];
    
    if (item.type === 'wall') {
      levelData.push({
        position: [gridToPos(r, c)],
        itemType: 'wallBreak',
        itemValueConfig: item.counter || 0,
        colorID: -1
      });
    } else if (item.type === 'hole') {
      const colorID = item.colorID !== undefined ? item.colorID : -1;
      levelData.push({
        position: [gridToPos(r, c)],
        itemType: 'hole',
        itemValueConfig: 0,
        colorID: colorID
      });
    } else if (item.type === 'tunnel' && item.pair && !processedTunnels.has(key)) {
      const pair = item.pair;
      const pairKey = getCellKey(pair.r, pair.c);
      processedTunnels.add(key);
      processedTunnels.add(pairKey);
      
      // Tunnel colors are visual only, not exported
      levelData.push({
        position: [
          gridToPos(r, c),
          gridToPos(pair.r, pair.c)
        ],
        itemType: 'tunnel',
        itemValueConfig: 0,
        colorID: -1  // Tunnel colors are visual only
      });
    }
  });

  return levelData;
}

// Tool selection
function selectTool(toolElement) {
  // Finish current snake if switching tool
  if (currentTool === 'snake') {
    if (currentSnakePath.length > 0) {
      finishCurrentSnake();
    }
    isDragging = false;
    lastDragCell = null;
  }
  
  // Close color picker when switching tools
  if (colorPickerVisible) {
    hideColorPicker();
  }
  
  // Check for unpaired tunnel
  if (tunnelFirst !== null) {
    const result = confirm(
      'You have an unpaired tunnel. What would you like to do?\n\n' +
      'Click OK to delete the unpaired tunnel and switch tools.\n' +
      'Click Cancel to stay on Tunnel tool.'
    );
    
    if (!result) {
      // User chose to stay on tunnel tool
      return;
    } else {
      // User chose to delete unpaired tunnel
      const key = tunnelFirst.key;
      delete gridData[key];
      tunnelFirst = null;
      updateGrid();
    }
  }
  
  document.querySelectorAll('.tool-option').forEach(t => t.classList.remove('active'));
  toolElement.classList.add('active');
  currentTool = toolElement.getAttribute('data-tool');
  
  // Reset tunnel state
  tunnelFirst = null;
}

document.querySelectorAll('.tool-option').forEach(tool => {
  tool.addEventListener('click', function() {
    selectTool(this);
  });
});

// Keyboard shortcuts for tools (S, W, H, T)
document.addEventListener('keydown', function(e) {
  // Only activate if Custom tab is active and not typing in input
  const customTabActive = document.getElementById('custom-tab').classList.contains('active');
  if (!customTabActive || e.target.tagName === 'INPUT') {
    return;
  }

  const key = e.key.toLowerCase();
  const toolElement = document.querySelector(`.tool-option[data-key="${key}"]`);
  
  if (toolElement) {
    e.preventDefault();
    selectTool(toolElement);
  }
});

// Grid controls
document.getElementById('create-grid-btn').addEventListener('click', function() {
  const rows = parseInt(document.getElementById('grid-rows').value);
  const cols = parseInt(document.getElementById('grid-cols').value);
  
  // Check if we have existing data
  const hasData = snakes.length > 0 || Object.keys(gridData).length > 0;
  
  if (hasData) {
    createGrid(rows, cols, true); // Preserve data and center it
  } else {
    createGrid(rows, cols, false); // Fresh grid
  }
});

document.getElementById('load-generated-btn').addEventListener('click', function() {
  if (!currentLevelJson || currentLevelJson.length === 0) {
    alert('No generated level found. Please generate a level first in the Generate Level tab.');
    return;
  }
  if (confirm('Load generated level? This will replace current content.')) {
    loadLevelIntoCustom(currentLevelJson);
  }
});

document.getElementById('clear-grid-btn').addEventListener('click', function() {
  if (confirm('Clear all? This cannot be undone.')) {
    clearGrid();
  }
});

document.getElementById('import-json-btn').addEventListener('click', function() {
  const input = document.getElementById('import-json-input');
  
  input.onchange = function(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    // Check file extension
    if (!file.name.toLowerCase().endsWith('.json')) {
      alert('Please select a JSON file (.json)');
      input.value = '';
      return;
    }
    
    // Check file size (5MB limit)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > maxSize) {
      alert('File too large (max 5MB)');
      input.value = '';
      return;
    }
    
    // Read file
    const reader = new FileReader();
    reader.onload = function(event) {
      try {
        const jsonData = JSON.parse(event.target.result);
        
        // Validate JSON format
        if (!Array.isArray(jsonData)) {
          throw new Error('JSON must be an array of items');
        }
        
        // Basic validation: check if items have required fields
        const isValid = jsonData.every(item => 
          item.position && 
          Array.isArray(item.position) && 
          item.itemType
        );
        
        if (!isValid) {
          throw new Error('Invalid JSON format. Each item must have "position" and "itemType" fields.');
        }
        
        // Check if grid has content
        const hasContent = snakes.length > 0 || Object.keys(gridData).length > 0;
        
        if (hasContent) {
          if (!confirm('Import will replace current content. Continue?')) {
            input.value = '';
            return;
          }
        }
        
        // Load the JSON into grid
        loadLevelIntoCustom(jsonData);
        
        alert('JSON imported successfully!');
        
        // Reset input
        input.value = '';
        
      } catch (error) {
        alert('Error reading JSON file:\n' + error.message);
        input.value = '';
      }
    };
    
    reader.onerror = function() {
      alert('Error reading file');
      input.value = '';
    };
    
    reader.readAsText(file);
  };
  
  // Trigger file input
  input.click();
});

// ========== DYNAMIC BUTTON TEXT UPDATE ==========
function updateGenerateButtonText() {
  const levelNumber = document.getElementById('level_number').value || '1';
  const btn = document.getElementById('download-json-btn');
  btn.textContent = `📥 Tải về Level${levelNumber}Data.JSON`;
}

function updateCustomButtonText() {
  const levelNumber = document.getElementById('custom_level_number').value || '1';
  const btn = document.getElementById('download-custom-json-btn');
  btn.textContent = `📥 Tải về Level${levelNumber}Data.JSON`;
}

// Listen to level input changes
document.getElementById('level_number').addEventListener('input', updateGenerateButtonText);
document.getElementById('custom_level_number').addEventListener('input', updateCustomButtonText);

// Initialize button text on page load
updateGenerateButtonText();
updateCustomButtonText();

// ========== JSON DOWNLOAD (Generate Level Tab) ==========
document.getElementById('download-json-btn').addEventListener('click', function() {
  if (!currentLevelJson || currentLevelJson.length === 0) {
    alert('Chưa có dữ liệu. Vui lòng tạo level trước.');
    return;
  }
  const levelNumber = document.getElementById('level_number').value || '1';
  const filename = `Level${levelNumber}Data.json`;
  downloadJSON(currentLevelJson, filename);
});

// ========== JSON DOWNLOAD (Custom Level Tab) ==========
document.getElementById('download-custom-json-btn').addEventListener('click', function() {
  const levelData = exportCustomLevel();
  if (!levelData || levelData.length === 0) {
    alert('Chưa có dữ liệu. Vui lòng vẽ level trước.');
    return;
  }
  const levelNumber = document.getElementById('custom_level_number').value || '1';
  const filename = `Level${levelNumber}Data.json`;
  downloadJSON(levelData, filename);
});

function loadLevelIntoCustom(levelJson) {
  // Calculate required grid size from coordinates
  let minX = 0, maxX = 0, minY = 0, maxY = 0;
  
  levelJson.forEach(item => {
    item.position.forEach(pos => {
      minX = Math.min(minX, pos.x);
      maxX = Math.max(maxX, pos.x);
      minY = Math.min(minY, pos.y);
      maxY = Math.max(maxY, pos.y);
    });
  });
  
  // Add padding
  const padding = 3;
  const neededCols = maxX - minX + 1 + (padding * 2);
  const neededRows = maxY - minY + 1 + (padding * 2);
  
  // Create grid with appropriate size
  const rows = Math.max(20, Math.min(50, neededRows));
  const cols = Math.max(20, Math.min(50, neededCols));
  
  document.getElementById('grid-rows').value = rows;
  document.getElementById('grid-cols').value = cols;
  
  // Clear and create new grid
  clearGrid();
  createGrid(rows, cols, false);
  
  // Convert center-origin to grid indices
  const centerR = Math.floor(rows / 2);
  const centerC = Math.floor(cols / 2);
  
  function posToGrid(pos) {
    // pos.x = col - centerC  =>  col = pos.x + centerC
    // pos.y = centerR - row  =>  row = centerR - pos.y
    const r = centerR - pos.y;
    const c = pos.x + centerC;
    return [r, c];
  }
  
  // Helper to check if position is valid
  function isValidPos(r, c) {
    return r >= 0 && r < rows && c >= 0 && c < cols;
  }
  
  // Load items into grid
  levelJson.forEach(item => {
    if (item.itemType === 'snake') {
      // Add snake with colorID
      const path = item.position.map(pos => posToGrid(pos)).filter(([r, c]) => isValidPos(r, c));
      const colorID = item.colorID !== undefined ? item.colorID : -1;
      if (path.length >= 2) {
        snakes.push({ path, colorID });
      }
    } else if (item.itemType === 'wallBreak' || item.itemType === 'wall') {
      const [r, c] = posToGrid(item.position[0]);
      if (isValidPos(r, c)) {
        const key = getCellKey(r, c);
        gridData[key] = { type: 'wall', counter: item.itemValueConfig || 0 };
      }
    } else if (item.itemType === 'hole') {
      const [r, c] = posToGrid(item.position[0]);
      if (isValidPos(r, c)) {
        const key = getCellKey(r, c);
        const colorID = item.colorID !== undefined ? item.colorID : -1;
        gridData[key] = { type: 'hole', colorID: colorID };
      }
    } else if (item.itemType === 'tunnel') {
      const [r1, c1] = posToGrid(item.position[0]);
      const [r2, c2] = posToGrid(item.position[1]);
      if (isValidPos(r1, c1) && isValidPos(r2, c2)) {
        const key1 = getCellKey(r1, c1);
        const key2 = getCellKey(r2, c2);
        
        // Generate random color for visual distinction (not from colorList)
        const tunnelColor = generateRandomTunnelColor();
        
        gridData[key1] = { type: 'tunnel', pair: { r: r2, c: c2 }, color: tunnelColor };
        gridData[key2] = { type: 'tunnel', pair: { r: r1, c: c1 }, color: tunnelColor };
      }
    }
  });
  
  // Render the grid
  updateGrid();
}

// Initialize grid on load
createGrid(20, 20);

// ========== GENERATE TAB (ORIGINAL) ==========

// Wall Counter Management
let wallCounterIndex = 0;

function addWallCounter() {
  const container = document.getElementById('wall-counters-container');
  const index = wallCounterIndex++;
  
  const wallItem = document.createElement('div');
  wallItem.className = 'wall-counter-item';
  wallItem.dataset.index = index;
  wallItem.innerHTML = `
    <label>Wall Break ${index + 1}:</label>
    <input type="number" class="wall-counter-value" min="0" max="99" value="3" />
    <button type="button" class="remove-wall-btn">🗑️</button>
  `;
  
  // Add remove handler
  wallItem.querySelector('.remove-wall-btn').addEventListener('click', function() {
    wallItem.remove();
  });
  
  container.appendChild(wallItem);
}

function clearAllWalls() {
  const container = document.getElementById('wall-counters-container');
  container.innerHTML = '';
  wallCounterIndex = 0;
}

document.getElementById('add-wall-btn').addEventListener('click', addWallCounter);
document.getElementById('clear-walls-btn').addEventListener('click', function() {
  if (confirm('Remove all walls?')) {
    clearAllWalls();
  }
});

// ========== COLOR MANAGEMENT ==========

function addColor(colorValue = '#000000') {
  const container = document.getElementById('colors-container');
  const index = colorList.length;
  colorList.push(colorValue);
  
  const colorItem = document.createElement('div');
  colorItem.className = 'color-item';
  colorItem.dataset.index = index;
  colorItem.innerHTML = `
    <label>Color ${index + 1}:</label>
    <input type="color" class="color-picker" value="${colorValue}" />
    <button type="button" class="remove-color-btn">🗑️</button>
  `;
  
  // Update colorList when color changes
  colorItem.querySelector('.color-picker').addEventListener('change', function(e) {
    colorList[index] = e.target.value;
  });
  
  // Add remove handler
  colorItem.querySelector('.remove-color-btn').addEventListener('click', function() {
    removeColor(index);
  });
  
  container.appendChild(colorItem);
}

function removeColor(indexToRemove) {
  colorList.splice(indexToRemove, 1);
  renderColorsList();
}

function renderColorsList() {
  const container = document.getElementById('colors-container');
  container.innerHTML = '';
  
  colorList.forEach((color, index) => {
    const colorItem = document.createElement('div');
    colorItem.className = 'color-item';
    colorItem.dataset.index = index;
    colorItem.innerHTML = `
      <label>Color ${index + 1}:</label>
      <input type="color" class="color-picker" value="${color}" />
      <button type="button" class="remove-color-btn">🗑️</button>
    `;
    
    // Update colorList when color changes
    colorItem.querySelector('.color-picker').addEventListener('change', function(e) {
      colorList[index] = e.target.value;
    });
    
    // Add remove handler
    colorItem.querySelector('.remove-color-btn').addEventListener('click', function() {
      removeColor(index);
    });
    
    container.appendChild(colorItem);
  });
}

document.getElementById('add-color-btn').addEventListener('click', function() {
  addColor();
});

// Initialize with one default color
addColor('#ef8aa8');
addColor('#84d245');
addColor('#9536e9');
addColor('#34c4cc');
addColor('#f9743a');
addColor('#6b3c2c');
addColor('#f1c24f');
addColor('#477ff7');
addColor('#ee4226');

document
  .getElementById("generate-form")
  .addEventListener("submit", function (e) {
    e.preventDefault();

    const form = e.target;
    const formData = new FormData(form);
    
    // Get wall counters
    const wallCounters = Array.from(document.querySelectorAll('.wall-counter-value'))
      .map(input => parseInt(input.value) || 0);
    
    // Add wall counters to formData
    formData.set('wall_counters', JSON.stringify(wallCounters));
    
    // Add colors to formData
    formData.set('colors', JSON.stringify(colorList));
    
    const requiredCount = formData.get("arrow_count");

    const imageElement = document.getElementById("level-image");
    const displayElement = document.getElementById("arrow-count-display");
    const resultArea = document.getElementById("result-area");
    const jsonSection = document.getElementById("json-section");

    resultArea.querySelector("h2").textContent = "Đang tạo level...";
    imageElement.style.display = "none";
    displayElement.style.display = "none";
    jsonSection.style.display = "none";

    fetch("/generate", {
      method: "POST",
      body: formData,
    })
      .then((response) => {
        if (!response.ok) {
          return response.json().then((err) => {
            throw new Error(err.error || "Lỗi không xác định.");
          });
        }
        return response.json();
      })
      .then((data) => {
        const base64Image = data.base64_image;
        const actualCount = data.actual_arrow_count;
        const levelJson = data.level_json;

        const imageUrl = "data:image/png;base64," + base64Image;
        imageElement.src = imageUrl;
        imageElement.style.display = "block";

        resultArea.querySelector("h2").textContent =
          "Level Đã Tạo Thành Công";
        displayElement.textContent = `✅ Đã tạo: ${actualCount} / ${requiredCount} Mũi tên.`;
        displayElement.style.display = "block";

        if (actualCount < requiredCount) {
          displayElement.style.color = "orange";
          displayElement.textContent += " (Lưới quá chật/Phức tạp)";
        } else {
          displayElement.style.color = "#007bff";
        }

        // Lưu level JSON data để export
        if (levelJson) {
          currentLevelJson = levelJson;
          jsonSection.style.display = "block";
        }
      })
      .catch((error) => {
        resultArea.querySelector("h2").textContent = "Lỗi!";
        imageElement.style.display = "none";
        displayElement.style.display = "none";
        jsonSection.style.display = "none";
        alert("Lỗi khi tạo level: " + error.message);
        console.error("Fetch Error:", error);
      });
  });

// Xử lý toggle giữa JSON formatted và String minified
document
  .getElementById("toggle-string-btn")
  .addEventListener("click", function () {
    if (!currentLevelJson) {
      alert("Không có dữ liệu JSON để chuyển đổi.");
      return;
    }

    const jsonOutput = document.getElementById("json-output");
    const toggleBtn = document.getElementById("toggle-string-btn");

    if (isStringMode) {
      // Chuyển về JSON formatted (có xuống dòng và indent)
      jsonOutput.textContent = JSON.stringify(currentLevelJson, null, 2);
      toggleBtn.textContent = "🔄 Convert to String";
      isStringMode = false;
    } else {
      // Chuyển sang String minified (không xuống dòng, không dấu cách)
      jsonOutput.textContent = JSON.stringify(currentLevelJson);
      toggleBtn.textContent = "🔄 Convert to JSON";
      isStringMode = true;
    }
  });

// Xử lý copy to clipboard
document
  .getElementById("copy-json-btn")
  .addEventListener("click", function () {
    if (!currentLevelJson) {
      alert("Không có dữ liệu JSON để copy.");
      return;
    }

    const jsonOutput = document.getElementById("json-output");
    const copyBtn = document.getElementById("copy-json-btn");
    const textToCopy = jsonOutput.textContent;

    // Sử dụng Clipboard API
    navigator.clipboard
      .writeText(textToCopy)
      .then(() => {
        // Thông báo thành công
        const originalText = copyBtn.textContent;
        copyBtn.textContent = "✅ Copied!";
        copyBtn.classList.add("copied");

        // Reset sau 2 giây
        setTimeout(() => {
          copyBtn.textContent = originalText;
          copyBtn.classList.remove("copied");
        }, 2000);
      })
      .catch((err) => {
        alert("Lỗi khi copy: " + err);
        console.error("Copy Error:", err);
      });
  });
