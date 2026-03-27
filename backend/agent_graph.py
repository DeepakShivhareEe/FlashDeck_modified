import os
import operator
from typing import List, TypedDict, Annotated, Dict, Any, Union, Optional
from typing_extensions import TypedDict as ExtTypedDict

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langgraph.graph import StateGraph, END, START
from langgraph.types import Send
from pydantic import BaseModel, Field
from dotenv import load_dotenv, find_dotenv
from llm_client import create_llm, invoke_with_retry

# --- SETUP ---
# Load env
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
load_dotenv(env_path)

# Import RAG Engine
import rag_engine

# Shared LLM client: Groq via OpenAI-compatible endpoint.
llm = create_llm()

# --- SCHEMAS ---

class Flashcard(BaseModel):
    q: str = Field(description="The question part of the flashcard")
    a: str = Field(description="The answer part of the flashcard")
    topic: str = Field(description="The subtopic or section title this card belongs to (e.g., 'Introduction', 'Key Concepts')")

class CardList(BaseModel):
    cards: List[Flashcard]
    flowchart: Optional[str] = Field(description="Mermaid.js code for the flowchart")
    transcription: Optional[str] = Field(description="Detailed text summary/transcription for RAG")

# Main Graph State
class DeckState(TypedDict):
    original_text: Union[str, List[str]] # Text or List of Base64 Images
    # The reducer will automatically aggregate lists of lists (if we output list) 
    # OR we append to partial_cards list.
    partial_cards: Annotated[List[Dict], operator.add] 
    final_cards: List[Dict]
    batches: List[List[str]] # Temp storage for mapper
    deck_id: str
    flowcharts: Annotated[List[str], operator.add]
    transcriptions: Annotated[List[str], operator.add] # For RAG on Vision

# Worker State (Input for Map)
class BatchInput(TypedDict):
    batch_content: List[str] # List of 5 images OR text chunk

# --- NODES ---

def chunk_document(state: DeckState):
    """
    MAPPER: splits content into batches.
    Returns nothing to state, but determines valid edges via 'map_batches'
    """
    print("--- NODE: CHUNKER (MAPPER) ---")
    content = state['original_text']
    
    batches = []
    
    # 1. Vision Mode (List of images)
    if isinstance(content, list):
        BATCH_SIZE = 5
        print(f"Vision Mode: {len(content)} pages. Batching by {BATCH_SIZE}...")
        for i in range(0, len(content), BATCH_SIZE):
            batches.append(content[i:i + BATCH_SIZE])
            
    # 2. Text Mode (String)
    else:
        text = str(content)
        splitter = RecursiveCharacterTextSplitter(chunk_size=4000, chunk_overlap=200)
        docs = splitter.create_documents([text])
        # Text is simple, just list of strings
        # We can also batch text chunks if we want, but usually 1 chunk = 1 context window is fine.
        # Let's just treat each text chunk as a "batch" of 1 item for consistency?
        # Or just pass the string.
        text_chunks = [d.page_content for d in docs]
        batches = [[c] for c in text_chunks] 

    print(f"Created {len(batches)} batches/jobs.")
    
    return {"batches": batches}

def generate_batch_node(state: BatchInput):
    """
    WORKER: Processes a single batch of images/text.
    """
    batch = state['batch_content']
    print(f"--- WORKER: Processing Batch ({len(batch)} items) ---")
    
    generated = []
    parser = JsonOutputParser(pydantic_object=CardList)
    
    # Check if this batch is Images (Vision) or Text
    # Heuristic: check first item length/spaces
    first_item = batch[0]
    is_image = len(first_item) > 100 and " " not in first_item[:100]
    
    try:
        if is_image:
            # Construct ONE Multimodal Message for the whole batch
            content_parts = [
                {"type": "text", "text": "Analyze these document slides/pages. Create 15-20 high-quality flashcards. Group them by TOPIC (e.g. 'Intro', 'Mechanism', 'Summary'). ALSO generate a Mermaid.js flowchart (graph TD) summarizing the visual flow. FINALLY, provide a detailed textual summary/transcription for RAG. Return valid JSON with 'cards' (each having q, a, topic), 'flowchart', and 'transcription'."}
            ]
            for img in batch:
                content_parts.append({
                    "type": "image_url", 
                    "image_url": {"url": f"data:image/jpeg;base64,{img}"}
                })
                
            msg = {"role": "user", "content": content_parts}
            res = invoke_with_retry(llm.invoke, [msg])
            
        else:
            # Text Batch (usually 1 large chunk)
            text_blob = "\n\n".join(batch)
            # Updated Prompt for Flowchart
            prompt = ChatPromptTemplate.from_messages([
                 ("system", "You are an expert tutor. Create 15-20 high-quality flashcards covering all topics. "
                            "Group them by generic TOPICS. "
                            "ALSO, identify the core process or hierarchy in the text and generate a Mermaid.js flowchart (graph TD) representing it. "
                            "Return JSON with keys: 'cards' (list of {{q, a, topic}}) and 'flowchart' (string, optional)."),
                 ("user", "{text}")
             ])
            chain = prompt | llm | parser
            # We bypass chain invoke to handle manual parsing if needed, but chain is cleaner for text
            res = invoke_with_retry(chain.invoke, {"text": text_blob})
            # chain returns parsed dict usually
            if isinstance(res, dict):
                return {
                    "partial_cards": res.get('cards', []), 
                    "flowcharts": [res.get('flowchart')] if res.get('flowchart') else [],
                    "transcriptions": [res.get('transcription')] if res.get('transcription') else []
                }
            elif isinstance(res, list):
                 return {"partial_cards": res, "flowcharts": [], "transcriptions": []}
            return {"partial_cards": [], "flowcharts": [], "transcriptions": []} # Fallback

        if is_image:
            # Manual Parse for Vision
            flowchart = None
            transcription = ""
            try:
                parsed = parser.parse(res.content)
            except Exception:
                # Fallback if raw text
                parsed = {}

            if isinstance(parsed, dict):
                generated = parsed.get('cards', [])
                flowchart = parsed.get('flowchart')
                transcription = parsed.get('transcription', "")
            elif isinstance(parsed, list):
                generated = parsed
                flowchart = None
                transcription = ""
         
        # Add flowchart to output if present
        return {
            "partial_cards": generated, 
            "flowcharts": [flowchart] if flowchart else [],
            "transcriptions": [transcription] if transcription else []
        }

    except Exception as e:
        print(f"Error in generate_batch_node: {e}")
        return {"partial_cards": [], "flowcharts": [], "transcriptions": []}

def refine_deck(state: DeckState):
    print("--- NODE: REFINER (REDUCER) ---")
    raw_cards = state['partial_cards']
    
    unique_map = {}
    for c in raw_cards:
        if c is None:
            continue
        if hasattr(c, 'model_dump'): c = c.model_dump()
        elif hasattr(c, 'dict'): c = c.dict()
        elif not isinstance(c, dict):
            continue
        
        q = c.get('q') or c.get('Q') or c.get('question') or c.get('front')
        a = c.get('a') or c.get('A') or c.get('answer') or c.get('back')
        
        if q and isinstance(q, str):
            unique_map[q.strip()] = {"q": q, "a": a}
            
    final = list(unique_map.values())
    
    # Aggregate Flowcharts (Simple concatenation for now or pick longest)
    # We just pass them through to final state or filter empty
    flowcharts = state.get('flowcharts', [])
    valid_charts = [f for f in flowcharts if f and isinstance(f, str) and "graph" in f]
    
    # Dedup flowcharts?
    valid_charts = list(dict.fromkeys(valid_charts))
    
    # --- RAG INDEXING ---
    # We do this here to ensure we only index after successful generation
    if rag_engine:
        transcriptions = state.get('transcriptions', [])
        deck_id = state.get('deck_id')
        
        content_to_index = []
        if transcriptions and any(transcriptions):
             # Vision Mode: Index the LLM-generated transcriptions
             content_to_index = transcriptions
        else:
             # Text Mode: Index the original text
             original = state.get('original_text')
             if isinstance(original, str):
                 content_to_index = [original] # Let PDR split it
        
        if content_to_index:
            rag_engine.index_content(content_to_index, deck_id, "Uploaded Document")

    return {"final_cards": final, "flowcharts": valid_charts}

# --- EDGE LOGIC ---

def map_jobs(state: DeckState):
    # Retrieve batches created by chunker
    batches = state.get("batches", [])
    # Create Send objects for parallel execution
    return [Send("generator", {"batch_content": b}) for b in batches]

# --- GRAPH BUILD ---

workflow = StateGraph(DeckState)
workflow.add_node("chunker", chunk_document)
workflow.add_node("generator", generate_batch_node)
workflow.add_node("refiner", refine_deck)

workflow.add_edge(START, "chunker")
workflow.add_conditional_edges("chunker", map_jobs, ["generator"])
workflow.add_edge("generator", "refiner")
workflow.add_edge("refiner", END)

app_graph = workflow.compile()
