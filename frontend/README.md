# FlashDeck AI Frontend ⚡

A modern, immersive web application for studying and visualizing your notes.

## 🌟 New in v3.1

*   **Zero-Distraction Dashboard**: Clean upload interface with vibrant animations.
*   **Topic-Based Decks**: Flashcards are intelligently grouped by topic (e.g., "Introduction", "Advanced Concepts").
*   **Knowledge Base**: A professional 3-pane interface for deep diving:
    *   **Source View**: See your uploaded files.
    *   **Visual Canvas**: Zoomable Mermaid.js interactive flowcharts.
    *   **AI Assistant**: Chat with your documents in real-time.
*   **Export**: Download specific topic decks as high-quality PDFs.

## 🛠️ Stack

*   **Framework**: React (Vite)
*   **Styling**: Tailwind CSS + Shadcn UI (Radix Primitives)
*   **Icons**: Lucide React
*   **Visuals**: Mermaid.js (Diagrams), Framer Motion (Animations)
*   **Export**: html2canvas, jsPDF

## 🏃‍♂️ Setup & Run

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Start Dev Server**:
    ```bash
    npm run dev
    ```
    *   Access at: `http://localhost:5173`

3.  **Build for Production**:
    ```bash
    npm run build
    ```

## 📂 Key Components

*   `pages/Dashboard.jsx`: Main entry, upload handling, and navigation hub.
*   `pages/MyDecks.jsx`: Topic grid and flashcard review interface with export.
*   `pages/KnowledgeBase.jsx`: integrated 3-pane study environment.
*   `components/FlowchartView.jsx`: Renders Mermaid.js diagrams.

## 🚀 Deploy Frontend on Vercel

1. **Import project in Vercel**
    - Create a new Vercel project from this repository.
    - Set **Root Directory** to `frontend`.
    - Framework preset should be **Vite**.

2. **Set frontend environment variables (Vercel Project Settings -> Environment Variables)**
    - `VITE_API_BASE_URL=https://flashdeck-modified.onrender.com`
    - `VITE_DEBUG_API=false`

3. **Build settings**
    - Build command: `npm run build`
    - Output directory: `dist`

4. **Redeploy**
    - Trigger a deployment after saving environment variables.

5. **Allow your Vercel origin in backend CORS (Render env var)**
    - In Render service settings, set `CORS_ALLOW_ORIGINS` to include:
      - `https://<your-vercel-domain>`
      - `https://flashdeck-modified.onrender.com` (optional for direct backend access)
      - your local dev origins if needed.
    - Example:
      `CORS_ALLOW_ORIGINS=https://your-app.vercel.app,http://localhost:5173,http://127.0.0.1:5173`

The included `vercel.json` enables SPA routing so direct navigation to app routes resolves correctly.
