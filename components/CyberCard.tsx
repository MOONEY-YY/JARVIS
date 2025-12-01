
import React from 'react';

interface CyberCardProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
  icon?: React.ReactNode;
  loading?: boolean;
}

const CyberCard: React.FC<CyberCardProps> = ({ children, title, className = '', icon, loading = false }) => {
  return (
    <div className={`relative bg-slate-900/40 backdrop-blur-md border border-slate-800 rounded-xl overflow-hidden flex flex-col transition-all duration-300 hover:border-slate-700 hover:shadow-[0_0_20px_rgba(6,182,212,0.05)] ${className}`}>
      {/* Decorative corners */}
      <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-cyan-500/50 rounded-tl-sm z-10"></div>
      <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-cyan-500/50 rounded-tr-sm z-10"></div>
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-cyan-500/50 rounded-bl-sm z-10"></div>
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-cyan-500/50 rounded-br-sm z-10"></div>

      {(title || icon) && (
        <div className="flex items-center gap-2 p-3 border-b border-slate-800 bg-slate-900/60 select-none">
          {icon && <span className="text-cyan-500/80">{icon}</span>}
          {title && <h3 className="text-sm font-bold tracking-wider text-cyan-100/90 uppercase font-mono shadow-black drop-shadow-md">{title}</h3>}
          {loading && (
            <div className="ml-auto flex gap-1">
              <span className="w-1 h-1 bg-cyan-400 rounded-full animate-pulse"></span>
              <span className="w-1 h-1 bg-cyan-400 rounded-full animate-pulse delay-75"></span>
              <span className="w-1 h-1 bg-cyan-400 rounded-full animate-pulse delay-150"></span>
            </div>
          )}
        </div>
      )}
      <div className="flex-1 p-4 relative overflow-auto">
        {children}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-transparent to-cyan-900/5 opacity-50"></div>
      </div>
    </div>
  );
};

export default CyberCard;
