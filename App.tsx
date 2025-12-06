import React, { useEffect, useRef, useState } from 'react';
import { useLiveAPI } from './hooks/useLiveAPI';
import ControlTray from './components/ControlTray';
import Visualizer from './components/Visualizer';
import Logger from './components/Logger';
import { ConnectionStatus } from './types';
import { AlertCircle } from 'lucide-react';

const App: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { connect, disconnect, status, isMuted, setIsMuted, volumeLevel, logs } = useLiveAPI();
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Handle Video Stream
  useEffect(() => {
    let stream: MediaStream | null = null;

    const setupVideo = async () => {
      try {
        if (isVideoEnabled) {
          stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
              width: { ideal: 1280 }, 
              height: { ideal: 720 },
              facingMode: "user" 
            } 
          });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
          }
        } else {
          if (videoRef.current) {
            videoRef.current.srcObject = null;
          }
        }
      } catch (err) {
        console.error("Camera access denied or failed", err);
        setError("Camera access required for video features.");
        setIsVideoEnabled(false);
      }
    };

    setupVideo();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isVideoEnabled]);

  const handleConnect = async () => {
     setError(null);
     await connect(videoRef.current);
  };

  const isConnected = status === ConnectionStatus.CONNECTED;

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden flex flex-col">
      
      {/* Header / Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-50 p-6 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
        <div className="flex items-center gap-3 pointer-events-auto">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 animate-pulse" />
            <h1 className="text-xl font-semibold tracking-wide text-white/90">Gemini Live <span className="text-xs align-top opacity-50 border border-white/20 rounded px-1 ml-1">PREVIEW</span></h1>
        </div>
        <div className="flex items-center gap-2 text-sm text-white/60 pointer-events-auto">
            {status === ConnectionStatus.CONNECTED && (
                <span className="flex items-center gap-2 text-green-400">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    Live
                </span>
            )}
        </div>
      </div>

      {/* Main Video Area */}
      <div className="flex-1 relative flex items-center justify-center">
        {/* User Video Feed */}
        <video 
          ref={videoRef}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${isVideoEnabled ? 'opacity-100' : 'opacity-0'}`}
          muted
          playsInline
        />
        
        {/* Placeholder when video is off */}
        {!isVideoEnabled && (
            <div className="absolute inset-0 flex items-center justify-center bg-neutral-900 text-neutral-500">
                <p>Camera is disabled</p>
            </div>
        )}

        {/* AI Visualizer Overlay - Always centered */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className="w-[500px] h-[500px] relative">
               <Visualizer isActive={isConnected} volume={volumeLevel} />
            </div>
        </div>
        
        {/* Logger Overlay */}
        <Logger logs={logs} />
        
        {/* Connection Status Text (if connecting) */}
        {status === ConnectionStatus.CONNECTING && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black/50 backdrop-blur px-6 py-3 rounded-xl border border-white/10 z-20">
                <span className="text-white font-medium animate-pulse">Establishing connection to Gemini...</span>
            </div>
        )}
      </div>

      {/* Error Toast */}
      {error && (
        <div className="absolute top-24 left-1/2 transform -translate-x-1/2 bg-red-500/90 text-white px-6 py-3 rounded-lg shadow-xl flex items-center gap-3 z-50 border border-red-400/50">
            <AlertCircle size={20} />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-2 hover:opacity-80">✕</button>
        </div>
      )}

      {/* Controls */}
      <ControlTray 
        status={status}
        isMuted={isMuted}
        isVideoEnabled={isVideoEnabled}
        onToggleMute={() => setIsMuted(!isMuted)}
        onToggleVideo={() => setIsVideoEnabled(!isVideoEnabled)}
        onConnect={handleConnect}
        onDisconnect={disconnect}
      />
    </div>
  );
};

export default App;
