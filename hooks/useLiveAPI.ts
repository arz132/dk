import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { ConnectionStatus, MultimodalLog } from '../types';
import { createPcmBlob, decodeAudioData, base64ToUint8Array, blobToBase64 } from '../utils/audioUtils';

const MODEL_NAME = 'gemini-2.5-flash-native-audio-preview-09-2025';
const API_KEY = process.env.API_KEY || '';

export const useLiveAPI = () => {
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [isMuted, setIsMuted] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [logs, setLogs] = useState<MultimodalLog[]>([]);

  // Audio Contexts
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  // Stream & Processor
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  // Session
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const videoIntervalRef = useRef<number | null>(null);

  // Transcription State
  const currentInputTransRef = useRef<string>("");
  const currentOutputTransRef = useRef<string>("");

  const connect = useCallback(async (videoElement: HTMLVideoElement | null) => {
    if (!API_KEY) {
      console.error("API Key is missing");
      setStatus(ConnectionStatus.ERROR);
      return;
    }

    try {
      setStatus(ConnectionStatus.CONNECTING);

      // 1. Setup Audio Contexts
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const outputNode = outputAudioContextRef.current.createGain();
      outputNode.connect(outputAudioContextRef.current.destination);

      // 2. Get User Media (Mic)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // 3. Initialize Gemini Client
      const ai = new GoogleGenAI({ apiKey: API_KEY });
      
      const config = {
        model: MODEL_NAME,
        callbacks: {
          onopen: () => {
            console.log('Gemini Live Session Opened');
            setStatus(ConnectionStatus.CONNECTED);
            setLogs([{ date: new Date(), role: 'system', text: 'Session connected' }]);
            
            // Start Audio Streaming
            if (inputAudioContextRef.current && mediaStreamRef.current) {
               const source = inputAudioContextRef.current.createMediaStreamSource(mediaStreamRef.current);
               inputSourceRef.current = source;
               
               // Use ScriptProcessor for raw PCM access (per docs example)
               const scriptProcessor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
               scriptProcessorRef.current = scriptProcessor;

               scriptProcessor.onaudioprocess = (e) => {
                 if (isMuted) return; // Don't send if muted
                 
                 const inputData = e.inputBuffer.getChannelData(0);
                 
                 // Calculate volume for visualizer
                 let sum = 0;
                 for (let i = 0; i < inputData.length; i++) {
                   sum += inputData[i] * inputData[i];
                 }
                 const rms = Math.sqrt(sum / inputData.length);
                 setVolumeLevel(Math.min(rms * 5, 1)); 

                 const pcmBlob = createPcmBlob(inputData);
                 
                 sessionPromiseRef.current?.then(session => {
                   session.sendRealtimeInput({ media: pcmBlob });
                 });
               };

               source.connect(scriptProcessor);
               scriptProcessor.connect(inputAudioContextRef.current.destination);
            }
          },
          onmessage: async (message: LiveServerMessage) => {
             // 1. Handle Audio Output
             const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
             if (base64Audio && outputAudioContextRef.current) {
                const ctx = outputAudioContextRef.current;
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                
                const audioBuffer = await decodeAudioData(
                  base64ToUint8Array(base64Audio),
                  ctx,
                  24000,
                  1
                );
                
                const source = ctx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(outputNode);
                source.addEventListener('ended', () => {
                  audioSourcesRef.current.delete(source);
                });
                
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
                audioSourcesRef.current.add(source);
             }

             // 2. Handle Transcription
             const serverContent = message.serverContent;
             if (serverContent) {
                if (serverContent.modelTurn) {
                   // Model just started speaking, or is speaking
                   // Note: We might get text parts here if we didn't use audio, but for Live API with audio, 
                   // we rely on `outputTranscription` inside serverContent usually, 
                   // but looking at types it might be nested differently.
                   // The Live API specifically sends `outputTranscription` fields.
                }

                if (serverContent.outputTranscription?.text) {
                   currentOutputTransRef.current += serverContent.outputTranscription.text;
                   // Update live log (debounce or simple replacement for now)
                   // We don't push a new log every chunk, we update the last model log or create one
                }

                if (serverContent.inputTranscription?.text) {
                   currentInputTransRef.current += serverContent.inputTranscription.text;
                }

                if (serverContent.turnComplete) {
                   // Turn is done, commit logs
                   if (currentInputTransRef.current.trim()) {
                      const text = currentInputTransRef.current;
                      setLogs(prev => [...prev, { date: new Date(), role: 'user', text }]);
                      currentInputTransRef.current = "";
                   }
                   if (currentOutputTransRef.current.trim()) {
                      const text = currentOutputTransRef.current;
                      setLogs(prev => [...prev, { date: new Date(), role: 'model', text }]);
                      currentOutputTransRef.current = "";
                   }
                }
             }

             // 3. Handle Interruptions
             if (message.serverContent?.interrupted) {
                console.log('Interrupted by user');
                audioSourcesRef.current.forEach(s => s.stop());
                audioSourcesRef.current.clear();
                nextStartTimeRef.current = 0;
                
                // Commit partial model log
                if (currentOutputTransRef.current.trim()) {
                     const text = currentOutputTransRef.current + " [interrupted]";
                     setLogs(prev => [...prev, { date: new Date(), role: 'model', text }]);
                     currentOutputTransRef.current = "";
                }
             }
          },
          onclose: () => {
            console.log('Gemini Live Session Closed');
            setStatus(ConnectionStatus.DISCONNECTED);
            setLogs(prev => [...prev, { date: new Date(), role: 'system', text: 'Session disconnected' }]);
          },
          onerror: (err: any) => {
            console.error('Gemini Live Error', err);
            setStatus(ConnectionStatus.ERROR);
            setLogs(prev => [...prev, { date: new Date(), role: 'system', text: 'Error: ' + err.message }]);
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } }
          },
          // Enable transcription
          inputAudioTranscription: { model: MODEL_NAME },
          outputAudioTranscription: { model: MODEL_NAME }
        }
      };

      // 4. Connect
      sessionPromiseRef.current = ai.live.connect(config);

      // 5. Start Video Streaming Loop
      if (videoElement) {
         startVideoStreaming(videoElement);
      }

    } catch (error) {
      console.error("Connection failed", error);
      setStatus(ConnectionStatus.ERROR);
    }
  }, [isMuted]);

  const startVideoStreaming = (videoEl: HTMLVideoElement) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const JPEG_QUALITY = 0.5;
    const FRAME_RATE = 2; // Limit fps to save bandwidth for demo

    if (videoIntervalRef.current) clearInterval(videoIntervalRef.current);

    videoIntervalRef.current = window.setInterval(() => {
       if (!ctx || !videoEl.videoWidth || !videoEl.videoHeight) return;
       
       canvas.width = videoEl.videoWidth;
       canvas.height = videoEl.videoHeight;
       ctx.drawImage(videoEl, 0, 0);
       
       canvas.toBlob(async (blob) => {
          if (blob) {
            const base64 = await blobToBase64(blob);
            sessionPromiseRef.current?.then(session => {
               session.sendRealtimeInput({
                 media: { data: base64, mimeType: 'image/jpeg' }
               });
            });
          }
       }, 'image/jpeg', JPEG_QUALITY);

    }, 1000 / FRAME_RATE);
  };

  const disconnect = useCallback(() => {
    // Stop streams
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    // Stop script processor
    if (scriptProcessorRef.current && inputSourceRef.current) {
      inputSourceRef.current.disconnect();
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    
    // Close context
    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close();
      outputAudioContextRef.current = null;
    }

    // Stop video loop
    if (videoIntervalRef.current) {
      clearInterval(videoIntervalRef.current);
      videoIntervalRef.current = null;
    }
    
    setStatus(ConnectionStatus.DISCONNECTED);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  return {
    connect,
    disconnect,
    status,
    isMuted,
    setIsMuted,
    volumeLevel,
    logs
  };
};
