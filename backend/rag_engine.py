import os
import logging
import hashlib
import math
import pickle
from typing import Iterator, List, Optional, Sequence, Tuple

# LangChain Imports
from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_core.stores import BaseStore
from langchain_classic.retrievers import ParentDocumentRetriever
# from langchain.retrievers import ParentDocumentRetriever # Fallback failed
from langchain_classic.storage import LocalFileStore
# from langchain.storage import LocalFileStore
from langchain_text_splitters import RecursiveCharacterTextSplitter
# from langchain_community.storage import LocalFileStore # Explicit import if needed

# --- CONFIG ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CHROMA_DIR = os.path.join(BASE_DIR, "chroma_db")
DOC_STORE_DIR = os.path.join(BASE_DIR, "doc_store") # For Parent Docs
COLLECTION_NAME = os.getenv("RAG_COLLECTION_NAME", "flashdeck_knowledge_child_local")

# Ensure directories exist
os.makedirs(DOC_STORE_DIR, exist_ok=True)

# Load Env
from dotenv import load_dotenv
load_dotenv()

logger = logging.getLogger(__name__)


class DocumentFileStoreAdapter(BaseStore[str, Document]):
    """Store LangChain Documents as bytes in LocalFileStore."""

    def __init__(self, store: LocalFileStore):
        self._store = store

    def mget(self, keys: Sequence[str]) -> List[Optional[Document]]:
        raw_values = self._store.mget(list(keys))
        values: List[Optional[Document]] = []
        for raw in raw_values:
            if raw is None:
                values.append(None)
                continue
            values.append(pickle.loads(raw))
        return values

    def mset(self, key_value_pairs: Sequence[Tuple[str, Document]]) -> None:
        serialized: List[Tuple[str, bytes]] = []
        for key, value in key_value_pairs:
            serialized.append((key, pickle.dumps(value)))
        self._store.mset(serialized)

    def mdelete(self, keys: Sequence[str]) -> None:
        self._store.mdelete(list(keys))

    def yield_keys(self, *, prefix: Optional[str] = None) -> Iterator[str]:
        return self._store.yield_keys(prefix=prefix)


class LocalHashEmbeddings:
    """Deterministic local embeddings without external model/API dependencies."""

    def __init__(self, dimensions: int = 512):
        self.dimensions = dimensions

    def _tokenize(self, text: str) -> List[str]:
        return [tok for tok in (text or "").lower().split() if tok]

    def _embed(self, text: str) -> List[float]:
        vector = [0.0] * self.dimensions
        tokens = self._tokenize(text)
        if not tokens:
            return vector

        for token in tokens:
            digest = hashlib.sha256(token.encode("utf-8")).digest()
            index = int.from_bytes(digest[:4], "big") % self.dimensions
            sign = 1.0 if (digest[4] % 2 == 0) else -1.0
            vector[index] += sign

        norm = math.sqrt(sum(value * value for value in vector))
        if norm == 0:
            return vector
        return [value / norm for value in vector]

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        return [self._embed(text) for text in texts]

    def embed_query(self, text: str) -> List[float]:
        return self._embed(text)

def get_embeddings():
    """
    Returns the embedding function.
    Uses deterministic local hash embeddings to avoid external API dependencies.
    """
    return LocalHashEmbeddings(dimensions=512)

def get_vectorstore():
    """
    Returns the persistent Chroma VectorStore (Child Docs).
    """
    return Chroma(
        collection_name=COLLECTION_NAME,
        embedding_function=get_embeddings(),
        persist_directory=CHROMA_DIR
    )

def get_docstore():
    """
    Returns the LocalFileStore for Parent Docs (blob storage).
    """
    return DocumentFileStoreAdapter(LocalFileStore(DOC_STORE_DIR))

def get_retriever():
    """
    Constructs the ParentDocumentRetriever.
    """
    vectorstore = get_vectorstore()
    store = get_docstore()
    
    # 1. Child Splitter: Small chunks for vector search
    child_splitter = RecursiveCharacterTextSplitter(chunk_size=400, chunk_overlap=50)
    
    # 2. Parent Splitter: Large chunks (or None to use full docs) for LLM context
    # If the input docs are already "Pages", we might not need to split parents further.
    # But let's set a safe large limit (e.g. 2000 chars) in case we get raw text.
    parent_splitter = RecursiveCharacterTextSplitter(chunk_size=2000, chunk_overlap=200)

    retriever = ParentDocumentRetriever(
        vectorstore=vectorstore,
        docstore=store,
        child_splitter=child_splitter,
        parent_splitter=parent_splitter,
    )
    return retriever

def index_content(text_chunks: List[str], deck_id: str, source_file: str):
    """
    Indexes content using the Advanced RAG (Parent-Child) strategy.
    
    Args:
        text_chunks: List of strings. In v3/v4 logic, these are usually full Pages (transcribed or extracted).
    """
    if not text_chunks:
        return
        
    logger.info("Indexing %s parent chunk(s) for deck %s", len(text_chunks), deck_id)
    
    # Convert strings to Documents
    documents = []
    for i, chunk in enumerate(text_chunks):
        doc = Document(
            page_content=chunk,
            metadata={
                "deck_id": deck_id, 
                "source": source_file,
                "page_number": i + 1
            }
        )
        documents.append(doc)
    
    # Use the Retriever to add docs. 
    # It will automatically:
    # 1. Split these 'parents' into 'children'
    # 2. Embed children -> Chroma
    # 3. Store parents -> LocalFileStore
    retriever = get_retriever()
    retriever.add_documents(documents)
    
    logger.info("RAG indexing complete")

def query_vector_db(query: str, deck_id: Optional[str] = None, k: int = 4):
    """
    Queries the knowledge base using the Parent Document Retriever.
    """
    retriever = get_retriever()
    
    # Note: ParentDocumentRetriever search_kwargs are for the underlying vectorstore search
    # We want to filter by deck_id.
    search_kwargs = {"k": k}
    if deck_id:
        search_kwargs["filter"] = {"deck_id": deck_id}

    if hasattr(retriever, "search_kwargs"):
        retriever.search_kwargs = search_kwargs

    logger.info("RAG query received for deck %s", deck_id)
    results = retriever.invoke(query)
    
    # Results are the PARENT documents (large context).
    return results

def check_health():
    """
    Checks if ChromaDB is responding.
    """
    try:
        vs = get_vectorstore()
        count = vs._collection.count()
        logger.debug("RAG vectorstore count: %s", count)
        return True
    except Exception as e:
        logger.exception("RAG health check failed")
        return False

def clear_deck_data(deck_id: str):
    """
    Removes data for a specific deck.
    TODO: This is harder with ParentDocumentRetriever as it manages keys. 
    For now, we might skip deletion or implement a scan-and-delete if critical.
    """
    pass

# --- STARTUP MESSAGE ---
print("---------------------------------------------------------------")
print(f"✅ Advanced RAG Engine (Parent Doc Retriever) Configured")
print(f"📂 Vector Store: {CHROMA_DIR}")
print(f"📂 Parent Store: {DOC_STORE_DIR}")
print("---------------------------------------------------------------")
