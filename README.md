# Tool Gen Level Snake Out
This project generates level images and JSON data for a Snake game variant.

## Project Structure
The project is split into two main components:

### 1. Client (`/client`)
- **Technology**: React + Vite (Planned)
- **Status**: Folder created. Requires Node.js to initialize.
- **Setup**:
  1. Install Node.js.
  2. Run `npm create vite@latest client -- --template react-ts` inside the root folder (or inside `client` if empty).
  3. `cd client && npm install && npm run dev`

### 2. Server (`/server`)
- **Technology**: Python (Flask)
- **Status**: Refactored to REST API.
- **Setup**:
  1. `cd server`
  2. `pip install -r requirements.txt`
  3. `python app.py`
  - Runs on `http://localhost:5000`

## API Endpoints
- `GET /api/shapes`: Returns available shape names.
- `POST /api/generate`: Generates a level. Expects form-data:
  - `arrow_count`: int
  - `min_arrow_length`, `max_arrow_length`: int
  - `min_bends`, `max_bends`: int
  - `wall_counters`: JSON string array `[{"r":..., "c":...}, ...]` (or simplified logic)
  - `colors`: JSON string array of hex codes
  - `image_file`: (Optional) Uploaded mask image.
