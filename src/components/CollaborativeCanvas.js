"use client";
import React, { useEffect, useRef, useState } from 'react';
import { Users, Undo, Redo, Trash2, Pencil, Eraser, Download } from 'lucide-react';

const CollaborativeCanvas = () => {
  const canvasRef = useRef(null);
  const [tool, setTool] = useState('brush');
  const [color, setColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(3);
  const [operations, setOperations] = useState([]);
  const [currentOperationIndex, setCurrentOperationIndex] = useState(-1);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState(1);
  const [username, setUsername] = useState('');
  const [userId, setUserId] = useState('');
  
  const currentPathRef = useRef([]);
  const syncIntervalRef = useRef(null);

  // Initialize user
  useEffect(() => {
    const storedUserId = localStorage.getItem('canvas-user-id');
    const storedUsername = localStorage.getItem('canvas-username');
    
    if (storedUserId && storedUsername) {
      setUserId(storedUserId);
      setUsername(storedUsername);
    } else {
      const newUserId = 'user_' + Math.random().toString(36).substr(2, 9);
      const newUsername = 'User' + Math.floor(Math.random() * 1000);
      setUserId(newUserId);
      setUsername(newUsername);
      localStorage.setItem('canvas-user-id', newUserId);
      localStorage.setItem('canvas-username', newUsername);
    }
  }, []);

  // Load canvas operations from storage
  useEffect(() => {
    const loadCanvas = async () => {
      if (!userId) return;
      
      try {
        const result = await window.storage.get('canvas-operations', true);
        if (result && result.value) {
          const ops = JSON.parse(result.value);
          setOperations(ops);
          setCurrentOperationIndex(ops.length - 1);
          setTimeout(() => redrawCanvas(ops), 100);
        }
        
        // Update online presence
        await updatePresence();
        
        setIsLoading(false);
      } catch (error) {
        console.log('No existing canvas data');
        setIsLoading(false);
      }
    };
    
    loadCanvas();
  }, [userId]);

  // Sync with other users periodically
  useEffect(() => {
    if (!userId) return;
    
    syncIntervalRef.current = setInterval(async () => {
      try {
        const result = await window.storage.get('canvas-operations', true);
        if (result && result.value) {
          const ops = JSON.parse(result.value);
          // Check if operations changed by comparing length and last timestamp
          const shouldUpdate = ops.length !== operations.length || 
            (ops.length > 0 && operations.length > 0 && 
             ops[ops.length - 1]?.timestamp !== operations[operations.length - 1]?.timestamp);
          
          if (shouldUpdate) {
            setOperations(ops);
            setCurrentOperationIndex(ops.length - 1);
            setTimeout(() => redrawCanvas(ops), 0);
          }
        }
        
        // Update presence
        await updatePresence();
        await countOnlineUsers();
      } catch (error) {
        console.log('Sync error:', error);
      }
    }, 1000); // Faster sync - every 1 second
    
    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [userId, operations]);

  const updatePresence = async () => {
    try {
      const presence = {
        userId,
        username,
        timestamp: Date.now()
      };
      await window.storage.set(`presence:${userId}`, JSON.stringify(presence), true);
    } catch (error) {
      console.log('Presence update error:', error);
    }
  };

  const countOnlineUsers = async () => {
    try {
      const result = await window.storage.list('presence:', true);
      if (result && result.keys) {
        // Count users active in last 10 seconds
        const now = Date.now();
        let activeCount = 0;
        
        for (const key of result.keys) {
          try {
            const userData = await window.storage.get(key, true);
            if (userData && userData.value) {
              const user = JSON.parse(userData.value);
              if (now - user.timestamp < 10000) {
                activeCount++;
              }
            }
          } catch (e) {
            console.log('Error counting user:', e);
          }
        }
        
        setOnlineUsers(Math.max(1, activeCount));
      }
    } catch (error) {
      console.log('Error counting users:', error);
    }
  };

  const saveOperations = async (ops) => {
    try {
      await window.storage.set('canvas-operations', JSON.stringify(ops), true);
    } catch (error) {
      console.error('Error saving operations:', error);
    }
  };

  const drawPath = (ctx, operation) => {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = operation.tool === 'eraser' ? '#FFFFFF' : operation.color;
    ctx.lineWidth = operation.lineWidth;
    ctx.globalCompositeOperation = operation.tool === 'eraser' ? 'destination-out' : 'source-over';

    if (operation.points && operation.points.length > 0) {
      ctx.beginPath();
      ctx.moveTo(operation.points[0].x, operation.points[0].y);
      
      for (let i = 1; i < operation.points.length; i++) {
        ctx.lineTo(operation.points[i].x, operation.points[i].y);
      }
      
      ctx.stroke();
    }
    
    ctx.globalCompositeOperation = 'source-over';
  };

  const redrawCanvas = (ops) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ops.forEach(op => {
      drawPath(ctx, op);
    });
  };

  const getMousePos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const handleMouseDown = (e) => {
    setIsDrawing(true);
    const pos = getMousePos(e);
    currentPathRef.current = [pos];

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const handleMouseMove = (e) => {
    if (!isDrawing) return;

    const pos = getMousePos(e);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = tool === 'eraser' ? '#FFFFFF' : color;
    ctx.lineWidth = lineWidth;
    ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';

    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();

    currentPathRef.current.push(pos);
    ctx.globalCompositeOperation = 'source-over';
  };

  const handleMouseUp = async () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (currentPathRef.current.length > 0) {
      const operation = {
        userId,
        username,
        tool,
        color,
        lineWidth,
        points: [...currentPathRef.current],
        timestamp: Date.now()
      };

      // Get current operations from storage to avoid conflicts
      let currentOps = [];
      try {
        const result = await window.storage.get('canvas-operations', true);
        if (result && result.value) {
          currentOps = JSON.parse(result.value);
        }
      } catch (e) {
        console.log('No existing operations');
      }

      const newOps = [...currentOps, operation];
      setOperations(newOps);
      setCurrentOperationIndex(newOps.length - 1);
      
      await saveOperations(newOps);
    }

    currentPathRef.current = [];
  };

  const handleUndo = async () => {
    if (currentOperationIndex >= 0) {
      const newIndex = currentOperationIndex - 1;
      setCurrentOperationIndex(newIndex);
      const newOps = operations.slice(0, newIndex + 1);
      redrawCanvas(newOps);
      await saveOperations(operations);
    }
  };

  const handleRedo = async () => {
    if (currentOperationIndex < operations.length - 1) {
      const newIndex = currentOperationIndex + 1;
      setCurrentOperationIndex(newIndex);
      const newOps = operations.slice(0, newIndex + 1);
      redrawCanvas(newOps);
      await saveOperations(operations);
    }
  };

  const handleClear = async () => {
    setOperations([]);
    setCurrentOperationIndex(-1);
    await window.storage.delete('canvas-operations', true);
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `canvas-${Date.now()}.png`;
    link.href = url;
    link.click();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading canvas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Toolbar */}
      <div className="bg-white/80 backdrop-blur-lg shadow-lg border-b border-gray-200/50 p-4">
        <div className="max-w-7xl mx-auto flex items-center gap-6 flex-wrap">
          {/* Tools */}
          <div className="flex items-center gap-2 bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setTool('brush')}
              className={`p-2.5 rounded-lg transition-all ${
                tool === 'brush' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-gray-600 hover:bg-gray-200'
              }`}
              title="Brush"
            >
              <Pencil size={20} />
            </button>
            <button
              onClick={() => setTool('eraser')}
              className={`p-2.5 rounded-lg transition-all ${
                tool === 'eraser' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-gray-600 hover:bg-gray-200'
              }`}
              title="Eraser"
            >
              <Eraser size={20} />
            </button>
          </div>

          {/* Color & Size */}
          <div className="flex items-center gap-3 bg-gray-100 rounded-xl px-4 py-2">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-10 h-10 border-2 border-white rounded-lg cursor-pointer shadow-sm"
              disabled={tool === 'eraser'}
            />
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="1"
                max="30"
                value={lineWidth}
                onChange={(e) => setLineWidth(Number(e.target.value))}
                className="w-24"
              />
              <span className="text-sm font-medium text-gray-700 min-w-[45px]">{lineWidth}px</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleUndo}
              disabled={currentOperationIndex < 0}
              className="p-2.5 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              title="Undo"
            >
              <Undo size={20} />
            </button>
            <button
              onClick={handleRedo}
              disabled={currentOperationIndex >= operations.length - 1}
              className="p-2.5 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              title="Redo"
            >
              <Redo size={20} />
            </button>
            <button
              onClick={handleClear}
              className="p-2.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-all"
              title="Clear Canvas"
            >
              <Trash2 size={20} />
            </button>
            <button
              onClick={handleDownload}
              className="p-2.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-all"
              title="Download"
            >
              <Download size={20} />
            </button>
          </div>

          {/* Users */}
          <div className="ml-auto flex items-center gap-3 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl px-4 py-2">
            <Users size={20} className="text-indigo-600" />
            <span className="text-sm font-semibold text-gray-700">{onlineUsers} online</span>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-gray-600">{username}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200/50">
          <canvas
            ref={canvasRef}
            width={1200}
            height={700}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="cursor-crosshair"
            style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="bg-white/80 backdrop-blur-lg border-t border-gray-200/50 px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-gray-600">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              Shared Canvas - All users see the same drawing
            </span>
          </div>
          <div>
            {operations.length} operations saved
          </div>
        </div>
      </div>
    </div>
  );
};

export default CollaborativeCanvas;