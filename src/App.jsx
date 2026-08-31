import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Welcome from './screens/Welcome';
import Upload from './screens/Upload';
import History from './screens/History';
import SearchSources from './screens/Search';
import { GoogleOAuthProvider } from '@react-oauth/google';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <Router>
        {/* Added dark:bg-slate-950 dark:text-slate-100 */}
        <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-300">
          <Sidebar />
          
          <main className="flex-1 min-w-0 overflow-y-auto h-full">
            <div className="p-8 max-w-7xl mx-auto">
              <Routes>
                <Route path="/" element={<Welcome />} />
                <Route path="/upload" element={<Upload />} />
                <Route path="/history" element={<History />} />
                <Route path="/search" element={<SearchSources />} />
              </Routes>
            </div>
          </main>
        </div>
      </Router>
    </GoogleOAuthProvider>
  );
}