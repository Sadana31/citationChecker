import React, { useState, useEffect } from 'react';
import { FileText, Clock, Loader2, CheckCircle2, AlertCircle, Search, ChevronRight, ChevronDown, XCircle, UserCheck } from 'lucide-react';

export default function History() {
  const [pastPapers, setPastPapers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // State for expanded rows
  const [expandedId, setExpandedId] = useState(null);
  const [paperDetails, setPaperDetails] = useState({});
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    // Retrieve logged-in user from localStorage
    const savedUser = localStorage.getItem('citation_ai_user');
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      setCurrentUser(parsedUser);
      fetchHistory(parsedUser.email);
    } else {
      setIsLoading(false);
      setError("Please sign in with Google to view your personalized history.");
    }
  }, []);


  const fetchHistory = async (email) => {
    try {
      const API_URL = "https://citationchecker-zmrc.onrender.com" || 'http://localhost:3001';

      const response = await fetch(`${API_URL}/api/history?email=${encodeURIComponent(email)}`);
      if (!response.ok) throw new Error('Failed to fetch history');
      const data = await response.json();
      setPastPapers(data);
    } catch (err) {
      console.error("Error fetching history:", err);
      setError("Could not load your processing history.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDoubleClick = async (paperId) => {
    if (expandedId === paperId) {
      setExpandedId(null);
      return;
    }
    
    setExpandedId(paperId);
    
    if (!paperDetails[paperId]) {
      setLoadingDetails(true);
      try {
        const API_URL = "https://citationchecker-zmrc.onrender.com" || 'http://localhost:3001';
        const response = await fetch(`${API_URL}/api/results/${paperId}`);
        const data = await response.json();
        setPaperDetails(prev => ({ ...prev, [paperId]: data.claims || [] }));
      } catch (err) {
        console.error("Error fetching paper details:", err);
      } finally {
        setLoadingDetails(false);
      }
    }
  };

  const getStatusConfig = (status) => {
    switch(status?.toLowerCase()) {
      case 'completed': 
      case 'supported':
        return { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: <CheckCircle2 size={14} /> };
      case 'failed': 
      case 'unsupported':
        return { color: 'bg-rose-100 text-rose-700 border-rose-200', icon: <XCircle size={14} /> };
      case 'partial':
        return { color: 'bg-amber-100 text-amber-700 border-amber-200', icon: <AlertCircle size={14} /> };
      default: 
        return { color: 'bg-slate-100 text-slate-700 border-slate-200', icon: <Loader2 size={14} className="animate-spin" /> };
    }
  };

  return (
    <div className="mx-auto space-y-8 animate-in fade-in duration-500 pb-12 px-4">
      
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-indigo-600">
            Verification History
          </h2>
          <p className="text-slate-500 font-medium mt-2">
            {currentUser ? `Showing documents for ${currentUser.email}` : "Double-click any manuscript to review its extracted claims."}
          </p>
        </div>
        {currentUser && (
          <div className="hidden md:flex items-center gap-2 bg-blue-50 border border-blue-100 text-blue-700 px-4 py-2 rounded-2xl text-xs font-bold shadow-sm">
            <UserCheck size={16} /> Authenticated Account
          </div>
        )}
      </header>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-64 bg-white/80 backdrop-blur-md rounded-3xl border border-slate-200 shadow-sm">
          <Loader2 className="animate-spin text-blue-600 mb-4" size={32} />
          <p className="text-slate-500 font-medium">Loading history...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-64 bg-rose-50/50 rounded-3xl border border-rose-100 text-center px-6">
          <AlertCircle className="text-rose-500 mb-3" size={32} />
          <p className="text-rose-600 font-medium">{error}</p>
        </div>
      ) : pastPapers.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 bg-white/80 backdrop-blur-md rounded-3xl border border-slate-200 shadow-sm text-center px-6">
          <div className="p-4 bg-slate-50 rounded-full mb-4">
            <Search className="text-slate-400" size={32} />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-1">No manuscripts found for this account</h3>
          <p className="text-slate-500 text-sm">Upload your first PDF while signed in to track it here.</p>
        </div>
      ) : (
        <div className="bg-white/90 backdrop-blur-md rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
          <ul className="divide-y divide-slate-100">
            {pastPapers.map((paper) => {
              const statusConfig = getStatusConfig(paper.status);
              const isExpanded = expandedId === paper.id;
              
              return (
                <li 
                  key={paper.id} 
                  className="flex flex-col transition-all duration-300 group bg-white hover:bg-blue-50/20"
                >
                  <div 
                    onClick={() => handleDoubleClick(paper.id)}
                    className="p-6 flex items-center justify-between cursor-pointer select-none"
                    title="Double-click to expand details"
                  >
                    <div className="flex items-center gap-5">
                      <div className="p-3.5 bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-600 rounded-2xl shadow-sm group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                        <FileText size={24} />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800 text-lg group-hover:text-blue-700 transition-colors">
                          {paper.title || 'Untitled Manuscript'}
                        </h3>
                        <div className="flex items-center gap-4 text-sm font-medium text-slate-500 mt-1.5">
                          <span className="flex items-center gap-1.5">
                            <Clock size={14} className="text-slate-400" /> 
                            {new Date(paper.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                            {paper.claims || 0} claims verified
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <span className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider border rounded-full shadow-sm ${statusConfig.color}`}>
                        {statusConfig.icon}
                        {paper.status}
                      </span>
                      {isExpanded ? (
                        <ChevronDown size={20} className="text-blue-600 transition-all" />
                      ) : (
                        <ChevronRight size={20} className="text-slate-300 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-6 pb-6 pt-2 animate-in fade-in slide-in-from-top-4 duration-300">
                      <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/50 shadow-inner">
                        {loadingDetails ? (
                          <div className="p-8 flex justify-center items-center gap-3 text-slate-500 font-medium">
                            <Loader2 className="animate-spin text-blue-600" size={20} />
                            Fetching claims...
                          </div>
                        ) : paperDetails[paper.id]?.length > 0 ? (
                          <div className="max-h-96 overflow-y-auto">
                            <table className="w-full text-left text-sm">
                              <thead className="bg-slate-100/80 sticky top-0 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                                <tr>
                                  <th className="px-4 py-3 w-[45%]">In-Text Claim</th>
                                  <th className="px-4 py-3 w-[35%]">Matched Source</th>
                                  <th className="px-4 py-3 w-[20%] text-center">Score</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {paperDetails[paper.id].map((claimObj, idx) => {
                                  const cStatus = getStatusConfig(claimObj.verification_status);
                                  return (
                                    <tr key={idx} className="hover:bg-white transition-colors">
                                      <td className="px-4 py-3 text-slate-700 font-medium align-top">
                                        {claimObj.claim_text}
                                      </td>
                                      <td className="px-4 py-3 align-top border-l border-slate-100">
                                        <p className="text-slate-800 font-bold text-xs line-clamp-2" title={claimObj.title}>
                                          {claimObj.title || "Unknown Title"}
                                        </p>
                                        <p className="text-slate-500 text-[10px] mt-0.5 line-clamp-1">
                                          {claimObj.author || "Unknown Author"}
                                        </p>
                                      </td>
                                      <td className="px-4 py-3 align-top text-center border-l border-slate-100">
                                        <div className="flex flex-col items-center justify-center gap-1.5 h-full">
                                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide border ${cStatus.color}`}>
                                            {cStatus.icon} {claimObj.verification_status}
                                          </span>
                                          <span className="text-xs font-bold text-slate-500">
                                            {claimObj.confidence_score}%
                                          </span>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="p-8 text-center text-slate-500 font-medium">
                            No valid claims were extracted for this document.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}