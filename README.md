# Tool Gen Level Snake Out

A powerful level generator tool for a Snake game variant, featuring a visual grid editor, parametric generation, and instant preview. Built with a React frontend and Python Flask backend.

**Live:** [https://tool-gen-level-snake-out.vercel.app/](https://tool-gen-level-snake-out.vercel.app/)

## Architecture

The project is structured as a modern Client-Server application:

-   **Backend (`/server`)**: Python Flask API handling core logic, image processing, and generation algorithms.
-   **Frontend (`/client`)**: React + Vite application providing a rich user interface for configuration and visualization.

## Getting Started

### Prerequisites
-   **Node.js** (v18+ recommended)
-   **Python** (v3.8+)
-   **pip**

### 1. Backend Setup (Server)
Navigate to the root directory and set up the Python environment:

```bash
# Create virtual environment (optional but recommended)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the server
python server/run.py
```
*The server will start at `http://localhost:5000`*

### 2. Frontend Setup (Client)
Open a new terminal and navigate to the client folder:

```bash
cd client

# Install dependencies
npm install

# Start the development server
npm run dev
```
*The client will start at `http://localhost:5173`*

## Features

### Grid Editor (Panel 1)
-   **Visual Editor**: Draw directly on the grid to create custom shapes or "masks" for generation.
-   **Tools**: Pen, Eraser, and Shape tools (Rectangle, Circle, Line, etc.).
-   **Import**: Upload an image to automatically convert it into a grid mask.

### Level Generator (Panel 2)
-   **Parametric Generation**: Configure `Arrow Count`, `Length Range`, `Bends`, `Holes`, and `Tunnels`.
-   **Real-time Preview**: See the generated level image instantly.
-   **Export Tools**:
    -   **Download Image**: Save the level as a high-quality PNG.
    -   **Download JSON**: Export the level data for the game engine.
    -   **Naming Config**: Set customizable `Prefix` and `Suffix` for files (e.g., `level_01_v2.json`).

### Global Settings
-   **Grid Configuration**: Adjust Width and Height dynamically.
-   **Visuals**: Customize the Background Color.
-   **Palette**: Manage the "Snake Color Palette" used for generation.

## API Reference

### `GET /api/shapes`
Returns a list of available pre-defined shapes.

### `POST /api/generate`
Generates a level based on provided parameters.
**Body (FormData):**
-   `arrow_count`, `min/max_arrow_length`, `min/max_bends`: (int) Generation parameters.
-   `colors`: (JSON string) Array of hex color codes.
-   `hole_count`, `tunnel_count`: (int) Obstacle counts.
-   `image_file`: (File, Optional) Mask image for constrained generation.

## Contributing
1.  Fork the repository.
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4.  Push to the branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request.
