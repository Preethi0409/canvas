
import React, { useEffect, useRef, useState } from 'react';
import { Users, Undo, Redo, Trash2, Pencil, Eraser, Download, Plus, LogIn, Lock, Globe, Copy, Check } from 'lucide-react';

const CollaborativeCanvas = ({ supabase }) => {
  const canvasRef = useRef(null);
  const [tool, setTool] = useState('brush');
  const [color, setColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(3);
  const [operations, setOperations] = useState([]);
  const [currentOperationIndex, setCurrentOperationIndex] = useState(-1);
  const [isDrawing, setIsDrawing] = useState(false);
  const [username, setUsername] = useState('');
  const [userId, setUserId] = useState('');
  const [canvasId, setCanvasId] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  
  // UI States
  const [showJoinModal, setShowJoinModal] = useState(true);
  const [canvasName, setCanvasName] = useState('');
  const [canvasToJoin, setCanvasToJoin] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [canvasPassword, setCanvasPassword] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [availableCanvases, setAvailableCanvases] = useState([]);
  
  const currentPathRef = useRef([]);
  const channelRef = useRef(null);

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

  // Load available public canvases
  useEffect(() => {
    if (!supabase) return;
    
    const loadCanvases = async () => {
      const { data, error } = await supabase
        .from('canvases')
        .select('*')
        .eq('is_private', false)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (data) {
        setAvailableCanvases(data);
      }
    };
    
    loadCanvases();
  }, [showJoinModal, supabase]);

  // Setup Realtime subscription when canvas is joined
  useEffect(() => {
    if (!canvasId || !userId || !supabase) return;

    const channel = supabase.channel(`canvas:${canvasId}`, {
      config: {
        broadcast: { self: false },
        presence: { key: userId }
      }
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const presenceState = channel.presenceState();
        const activeUsers = Object.values(presenceState).flat();
        setOnlineUsers(activeUsers);
      })
      .on('broadcast', { event: 'draw:operation' }, ({ payload }) => {
        if (payload.userId !== userId) {
          setOperations(prev => {
            const newOps = [...prev, payload];
            setCurrentOperationIndex(newOps.length - 1);
            setTimeout(() => drawPath(canvasRef.current?.getContext('2d'), payload), 0);
            return newOps;
          });
        }
      })
      .on('broadcast', { event: 'canvas:undo' }, () => {
        handleRemoteUndo();
      })
      .on('broadcast', { event: 'canvas:redo' }, () => {
        handleRemoteRedo();
      })
      .on('broadcast', { event: 'canvas:clear' }, () => {
        handleRemoteClear();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'canvas_operations',
        filter: `canvas_id=eq.${canvasId}`
      }, (payload) => {
        if (payload.eventType === 'INSERT' && payload.new.user_id !== userId) {
          const operation = {
            id: payload.new.id,
            userId: payload.new.user_id,
            tool: payload.new.tool,
            color: payload.new.color,
            lineWidth: payload.new.line_width,
            points: payload.new.points,
            timestamp: new Date(payload.new.created_at).getTime()
          };
          
          setOperations(prev => {
            const newOps = [...prev, operation];
            setCurrentOperationIndex(newOps.length - 1);
            setTimeout(() => drawPath(canvasRef.current?.getContext('2d'), operation), 0);
            return newOps;
          });
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            id: userId,
            username: username,
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
  }, [canvasId, userId, username, supabase]);

  const loadCanvasOperations = async () => {
    if (!supabase || !canvasId) return;
    
    const { data, error } = await supabase
      .from('canvas_operations')
      .select('*')
      .eq('canvas_id', canvasId)
      .order('created_at', { ascending: true });

    if (data) {
      const ops = data.map(op => ({
        id: op.id,
        userId: op.user_id,
        tool: op.tool,
        color: op.color,
        lineWidth: op.line_width,
        points: op.points,
        timestamp: new Date(op.created_at).getTime()
      }));
      
      setOperations(ops);
      setCurrentOperationIndex(ops.length - 1);
      
      setTimeout(() => {
        redrawCanvas(ops);
      }, 100);
    }
  };

  const createCanvas = async () => {
    if (!canvasName.trim()) {
      setError('Please enter a canvas name');
      return;
    }
    
    if (isPrivate && !canvasPassword.trim()) {
      setError('Please enter a password for private canvas');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const newCanvasId = 'canvas_' + Math.random().toString(36).substr(2, 9);
      
      const { data, error } = await supabase
        .from('canvases')
        .insert({
          id: newCanvasId,
          name: canvasName,
          is_private: isPrivate,
          password: isPrivate ? canvasPassword : null,
          created_by: userId
        })
        .select()
        .single();

      if (error) throw error;

      setCanvasId(newCanvasId);
      setShowJoinModal(false);
    } catch (err) {
      setError('Failed to create canvas: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const joinCanvas = async (targetCanvasId = null) => {
    const idToJoin = targetCanvasId || canvasToJoin.trim();
    
    if (!idToJoin) {
      setError('Please enter a canvas ID');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const { data, error } = await supabase
        .from('canvases')
        .select('*')
        .eq('id', idToJoin)
        .single();

      if (error || !data) {
        throw new Error('Canvas not found');
      }

      if (data.is_private && data.password !== joinPassword) {
        throw new Error('Incorrect password');
      }

      setCanvasId(idToJoin);
      setShowJoinModal(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const drawPath = (ctx, operation) => {
    if (!ctx) return;
    
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

      // Save to database
      const { data, error } = await supabase
        .from('canvas_operations')
        .insert({
          canvas_id: canvasId,
          user_id: userId,
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
      
      const newIndex = currentOperationIndex - 1;
      setCurrentOperationIndex(newIndex);
      redrawCanvas(operations.slice(0, newIndex + 1));
    }
  };

  const handleRedo = () => {
    if (currentOperationIndex < operations.length - 1) {
      channelRef.current?.send({
        type: 'broadcast',
        event: 'canvas:redo',
        payload: {}
      });
      
      const newIndex = currentOperationIndex + 1;
      setCurrentOperationIndex(newIndex);
      redrawCanvas(operations.slice(0, newIndex + 1));
    }
  };

  const handleClear = async () => {
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

  const handleRemoteUndo = () => {
    setCurrentOperationIndex(prev => {
      const newIndex = Math.max(-1, prev - 1);
      redrawCanvas(operations.slice(0, newIndex + 1));
      return newIndex;
    });
  };

  const handleRemoteRedo = () => {
    setCurrentOperationIndex(prev => {
      const newIndex = Math.min(operations.length - 1, prev + 1);
      redrawCanvas(operations.slice(0, newIndex + 1));
      return newIndex;
    });
  };

  const handleRemoteClear = () => {
    setOperations([]);
    setCurrentOperationIndex(-1);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `canvas-${Date.now()}.png`;
    link.href = url;
    link.click();
  };

  const copyCanvasId = () => {
    navigator.clipboard.writeText(canvasId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (showJoinModal) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-2xl w-full">
          <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">Collaborative Canvas</h1>
          
          <div className="space-y-6">
            {/* Create New Canvas */}
            <div className="border-2 border-gray-200 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Plus className="text-indigo-600" size={24} />
                <h2 className="text-xl font-semibold text-gray-800">Create New Canvas</h2>
              </div>
              
              <input
                type="text"
                placeholder="Canvas Name"
                value={canvasName}
                onChange={(e) => setCanvasName(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg mb-3 focus:border-indigo-500 focus:outline-none"
              />
              
              <div className="flex items-center gap-4 mb-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPrivate}
                    onChange={(e) => setIsPrivate(e.target.checked)}
                    className="w-5 h-5"
                  />
                  <Lock size={18} />
                  <span className="text-sm font-medium">Private Canvas</span>
                </label>
              </div>
              
              {isPrivate && (
                <input
                  type="password"
                  placeholder="Set Password"
                  value={canvasPassword}
                  onChange={(e) => setCanvasPassword(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg mb-3 focus:border-indigo-500 focus:outline-none"
                />
              )}
              
              <button
                onClick={createCanvas}
                disabled={isLoading}
                className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Creating...' : 'Create Canvas'}
              </button>
            </div>

            {/* Join Existing Canvas */}
            <div className="border-2 border-gray-200 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <LogIn className="text-green-600" size={24} />
                <h2 className="text-xl font-semibold text-gray-800">Join Canvas</h2>
              </div>
              
              <input
                type="text"
                placeholder="Canvas ID"
                value={canvasToJoin}
                onChange={(e) => setCanvasToJoin(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg mb-3 focus:border-green-500 focus:outline-none"
              />
              
              <input
                type="password"
                placeholder="Password (if private)"
                value={joinPassword}
                onChange={(e) => setJoinPassword(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg mb-3 focus:border-green-500 focus:outline-none"
              />
              
              <button
                onClick={() => joinCanvas()}
                disabled={isLoading}
                className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Joining...' : 'Join Canvas'}
              </button>
            </div>

            {/* Available Public Canvases */}
            {availableCanvases.length > 0 && (
              <div className="border-2 border-gray-200 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Globe className="text-blue-600" size={24} />
                  <h2 className="text-xl font-semibold text-gray-800">Public Canvases</h2>
                </div>
                
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {availableCanvases.map((canvas) => (
                    <button
                      key={canvas.id}
                      onClick={() => joinCanvas(canvas.id)}
                      className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <div className="font-medium text-gray-800">{canvas.name}</div>
                      <div className="text-xs text-gray-500 mt-1">ID: {canvas.id}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}
          
          <div className="mt-6 text-center text-sm text-gray-500">
            Logged in as <strong>{username}</strong>
          </div>
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

          {/* Canvas ID */}
          <button
            onClick={copyCanvasId}
            className="flex items-center gap-2 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl px-4 py-2 hover:from-purple-100 hover:to-pink-100 transition-colors"
            title="Click to copy Canvas ID"
          >
            {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} className="text-purple-600" />}
            <span className="text-sm font-mono text-gray-700">{canvasId}</span>
          </button>

          {/* Users */}
          <div className="ml-auto flex items-center gap-3 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl px-4 py-2">
            <Users size={20} className="text-indigo-600" />
            <span className="text-sm font-semibold text-gray-700">{onlineUsers.length} online</span>
            <div className="flex -space-x-2">
              {onlineUsers.slice(0, 5).map((user, idx) => (
                <div
                  key={user.id}
                  className="w-9 h-9 rounded-full border-3 border-white shadow-md flex items-center justify-center overflow-hidden bg-gradient-to-br from-purple-500 to-pink-500"
                  title={user.username}
                  style={{ zIndex: 10 - idx }}
                >
                  <span className="text-white text-xs font-bold">{user.username?.[0]?.toUpperCase()}</span>
                </div>
              ))}
              {onlineUsers.length > 5 && (
                <div className="w-9 h-9 rounded-full border-3 border-white shadow-md flex items-center justify-center bg-gray-400 text-white text-xs font-bold">
                  +{onlineUsers.length - 5}
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
              Real-time Collaboration
            </span>
            <span>{operations.length} operations</span>
          </div>
          <div>
            <strong>{username}</strong>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CollaborativeCanvas;