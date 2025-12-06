import React, { useEffect, useRef } from 'react';
import { MultimodalLog } from '../types';

interface LoggerProps {
  logs: MultimodalLog[];
}

const Logger: React.FC<LoggerProps> = ({ logs }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  if (logs.length === 0) return null;

  return (
    <div 
      ref={containerRef}
      className="absolute top-24 right-6 w-80 max-h-[60vh] overflow-y-auto rounded-xl bg-neutral-900/80 backdrop-blur-md border border-white/10 p-4 flex flex-col gap-3 shadow-2xl z-30"
    >
      {logs.map((log, index) => (
        <div 
          key={index} 
          className={`text-sm p-3 rounded-lg ${
            log.role === 'model' 
              ? 'bg-blue-500/20 border border-blue-500/30 text-blue-100' 
              : log.role === 'user' 
                ? 'bg-white/10 border border-white/20 text-white' 
                : 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-200 text-xs text-center'
          }`}
        >
          {log.role !== 'system' && (
             <div className="flex justify-between items-center mb-1 opacity-50 text-xs uppercase tracking-wider font-semibold">
                <span>{log.role}</span>
                <span>{log.date.toLocaleTimeString()}</span>
             </div>
          )}
          <p className="leading-relaxed">{log.text}</p>
        </div>
      ))}
    </div>
  );
};

export default Logger;
