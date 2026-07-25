import os
import pandas as pd
import numpy as np
import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
RAG_CSV_PATH = os.path.join(BASE_DIR, "Dataset", "RAG_Knowledge_5000.csv")
INDEX_CACHE_PATH = os.path.join(BASE_DIR, "backend", "ml", "saved_models", "rag_tfidf_index.joblib")

class VectorRAGRetriever:
    def __init__(self):
        self.vectorizer = None
        self.tfidf_matrix = None
        self.documents = []
        self.is_indexed = False
        self._load_or_build_index()

    def _load_or_build_index(self):
        """Loads cached TF-IDF index or builds it from RAG_Knowledge_5000.csv"""
        if os.path.exists(INDEX_CACHE_PATH):
            try:
                data = joblib.load(INDEX_CACHE_PATH)
                self.vectorizer = data["vectorizer"]
                self.tfidf_matrix = data["tfidf_matrix"]
                self.documents = data["documents"]
                self.is_indexed = True
                print(f"Loaded persistent RAG Index with {len(self.documents)} documents.")
                return
            except Exception as e:
                print(f"Failed to load cached RAG index: {e}. Rebuilding...")

        if not os.path.exists(RAG_CSV_PATH):
            print(f"Warning: {RAG_CSV_PATH} not found. Vector RAG disabled.")
            return

        try:
            print("Building TF-IDF Vector Index over 5000 RAG Knowledge documents...")
            df = pd.read_csv(RAG_CSV_PATH)
            df_clean = df.drop_duplicates(subset=["Question", "Answer"])
            
            docs = []
            corpus = []
            for _, row in df_clean.iterrows():
                q = str(row.get("Question", "")).strip()
                a = str(row.get("Answer", "")).strip()
                cat = str(row.get("Category", "General Real Estate")).strip()
                
                text_to_embed = f"{q} {a} {cat}"
                corpus.append(text_to_embed)
                docs.append({
                    "question": q,
                    "answer": a,
                    "category": cat
                })

            self.vectorizer = TfidfVectorizer(stop_words='english', max_features=10000, ngram_range=(1, 2))
            self.tfidf_matrix = self.vectorizer.fit_transform(corpus)
            self.documents = docs
            self.is_indexed = True

            # Save persistent index to disk if writable
            try:
                os.makedirs(os.path.dirname(INDEX_CACHE_PATH), exist_ok=True)
                joblib.dump({
                    "vectorizer": self.vectorizer,
                    "tfidf_matrix": self.tfidf_matrix,
                    "documents": self.documents
                }, INDEX_CACHE_PATH)
            except Exception as e:
                print(f"Read-only filesystem, skipping index cache save: {e}")
            print(f"RAG Vector Index built successfully! Indexed {len(self.documents)} documents.")
        except Exception as e:
            print(f"Error building RAG vector index: {e}")

    def search(self, query: str, top_k: int = 3, min_similarity: float = 0.12) -> list[dict]:
        """Performs vector similarity search against the RAG knowledge index."""
        if not self.is_indexed or not self.vectorizer or self.tfidf_matrix is None:
            return []

        try:
            query_vec = self.vectorizer.transform([query])
            sim_scores = cosine_similarity(query_vec, self.tfidf_matrix).flatten()
            top_indices = np.argsort(sim_scores)[::-1][:top_k]

            results = []
            for idx in top_indices:
                score = float(sim_scores[idx])
                if score >= min_similarity:
                    doc = self.documents[idx].copy()
                    doc["similarity_score"] = round(score, 3)
                    results.append(doc)
            return results
        except Exception as e:
            print(f"Vector RAG search error: {e}")
            return []

# Singleton Instance
vector_retriever = VectorRAGRetriever()
