def create_level_json(snakes, obstacles_data, rows, cols, color_palette):
    level_data = []
    item_id = 0  # Counter for itemID
    
    # Grid center logic for relative positioning
    center_r = rows // 2
    center_c = cols // 2
    
    def to_pos(r, c):
        return { "x": c - center_c, "y": center_r - r }

    # 1. Add Snakes
    for snake in snakes:
        # Snake path is [Start, ..., End]
        # JSON expects format where position[0] is Head (End).
        # So we reverse path for export.
        reversed_path = list(reversed(snake['path']))
        pos_objs = [to_pos(r, c) for r, c in reversed_path]
        
        # Color mapping
        color_idx = None
        try:
             color_idx = color_palette.index(snake['color'])
        except:
             pass
             
        level_data.append({
            "itemID": item_id,
            "itemType": "snake",
            "position": pos_objs,
            "colorID": color_idx,
            "itemValueConfig": 0 
        })
        item_id += 1
        
    # 2. Add Obstacles
    processed_tunnels = set()
    
    for (r, c), data in obstacles_data.items():
        o_type = data['type']
        
        if o_type == 'wall':
            level_data.append({
                "itemID": item_id,
                "itemType": "wall",
                "position": [to_pos(r, c)],
                "colorID": None,
                "itemValueConfig": None
            })
            item_id += 1
        elif o_type == 'wall_break':
            level_data.append({
                "itemID": item_id,
                "itemType": "wallBreak",
                "position": [to_pos(r, c)],
                "colorID": None,
                "itemValueConfig": { "count": data.get('count', 3) }
            })
            item_id += 1
        elif o_type == 'hole':
             # Find color ID
             c_idx = None
             if 'color' in data:
                 try: c_idx = color_palette.index(data['color'])
                 except: pass
             level_data.append({
                "itemID": item_id,
                "itemType": "hole",
                "position": [to_pos(r, c)],
                "colorID": c_idx,
                "itemValueConfig": None
            })
             item_id += 1
        elif o_type == 'tunnel':
            # Only process pair once
            if (r, c) in processed_tunnels: continue
            
            partner = data.get('partner')
            if partner:
                processed_tunnels.add((r, c))
                processed_tunnels.add(partner)
                
                # Direction mapping
                d_str = data.get('direction', 'right')
                dx, dy = 1, 0
                if d_str == 'up': dx, dy = 0, 1
                elif d_str == 'down': dx, dy = 0, -1
                elif d_str == 'left': dx, dy = -1, 0
                
                level_data.append({
                    "itemID": item_id,
                    "itemType": "tunel", # Note: Client uses 'tunel' typo
                    "position": [to_pos(r, c), to_pos(partner[0], partner[1])],
                    "colorID": None, 
                    "itemValueConfig": { "directX": dx, "directY": dy }
                })
                item_id += 1
        
    return level_data
