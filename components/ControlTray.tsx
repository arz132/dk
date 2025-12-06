import React from 'react';
import { Mic, MicOff, Video, VideoOff, Phone, PhoneOff, Settings } from 'lucide-react';
import { ConnectionStatus } from '../types';

interface ControlTrayProps {
  status: ConnectionStatus;
  isMuted: boolean;
  isVideoEnabled: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
}

const ControlTray: React.FC<ControlTrayProps> = ({
  status,
  isMuted,
  isVideoEnabled,
  onToggleMute,
  onToggleVideo,
  onConnect,
  onDisconnect
}) => {
  const isConnected = status === ConnectionStatus.CONNECTED;
  const isConnecting = status === ConnectionStatus.CONNECTING;

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 flex items-center gap-4 bg-neutral-900/90 backdrop-blur-md px-6 py-4 rounded-full border border-white/10 shadow-2xl z-50">
      
      {/* Mic Toggle */}
      <button 
        onClick={onToggleMute}
        disabled={!isConnected}
        className={`p-4 rounded-full transition-all duration-200 ${
          isMuted ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' : 'bg-white/10 hover:bg-white/20 text-white'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
      </button>

      {/* Video Toggle */}
      <button 
        onClick={onToggleVideo}
        className={`p-4 rounded-full transition-all duration-200 ${
          !isVideoEnabled ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' : 'bg-white/10 hover:bg-white/20 text-white'
        }`}
      >
        {!isVideoEnabled ? <VideoOff size={24} /> : <Video size={24} />}
      </button>

      {/* Main Action Button */}
      <button
        onClick={isConnected ? onDisconnect : onConnect}
        disabled={isConnecting}
        className={`p-4 px-8 rounded-full font-bold text-lg transition-all duration-300 flex items-center gap-2 ${
          isConnected 
            ? 'bg-red-500 hover:bg-red-600 text-white' 
            : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:opacity-90 text-white'
        } disabled:opacity-70`}
      >
        {isConnecting ? (
           <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : isConnected ? (
           <><PhoneOff size={24} /> End</>
        ) : (
           <><Phone size={24} /> Start</>
        )}
      </button>

      <div className="w-px h-8 bg-white/10 mx-2" />

       <button 
        className="p-4 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all"
        title="Settings (Demo)"
      >
        <Settings size={24} />
      </button>

    </div>
  );
};

export default ControlTray;