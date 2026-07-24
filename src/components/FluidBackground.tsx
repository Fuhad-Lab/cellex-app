'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { useRef, useMemo } from 'react';
import * as THREE from 'three';

/**
 * FluidBackground — Grok-style heavy fluid smoke background.
 *
 * Uses a custom GLSL ShaderMaterial with Domain Warping FBM (Fractal Brownian
 * Motion) to generate thick, slow-moving fluid smoke. The shader feeds noise
 * functions into other noise functions, simulating physics-based fluid density
 * rather than just floating particles.
 *
 * Color: Dark grey/black (#050505 to #1a1a1a) with slow heavy drift.
 * Sits behind all content (z -50) and never blocks pointer events.
 */

const SmokeShader = {
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    varying vec2 vUv;

    // Noise functions (Simplex/Perlin)
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

    float snoise(vec2 v) {
      const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
      vec2 i  = floor(v + dot(v, C.yy) );
      vec2 x0 = v - i + dot(i, C.xx);
      vec2 i1;
      i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod289(i);
      vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
      m = m*m ;
      return 105.0 * dot( m*m, vec3( dot(p.x,x0), dot(p.y,x12.xy), dot(p.z,x12.zw) ) );
    }

    // Domain Warping for "Fluid" look
    float fbm(vec2 p) {
      float f = 0.0;
      f += 0.500 * snoise(p); p *= 2.02;
      f += 0.250 * snoise(p); p *= 2.03;
      f += 0.125 * snoise(p); p *= 2.01;
      return f;
    }

    void main() {
      vec2 uv = vUv * 2.0; // Scale up
      float time = uTime * 0.15; // Slow movement for "heavy" feel

      // Warp the coordinates to simulate fluid flow
      vec2 q = vec2(0.);
      q.x = fbm( uv + 0.00 * time );
      q.y = fbm( uv + vec2(1.0));

      vec2 r = vec2(0.);
      r.x = fbm( uv + 1.0 * q + vec2(1.7,9.2)+ 0.15 * time );
      r.y = fbm( uv + 1.0 * q + vec2(8.3,2.8)+ 0.126 * time);

      float f = fbm(uv + r);

      // Mix colors: Dark Grey to Black
      vec3 color = mix(vec3(0.05, 0.05, 0.05), vec3(0.3, 0.35, 0.4), clamp((f*f)*4.0, 0.0, 1.0));

      // Heavy vignette
      color = mix(color, vec3(0.0), 0.5 * length(uv - 1.0));

      gl_FragColor = vec4(color, 1.0);
    }
  `
};

const Plane = () => {
  const mesh = useRef<THREE.Mesh>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  useFrame((state) => {
    if (mesh.current) {
      uniforms.uTime.value = state.clock.getElapsedTime();
    }
  });

  return (
    <mesh ref={mesh} scale={[10, 10, 1]}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        vertexShader={SmokeShader.vertexShader}
        fragmentShader={SmokeShader.fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  );
};

export default function FluidBackground() {
  return (
    <div className="fixed inset-0 -z-50 w-full h-full bg-black pointer-events-none">
      <Canvas camera={{ position: [0, 0, 1] }}>
        <Plane />
      </Canvas>
    </div>
  );
}
