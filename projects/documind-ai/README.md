# 🚀 DocuMind AI – Intelligent Document Query System (RAG)

DocuMind AI is a **Retrieval-Augmented Generation (RAG)** system that allows users to query documents using natural language.
It combines **semantic search + vector embeddings + local LLM** to generate accurate, context-aware answers.

---

## 🧠 Key Features

* 🔍 Semantic Search using embeddings (MiniLM)
* 📄 PDF parsing and intelligent text chunking
* 🧮 Vector similarity search (cosine similarity)
* 🤖 Local LLM (Flan-T5) for answer generation
* 🧹 Context cleaning for improved accuracy
* 📊 Handles both descriptive and count-based queries
* 🌐 Full-stack application (Node.js + React)

---

## ⚙️ Tech Stack

**Backend**

* Node.js
* Express.js
* @xenova/transformers (for embeddings & LLM)

**Frontend**

* React.js
* Axios

**AI/ML**

* Embeddings: `all-MiniLM-L6-v2`
* LLM: `flan-t5-small`
* Similarity: Cosine Similarity

---

## 🏗️ System Architecture

```
PDF → Text Extraction → Chunking → Embeddings → Vector Store
↓
User Query → Embedding → Similarity Search → Top Context
↓
LLM (Flan-T5) → Final Answer
```

---

## 📂 Project Structure

```
documind-ai/
├── backend/
│   ├── controllers/
│   ├── services/
│   ├── routes/
│   ├── utils/
│   └── index.js
├── frontend/
│   └── src/
└── README.md
```

---

## 🚀 Getting Started

### 🔹 1. Clone the repository

```bash
git clone https://github.com/Anunay-web/RAG-document-QA-system.git
cd RAG-document-QA-system
```

---

### 🔹 2. Backend Setup

```bash
cd backend
npm install
npm run dev
```

---

### 🔹 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

---

## 📌 Usage

1. Upload a document (PDF)
2. System processes and stores embeddings
3. Ask questions like:

   * "What is this document about?"
   * "How many projects are mentioned?"
4. Get intelligent answers based on document content

---

## 🧩 Endee Integration

This project is built using concepts inspired by the Endee vector database:

* Implemented vector storage and retrieval
* Applied semantic search techniques
* Built a RAG pipeline on top of vector similarity

🔗 Endee Fork: https://github.com/Anunay-web/endee

---

## ⚡ Challenges Faced

* Handling noisy text (emails, links, irrelevant data)
* Improving retrieval accuracy
* Managing local LLM performance
* Designing a clean RAG pipeline

---

## 🚀 Future Improvements

* Integrate scalable vector DB (Endee / Pinecone)
* Multi-document querying
* Better ranking (hybrid search)
* Streaming responses
* UI/UX improvements

---

## 👨‍💻 Author

**Anunay Kumar**
B.Tech CSE | AI & Full Stack Enthusiast

---

## ⭐ Acknowledgment

Inspired by **Endee Vector Database** and modern RAG architectures.
