import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  isActive: boolean;
  volume: number; // 0 to 1
}

const Visualizer: React.FC<VisualizerProps> = ({ isActive, volume }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const timeRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const animate = () => {
      if (!isActive) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      timeRef.current += 0.05;
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;
      
      // Clear with fade effect for trails
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fillRect(0, 0, width, height);

      // Base radius plus volume reaction
      const baseRadius = 50;
      const reaction = volume * 100;
      
      // Draw nebulous blobs
      for (let i = 0; i < 3; i++) {
        const offset = (i * Math.PI * 2) / 3;
        const x = centerX + Math.cos(timeRef.current + offset) * 20;
        const y = centerY + Math.sin(timeRef.current + offset) * 20;
        
        const gradient = ctx.createRadialGradient(x, y, 5, x, y, baseRadius + reaction);
        
        if (i === 0) {
            gradient.addColorStop(0, 'rgba(66, 133, 244, 0.8)'); // Google Blue
            gradient.addColorStop(1, 'rgba(66, 133, 244, 0)');
        } else if (i === 1) {
            gradient.addColorStop(0, 'rgba(219, 68, 55, 0.8)'); // Google Red
            gradient.addColorStop(1, 'rgba(219, 68, 55, 0)');
        } else {
            gradient.addColorStop(0, 'rgba(15, 157, 88, 0.8)'); // Google Green/Yellow mix
            gradient.addColorStop(1, 'rgba(15, 157, 88, 0)');
        }

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, baseRadius + reaction, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Central White Core
      ctx.beginPath();
      ctx.arc(centerX, centerY, 40 + (reaction * 0.5), 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.filter = 'blur(10px)';
      ctx.fill();
      ctx.filter = 'none';

      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isActive, volume]);

  return (
    <canvas 
      ref={canvasRef} 
      width={400} 
      height={400} 
      className={`w-full h-full pointer-events-none transition-opacity duration-500 ${isActive ? 'opacity-100' : 'opacity-0'}`}
    />
  );
};

export default Visualizer;