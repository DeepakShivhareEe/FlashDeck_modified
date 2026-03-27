# FlashDeck AI Backend 🧠

The intelligent core of FlashDeck, powered by LangChain, OpenAI, and ChromaDB.

## 🚀 Features

*   **Multimodal RAG**: Processes highly complex PDFs (text-heavy or scanned/handwritten) using a hybrid approach.
    *   **Text Mode**: Uses standard embedding-based retrieval.
    *   **Vision Mode**: Uses Google Gemini 3 Flash (or equivalent) to transcribe and describe visual content for indexing.
*   **Agentic Workflow**: A LangGraph-based state machine orchestrated the deck generation:
    *   **Chunker**: Splits documents intelligently.
    *   **Generator**: Creates flashcards and flowcharts in parallel batches.
    *   **Refiner**: Aggregates results, removes duplicates, and indexes content into ChromaDB.
*   **Interactive Chat**: Context-aware chatbot that "thinks" aloud in the console, providing transparency.
*   **Vector Search**: Uses `chromadb` for persistent storage of document embeddings.

## 🛠️ Stack

*   **Framework**: FastAPI
*   **AI Orchestration**: LangChain, LangGraph
*   **Vector DB**: ChromaDB
*   **LLM**: Groq (OpenAI-compatible endpoint)
*   **PDF Processing**: PyMuPDF (Fitz)

## 🏃‍♂️ Setup & Run

1.  **Environment**:
    Create a `.env` file in this directory:
    ```env
    GROQ_API_KEY=gsk-...
    ```

3.  **Setup Virtual Environment**:
    ```bash
    # Create venv
    python -m venv venv
    
    # Activate (Windows)
    .\venv\Scripts\activate
    
    # Activate (Mac/Linux)
    source venv/bin/activate
    ```

4.  **Install Dependencies**:
    ```bash
    pip install -r requirements.txt
    ```

3.  **Start Server**:
    ```bash
    python -m uvicorn main:app --port 8001 --reload
    ```
    *   The server will verify ChromaDB configuration on startup.
    *   API Docs available at: `http://localhost:8001/docs`

## 📂 Project Structure

*   `main.py`: API Entry points (`/generate`, `/chat`).
*   `agent_graph.py`: The brain. Defines the LangGraph workflow and LLM prompts.
*   `rag_engine.py`: Handles vector storage, embedding generation, and retrieval.
*   `deck_builder.py`: Exports flashcards to Anki (.apkg) format.
