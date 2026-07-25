import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Send, Bot, User, Loader2, Sparkles, X, ExternalLink, ShieldCheck, Database, Building } from 'lucide-react';

const SUGGESTIONS = [
  "What affects property valuation?",
  "Tell me about Miyapur market trends",
  "Tell me about property 42",
  "Explain the investment score of property 42",
  "Compare property 42 and property 108",
  "Show 3 BHK apartments in Hyderabad",
  "Show properties under 1.5 crore",
  "Recommend low-risk properties in Hyderabad",
  "What amenities are near property 42?",
];

function ChatBubble({ msg, index }) {
  const isUser = msg.role === 'user';
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25, delay: index * 0.02 }}
      className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      <div className={`p-2.5 rounded-xl flex-shrink-0 ${isUser ? 'bg-violet-600 shadow-lg shadow-violet-600/30' : 'bg-slate-700/80'}`}>
        {isUser ? <User className="h-4 w-4 text-white" /> : <Bot className="h-4 w-4 text-violet-400" />}
      </div>

      <div className={`max-w-[82%] px-4 py-3.5 rounded-2xl text-sm leading-relaxed ${isUser
        ? 'bg-violet-600/20 border border-violet-500/30 text-violet-100 rounded-tr-sm'
        : 'bg-slate-800/80 border border-white/10 text-slate-200 rounded-tl-sm space-y-3'}`}>
        
        {/* Main Text Content */}
        <div className="whitespace-pre-wrap">{msg.content}</div>

        {/* Structured Property Recommendation Cards */}
        {msg.properties && msg.properties.length > 0 && (
          <div className="pt-3 border-t border-white/10 space-y-2.5">
            <p className="text-xs font-semibold text-violet-300 uppercase tracking-wider flex items-center gap-1.5">
              <Building className="h-3.5 w-3.5 text-violet-400" /> Property Recommendations ({msg.properties.length})
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {msg.properties.map((p, idx) => (
                <div key={p.id || idx} className="p-3 bg-slate-950/70 border border-white/5 rounded-xl flex flex-col justify-between hover:border-violet-500/30 transition">
                  <div>
                    <div className="flex justify-between items-start gap-1">
                      <p className="font-bold text-white text-xs truncate">{p.property_name || `${p.locality} ${p.property_type}`}</p>
                      <span className="text-[10px] font-mono text-violet-400 font-bold">#{p.id}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">{p.locality}, {p.city} · {p.bedrooms} BHK ({p.area_sqft} sqft)</p>
                    <p className="text-xs font-bold text-violet-300 mt-1">₹{new Intl.NumberFormat('en-IN').format(p.price_inr)}</p>
                  </div>
                  <div className="flex justify-between items-center mt-2.5 pt-2 border-t border-white/5">
                    <span className="text-[10px] text-emerald-400 font-semibold">Inv: {p.investment_score}/100</span>
                    <button
                      onClick={() => navigate(`/properties/${p.id}`)}
                      className="px-2.5 py-1 bg-violet-600/30 hover:bg-violet-600 text-violet-200 text-[10px] font-semibold rounded-lg flex items-center gap-1 transition"
                    >
                      View Property <ExternalLink className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Metadata Footer: Sources & Confidence */}
        {!isUser && (msg.sources || msg.confidence) && (
          <div className="pt-2 border-t border-white/5 flex flex-wrap justify-between items-center text-[10px] text-slate-400 gap-2">
            {msg.sources && msg.sources.length > 0 && (
              <div className="flex items-center gap-1">
                <Database className="h-3 w-3 text-slate-500" />
                <span className="text-slate-500">Sources:</span>
                <span className="text-slate-300 font-medium">{msg.sources.join(' · ')}</span>
              </div>
            )}
            {msg.confidence && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                msg.confidence === 'High Confidence' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                msg.confidence === 'Medium Confidence' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
                'bg-slate-700/50 border-white/10 text-slate-400'
              }`}>
                {msg.confidence}
              </span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function AIChatbot() {
  const conversationIdRef = useRef(`conv_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`);

  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hello! I'm your AI Real Estate Intelligence Assistant 🏠\n\nI can help you with:\n• Factual market trends & locality growth statistics\n• Structured property lookups & AI risk evaluations\n• Side-by-side property comparisons (e.g., 'Compare property 42 and property 108')\n• Semantic RAG knowledge base search over 5,000 real estate topics\n\nWhat would you like to research today?",
      sources: ["PropValue Intelligence Engine"],
      confidence: "High Confidence"
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendMessage = async (text) => {
    const question = (text || input).trim();
    if (!question) return;

    setMessages(prev => [...prev, { role: 'user', content: question }]);
    setInput('');
    setLoading(true);

    try {
      const res = await axios.post('/api/assistant/chat', {
        message: question,
        conversationId: conversationIdRef.current
      });

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: res.data.answer,
        sources: res.data.sources,
        confidence: res.data.confidence,
        properties: res.data.properties
      }]);
    } catch (err) {
      console.error('Assistant API error:', err);
      const errMsg = err.response?.data?.detail || "Sorry, the AI assistant encountered an issue. Please try again.";
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `⚠️ ${errMsg}`,
        confidence: "Limited Data"
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

  const clearChat = () => {
    conversationIdRef.current = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    setMessages([{
      role: 'assistant',
      content: "Chat context reset! How can I assist your real estate research?",
      sources: ["PropValue Intelligence Engine"],
      confidence: "High Confidence"
    }]);
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-white flex flex-col">
      {/* Ambient glow */}
      <div className="fixed top-0 right-0 w-96 h-96 rounded-full bg-violet-600/5 blur-[150px] pointer-events-none" />

      <div className="max-w-4xl w-full mx-auto flex flex-col h-[calc(100vh-4rem)] px-4 py-8">
        {/* Header */}
        <div className="glass-panel p-5 rounded-2xl border border-white/10 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-violet-600/20 border border-violet-500/30 rounded-xl">
              <Sparkles className="h-6 w-6 text-violet-400" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-white">AI Real Estate Intelligence Assistant</h1>
              <p className="text-xs text-slate-400">Hybrid RAG Architecture · 5,000 Indexed Documents · Structured Datasets</p>
            </div>
          </div>
          <button onClick={clearChat} className="p-2 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition" title="Clear chat context">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Chat Window */}
        <div className="flex-1 glass-panel rounded-2xl border border-white/10 overflow-y-auto p-5 space-y-4 mb-4">
          <AnimatePresence>
            {messages.map((msg, i) => <ChatBubble key={i} msg={msg} index={i} />)}
          </AnimatePresence>

          {loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-slate-700/80">
                <Bot className="h-4 w-4 text-violet-400" />
              </div>
              <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-slate-800/80 border border-white/10">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </motion.div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Suggestion Pills */}
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1 hide-scrollbar">
          {SUGGESTIONS.map(s => (
            <button key={s} onClick={() => sendMessage(s)}
              className="flex-shrink-0 px-3 py-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300 text-xs hover:bg-violet-600/20 transition whitespace-nowrap">
              {s}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="glass-panel rounded-2xl border border-white/10 p-3 flex items-end gap-3">
          <textarea
            rows={1}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about any property, Miyapur market trends, or comparison..."
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none resize-none leading-relaxed max-h-32 overflow-y-auto"
            style={{ minHeight: '40px' }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            className="p-3 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white transition shadow-lg shadow-violet-600/25 flex-shrink-0"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
