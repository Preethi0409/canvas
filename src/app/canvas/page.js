"use client";
import React, { useEffect, useRef, useState } from 'react';
import { Users, Undo, Redo, Trash2, Pencil, Eraser, Save, Download } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

const CollaborativeCanvas = ({ userId: urlUserId }) => {
  const canvasRef = useRef(null);
  const [tool, setTool] = useState('brush');
  const [color, setColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(3);
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [operations, setOperations] = useState([]);
  const [currentOperationIndex, setCurrentOperationIndex] = useState(-1);
  const [isDrawing, setIsDrawing] = useState(false);
  const [canvasId] = useState('default-canvas');
  const [isSaving, setIsSaving] = useState(false);
  
  const currentPathRef = useRef([]);
  const cursorPositions = useRef({});
  const lastBroadcastTime = useRef(0);
  const channelRef = useRef(null);

  // Fetch current user data
  useEffect(() => {
    const fetchUser = async () => {
      if (!urlUserId) return;
      
      const { data, error } = await supabase
        .from('users')
        .select('id, username, profile_pic')
        .eq('id', urlUserId)
        .single();
      
      if (data) {
        setCurrentUser(data);
      }
    };
    
    fetchUser();
  }, [urlUserId]);

  // Initialize Supabase Realtime
  useEffect(() => {
    if (!currentUser) return;

    const channel = supabase.channel(`canvas:${canvasId}`, {
      config: {
        broadcast: { self: false },
        presence: { key: currentUser.id }
      }
    });

    // Track presence
    channel
      .on('presence', { event: 'sync' }, () => {
        const presenceState = channel.presenceState();
        const activeUsers = Object.values(presenceState)
          .flat()
          .filter(user => user.id !== currentUser.id);
        setUsers(activeUsers);
      })
      .on('broadcast', { event: 'draw:stroke' }, ({ payload }) => {
        if (payload.userId !== currentUser.id) {
          drawRemotePath(payload);
        }
      })
      .on('broadcast', { event: 'draw:operation' }, ({ payload }) => {
        setOperations(prev => {
          const newOps = [...prev, payload];
          setCurrentOperationIndex(newOps.length - 1);
          return newOps;
        });
      })
      .on('broadcast', { event: 'cursor:move' }, ({ payload }) => {
        if (payload.userId !== currentUser.id) {
          cursorPositions.current[payload.userId] = payload;
          requestAnimationFrame(drawCursors);
        }
      })
      .on('broadcast', { event: 'canvas:undo' }, () => {
        setCurrentOperationIndex(prev => {
          const newIndex = Math.max(-1, prev - 1);
          redrawCanvas(operations.slice(0, newIndex + 1));
          return newIndex;
        });
      })
      .on('broadcast', { event: 'canvas:redo' }, () => {
        setCurrentOperationIndex(prev => {
          const newIndex = Math.min(operations.length - 1, prev + 1);
          redrawCanvas(operations.slice(0, newIndex + 1));
          return newIndex;
        });
      })
      .on('broadcast', { event: 'canvas:clear' }, () => {
        setOperations([]);
        setCurrentOperationIndex(-1);
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            id: currentUser.id,
            username: currentUser.username,
            profile_pic: currentUser.profile_pic,
            online_at: new Date().toISOString()
          });
        }
      });

    channelRef.current = channel;

    // Load existing operations
    loadCanvasOperations();

    return () => {
      channel.unsubscribe();
    };
  }, [currentUser, canvasId]);

  const loadCanvasOperations = async () => {
    const { data, error } = await supabase
      .from('canvas_operations')
      .select('*')
      .eq('canvas_id', canvasId)
      .order('created_at', { ascending: true });

    if (data) {
      setOperations(data.map(op => ({
        id: op.id,
        userId: op.user_id,
        tool: op.tool,
        color: op.color,
        lineWidth: op.line_width,
        points: op.points,
        timestamp: new Date(op.created_at).getTime()
      })));
      setCurrentOperationIndex(data.length - 1);
      
      // Redraw all operations
      setTimeout(() => {
        redrawCanvas(data.map(op => ({
          userId: op.user_id,
          tool: op.tool,
          color: op.color,
          lineWidth: op.line_width,
          points: op.points
        })));
      }, 100);
    }
  };

  const drawRemotePath = (data) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = data.tool === 'eraser' ? '#FFFFFF' : data.color;
    ctx.lineWidth = data.lineWidth;
    ctx.globalCompositeOperation = data.tool === 'eraser' ? 'destination-out' : 'source-over';

    if (data.points.length > 0) {
      ctx.beginPath();
      ctx.moveTo(data.points[0].x, data.points[0].y);
      
      for (let i = 1; i < data.points.length; i++) {
        ctx.lineTo(data.points[i].x, data.points[i].y);
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
      drawRemotePath(op);
    });
  };

  const drawCursors = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    Object.values(cursorPositions.current).forEach(cursor => {
      ctx.save();
      ctx.fillStyle = cursor.color || '#3b82f6';
      ctx.beginPath();
      ctx.arc(cursor.x, cursor.y, 5, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw username label
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.font = '12px Inter, sans-serif';
      const textWidth = ctx.measureText(cursor.username).width;
      ctx.fillRect(cursor.x + 10, cursor.y - 20, textWidth + 8, 18);
      
      ctx.fillStyle = '#ffffff';
      ctx.fillText(cursor.username, cursor.x + 14, cursor.y - 7);
      ctx.restore();
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
    const pos = getMousePos(e);
    
    // Broadcast cursor position (throttled)
    const now = Date.now();
    if (now - lastBroadcastTime.current > 50) {
      channelRef.current?.send({
        type: 'broadcast',
        event: 'cursor:move',
        payload: {
          userId: currentUser?.id,
          username: currentUser?.username,
          color: '#3b82f6',
          x: pos.x,
          y: pos.y
        }
      });
      lastBroadcastTime.current = now;
    }

    if (!isDrawing) return;

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

    // Broadcast stroke in progress
    if (currentPathRef.current.length % 3 === 0) {
      channelRef.current?.send({
        type: 'broadcast',
        event: 'draw:stroke',
        payload: {
          userId: currentUser?.id,
          tool,
          color,
          lineWidth,
          points: [...currentPathRef.current]
        }
      });
    }
    
    ctx.globalCompositeOperation = 'source-over';
  };

  const handleMouseUp = async () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (currentPathRef.current.length > 0) {
      const operation = {
        userId: currentUser?.id,
        tool,
        color,
        lineWidth,
        points: [...currentPathRef.current],
        timestamp: Date.now()
      };

      // Save to database
      const { data, error } = await supabase
        .from('canvas_operations')
        .insert({
          canvas_id: canvasId,
          user_id: currentUser?.id,
          tool,
          color,
          line_width: lineWidth,
          points: operation.points
        })
        .select()
        .single();

      if (data) {
        operation.id = data.id;
        
        // Broadcast to other users
        channelRef.current?.send({
          type: 'broadcast',
          event: 'draw:operation',
          payload: operation
        });
        
        setOperations(prev => {
          const newOps = [...prev, operation];
          setCurrentOperationIndex(newOps.length - 1);
          return newOps;
        });
      }
    }

    currentPathRef.current = [];
  };

  const handleUndo = () => {
    if (currentOperationIndex >= 0) {
      channelRef.current?.send({
        type: 'broadcast',
        event: 'canvas:undo',
        payload: {}
      });
      setCurrentOperationIndex(prev => {
        const newIndex = prev - 1;
        redrawCanvas(operations.slice(0, newIndex + 1));
        return newIndex;
      });
    }
  };

  const handleRedo = () => {
    if (currentOperationIndex < operations.length - 1) {
      channelRef.current?.send({
        type: 'broadcast',
        event: 'canvas:redo',
        payload: {}
      });
      setCurrentOperationIndex(prev => {
        const newIndex = prev + 1;
        redrawCanvas(operations.slice(0, newIndex + 1));
        return newIndex;
      });
    }
  };

  const handleClear = async () => {
    // Delete all operations from database
    await supabase
      .from('canvas_operations')
      .delete()
      .eq('canvas_id', canvasId);

    channelRef.current?.send({
      type: 'broadcast',
      event: 'canvas:clear',
      payload: {}
    });
    
    setOperations([]);
    setCurrentOperationIndex(-1);
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

  if (!currentUser) {
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
      {/* Modern Toolbar */}
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
            <span className="text-sm font-semibold text-gray-700">{users.length + 1} online</span>
            <div className="flex -space-x-2">
              <div
                className="w-9 h-9 rounded-full border-3 border-white shadow-md flex items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-500 to-blue-500"
                title={`You (${currentUser.username})`}
              >
                {currentUser.profile_pic ? (
                  <img src={currentUser.profile_pic} alt="You" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white text-xs font-bold">{currentUser.username?.[0]?.toUpperCase()}</span>
                )}
              </div>
              {users.slice(0, 4).map((user, idx) => (
                <div
                  key={user.id}
                  className="w-9 h-9 rounded-full border-3 border-white shadow-md flex items-center justify-center overflow-hidden bg-gradient-to-br from-purple-500 to-pink-500"
                  title={user.username}
                  style={{ zIndex: 10 - idx }}
                >
                  {user.profile_pic ? (
                    <img src={user.profile_pic} alt={user.username} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white text-xs font-bold">{user.username?.[0]?.toUpperCase()}</span>
                  )}
                </div>
              ))}
              {users.length > 4 && (
                <div className="w-9 h-9 rounded-full border-3 border-white shadow-md flex items-center justify-center bg-gray-400 text-white text-xs font-bold">
                  +{users.length - 4}
                </div>
              )}
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
              Live Collaboration
            </span>
            <span>Canvas ID: {canvasId}</span>
          </div>
          <div>
            Logged in as <strong>{currentUser.username}</strong>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CollaborativeCanvas;