import fitz  # PyMuPDF
import base64

def process_pdf(file_stream):
    """
    Analyzes PDF. Returns:
    {
        "mode": "text" | "image",
        "content": str (text) | List[str] (base64 images)
    }
    """
    payload = file_stream.read()
    if not payload:
        raise ValueError("Empty file stream")

    doc = None
    try:
        doc = fitz.open(stream=payload, filetype="pdf")
        if len(doc) == 0:
            raise ValueError("PDF has no pages")

        text_accumulated = ""
        images_accumulated = []

        # 1. Check first few pages for text density
        sample_text = ""
        for i in range(min(3, len(doc))):
            sample_text += doc[i].get_text()

        is_scanned = len(sample_text.strip()) < 50

        if is_scanned:
            print("DEBUG: Scanned PDF detected. Switching to VISION mode.")
            for page in doc:
                # 150 DPI balances quality and response size for OCR/VLM extraction.
                pix = page.get_pixmap(dpi=150)
                data = pix.tobytes("jpeg")
                b64 = base64.b64encode(data).decode("utf-8")
                images_accumulated.append(b64)

            return {"mode": "image", "content": images_accumulated}

        print("DEBUG: Text PDF detected. Using TEXT mode.")
        for page in doc:
            text_accumulated += page.get_text() + "\n"
        return {"mode": "text", "content": text_accumulated}
    except Exception as exc:
        raise ValueError(f"Unable to parse PDF: {exc}") from exc
    finally:
        if doc is not None:
            doc.close()
