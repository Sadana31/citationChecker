import React, { useState } from 'react';
import { Search as SearchIcon, ExternalLink, BookOpen, Loader2 } from 'lucide-react';

export default function Search() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const API_URL = "https://citationchecker-zmrc.onrender.com" || 'http://localhost:3001';


  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    
    try {
      // Calls your Express backend to safely query SerpAPI without exposing your API key
      const response = await fetch(`https://citationchecker-zmrc.onrender.com/api/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      
      if (data.organic_results) {
        setResults(data.organic_results);
      } else {
        setResults([]);
      }
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto h-full flex flex-col">
      <header className="mb-8">
        <h2 className="text-3xl font-bold text-slate-800">Search Sources</h2>
        <p className="text-slate-500 mt-2">Manually look up academic papers and source links via Google Scholar.</p>
      </header>

      <form onSubmit={handleSearch} className="relative mb-8">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <SearchIcon className="h-5 w-5 text-slate-400" />
        </div>
        <input
          type="text"
          className="block w-full pl-11 pr-32 py-4 bg-white border border-slate-200 rounded-xl text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          placeholder="Search by title, author, or keywords..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button 
          type="submit"
          disabled={isLoading || !query.trim()}
          className="absolute right-2 top-2 bottom-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white px-6 rounded-lg font-medium transition flex items-center gap-2"
        >
          {isLoading ? <Loader2 className="animate-spin" size={18} /> : 'Search'}
        </button>
      </form>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex-1 overflow-y-auto">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
          {results.length > 0 ? 'Search Results' : ''}
        </h3>
        
        <div className="space-y-4">
          {results.length > 0 ? (
            results.map((result) => (
              <div key={result.position || result.result_id} className="p-4 border border-slate-100 rounded-lg flex flex-col sm:flex-row items-start justify-between gap-6 hover:border-blue-200 transition">
                <div className="flex gap-4">
                  <BookOpen className="text-blue-500 mt-1 shrink-0" size={20} />
                  <div>
                    <h4 className="font-semibold text-slate-800 text-lg leading-snug">{result.title}</h4>
                    <p className="text-sm text-blue-600 font-medium mt-1">{result.publication_info?.summary}</p>
                    <p className="text-sm text-slate-600 mt-3 leading-relaxed">{result.snippet}</p>
                  </div>
                </div>
                {result.link && (
                  <a 
                    href={result.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 flex items-center gap-1 text-sm text-blue-600 font-medium hover:text-blue-800 bg-blue-50 px-4 py-2 rounded-lg transition"
                  >
                    View Source <ExternalLink size={14} />
                  </a>
                )}
              </div>
            ))
          ) : (
            <div className="text-center text-slate-400 py-12 italic">
              Enter a query above to search for academic papers.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}