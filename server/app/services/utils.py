
def get_neighbors(r, c, rows, cols):
    """Return valid orthogonal neighbors."""
    curr_n = []
    for dr, dc in [(0, 1), (0, -1), (1, 0), (-1, 0)]:
        nr, nc = r + dr, c + dc
        if 0 <= nr < rows and 0 <= nc < cols:
            curr_n.append((nr, nc))
    return curr_n

def count_free_neighbors(r, c, rows, cols, occupied):
    """Count how many neighbors are NOT in occupied set and are valid."""
    count = 0
    for nr, nc in get_neighbors(r, c, rows, cols):
        if (nr, nc) not in occupied:
            count += 1
    return count
