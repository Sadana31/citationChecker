import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, FileText, Database, BrainCircuit, CheckCircle } from 'lucide-react';

export default function Welcome() {
  const workflowSteps = [
    {
      icon: <FileText size={24} className="text-blue-500" />,
      title: '1. Document Parsing',
      description: 'PyMuPDF scans the manuscript while spaCy segments sentences to isolate all in-text citation markers.',
      delay: 'delay-100'
    },
    {
      icon: <Database size={24} className="text-indigo-500" />,
      title: '2. Context Retrieval',
      description: 'The triple-fallback architecture queries OpenAlex, Semantic Scholar, and CrossRef to pull the true source abstracts.',
      delay: 'delay-200'
    },
    {
      icon: <BrainCircuit size={24} className="text-purple-500" />,
      title: '3. NLI Verification',
      description: 'The DeBERTa-v3 Cross-Encoder computes logical entailment to verify if the source abstract actually supports the claim.',
      delay: 'delay-300'
    }
  ];

  return (
    <div className="relative min-h-[calc(100vh-2rem)] flex flex-col items-center justify-center overflow-hidden px-4 py-12">
      
      {/* Animated Ambient Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-400/20 rounded-full blur-[100px] animate-pulse pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-400/20 rounded-full blur-[100px] animate-pulse delay-700 pointer-events-none"></div>

      {/* Floating Background Documents */}
      <div className="absolute top-24 left-[10%] w-48 h-64 bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-slate-100/50 animate-[bounce_8s_infinite] p-5 pointer-events-none transform -rotate-12 z-0">
        <div className="h-4 w-3/4 bg-slate-200 rounded mb-4"></div>
        <div className="h-3 w-full bg-slate-100 rounded mb-2"></div>
        <div className="h-3 w-5/6 bg-slate-100 rounded mb-2"></div>
        <div className="mt-8 flex gap-2">
          <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center"><CheckCircle size={12} className="text-blue-500"/></div>
          <div className="h-6 w-24 bg-slate-100 rounded-full"></div>
        </div>
      </div>
      
      <div className="absolute bottom-32 right-[10%] w-56 h-72 bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-slate-100/50 animate-[bounce_9s_infinite_reverse] p-5 pointer-events-none transform rotate-12 z-0">
        <div className="h-4 w-2/3 bg-indigo-100 rounded mb-4"></div>
        <div className="h-3 w-full bg-slate-100 rounded mb-2"></div>
        <div className="h-3 w-4/5 bg-slate-100 rounded mb-2"></div>
        <div className="h-3 w-full bg-slate-100 rounded mb-6"></div>
        <div className="p-3 bg-rose-50 rounded-lg border border-rose-100">
          <div className="h-2 w-1/2 bg-rose-200 rounded mb-2"></div>
          <div className="h-2 w-3/4 bg-rose-100 rounded"></div>
        </div>
      </div>

      {/* Main Hero Content */}
      <div className="z-10 text-center max-w-3xl mt-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-sm font-bold mb-8 shadow-sm">
          <span className="flex h-2 w-2 rounded-full bg-blue-600 animate-pulse"></span>
          Pipeline Operational
        </div>
        
        <h1 className="text-6xl md:text-7xl font-extrabold text-slate-900 tracking-tight mb-6">
          Verify Claims with <br/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600">Precision.</span>
        </h1>
        
        <p className="text-xl text-slate-600 mb-10 leading-relaxed max-w-2xl mx-auto">
          Automate manuscript integrity checks. Instantly cross-reference 70+ in-text citations against their original source abstracts using logical entailment mapping.
        </p>
        
        <Link to="/upload" className="inline-flex items-center gap-2 bg-slate-900 hover:bg-blue-600 text-white px-8 py-4 rounded-full font-bold text-lg transition-all duration-300 hover:scale-105 hover:shadow-[0_0_20px_rgba(37,99,235,0.4)] group">
          Initialize Pipeline <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>

      {/* Workflow Section */}
      <div className="z-10 mt-24 w-full max-w-5xl">
        <h3 className="text-center text-sm font-bold tracking-widest text-slate-400 uppercase mb-8">
          The Verification Engine
        </h3>
        <div className="grid md:grid-cols-3 gap-6">
          {workflowSteps.map((step, idx) => (
            <div 
              key={idx} 
              className={`bg-white/60 backdrop-blur-xl border border-slate-200/60 p-6 rounded-3xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 animate-in fade-in slide-in-from-bottom-8 fill-mode-both ${step.delay}`}
            >
              <div className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center mb-5">
                {step.icon}
              </div>
              <h4 className="text-lg font-bold text-slate-800 mb-2">{step.title}</h4>
              <p className="text-sm text-slate-500 leading-relaxed font-medium">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
      
    </div>
  );
}