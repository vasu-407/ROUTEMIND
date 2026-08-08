import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, CheckCircle2, ChevronRight, Activity } from 'lucide-react';
import { askCopilot, getSimulations } from '../api';

const AiInsights = () => {
  const [messages, setMessages] = useState([
    { role: 'user', text: "Why did route 00143bd change?", time: "10:41 AM" },
    { role: 'ai', text: "Route 00143bd was updated because a new pickup request was added near stop #18. The system recalculated the route to include this pickup while ensuring all constraints (time windows, capacity, COD limit) are satisfied with minimal impact.", time: "10:42 AM" }
  ]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [latestSimulation, setLatestSimulation] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    getSimulations()
      .then(({ data }) => {
        const latest = data[0] || null;
        setLatestSimulation(latest);
        if (latest?.explanation?.reason_changed) {
          setMessages([{
            role: 'ai',
            text: latest.explanation.reason_changed,
            time: new Date(latest.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          }]);
          askCopilot({
            route_id: latest.route_id,
            question: `Create a concise supervisor message about this exact simulation. Event: ${latest.event_type}. Distance change: ${latest.impact?.distance_difference_km ?? 0} km. ETA change: ${latest.impact?.time_difference_mins ?? 0} minutes. Existing rule result: ${latest.explanation?.reason_changed || 'not available'}. Explain what happened to the delivery route, why it changed, the impact on the driver, and whether to approve or reject. Do not invent facts.`,
          })
            .then(({ data }) => {
              const answer = data.answer;
              const text = typeof answer === 'string'
                ? answer
                : answer?.answer || answer?.reason_changed || JSON.stringify(answer);
              setMessages(messages => [...messages, {
                role: 'ai',
                text,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              }]);
            })
            .catch(console.error);
        }
      })
      .catch(console.error);
  }, []);

  const latestExplanation = latestSimulation?.explanation || {};

  const handleSend = async () => {
    if (!query.trim()) return;
    const userMsg = query;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages(m => [...m, { role: 'user', text: userMsg, time }]);
    setQuery('');
    setLoading(true);

    try {
      const res = await askCopilot({ question: userMsg });
      const answerObj = res.data.answer;
      let textResponse = "";
      if (typeof answerObj === 'string') {
        textResponse = answerObj;
      } else if (answerObj && answerObj.answer) {
        textResponse = answerObj.answer;
        if (answerObj.suggested_actions && answerObj.suggested_actions.length > 0) {
           textResponse += "\n\nSuggested Actions:\n- " + answerObj.suggested_actions.join("\n- ");
        }
      } else {
        textResponse = JSON.stringify(answerObj);
      }
      
      setMessages(m => [...m, { 
        role: 'ai', 
        text: textResponse,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    } catch (err) {
      setMessages(m => [...m, { 
        role: 'ai', 
        text: "Sorry, I encountered an error. " + (err.response?.data?.detail || err.message),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    } finally {
      setLoading(false);
    }
  };

  const SUGGESTIONS = [
    'Which routes have delays?',
    'Show COD limit alerts',
    'Predict tomorrow bottlenecks',
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col p-6 font-sans">
      
      <div className="grid grid-cols-12 gap-6 flex-1 max-h-[85vh]">
        
        {/* Left Panel - Route Explanation */}
        <div className="col-span-7 flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-100 p-6 overflow-y-auto custom-scrollbar">
          <div className="flex items-center mb-1">
            <div className="bg-indigo-600 p-1.5 rounded-lg text-white mr-3">
              <Bot size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight leading-none">AI Route Explanation</h2>
              <p className="text-slate-500 text-xs mt-1">AI-powered insights for route changes</p>
            </div>
          </div>
          
          <div className="mt-8 grid grid-cols-12 gap-8">
            {latestSimulation && (
              <div className="col-span-12 rounded-xl border border-indigo-100 bg-indigo-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-indigo-700">Latest simulation · {latestSimulation.event_type?.replace('_', ' ')}</p>
                <p className="mt-2 text-sm font-semibold text-slate-800">{latestExplanation.reason_changed || 'Route change explanation is being prepared.'}</p>
                <p className="mt-2 text-sm text-slate-600">{latestExplanation.approval_reason || latestExplanation.supervisor_recommendation || 'Supervisor review is required before dispatch.'}</p>
                <p className="mt-2 text-xs text-indigo-700">Generated by: {latestExplanation.ai_provider === 'gemini' ? 'Gemini' : 'rules-based fallback'}</p>
              </div>
            )}
            <div className="col-span-7">
              <h3 className="text-sm font-bold text-slate-800 mb-2">Why did this route change?</h3>
              <p className="text-sm text-slate-600 leading-relaxed mb-6">
                A new pickup request was received near stop #18. The optimizer inserted the pickup between stops #18 and #19 to minimize additional travel time while satisfying all constraints.
              </p>
              
              <h3 className="text-sm font-bold text-slate-800 mb-3">Key Factors</h3>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start">
                  <CheckCircle2 size={16} className="text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-slate-600">New pickup location is 2.1 km from current route</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle2 size={16} className="text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-slate-600">All delivery windows remain satisfied</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle2 size={16} className="text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-slate-600">COD limit within safe threshold (₹ 49,250 / ₹ 50,000)</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle2 size={16} className="text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-slate-600">Driver working hours within limit</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle2 size={16} className="text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-slate-600">Distance increase is minimal (+2.1 km)</span>
                </li>
              </ul>
            </div>
            
            <div className="col-span-5">
              <h3 className="text-sm font-bold text-slate-800 mb-3">Impact Analysis</h3>
              <div className="space-y-3 mb-8 border-b border-slate-100 pb-6">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Distance Impact</span>
                  <span className="font-semibold text-red-500">+2.1 km</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Time Impact</span>
                  <span className="font-semibold text-red-500">+4 min</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Fuel Impact</span>
                  <span className="font-semibold text-red-500">+0.4 L</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Cost Impact</span>
                  <span className="font-semibold text-red-500">+ ₹ 210</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Service Level</span>
                  <span className="font-semibold text-green-500">No Change</span>
                </div>
              </div>
              
              <h3 className="text-sm font-bold text-slate-800 mb-2">Recommendation</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Approve the replanned route. The impact is minimal and operational efficiency is maintained.
              </p>
            </div>
          </div>
          
          <div className="mt-auto pt-6">
            <div className="flex justify-between items-end mb-1">
              <span className="text-sm font-bold text-slate-800">Confidence Score</span>
              <span className="text-xs font-bold text-slate-500">92%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2">
              <div className="bg-indigo-500 h-2 rounded-full" style={{ width: '92%' }}></div>
            </div>
          </div>
        </div>

        {/* Right Panel - Chat Window */}
        <div className="col-span-5 flex flex-col h-full bg-[#0F172A] rounded-xl shadow-sm border border-slate-800 overflow-hidden relative">
          <div className="p-5 border-b border-slate-800 bg-slate-900/50">
            <h2 className="text-lg font-bold text-white tracking-tight">AI Insights</h2>
            <p className="text-slate-400 text-xs mt-1">Ask questions about your operations</p>
          </div>
          
          <div className="flex-1 p-5 overflow-y-auto custom-scrollbar space-y-5">
            <AnimatePresence>
              {messages.map((msg, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div className={`px-4 py-3 text-sm max-w-[85%] leading-relaxed ${
                    msg.role === 'user' 
                      ? 'bg-indigo-600 text-white rounded-2xl rounded-tr-sm' 
                      : 'bg-slate-800 text-slate-200 rounded-2xl rounded-tl-sm border border-slate-700'
                  }`}>
                    {msg.text}
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1">{msg.time}</span>
                </motion.div>
              ))}
              {loading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3">
                  <div className="bg-slate-800 px-4 py-3 rounded-2xl rounded-tl-sm border border-slate-700 flex gap-1">
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={bottomRef} />
          </div>

          <div className="p-4 bg-slate-900/80 border-t border-slate-800">
            <div className="flex flex-wrap gap-2 mb-3">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => setQuery(s)}
                  className="bg-slate-800 text-slate-300 text-[11px] font-medium px-3 py-1.5 rounded-full hover:bg-indigo-600 hover:text-white transition-colors border border-slate-700 hover:border-indigo-600"
                >
                  {s}
                </button>
              ))}
            </div>
            
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="Ask me anything about your operations..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-4 pr-12 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-inner"
              />
              <button
                onClick={handleSend}
                className="absolute right-1.5 top-1.5 bottom-1.5 bg-indigo-600 hover:bg-indigo-500 text-white w-9 rounded-lg flex items-center justify-center transition-colors"
              >
                <Send size={16} className="ml-0.5" />
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AiInsights;
