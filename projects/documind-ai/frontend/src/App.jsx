import React, { useState } from "react";
import axios from "axios";
import { 
  Upload, 
  Send, 
  FileText, 
  CheckCircle, 
  Loader2, 
  Sparkles, 
  XCircle,
  BrainCircuit,
  Lock,
  Activity
} from "lucide-react";

const App = () => {
  const [file, setFile] = useState(null);
  const [documentId, setDocumentId] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  // File selection handler
  const onFileChange = (e) => {
    setFile(e.target.files[0]);
    setAnswer("");
  };

  // Upload Logic
  const uploadFile = async () => {
    if (!file) return;
    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("file", file);
      
      const res = await axios.post("http://localhost:5000/upload", formData);
      setDocumentId(res.data.documentId);
    } catch (err) {
      console.error(err);
      alert("DocuMind Error: Ingestion failed.");
    } finally {
      setLoading(false);
    }
  };

  // Query Logic
  const askQuestion = async () => {
    if (!question || !documentId) return;
    try {
      setLoading(true);
      const res = await axios.post("http://localhost:5000/query", {
        question,
        documentId,
      });
      setAnswer(res.data.answer);
    } catch (err) {
      console.error(err);
      alert("DocuMind Error: Neural retrieval failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-slate-300 font-sans selection:bg-cyan-500/30">
      
      {/* Dynamic Background Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-cyan-900/10 blur-[150px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-900/10 blur-[150px] rounded-full" />
      </div>

      <div className="relative max-w-5xl mx-auto py-12 px-6">
        
        {/* Navigation / Header */}
        <nav className="flex justify-between items-center mb-16 px-4 py-3 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-cyan-400 to-indigo-600 p-2 rounded-xl">
              <BrainCircuit size={24} className="text-white" />
            </div>
            <h1 className="text-xl font-black tracking-tighter text-white">
              DocuMind <span className="text-cyan-400 italic font-medium">AI</span>
            </h1>
          </div>
          <div className="flex items-center gap-4 text-[10px] font-mono font-bold text-slate-500">
            <span className="flex items-center gap-1.5"><Lock size={12}/> ENCRYPTED</span>
            <span className="flex items-center gap-1.5 text-emerald-500"><Activity size={12}/> ENGINE ACTIVE</span>
          </div>
        </nav>

        <div className="grid lg:grid-cols-5 gap-8 items-start">
          
          {/* Left Column: Input & Controls */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white/[0.03] border border-white/10 p-8 rounded-3xl backdrop-blur-xl shadow-2xl">
              <h2 className="text-lg font-bold text-white mb-2">Knowledge Base</h2>
              <p className="text-xs text-slate-500 mb-6 uppercase tracking-widest">Feed the Mind</p>
              
              {!documentId ? (
                <div className="space-y-4">
                  <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-white/10 rounded-2xl hover:border-cyan-500/40 hover:bg-cyan-500/5 transition-all cursor-pointer group">
                    <div className="flex flex-col items-center text-center px-4">
                      <Upload className="mb-3 text-slate-600 group-hover:text-cyan-400 transition-colors" size={28} />
                      <p className="text-sm font-medium text-slate-400 truncate w-full">
                        {file ? file.name : "Choose Source File"}
                      </p>
                    </div>
                    <input type="file" className="hidden" onChange={onFileChange} accept=".pdf,.doc,.docx,.txt" />
                  </label>
                  
                  {file && (
                    <button 
                      onClick={uploadFile}
                      disabled={loading}
                      className="w-full bg-cyan-500 hover:bg-cyan-400 text-[#050505] font-black py-4 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="animate-spin" size={20} /> : "Vectorize PDF"}
                    </button>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-between animate-in zoom-in-95">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-emerald-500 rounded-lg">
                      <CheckCircle className="text-white" size={16} />
                    </div>
                    <p className="text-xs font-bold text-emerald-400 uppercase truncate max-w-[100px]">Ingested</p>
                  </div>
                  <button onClick={() => {setDocumentId(""); setFile(null); setAnswer("")}} className="text-slate-500 hover:text-red-400">
                    <XCircle size={20} />
                  </button>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl italic text-[11px] text-slate-500">
              "DocuMind uses semantic search to locate specific data points across 100s of pages in milliseconds."
            </div>
          </div>

          {/* Right Column: Interaction */}
          <div className={`lg:col-span-3 transition-all duration-700 ${!documentId ? "opacity-20 grayscale" : "opacity-100"}`}>
            <div className="bg-white/[0.03] border border-white/10 p-8 rounded-3xl backdrop-blur-xl min-h-[400px] flex flex-col">
              <h2 className="text-lg font-bold text-white mb-2">Neural Interface</h2>
              <p className="text-xs text-slate-500 mb-8 uppercase tracking-widest italic font-serif">Ask anything about your data</p>

              <div className="relative mb-8">
                <input
                  type="text"
                  placeholder={documentId ? "Enter your prompt..." : "Waiting for document..."}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && askQuestion()}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl py-5 pl-6 pr-16 text-white focus:outline-none focus:border-cyan-500/50 transition-all shadow-inner"
                />
                <button 
                  onClick={askQuestion}
                  disabled={loading || !question}
                  className="absolute right-3 top-3 bottom-3 px-4 bg-white/5 border border-white/10 text-white rounded-xl hover:bg-white/10 disabled:opacity-20 transition-all"
                >
                  {loading ? <Loader2 size={18} className="animate-spin text-cyan-400" /> : <Send size={18} />}
                </button>
              </div>

              {answer && (
                <div className="flex-1 space-y-4 animate-in slide-in-from-bottom-4 duration-500">
                  <div className="flex items-center gap-2 text-cyan-500 font-mono text-[10px] font-bold uppercase tracking-widest">
                    <Sparkles size={14}/> Result Synthesis
                  </div>
                  <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl text-slate-300 leading-relaxed font-light text-sm shadow-xl">
                    {answer}
                  </div>
                </div>
              )}

              {!answer && !loading && (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-600 opacity-40">
                  <FileText size={48} className="mb-4" strokeWidth={1} />
                  <p className="text-sm">Response will appear here</p>
                </div>
              )}
            </div>
          </div>

        </div>

        <footer className="mt-12 text-center text-[10px] font-mono text-slate-700 tracking-[0.5em] uppercase">
          Build v26.4 // Node-RAG // Localhost:5000
        </footer>
      </div>
    </div>
  );
};

export default App;