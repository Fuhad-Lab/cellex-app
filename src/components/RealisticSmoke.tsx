'use client';

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import * as THREE from 'three';

// Force client-side execution to bypass Next.js Server-Side Rendering
const SmokeScene = dynamic(
  () => import('react-smoke').then((mod: any) => mod.SmokeScene) as Promise<any>,
  { ssr: false }
) as React.ComponentType<any>;

export default function RealisticSmoke() {
  // Memoize color to prevent unnecessary React re-renders on the canvas
  const smokeColor = useMemo(() => new THREE.Color("#555555"), []);

  return (
    <div className="fixed inset-0 -z-50 w-screen h-screen bg-[#050508] overflow-hidden pointer-events-none">
      <SmokeScene 
        smoke={{ 
          color: smokeColor, 
          density: 45, 
          enableRotation: true 
        }} 
      />
    </div>
  );
}
