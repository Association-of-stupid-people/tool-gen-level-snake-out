export const translations = {
    // App Header
    gridEditor: { EN: 'Grid Editor', VN: 'Trình chỉnh sửa lưới' },
    levelGenerator: { EN: 'Level Generator', VN: 'Tạo màn chơi' },

    // Left Sidebar - Panels
    grid: { EN: 'Grid', VN: 'Lưới' },
    generator: { EN: 'Generator', VN: 'Tạo màn' },
    settings: { EN: 'Settings', VN: 'Cài đặt' },

    // Generator Panel
    generateLevel: { EN: 'Generate Level', VN: 'Tạo màn chơi' },
    generating: { EN: 'Generating...', VN: 'Đang tạo...' },
    distributionStrategy: { EN: 'Distribution Strategy', VN: 'Chiến lược phân bố' },
    arrowCount: { EN: 'Arrow Count', VN: 'Số lượng mũi tên' },
    complexity: { EN: 'Complexity', VN: 'Độ phức tạp' },
    lengthRange: { EN: 'Length Range', VN: 'Phạm vi độ dài' },
    bendsRange: { EN: 'Bends Range', VN: 'Phạm vi góc cua' },
    obstacles: { EN: 'Obstacles', VN: 'Vật cản' },
    items: { EN: 'Items', VN: 'Vật phẩm' },
    add: { EN: 'Add', VN: 'Thêm' },
    noObstacles: { EN: 'No obstacles added yet', VN: 'Chưa có vật cản' },

    // Obstacle Types
    wall: { EN: 'Wall', VN: 'Tường' },
    wallBreak: { EN: 'Wall Break', VN: 'Tường phá vỡ' },
    hole: { EN: 'Hole', VN: 'Lỗ' },
    tunnel: { EN: 'Tunnel', VN: 'Đường hầm' },
    icedSnake: { EN: 'Iced Snake', VN: 'Rắn đóng băng' },
    keySnake: { EN: 'Key Snake', VN: 'Rắn khóa' },

    // Obstacle Config
    position: { EN: 'Position', VN: 'Vị trí' },
    cellSize: { EN: 'Cell Size', VN: 'Kích thước ô' },
    countdown: { EN: 'Countdown', VN: 'Đếm ngược' },
    color: { EN: 'Color', VN: 'Màu sắc' },
    direction: { EN: 'Direction', VN: 'Hướng' },
    snakeId: { EN: 'Snake ID', VN: 'ID rắn' },
    keySnakeId: { EN: 'Key Snake ID', VN: 'ID rắn khóa' },
    lockedSnakeId: { EN: 'Locked Snake ID', VN: 'ID rắn bị khóa' },

    // Strategy Names
    smartDynamic: { EN: 'Smart Dynamic', VN: 'Thông minh động' },
    randomAdaptive: { EN: 'Random Adaptive', VN: 'Ngẫu nhiên thích ứng' },
    edgeHugger: { EN: 'Edge Hugger', VN: 'Bám viền' },
    maxClump: { EN: 'Max Clump', VN: 'Nhóm tối đa' },
    spiralFill: { EN: 'Spiral Fill', VN: 'Xoắn ốc' },
    symmetrical: { EN: 'Symmetrical', VN: 'Đối xứng' },

    // Strategy Config
    depthPriority: { EN: 'Depth Priority', VN: 'Ưu tiên độ sâu' },
    poolSizePercent: { EN: 'Pool Size %', VN: '% Kích thước pool' },
    preferEdges: { EN: 'Prefer Edges', VN: 'Ưu tiên viền' },
    avoidCorners: { EN: 'Avoid Corners', VN: 'Tránh góc' },
    wallFollowStrength: { EN: 'Wall Follow Strength', VN: 'Độ bám tường' },
    edgeDistanceMax: { EN: 'Edge Distance Max', VN: 'Khoảng cách viền tối đa' },
    cornerPriority: { EN: 'Corner Priority', VN: 'Ưu tiên góc' },
    expansionRate: { EN: 'Expansion Rate', VN: 'Tỷ lệ mở rộng' },
    minAreaSize: { EN: 'Min Area Size', VN: 'Kích thước tối thiểu' },
    avoidEdges: { EN: 'Avoid Edges', VN: 'Tránh viền' },
    tightness: { EN: 'Tightness', VN: 'Độ chặt' },
    startFrom: { EN: 'Start From', VN: 'Bắt đầu từ' },
    center: { EN: 'Center', VN: 'Trung tâm' },
    corner: { EN: 'Corner', VN: 'Góc' },
    random: { EN: 'Random', VN: 'Ngẫu nhiên' },
    clockwise: { EN: 'Clockwise', VN: 'Theo chiều kim đồng hồ' },
    counterClockwise: { EN: 'Counter CW', VN: 'Ngược chiều KĐH' },
    strictness: { EN: 'Strictness', VN: 'Độ chặt chẽ' },
    symmetryType: { EN: 'Symmetry Type', VN: 'Kiểu đối xứng' },
    horizontal: { EN: 'Horizontal', VN: 'Ngang' },
    vertical: { EN: 'Vertical', VN: 'Dọc' },
    both: { EN: 'Both', VN: 'Cả hai' },
    radial: { EN: 'Radial', VN: 'Hướng tâm' },
    fallback: { EN: 'Fallback', VN: 'Dự phòng' },
    bonusFill: { EN: 'Bonus Fill', VN: 'Tự động lấp' },
    bonusFillDescription: { EN: 'Automatically fill remaining gaps', VN: 'Tự động lấp đầy khoảng trống còn lại' },

    // Right Sidebar - Editor Tools
    tools: { EN: 'Tools', VN: 'Công cụ' },
    pen: { EN: 'Pen', VN: 'Bút' },
    eraser: { EN: 'Eraser', VN: 'Tẩy' },
    shape: { EN: 'Shape', VN: 'Hình dạng' },
    shapes: { EN: 'Shapes', VN: 'Hình dạng' },
    rectangle: { EN: 'Rectangle', VN: 'Hình chữ nhật' },
    circle: { EN: 'Circle', VN: 'Hình tròn' },
    line: { EN: 'Line', VN: 'Đường thẳng' },
    triangle: { EN: 'Triangle', VN: 'Tam giác' },
    diamond: { EN: 'Diamond', VN: 'Kim cương' },
    frame: { EN: 'Frame', VN: 'Khung' },

    // Right Sidebar - Actions
    actions: { EN: 'Actions', VN: 'Hành động' },
    files: { EN: 'Files', VN: 'Tệp tin' },
    copyJson: { EN: 'Copy JSON', VN: 'Sao chép JSON' },
    toGenerator: { EN: 'To Generator', VN: 'Đến tạo màn' },
    uploadImage: { EN: 'Upload Image', VN: 'Tải ảnh lên' },
    clearGrid: { EN: 'Clear Grid', VN: 'Xóa lưới' },
    fillGaps: { EN: 'Smart Fill', VN: 'Lấp khoảng trống' },

    // Right Sidebar - Generator Tools
    drawingTools: { EN: 'Drawing Tools', VN: 'Công cụ vẽ' },
    arrow: { EN: 'Arrow', VN: 'Mũi tên' },
    none: { EN: 'None', VN: 'Không' },
    obstacleType: { EN: 'Obstacle Type', VN: 'Loại chướng ngại' },
    arrowColor: { EN: 'Arrow Color', VN: 'Màu mũi tên' },
    obstacleColor: { EN: 'Obstacle Color', VN: 'Màu chướng ngại' },
    breakCount: { EN: 'Break Count', VN: 'Số lần phá' },
    tunnelDirection: { EN: 'Tunnel Direction', VN: 'Hướng đường hầm' },
    up: { EN: 'Up', VN: 'Lên' },
    down: { EN: 'Down', VN: 'Xuống' },
    left: { EN: 'Left', VN: 'Trái' },
    right: { EN: 'Right', VN: 'Phải' },

    // Right Sidebar - Output
    outputPreview: { EN: 'Output Preview', VN: 'Xem trước kết quả' },
    levelId: { EN: 'Level ID', VN: 'ID màn' },
    downloadImage: { EN: 'Download Image', VN: 'Tải ảnh' },
    downloadJson: { EN: 'Download JSON', VN: 'Tải JSON' },
    copyToClipboard: { EN: 'Copy', VN: 'Sao chép' },
    simulate: { EN: 'Simulate', VN: 'Mô phỏng' },
    validate: { EN: 'Validate', VN: 'Kiểm tra' },
    clearOverlays: { EN: 'Clear Overlays', VN: 'Xóa overlay' },
    importJson: { EN: 'Import JSON', VN: 'Nhập JSON' },

    // Simulation Modal
    simulationMode: { EN: 'Simulation Mode', VN: 'Chế độ mô phỏng' },
    moves: { EN: 'Moves', VN: 'Số bước' },
    zoom: { EN: 'Zoom', VN: 'Phóng to' },
    speed: { EN: 'Speed', VN: 'Tốc độ' },
    reset: { EN: 'Reset', VN: 'Đặt lại' },
    levelComplete: { EN: 'Level Complete!', VN: 'Hoàn thành màn!' },
    tapToMove: { EN: 'Tap any snake to move it', VN: 'Nhấn vào rắn để di chuyển' },
    movableGlow: { EN: 'Movable snakes will glow on hover', VN: 'Rắn có thể di chuyển sẽ sáng khi rê chuột' },
    autoPlay: { EN: 'Auto Play', VN: 'Tự động chơi' },
    stopAutoPlay: { EN: 'Stop', VN: 'Dừng' },
    levelStuck: { EN: 'Level is stuck! No movable snakes.', VN: 'Màn bị kẹt! Không có rắn nào di chuyển được.' },
    autoPlayActive: { EN: 'Auto-playing...', VN: 'Đang tự động chơi...' },

    // Grid Editor Section
    gridEditorSection: { EN: 'Grid Editor', VN: 'Chỉnh sửa lưới' },
    cellsFilled: { EN: 'cells filled', VN: 'ô đã tô' },
    format: { EN: 'Format', VN: 'Định dạng' },
    copy: { EN: 'Copy', VN: 'Sao chép' },
    apply: { EN: 'Apply', VN: 'Áp dụng' },
    cancel: { EN: 'Cancel', VN: 'Hủy' },

    // Settings Panel
    gridSize: { EN: 'Grid Size', VN: 'Kích thước lưới' },
    width: { EN: 'Width', VN: 'Rộng' },
    height: { EN: 'Height', VN: 'Cao' },
    backgroundColor: { EN: 'Background Color', VN: 'Màu nền' },
    snakePalette: { EN: 'Snake Palette', VN: 'Bảng màu rắn' },
    addColor: { EN: 'Add Color', VN: 'Thêm màu' },
    filenamePrefix: { EN: 'Filename Prefix', VN: 'Tiền tố tên file' },
    filenameSuffix: { EN: 'Filename Suffix', VN: 'Hậu tố tên file' },
    restrictDraw: { EN: 'Restrict Draw to Colored', VN: 'Chỉ vẽ trên ô màu' },

    // Notifications
    copied: { EN: 'Copied!', VN: 'Đã sao chép!' },
    gridUpdated: { EN: 'Grid updated', VN: 'Đã cập nhật lưới' },
    overlaysCleared: { EN: 'Overlays cleared!', VN: 'Đã xóa overlay!' },
    levelGenerated: { EN: 'Level generated successfully!', VN: 'Tạo màn thành công!' },
    snakesCannotExit: { EN: 'snakes cannot exit', VN: 'rắn không thể thoát' },
    failedToConnect: { EN: 'Failed to connect to server', VN: 'Không thể kết nối server' },
    imageImported: { EN: 'Image imported!', VN: 'Đã nhập ảnh!' },
    cells: { EN: 'cells', VN: 'ô' },
    imported: { EN: 'Imported', VN: 'Đã nhập' },
    snakes: { EN: 'snakes', VN: 'rắn' },
    and: { EN: 'and', VN: 'và' },

    // Generator Panel - Context Menu & UI
    readyToGen: { EN: 'Ready to Gen', VN: 'Sẵn sàng tạo' },
    pasteJsonPrompt: { EN: 'Paste valid JSON grid or click Generate', VN: 'Dán JSON lưới hợp lệ hoặc nhấn Tạo' },
    itemId: { EN: 'Item ID', VN: 'ID vật phẩm' },
    delete: { EN: 'Delete', VN: 'Xóa' },
    reverseDirection: { EN: 'Reverse Direction', VN: 'Đảo ngược hướng' },
    keyId: { EN: 'Key ID', VN: 'ID khóa' },
    lockId: { EN: 'Lock ID', VN: 'ID ổ khóa' },
    generatingLevel: { EN: 'Generating level...', VN: 'Đang tạo màn chơi...' },

    // Right Sidebar - Detailed UI
    difficultyAnalysis: { EN: 'Difficulty Analysis', VN: 'Phân tích độ khó' },
    calculateScore: { EN: 'Calculate Score', VN: 'Tính điểm' },
    totalDifficulty: { EN: 'Total Difficulty', VN: 'Tổng độ khó' },
    snake: { EN: 'Snake', VN: 'Rắn' },
    free: { EN: 'Free', VN: 'Tự do' },
    obs: { EN: 'Obs', VN: 'Vật cản' },
    scoreFormula: { EN: 'Score = S (Load) + F (Freedom) + O (Obstacles)', VN: 'Điểm = S (Tải) + F (Tự do) + O (Vật cản)' },
    exportConfig: { EN: 'Export Config', VN: 'Cấu hình xuất' },
    export: { EN: 'Export', VN: 'Xuất' },
    exportDescription: { EN: 'Export arrows and obstacles drawn on grid', VN: 'Xuất các mũi tên và vật cản đã vẽ trên lưới' },
    import: { EN: 'Import', VN: 'Nhập' },
    importFromFile: { EN: 'Import from File', VN: 'Nhập từ file' },
    importFromClipboard: { EN: 'Import from Clipboard', VN: 'Nhập từ clipboard' },

    debugInfo: { EN: 'Debug Info', VN: 'Thông tin debug' },
    objects: { EN: 'Objects', VN: 'Đối tượng' },
    generatedAt: { EN: 'Generated At', VN: 'Tạo lúc' },
    pairCheckOK: { EN: 'Pair check: OK', VN: 'Kiểm tra cặp: OK' },
    pairCheckIncomplete: { EN: 'Pair check: Incomplete', VN: 'Kiểm tra cặp: Chưa đủ' },
    placeFirstTunnel: { EN: 'Place first tunnel to start a pair.', VN: 'Đặt đường hầm đầu tiên để bắt đầu cặp.' },
    placeOneMoreTunnel: { EN: 'Place one more tunnel to complete the pair.', VN: 'Đặt thêm một đường hầm để hoàn thành cặp.' },
    currentCount: { EN: 'Current count', VN: 'Số lượng hiện tại' },
    breakCountdown: { EN: 'Break Countdown', VN: 'Đếm ngược phá' },
    levelIdLabel: { EN: 'Level ID', VN: 'ID Cấp độ' }, // Distinct from previous levelId if needed, or reuse
    file: { EN: 'File', VN: 'Tệp' },

    // More Notifications
    difficultyCalculated: { EN: 'Difficulty calculated!', VN: 'Đã tính độ khó!' },
    calculationFailed: { EN: 'Calculation failed', VN: 'Tính toán thất bại' },
    copiedItems: { EN: 'Copied {count} items to clipboard!', VN: 'Đã sao chép {count} mục vào clipboard!' },
    downloadedItems: { EN: 'Downloaded {count} items!', VN: 'Đã tải xuống {count} mục!' },
    jsonImportedFile: { EN: 'JSON imported from file!', VN: 'Đã nhập JSON từ file!' },
    invalidJsonFile: { EN: 'Invalid JSON file!', VN: 'File JSON không hợp lệ!' },
    jsonImportedClipboard: { EN: 'JSON imported from clipboard!', VN: 'Đã nhập JSON từ clipboard!' },
    invalidJsonClipboard: { EN: 'Invalid JSON in clipboard!', VN: 'JSON trong clipboard không hợp lệ!' },

    // Settings Panel - Detailed
    globalSettings: { EN: 'Global Settings', VN: 'Cài đặt chung' },
    rows: { EN: 'Rows', VN: 'Hàng' },
    columns: { EN: 'Columns', VN: 'Cột' },
    generatorOptions: { EN: 'Generator Options', VN: 'Tùy chọn tạo màn' },
    drawingToColoredCells: { EN: 'Drawing to Colored Cells', VN: 'Vẽ trên ô màu' },
    levelFilePrefix: { EN: 'Level File Prefix', VN: 'Tiền tố file màn' },
    levelFileSuffix: { EN: 'Level File Suffix', VN: 'Hậu tố file màn' },
    output: { EN: 'Output', VN: 'Đầu ra' },

    // Direction Labels with Arrows
    upArrow: { EN: '↑ Up', VN: '↑ Lên' },
    downArrow: { EN: '↓ Down', VN: '↓ Xuống' },
    leftArrow: { EN: '← Left', VN: '← Trái' },
    rightArrow: { EN: '→ Right', VN: '→ Phải' },

    // Obstacle Configs
    cellSizeLabel: { EN: 'Cell Size', VN: 'Kích thước ô' },
    tunnelColor: { EN: 'Tunnel Color', VN: 'Màu đường hầm' },
    holeColor: { EN: 'Hole Color', VN: 'Màu lỗ' },

    // Additional Notifications
    downloadedItemsMsg: { EN: 'Downloaded items!', VN: 'Đã tải xuống!' },
    arrows: { EN: 'arrows', VN: 'mũi tên' },

    // Editor Mode (used in RightSidebar for non-generator mode)
    selectShape: { EN: 'Select Shape', VN: 'Chọn hình dạng' },
    importMask: { EN: 'Import Mask', VN: 'Nhập mặt nạ' },
    clickOrDropImage: { EN: 'Click or Drop Image', VN: 'Nhấn hoặc thả ảnh' },

    // Import Config Settings
    importConfig: { EN: 'Import Config', VN: 'Cấu hình nhập' },
    autoResizeGridOnImport: { EN: 'Auto-resize grid to level bounds', VN: 'Tự động resize grid theo level' },
    autoFillDrawOnImport: { EN: 'Auto-fill draw layer from arrows', VN: 'Tự động tô draw layer theo arrow' },
}

export type TranslationKey = keyof typeof translations
export type Language = 'EN' | 'VN'

export const t = (key: TranslationKey, lang: Language): string => {
    return translations[key]?.[lang] || translations[key]?.EN || key
}
