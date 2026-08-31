import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, Home, Upload, History, Search, FileText, X, LogOut, Sun, Moon } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

  // Check user session and dark mode preference on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('citation_ai_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }

    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    if (isDarkMode) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setIsDarkMode(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setIsDarkMode(true);
    }
  };


  const handleLoginSuccess = async (credentialResponse) => {
    try {
      const decoded = JSON.parse(atob(credentialResponse.credential.split('.')[1]));
      
      const userData = {
        googleId: decoded.sub,
        name: decoded.name,
        email: decoded.email,
        avatar: decoded.picture
      };

      setUser(userData);
      localStorage.setItem('citation_ai_user', JSON.stringify(userData));

      const API_URL = "https://citationchecker-zmrc.onrender.com" || 'http://localhost:3001';

      await fetch("https://citationchecker-zmrc.onrender.com/api/auth/google", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
    } catch (error) {
      console.error('Login sync error:', error);
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('citation_ai_user');
  };

  const navItems = [
    { name: 'Welcome', path: '/', icon: <Home size={20} /> },
    { name: 'Upload Paper', path: '/upload', icon: <Upload size={20} /> },
    { name: 'History', path: '/history', icon: <History size={20} /> },
    { name: 'Search Sources', path: '/search', icon: <Search size={20} /> },
  ];

  return (
    <>
      <button 
        onClick={() => setIsMobileOpen(true)}
        className="md:hidden fixed top-4 left-4 z-40 p-2.5 bg-white/90 dark:bg-slate-900 dark:border-slate-800 backdrop-blur-md rounded-xl shadow-sm text-slate-600 dark:text-slate-300 border border-slate-200 hover:text-blue-600 transition-colors"
      >
        <Menu size={20} />
      </button>

      {isMobileOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 transition-opacity animate-in fade-in"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside className={`
        fixed md:relative inset-y-0 left-0 z-50
        ${isOpen ? 'w-64' : 'w-20'} 
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        h-screen bg-sky-100/90 dark:bg-slate-900 backdrop-blur-md border-r border-sky-200 dark:border-slate-800 shadow-xl transition-all duration-300 flex flex-col justify-between font-sans shrink-0
      `}>
        <div>
          <div className={`p-4 flex items-center border-b border-sky-200/60 dark:border-slate-800 h-20 ${isOpen ? 'justify-between' : 'justify-center'}`}>
            {isOpen && (
              <div className="flex items-center gap-3 overflow-hidden whitespace-nowrap">
                <div className="p-2 bg-blue-600 rounded-xl shadow-sm shrink-0 text-white">
                  <FileText size={20} />
                </div>
                <span className="font-extrabold text-lg text-slate-900 dark:text-white tracking-wide">
                  CitationChecker
                </span>
              </div>
            )}
            <button 
              onClick={() => setIsOpen(!isOpen)} 
              className="hidden md:flex p-2 hover:bg-sky-200/50 dark:hover:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300 hover:text-blue-700 transition-all shrink-0 items-center justify-center"
            >
              <Menu size={20} />
            </button>
            <button 
              onClick={() => setIsMobileOpen(false)} 
              className="md:hidden p-2 hover:bg-rose-100 dark:hover:bg-rose-950/50 rounded-xl text-slate-600 dark:text-slate-300 hover:text-rose-600 transition-colors shrink-0"
            >
              <X size={20} />
            </button>
          </div>
          
          <nav className="p-3 space-y-1.5 mt-2">
            {navItems.map((item) => {
              const active = location.pathname === item.path;
              return (
                <Link 
                  key={item.name} 
                  to={item.path} 
                  className={`relative flex items-center gap-3 p-3 rounded-xl transition-all duration-300 group ${
                    active 
                      ? 'bg-blue-600 text-white font-semibold shadow-md shadow-blue-500/20' 
                      : 'text-slate-600 dark:text-slate-400 hover:bg-sky-200/60 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white font-medium'
                  } ${!isOpen && 'md:justify-center'}`}
                  title={!isOpen ? item.name : ""}
                >
                  <div className={`shrink-0 transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>
                    {item.icon}
                  </div>
                  <span className={`whitespace-nowrap transition-opacity duration-300 ${!isOpen ? 'md:hidden md:opacity-0' : 'opacity-100'}`}>
                    {item.name}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section: Theme Switch & Profile */}
        <div className="border-t border-sky-200/60 dark:border-slate-800 bg-sky-100/40 dark:bg-slate-950/40 flex flex-col">
          
          {/* Sun/Moon Toggle Switch */}
          <div className="p-3 pb-0">
            <button 
              onClick={toggleDarkMode}
              className={`w-full py-2.5 px-3 rounded-xl bg-white/80 dark:bg-slate-800 hover:bg-sky-200/60 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all font-bold text-xs shadow-sm flex items-center justify-between ${!isOpen && 'md:justify-center'}`}
              title="Toggle Theme"
            >
              <div className="flex items-center gap-2">
                {isDarkMode ? <Sun size={16} className="text-amber-400 shrink-0" /> : <Moon size={16} className="text-blue-600 shrink-0" />}
                <span className={`truncate ${!isOpen && 'md:hidden'}`}>
                  {isDarkMode ? "Dark Mode" : "Light Mode"}
                </span>
              </div>
              
              {/* Interactive Switch UI Pill */}
              <div className={`w-8 h-4 bg-slate-200 dark:bg-slate-900 rounded-full relative p-0.5 transition-colors ${!isOpen && 'md:hidden'}`}>
                <div className={`w-3 h-3 bg-white rounded-full shadow-md transition-transform duration-300 ${isDarkMode ? 'translate-x-4 bg-blue-600' : 'translate-x-0'}`}></div>
              </div>
            </button>
          </div>

          {/* Profile / Auth Section */}
          <div className="p-4">
            {user ? (
              <div className={`flex items-center gap-2 ${!isOpen ? 'md:justify-center' : 'justify-between'}`}>
                <div className={`flex items-center gap-2.5 overflow-hidden ${!isOpen && 'md:hidden'}`}>
                  <img 
                    src={user.avatar} 
                    alt={user.name} 
                    className="w-9 h-9 rounded-full border-2 border-white dark:border-slate-800 shadow-sm shrink-0 object-cover" 
                  />
                  <div className="flex flex-col overflow-hidden whitespace-nowrap min-w-0">
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate" title={user.name}>{user.name}</span>
                    <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 truncate" title={user.email}>{user.email}</span>
                  </div>
                </div>
                
                <button 
                  onClick={handleLogout} 
                  className="p-2 bg-white/80 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200/60 dark:border-slate-700 transition-colors rounded-xl shadow-sm shrink-0 flex items-center justify-center"
                  title="Sign out"
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <div className={`flex flex-col items-center justify-center ${!isOpen && 'md:scale-90'}`}>
                {isOpen && (
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 text-center">Sign in to sync database</p>
                )}
                <GoogleLogin
                  onSuccess={handleLoginSuccess}
                  onError={() => console.error('Google Login Failed')}
                  shape="pill"
                  size="medium"
                  theme="outline"
                  text={isOpen ? "signin_with" : "icon"}
                />
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}