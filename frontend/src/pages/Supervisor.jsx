import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getEvents, approveEvent, rejectEvent,  } from '../api';
import { CheckCircle, XCircle, Map as MapIcon, ShieldAlert, Check, X, ArrowRight, Bot } from 'lucide-react';
import MapViewer from '../components/MapViewer';

const Supervisor = () => {
  const [searchParams] = useSearchParams();
  const targetRouteId = searchParams.get('routeId');

  const [pending, setPending] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionResult, setActionResult] = useState(null); // { routeId, action, eventType }

  const loadPending = () => {
    getEvents()
      .then(res => {
        const p = res.data.filter(item => item.status === 'PENDING_APPROVAL');
        setPending(p);

        if (p.length > 0) {
          if (targetRouteId) {
            const target = p.find(x => x.route_id === targetRouteId);
            if (target) {
              setSelectedItem(target);
              return;
            }
          }

          if (!selectedItem) {
            setSelectedItem(p[0]);
          } else {
            const updated = p.find(x => x.route_id === selectedItem.route_id);
            if (updated) {
              setSelectedItem(updated);
            } else {
              setSelectedItem(p[0]);
            }
          }
        } else {
          setSelectedItem(null);
        }
      })
      .catch(err => console.error(err));
  };

  useEffect(() => {
    loadPending();
    const interval = setInterval(loadPending, 5000);
    return () => clearInterval(interval);
  }, [targetRouteId]);

  const handleAction = async (eventId, action) => {
    const eventType = selectedItem?.event_type || selectedItem?.eventType;
    setLoading(true);
    try {
      const { data } = action === 'approve' 
        ? await approveEvent(eventId, { notes: '' }) 
        : await rejectEvent(eventId, { notes: '' });
      if (action === 'approve') {
        localStorage.setItem('offline_driver_route', JSON.stringify({
          route_id: data.route_id,
          sequence: data.after_sequence,
          stop_coordinates: data.stop_coordinates,
        }));
      }
      setActionResult({ eventId, action, eventType });
      setPending(prev => prev.filter(x => x.id !== eventId));
      setSelectedItem(null);
      loadPending();
      // Auto-clear banner after 6s
      setTimeout(() => setActionResult(null), 6000);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans">
      <header className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Supervisor Console</h1>
          <p className="text-slate-500 text-sm mt-1">Review AI-proposed route modifications and dispatch to drivers.</p>
        </div>
      </header>

      {/* Action Result Banner */}
      {actionResult && (
        <div className={`mb-5 flex items-center gap-3 px-5 py-3 rounded-xl border font-semibold text-sm shadow-sm ${
          actionResult.action === 'approve'
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {actionResult.action === 'approve'
            ? <CheckCircle size={18} className="text-green-600" />
            : <XCircle size={18} className="text-red-500" />}
          Replan for <span className="font-bold mx-1">{actionResult.eventType?.replace(/_/g, ' ')}</span>
          was <span className="font-bold mx-1">{actionResult.action === 'approve' ? 'Approved & Dispatched' : 'Rejected'}</span>.
        </div>
      )}
      <div className="grid grid-cols-12 gap-6 h-[80vh]">
        {/* LEFT COLUMN: Queue */}
        <div className="col-span-4 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
          <div className="bg-slate-50 p-4 border-b border-slate-200">
            <h2 className="font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center justify-between">
              Approval Queue
              <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-xs">{pending.length}</span>
            </h2>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
            {pending.length === 0 ? (
              <div className="text-center p-8 text-slate-400 text-sm">No pending items.</div>
            ) : pending.map(item => (
              <div 
                key={item.id} 
                onClick={() => setSelectedItem(item)}
                className={`p-4 rounded-lg cursor-pointer border transition-colors ${selectedItem?.id === item.id ? 'border-indigo-500 bg-indigo-50/30 ring-1 ring-indigo-500' : 'border-slate-200 hover:border-indigo-300 bg-white'}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="font-bold text-slate-800 text-sm">{item.label || item.routeId.substring(0,8)}</span>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${item.feasibility_check?.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {item.feasibility_check?.passed ? 'Valid' : 'Invalid'}
                  </span>
                </div>
                <div className="text-xs text-slate-600 font-medium mb-2">{item.eventType?.replace('_', ' ')}</div>
                <div className="text-[11px] text-slate-500 line-clamp-2">{item.explanation?.reason_changed || item.explanation?.supervisor_recommendation}</div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN: Details & Map */}
        <div className="col-span-8 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
          {selectedItem ? (
            <>
              {/* DETAILS HEADER */}
              <div className="p-6 border-b border-slate-200">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">{selectedItem.eventType?.replace('_', ' ')} on Route {selectedItem.label || selectedItem.routeId.substring(0,8)}</h2>
                    <p className="text-sm text-slate-500 mt-1">{selectedItem.explanation?.business_impact}</p>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => handleAction(selectedItem.id, 'reject')}
                      disabled={loading}
                      className="px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center"
                    >
                      <X size={16} className="mr-2" /> Reject Replan
                    </button>
                    <button 
                      onClick={() => handleAction(selectedItem.id, 'approve')}
                      disabled={loading || !selectedItem.feasibility_check?.passed}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center"
                    >
                      <Check size={16} className="mr-2" /> Approve & Dispatch
                    </button>
                  </div>
                </div>

                {/* AI RECOMMENDATION BOX */}
                <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-2 mb-2 text-indigo-800 font-bold text-sm">
                    <Bot size={16} /> AI Explanation & Recommendation
                  </div>
                  <p className="text-sm text-slate-700 mb-2">{selectedItem.explanation?.reason_changed}</p>
                  <p className="text-sm font-semibold text-indigo-700 mb-2">{selectedItem.explanation?.supervisor_recommendation}</p>
                  {selectedItem.explanation?.driver_notification && (
                    <div className="mt-3 bg-white border border-indigo-200 p-3 rounded text-xs text-indigo-900">
                      <strong className="block text-[10px] text-indigo-500 uppercase tracking-wider mb-1">Driver Message to Dispatch:</strong>
                      "{selectedItem.explanation.driver_notification}"
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="bg-slate-50 p-3 rounded border border-slate-100">
                    <span className="block text-[10px] uppercase text-slate-400 font-bold mb-1">Time Impact</span>
                    <span className="font-bold text-slate-800">{selectedItem.metrics?.time_saved_mins > 0 ? '+' : ''}{selectedItem.metrics?.time_saved_mins || 0} mins</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded border border-slate-100">
                    <span className="block text-[10px] uppercase text-slate-400 font-bold mb-1">Distance Impact</span>
                    <span className="font-bold text-slate-800">{selectedItem.metrics?.distance_saved_km > 0 ? '+' : ''}{selectedItem.metrics?.distance_saved_km || 0} km</span>
                  </div>
                  <div className={`p-3 rounded border ${selectedItem.feasibility_check?.passed ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                    <span className="block text-[10px] uppercase text-slate-400 font-bold mb-1">Feasibility</span>
                    <span className={`font-bold flex items-center ${selectedItem.feasibility_check?.passed ? 'text-green-700' : 'text-red-700'}`}>
                      {selectedItem.feasibility_check?.passed ? <><CheckCircle size={14} className="mr-1" /> All Constraints Valid</> : <><ShieldAlert size={14} className="mr-1" /> Constraint Violation</>}
                    </span>
                  </div>
                </div>
              </div>

              {/* MAP VISUALIZATION */}
              <div className="flex-1 relative bg-slate-100">
                <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur p-2 rounded-lg shadow-sm border border-slate-200 text-xs font-bold text-slate-700 flex flex-col gap-1">
                  <div className="flex items-center gap-2"><div className="w-3 h-1 bg-purple-600 rounded-full"></div> [ PROPOSED ROUTE ]</div>
                  <div className="flex items-center gap-2"><div className="w-3 h-1 bg-green-500 rounded-full"></div> [ ORIGINAL ROUTE ]</div>
                  <div className="text-slate-500 font-normal mt-1 pt-1 border-t border-slate-100">Use top-right toggles to switch views</div>
                </div>
                {selectedItem.stop_coordinates && selectedItem.after_sequence ? (
                  <MapViewer 
                    routeSequence={selectedItem.after_sequence} 
                    beforeSequence={selectedItem.before_sequence}
                    stopCoordinates={selectedItem.stop_coordinates} 
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                    <MapIcon size={24} className="mr-2 opacity-50" /> Map data unavailable
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
              <ShieldAlert size={48} className="mb-4 opacity-20" />
              <p>Select a pending replan to review its impact.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default Supervisor;
