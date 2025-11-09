//src/app/canvas/page.js
"use client"; // If using Next.js App Router

import React from 'react';
import { supabase } from '../../lib/supabaseClient';
import CollaborativeCanvas from '../../components/CollaborativeCanvas';

export default function CanvasPage() {
  return <CollaborativeCanvas supabase={supabase} />;
}