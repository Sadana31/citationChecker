import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, FileText, Loader2, ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle, XCircle, X, ExternalLink, ShieldAlert, Activity, PieChart } from 'lucide-react';

const RenderTextWithLinks = ({ text }) => {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return (
    <span>
      {parts.map((part, i) => {
        if (part.match(urlRegex)) {
          return (
            <a 
              key={i} 
              href={part} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-blue-600 hover:text-blue-800 underline font-semibold inline-flex items-center gap-1 mx-1 break-all"
              onClick={(e) => e.stopPropagation()}
            >
              {part} <ExternalLink size={12} className="inline shrink-0" />
            </a>
          );
        }
        return part;
      })}
    </span>
  );
};

const SourceAbstractModal = ({ isOpen, onClose, content }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-4xl w-full p-10 relative overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-6 right-6 p-2 rounded-full bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors">
          <X size={20} />
        </button>
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 rounded-xl bg-blue-100 text-blue-600">
            <FileText size={24} />
          </div>
          <div>
            <h3 className="text-2xl font-extrabold text-slate-800">Source Manuscript Abstract</h3>
            <p className="text-slate-500 mt-1">Full abstract or source reference details.</p>
          </div>
        </div>
        <div className="prose prose-slate prose-sm leading-relaxed max-h-[500px] overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
          <p className="text-slate-700 italic whitespace-pre-line">
            <RenderTextWithLinks text={content} />
          </p>
        </div>
        <div className="mt-10 border-t border-slate-100 pt-6 flex justify-end">
          <button onClick={onClose} className="bg-slate-900 text-white px-8 py-3 rounded-lg font-semibold shadow hover:bg-slate-800 transition">
            Close Source View
          </button>
        </div>
      </div>
    </div>
  );
};

export default function Upload() {
  const [file, setFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState([]); 
  const [statusText, setStatusText] = useState('');
  const [progress, setProgress] = useState(0);
  const [currentStepText, setCurrentStepText] = useState('');
  
  const [modalContent, setModalContent] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchingId, setSearchingId] = useState(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  const pollInterval = useRef(null);
  const progressTimer = useRef(null);

  useEffect(() => {
    if (isLoading) {
      setProgress(0);
      setCurrentStepText("Initializing NLP pipeline...");
      
      const totalSeconds = 240; 
      const updateIntervalMs = 1000;
      const progressPerTick = 100 / totalSeconds; 

      progressTimer.current = setInterval(() => {
        setProgress((prev) => {
          const next = prev + progressPerTick;
          if (next > 5 && next <= 25) {
            setCurrentStepText("Mapping bibliography & segmenting claims...");
          } else if (next > 25 && next <= 60) {
            setCurrentStepText("Fetching real abstracts from OpenAlex API...");
          } else if (next > 60 && next < 99) {
            setCurrentStepText("Running PyTorch NLI model inference...");
          } else if (next >= 99) {
            setCurrentStepText("Finalizing verification results...");
          }
          return next >= 99 ? 99 : Number(next.toFixed(2));
        });
      }, updateIntervalMs);
    } else {
      clearInterval(progressTimer.current);
    }
    return () => clearInterval(progressTimer.current);
  }, [isLoading]);

  const handleUpload = async () => {
    if (!file) return;
    setIsLoading(true);
    setResults([]);
    setStatusText('');
    setCurrentPage(1);

    const formData = new FormData();
    formData.append('paper', file);
    const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

    try {
      const response = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();

      if (response.ok && data.paperId) {
        pollForResults(data.paperId);
      } else {
        setStatusText('Upload failed.');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Upload error:', error);
      setStatusText('Server connection failed.');
      setIsLoading(false);
    }
  };

  const pollForResults = (paperId) => {
    if (pollInterval.current) clearInterval(pollInterval.current);

    pollInterval.current = setInterval(async () => {
      try {
        const res = await fetch(`{API_URL}/api/results/${paperId}`);
        const data = await res.json();

        if (data.status === 'completed') {
          clearInterval(pollInterval.current);
          setProgress(100);
          setCurrentStepText("Processing complete!");
          
          const mappedResults = data.claims.map((c, idx) => ({
            id: `[${idx + 1}]`,
            claim: c.claim || c.claim_text,
            source: c.source_context,
            title: c.title || "Unknown Title",
            author: c.author || "Unknown Author",
            scoreNum: c.confidence ?? c.confidence_score ?? 0,
            status: c.status || c.verification_status,
            isSuspicious: c.is_suspicious || (c.confidence < 40),
            evidence: c.evidence_snippet || c.source_context?.substring(0, 140) + "..."
          }));
          
          setTimeout(() => {
            setResults(mappedResults);
            setIsLoading(false);
            setProgress(0);
          }, 800);

        } else if (data.status === 'failed') {
          clearInterval(pollInterval.current);
          setStatusText('Processing failed on the server.');
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 2500);
  };

  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentRows = results.slice(indexOfFirstRow, indexOfLastRow);
  const totalPages = Math.ceil(results.length / rowsPerPage);

  // Compute Overall Health Metrics
  const totalClaims = results.length;
  const supportedCount = results.filter(r => r.scoreNum >= 70).length;
  const partialCount = results.filter(r => r.scoreNum >= 40 && r.scoreNum < 70).length;
  const unsupportedCount = results.filter(r => r.scoreNum < 40).length;
  const overallHealthScore = totalClaims > 0 ? Math.round((supportedCount * 100 + partialCount * 50) / totalClaims) : 0;

  const handleOpenModal = (abstract) => {
    if (abstract) {
      setModalContent(abstract);
      setIsModalOpen(true);
    }
  };

  const extractLinkFromSource = (text) => {
    if (!text) return null;
    const match = text.match(/(https?:\/\/[^\s]+)/);
    return match ? match[0] : null;
  };

  const handleViewSource = async (row) => {
    const existingLink = extractLinkFromSource(row.source);
    if (existingLink) {
      window.open(existingLink, '_blank');
      return;
    }

    setSearchingId(row.id);
    try {
      const searchQuery = row.title !== "Unknown Title" ? row.title : row.claim.substring(0, 80);
      const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
      const res = await fetch(`${API_URL}/api/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();

      const organic = data.organic_results || data.organic;
      if (organic && organic.length > 0 && organic[0].link) {
        window.open(organic[0].link, '_blank');
      } else {
        handleOpenModal(row.source);
      }
    } catch (err) {
      console.error("SerpAPI fetch error:", err);
      handleOpenModal(row.source);
    } finally {
      setSearchingId(null);
    }
  };

  return (
    <div className="mx-auto space-y-8 min-h-screen flex flex-col relative z-10 pb-16 px-4">
      
      <header className="text-center space-y-2">
        <h2 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-indigo-600">
          Manuscript Verification
        </h2>
        <p className="text-slate-500 font-medium">Upload your document to initiate the NLP extraction pipeline.</p>
      </header>

      <div className="relative group shrink-0 max-w-4xl mx-auto w-full">
        <div className={`absolute inset-0 bg-gradient-to-r from-blue-400 to-indigo-400 rounded-3xl blur opacity-25 group-hover:opacity-40 transition duration-500 ${isLoading ? 'animate-pulse' : ''}`}></div>
        <div className="relative bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-sm border border-white flex flex-col items-center justify-center text-center transition-all">
          <input type="file" id="fileUpload" className="hidden" onChange={(e) => setFile(e.target.files[0])} accept="application/pdf" disabled={isLoading} />
          
          <label htmlFor="fileUpload" className={`cursor-pointer border-2 border-dashed rounded-2xl p-10 w-full max-w-2xl transition-all duration-300 flex flex-col items-center justify-center gap-4 ${file ? 'border-blue-400 bg-blue-50/50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'}`}>
            <div className={`p-4 rounded-full transition-colors ${file ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500'}`}>
              {file ? <FileText size={40} /> : <UploadCloud size={40} />}
            </div>
            <div>
              <span className="block text-slate-800 font-bold text-lg mb-1">
                {file ? file.name : 'Click to browse or drag PDF here'}
              </span>
              <span className="block text-slate-400 text-sm font-medium">
                {file ? 'Ready for processing' : 'Supports .PDF up to 20MB'}
              </span>
            </div>
          </label>
          
          <button 
            onClick={handleUpload} 
            disabled={!file || isLoading} 
            className="mt-6 relative overflow-hidden group bg-slate-900 text-white px-10 py-3.5 rounded-xl font-semibold shadow-md transition-all disabled:opacity-50 hover:shadow-lg hover:-translate-y-0.5 flex items-center gap-2"
          >
            {isLoading && <Loader2 className="animate-spin" size={18} />}
            {isLoading ? 'Processing Pipeline...' : 'Start Verification'}
          </button>
          
          {isLoading && (
            <div className="w-full max-w-md mt-6 space-y-2 animate-in fade-in duration-300">
              <div className="flex justify-between text-xs font-bold text-slate-600">
                <span>{currentStepText}</span>
                <span>{progress}%</span>
              </div>
              <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200 shadow-inner">
                <div 
                  className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          )}

          {statusText && <p className="mt-4 text-sm font-medium text-rose-500">{statusText}</p>}
        </div>
      </div>

      {results.length > 0 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
          
          {/* OVERALL HEALTH SCORE & SEXY GRAPH DASHBOARD */}
          <div className="grid md:grid-cols-3 gap-6">
            
            {/* Health Score Card */}
            <div className="bg-white/90 backdrop-blur-md p-6 rounded-3xl shadow-xl border border-slate-200 flex items-center gap-5">
              <div className="relative flex items-center justify-center p-4 bg-blue-50 rounded-2xl text-blue-600">
                <Activity size={32} />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Overall Health Score</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <h3 className="text-3xl font-extrabold text-slate-800">{overallHealthScore}%</h3>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${overallHealthScore >= 70 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {overallHealthScore >= 70 ? 'Robust' : 'Needs Review'}
                  </span>
                </div>
              </div>
            </div>

            {/* Sexy Graph Breakdown Card */}
            <div className="md:col-span-2 bg-white/90 backdrop-blur-md p-6 rounded-3xl shadow-xl border border-slate-200 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-slate-700 font-bold text-sm">
                  <PieChart size={18} className="text-blue-600" /> Citation Verification Distribution
                </div>
                <span className="text-xs font-bold text-slate-400">{totalClaims} Total Claims</span>
              </div>
              
              {/* Stacked Progress Bar Graph */}
              <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                <div style={{ width: `${(supportedCount / totalClaims) * 100}%` }} className="bg-emerald-500 transition-all duration-1000" title={`Supported: ${supportedCount}`}></div>
                <div style={{ width: `${(partialCount / totalClaims) * 100}%` }} className="bg-amber-400 transition-all duration-1000" title={`Partial: ${partialCount}`}></div>
                <div style={{ width: `${(unsupportedCount / totalClaims) * 100}%` }} className="bg-rose-500 transition-all duration-1000" title={`Unsupported: ${unsupportedCount}`}></div>
              </div>

              <div className="flex items-center justify-between mt-3 text-xs font-bold">
                <span className="flex items-center gap-1.5 text-emerald-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Supported ({supportedCount})
                </span>
                <span className="flex items-center gap-1.5 text-amber-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span> Partial Match ({partialCount})
                </span>
                <span className="flex items-center gap-1.5 text-rose-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Unsupported ({unsupportedCount})
                </span>
              </div>
            </div>

          </div>

          {/* MAIN RESULTS TABLE */}
          <div className="bg-white/90 backdrop-blur-md rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left border-collapse table-auto">
                <thead className="bg-slate-50/80 border-b border-slate-200">
                  <tr className="text-slate-500 uppercase tracking-wider text-xs">
                    <th className="p-5 font-bold w-[6%]">ID</th>
                    <th className="p-5 font-bold w-[25%]">In-Text Claim & Flags</th>
                    <th className="p-5 font-bold w-[20%]">Source Info</th>
                    <th className="p-5 font-bold w-[34%]">Evidence Highlighting (Source Context)</th>
                    <th className="p-5 font-bold text-center w-[15%]">Verification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentRows.map((row, idx) => {
                    const isSearching = searchingId === row.id;

                    let badgeConfig = {
                      bg: 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200',
                      label: 'Low Match'
                    };
                    if (row.scoreNum >= 70) {
                      badgeConfig = {
                        bg: 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200',
                        label: 'Well Supported'
                      };
                    } else if (row.scoreNum >= 40) {
                      badgeConfig = {
                        bg: 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200',
                        label: 'Partial Match'
                      };
                    }

                    return (
                      <tr key={idx} className="hover:bg-blue-50/30 transition-colors group">
                        <td className="p-5 align-top">
                          <span className="bg-slate-100 text-slate-600 font-mono font-bold px-3 py-1.5 rounded-lg text-sm group-hover:bg-blue-100 group-hover:text-blue-700 transition-colors inline-block">
                            {row.id}
                          </span>
                        </td>
                        
                        {/* Claim with Suspicious Citation Flag */}
                        <td className="p-5 text-slate-800 text-sm leading-relaxed font-medium align-top space-y-2">
                          <p>{row.claim}</p>
                          {row.isSuspicious && (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 text-xs font-bold animate-pulse">
                              <ShieldAlert size={14} /> Suspicious Citation Flag
                            </div>
                          )}
                        </td>
                        
                        <td className="p-5 align-top border-l border-slate-50">
                          <div className="flex flex-col gap-1.5">
                            <span className="text-sm font-bold text-slate-800 leading-snug line-clamp-3" title={row.title}>
                              {row.title}
                            </span>
                            <span className="text-xs font-medium text-slate-500 leading-snug line-clamp-2" title={row.author}>
                              {row.author}
                            </span>
                          </div>
                        </td>
                        
                        {/* Evidence Highlighting Column */}
                        <td 
                          className={`p-5 text-slate-500 text-sm leading-relaxed border-l border-r border-slate-50 group-hover:border-blue-100/50 transition-colors align-top ${row.source.length > 200 ? 'cursor-pointer hover:text-blue-700' : ''}`}
                          onDoubleClick={() => handleOpenModal(row.source)}
                          title={row.source.length > 200 ? 'Double-click to view full abstract' : ''}
                        >
                          <div className="p-3 rounded-xl bg-amber-50/50 border border-amber-100/60 mb-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block mb-1">🔍 Highlighted Evidence Match</span>
                            <p className="text-slate-700 font-serif italic text-xs">
                              "{row.evidence}"
                            </p>
                          </div>
                          <RenderTextWithLinks text={row.source.length > 200 ? `${row.source.substring(0, 150)}...` : row.source} />
                          {row.source.length > 200 && (
                            <span className="text-[10px] text-blue-500 font-medium block mt-1.5">(Double-click for full abstract)</span>
                          )}
                        </td>
                        
                        <td className="p-5 align-top">
                          <div className="flex flex-col items-center justify-center gap-3">
                            <button 
                              onClick={() => handleViewSource(row)}
                              disabled={isSearching}
                              className={`w-full py-2 px-3 border rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 shadow-sm ${badgeConfig.bg}`}
                            >
                              {isSearching ? (
                                <Loader2 className="animate-spin" size={12} />
                              ) : (
                                <>
                                  {badgeConfig.label} <ExternalLink size={12} />
                                </>
                              )}
                            </button>

                            <div className="w-full max-w-[120px]">
                              <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1">
                                <span>CONFIDENCE</span>
                                <span>{row.scoreNum}%</span>
                              </div>
                              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full transition-all duration-1000 ${row.scoreNum >= 70 ? 'bg-emerald-500' : row.scoreNum >= 40 ? 'bg-amber-400' : 'bg-rose-500'}`}
                                  style={{ width: `${row.scoreNum}%` }}
                                ></div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-white rounded-b-3xl">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-slate-500">Rows per page:</span>
                <select 
                  value={rowsPerPage} 
                  onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                  className="border border-slate-200 bg-slate-50 focus:ring-0 text-sm font-bold text-slate-700 rounded-lg p-2 cursor-pointer"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
              
              <div className="flex items-center gap-6">
                <span className="text-sm font-medium text-slate-500">
                  Showing <strong className="text-slate-800">{indexOfFirstRow + 1}</strong> to <strong className="text-slate-800">{Math.min(indexOfLastRow, results.length)}</strong> of <strong className="text-slate-800">{results.length}</strong>
                </span>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                    disabled={currentPage === 1}
                    className="p-2 border border-slate-200 rounded-lg text-slate-600 disabled:opacity-30 hover:bg-slate-50 hover:text-blue-600 transition-colors"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                    disabled={currentPage === totalPages}
                    className="p-2 border border-slate-200 rounded-lg text-slate-600 disabled:opacity-30 hover:bg-slate-50 hover:text-blue-600 transition-colors"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}
      
      <SourceAbstractModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} content={modalContent} />
    </div>
  );
}