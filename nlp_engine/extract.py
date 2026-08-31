import sys
import json
import warnings
import os
import time
import urllib.parse
import requests
import re

warnings.filterwarnings("ignore")
os.environ["TRANSFORMERS_VERBOSITY"] = "error"

import fitz  
import spacy
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification, logging


logging.set_verbosity_error()

import os
from pathlib import Path
from dotenv import load_dotenv

# Find the root directory (one level up from nlp_engine/)
env_path = Path(__file__).resolve().parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

# Retrieve the key securely from the root .env file
OPENALEX_API_KEY = os.getenv("OPENALEX_API_KEY")

def log(message):
    sys.stderr.write(message + "\n")
    sys.stderr.flush()

log("Loading NLP models...")

try:
    nlp = spacy.load("en_core_web_sm")
except OSError:
    import spacy.cli
    spacy.cli.download("en_core_web_sm")
    nlp = spacy.load("en_core_web_sm")

nlp.max_length = 2500000

model_name = "cross-encoder/nli-deberta-v3-small"
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForSequenceClassification.from_pretrained(model_name)

def extract_references_and_body(full_text):
    pattern = r'(?i)\n\s*(?:\d+[\.\s]*)?(?:references|bibliography|works\s+cited)\s*\n'
    matches = list(re.finditer(pattern, full_text))
    
    if matches:
        ref_start = matches[-1].start()
        body_text = full_text[:ref_start]
        ref_section = full_text[ref_start:]
    else:
        body_text = full_text
        ref_section = ""
        
    refs = {}
    if ref_section:
        ref_matches = list(re.finditer(r'\[(\d+)\](.*?)(?=\[\d+\]|\Z)', ref_section, re.DOTALL))
        for m in ref_matches:
            ref_num = m.group(1)
            ref_text = " ".join(m.group(2).replace('\n', ' ').split())
            refs[ref_num] = ref_text
            
    return body_text, refs

def extract_claims(pdf_path):
    log(f"Parsing PDF: {pdf_path}")
    doc = fitz.open(pdf_path)
    
    raw_full_text = "\n".join([page.get_text() for page in doc])
    body_text, refs_dict = extract_references_and_body(raw_full_text)
    
    clean_body_text = re.sub(r'\s+', ' ', body_text).strip()
    spacy_doc = nlp(clean_body_text)
    claims_data = []
    
    citation_pattern = re.compile(r'\[\d+(?:[\s,–-]+\d+)*\]')
    
    sentences = list(spacy_doc.sents)
    for i, sent in enumerate(sentences):
        text = sent.text.strip()
        match = citation_pattern.search(text)
        
        if match and len(text) > 15:
            clean_claim = " ".join(text.split())
            first_num_match = re.search(r'\d+', match.group(0))
            first_cite_num = first_num_match.group(0) if first_num_match else ""
            
            ref_info = refs_dict.get(first_cite_num, "")
            
            # CAPTURE SURROUNDING CONTEXT FROM UPLOADED PAPER (Previous + Current + Next sentence)
            context_start = max(0, i - 1)
            context_end = min(len(sentences), i + 2)
            surrounding_context = " ".join([s.text.strip() for s in sentences[context_start:context_end]])
            surrounding_context = " ".join(surrounding_context.split())
            
            claims_data.append({
                "claim": clean_claim,
                "cite_num": first_cite_num,
                "ref_text": ref_info,
                "source_context": surrounding_context  # Now correctly points to user paper window!
            })
            
    return claims_data

def reconstruct_openalex_abstract(inverted_index):
    if not inverted_index:
        return None
    word_list = []
    for word, positions in inverted_index.items():
        for pos in positions:
            word_list.append((pos, word))
    word_list.sort(key=lambda x: x[0])
    return " ".join([item[1] for item in word_list])


def fetch_google_scholar_fallback(query_str):
    try:
        API_URL = "https://citationchecker-zmrc.onrender.com" if os.getenv("RENDER") else "http://localhost:3001"
        url = f"{API_URL}/api/search?q={urllib.parse.quote(query_str)}"
        response = requests.get(url, timeout=6)
        if response.status_code == 200:
            data = response.json()
            organic_results = data.get("organic_results", [])
            if organic_results and len(organic_results) > 0:
                top_res = organic_results[0]
                title = top_res.get("title", "Unknown Title")
                link = top_res.get("link", "")
                snippet = top_res.get("snippet", "No snippet available.")
                
                authors_list = top_res.get("about_this_result", {}).get("source", {}).get("authors", [])
                author_str = ", ".join(authors_list) if authors_list else "Google Scholar Result"
                
                formatted_abstract = f"{snippet}\n\n👉 Direct Source Link: {link}"
                return {"abstract": formatted_abstract, "title": title, "author": author_str}
    except Exception as e:
        log(f"SerpAPI fallback route error: {str(e)}")
    
    return None

def fetch_source_metadata(ref_text, claim_text=""):
    query_source = ref_text if ref_text else claim_text
    if not query_source:
        return {"abstract": "Bibliography entry not mapped in PDF.", "title": "Unknown Title", "author": "Unknown Author"}
        
    clean_query = re.sub(r'[^\w\s]', ' ', query_source)[:140]
    clean_query = " ".join(clean_query.split())
    
    if not clean_query:
        return {"abstract": "Source query invalid.", "title": "Unknown Title", "author": "Unknown Author"}
        

    headers = {"User-Agent": "CitationChecker/1.0 (mailto:academic_verifier@example.com)"}
    
    # ATTEMPT 1: OpenAlex
    try:
        url = f"https://api.openalex.org/works?search={urllib.parse.quote(clean_query)}&per-page=1"
        if OPENALEX_API_KEY and OPENALEX_API_KEY != "sabNi4ria6xp7IrXWkzqf5":
            url += f"&api_key={OPENALEX_API_KEY}"
            
        response = requests.get(url, headers=headers, timeout=8)
        if response.status_code == 200:
            data = response.json()
            results = data.get("results", [])
            if results and len(results) > 0:
                paper = results[0]
                inv_abstract = paper.get("abstract_inverted_index")
                full_abstract = reconstruct_openalex_abstract(inv_abstract)
                if full_abstract:
                    title = paper.get("title") or "Unknown Title"
                    authorships = paper.get("authorships", [])
                    author_names = [a.get("author", {}).get("display_name", "") for a in authorships if a.get("author")]
                    author_str = ", ".join(filter(None, author_names)) if author_names else "Unknown Author"
                    return {"abstract": full_abstract, "title": title, "author": author_str}
    except Exception:
        pass

    # ATTEMPT 2: Semantic Scholar
    try:
        time.sleep(0.5)
        ss_url = f"https://api.semanticscholar.org/graph/v1/paper/search?query={urllib.parse.quote(clean_query)}&limit=1&fields=title,abstract,authors"
        ss_response = requests.get(ss_url, timeout=8)
        if ss_response.status_code == 200:
            ss_data = ss_response.json()
            if ss_data.get('data') and len(ss_data['data']) > 0:
                paper = ss_data['data'][0]
                abstract = paper.get('abstract')
                if abstract:
                    title = paper.get('title') or "Unknown Title"
                    authors = paper.get('authors', [])
                    author_str = ", ".join([a.get('name', '') for a in authors]) if authors else "Unknown Author"
                    return {"abstract": abstract, "title": title, "author": author_str}
    except Exception:
        pass

    # ATTEMPT 3: CrossRef
    try:
        time.sleep(0.5)
        cr_url = f"https://api.crossref.org/works?query={urllib.parse.quote(clean_query)}&select=title,author,abstract&rows=1"
        cr_response = requests.get(cr_url, timeout=8)
        if cr_response.status_code == 200:
            cr_data = cr_response.json()
            items = cr_data.get('message', {}).get('items', [])
            if items and len(items) > 0:
                paper = items[0]
                abstract = paper.get('abstract')
                if abstract:
                    abstract = re.sub(r'<[^>]+>', '', abstract)
                    title_arr = paper.get('title', [])
                    title = title_arr[0] if title_arr else "Unknown Title"
                    authors = paper.get('author', [])
                    author_str = ", ".join([f"{a.get('given', '')} {a.get('family', '')}".strip() for a in authors]) if authors else "Unknown Author"
                    return {"abstract": abstract, "title": title, "author": author_str}
    except Exception:
        pass

    # ATTEMPT 4: Google Scholar / SerpAPI Link Fallback
    scholar_result = fetch_google_scholar_fallback(clean_query)
    if scholar_result:
        return scholar_result

    return {"abstract": "Source abstract not openly available. No link found.", "title": "Unknown Title", "author": "Unknown Author"}

from sentence_transformers import SentenceTransformer, util
import torch

embedder = SentenceTransformer('all-mpnet-base-v2')

def verify_claim(claim, external_abstract):
    if external_abstract in ["Source abstract not openly available. No link found.", "Bibliography entry not mapped in PDF."]:
        return "Unsupported", 0.0

    embedding_claim = embedder.encode(claim, convert_to_tensor=True)
    embedding_source = embedder.encode(external_abstract, convert_to_tensor=True)

    cos_sim = util.cos_sim(embedding_claim, embedding_source).item()
    score_percentage = round(max(0.0, cos_sim) * 100, 2)
    
    if score_percentage >= 55:
        status = 'Supported'
    elif score_percentage >= 30:
        status = 'Partial'
    else:
        status = 'Unsupported'
        
    return status, score_percentage

if __name__ == "__main__":
    if len(sys.argv) < 2:
        log("Error: PDF file path argument missing.")
        sys.exit(1)

    target_pdf = sys.argv[1]
    extracted_data = extract_claims(target_pdf)
    
    results = []
    abstract_cache = {} 
    
    log(f"Extracted {len(extracted_data)} total citation instances. Processing...")
    
    for item in extracted_data:
        claim_text = item["claim"]
        cite_num = item["cite_num"]
        ref_text = item["ref_text"]
        user_paper_context = item["source_context"]  # Surrounding text from user manuscript
        
        cache_key = cite_num if cite_num else claim_text[:50]
        
        if cache_key in abstract_cache:
            source_data = abstract_cache[cache_key]
        else:
            source_data = fetch_source_metadata(ref_text, claim_text)
            abstract_cache[cache_key] = source_data
            time.sleep(1.5)
            
        real_abstract = source_data["abstract"]
        title = source_data["title"]
        author = source_data["author"]
            
        status, conf = verify_claim(claim_text, real_abstract)
        
        results.append({
            "claim": claim_text,
            "source_context": user_paper_context,  # Saved to database as the highlighted evidence snippet from the user paper
            "external_abstract": real_abstract,    # Used for NLI/similarity validation
            "title": title,
            "author": author,
            "status": status,
            "confidence": conf
        })

    print(json.dumps(results))