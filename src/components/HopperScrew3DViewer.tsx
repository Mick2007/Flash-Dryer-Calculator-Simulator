import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  Rotate3d,
  Layers,
  Sparkles,
  Eye,
  Sliders,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Compass,
  Maximize2,
  Minimize2,
  Box,
  Ruler
} from 'lucide-react';
import { HopperDesignReport, ScrewFeederDesignReport } from '../types/dryer';

interface HopperScrew3DViewerProps {
  hopperDesign: HopperDesignReport;
  screwFeederDesign: ScrewFeederDesignReport;
  onResetView?: () => void;
}

export const HopperScrew3DViewer: React.FC<HopperScrew3DViewerProps> = ({
  hopperDesign,
  screwFeederDesign,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  // Three.js instances
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const hopperGroupRef = useRef<THREE.Group | null>(null);

  // UI state
  const [wireframe, setWireframe] = useState<boolean>(false);
  const [translucent, setTranslucent] = useState<boolean>(false);
  const [showMashBed, setShowMashBed] = useState<boolean>(true);
  const [showAnnotations, setShowAnnotations] = useState<boolean>(true);
  const [isRotating, setIsRotating] = useState<boolean>(false);
  const [cameraPreset, setCameraPreset] = useState<'iso' | 'front' | 'side' | 'top'>('iso');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Geometry dimensions from hopperDesign
  const W1 = hopperDesign.topWidthM; // e.g. 0.50 m
  const L1 = hopperDesign.topLengthM; // e.g. 0.50 m
  const W2 = hopperDesign.outletWidthM; // e.g. 0.32 m
  const L2 = hopperDesign.outletLengthM; // e.g. 0.22 m
  const h1 = hopperDesign.upperVerticalHeightM; // e.g. 0.10 m
  const h2 = hopperDesign.lowerTaperedHeightM; // e.g. 0.556 m
  const H = hopperDesign.overallHeightM; // h1 + h2

  // Angles
  const angleA = hopperDesign.wallSlopeAngleADeg; // Side Wall Angle (Width)
  const angleB = hopperDesign.wallSlopeAngleBDeg; // End Wall Angle (Length)
  const angleC = hopperDesign.valleyAngleDeg; // Valley Corner Angle
  const isSteep = hopperDesign.isValleyAngleSufficient;

  // Screw dimensions
  const screwD = (screwFeederDesign.screwDiameterMm || 100) / 1000; // m
  const screwL = (screwFeederDesign.screwLengthMm || 1000) / 1000; // m
  const screwPitch = (screwFeederDesign.screwPitchMm || 100) / 1000; // m
  const shaftR = (screwFeederDesign.shaftDiameterMm || 38) / 2000; // m

  // Initialize Three.js Scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 450;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090d16); // Deep engineering dark navy
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.05, 50);
    camera.position.set(1.4, 1.1, 1.6);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.replaceChildren(renderer.domElement);
    rendererRef.current = renderer;

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 0.25, 0);
    controls.maxDistance = 10;
    controls.minDistance = 0.3;
    controlsRef.current = controls;

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight1.position.set(4, 6, 4);
    dirLight1.castShadow = true;
    dirLight1.shadow.mapSize.width = 1024;
    dirLight1.shadow.mapSize.height = 1024;
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x38bdf8, 0.5); // Cool blue fill
    dirLight2.position.set(-4, 3, -3);
    scene.add(dirLight2);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x1e293b, 0.6);
    scene.add(hemiLight);

    // 6. Ground Grid & Shadow Plane
    const grid = new THREE.GridHelper(4, 20, 0x334155, 0x1e293b);
    grid.position.y = -screwD * 1.5;
    scene.add(grid);

    // 7. Animation Loop
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      if (controlsRef.current) {
        controlsRef.current.autoRotate = isRotating;
        controlsRef.current.autoRotateSpeed = 2.0;
        controlsRef.current.update();
      }
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    // 8. Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0 && cameraRef.current && rendererRef.current) {
          cameraRef.current.aspect = w / h;
          cameraRef.current.updateProjectionMatrix();
          rendererRef.current.setSize(w, h);
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      resizeObserver.disconnect();
      renderer.dispose();
      scene.clear();
    };
  }, []);

  // Update 3D Geometry when dimensions or display settings change
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Remove existing hopper group if present
    if (hopperGroupRef.current) {
      scene.remove(hopperGroupRef.current);
      hopperGroupRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
      hopperGroupRef.current = null;
    }

    const group = new THREE.Group();
    hopperGroupRef.current = group;
    scene.add(group);

    // ==========================================
    // MATERIALS
    // ==========================================
    const wallOpacity = translucent ? 0.35 : 0.95;
    const stainlessSteelMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.85,
      roughness: 0.28,
      wireframe: wireframe,
      transparent: translucent,
      opacity: wallOpacity,
      side: THREE.DoubleSide,
    });

    const rimMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      metalness: 0.9,
      roughness: 0.2,
      wireframe: wireframe,
    });

    const screwFlightMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7, // Vibrant cyan-blue
      metalness: 0.85,
      roughness: 0.25,
      wireframe: wireframe,
      side: THREE.DoubleSide,
    });

    const shaftMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.9,
      roughness: 0.15,
      wireframe: wireframe,
    });

    const motorMat = new THREE.MeshStandardMaterial({
      color: 0x1d4ed8, // Industrial blue
      metalness: 0.5,
      roughness: 0.4,
      wireframe: wireframe,
    });

    const mashMat = new THREE.MeshStandardMaterial({
      color: 0xd97706, // Golden amber dewatered cassava
      metalness: 0.1,
      roughness: 0.8,
      transparent: true,
      opacity: 0.65,
      wireframe: wireframe,
    });

    // Coordinates setup:
    // Origin Y=0 is the bottom outlet of the hopper frustum.
    // Frustum extends from Y=0 (W2 x L2) to Y=h2 (W1 x L1).
    // Upper collar extends from Y=h2 to Y=h2+h1 (W1 x L1).
    // X is Width direction (W1, W2).
    // Z is Length direction (L1, L2).

    // ==========================================
    // 1. UPPER STRAIGHT COLLAR (h1: W1 x L1)
    // ==========================================
    // 4 vertical walls around the perimeter
    const collarGroup = new THREE.Group();
    const t = 0.003; // 3 mm sheet metal

    // North & South walls (along X, length L1)
    const nsWallGeo = new THREE.BoxGeometry(W1, h1, t);
    const nWall = new THREE.Mesh(nsWallGeo, stainlessSteelMat);
    nWall.position.set(0, h2 + h1 / 2, L1 / 2);
    nWall.castShadow = true;
    collarGroup.add(nWall);

    const sWall = new THREE.Mesh(nsWallGeo, stainlessSteelMat);
    sWall.position.set(0, h2 + h1 / 2, -L1 / 2);
    sWall.castShadow = true;
    collarGroup.add(sWall);

    // East & West walls (along Z, width W1)
    const ewWallGeo = new THREE.BoxGeometry(t, h1, L1);
    const eWall = new THREE.Mesh(ewWallGeo, stainlessSteelMat);
    eWall.position.set(W1 / 2, h2 + h1 / 2, 0);
    eWall.castShadow = true;
    collarGroup.add(eWall);

    const wWall = new THREE.Mesh(ewWallGeo, stainlessSteelMat);
    wWall.position.set(-W1 / 2, h2 + h1 / 2, 0);
    wWall.castShadow = true;
    collarGroup.add(wWall);

    // Top Rim Flange Stiffener (Angle Iron Perimeter 30x30x3 mm)
    const rimFlangeGeo = new THREE.BoxGeometry(W1 + 0.04, 0.02, L1 + 0.04);
    const rimFlange = new THREE.Mesh(rimFlangeGeo, rimMat);
    rimFlange.position.set(0, h2 + h1, 0);
    collarGroup.add(rimFlange);

    group.add(collarGroup);

    // ==========================================
    // 2. LOWER TAPERED PYRAMIDAL FRUSTUM (h2: W1xL1 -> W2xL2)
    // ==========================================
    // 8 vertices:
    // Top 4 at Y = h2:
    // 0: (+W1/2, h2, +L1/2) - Front Right
    // 1: (-W1/2, h2, +L1/2) - Front Left
    // 2: (-W1/2, h2, -L1/2) - Back Left
    // 3: (+W1/2, h2, -L1/2) - Back Right
    // Bottom 4 at Y = 0:
    // 4: (+W2/2, 0, +L2/2) - Front Right Bottom
    // 5: (-W2/2, 0, +L2/2) - Front Left Bottom
    // 6: (-W2/2, 0, -L2/2) - Back Left Bottom
    // 7: (+W2/2, 0, -L2/2) - Back Right Bottom

    const w1h = W1 / 2;
    const l1h = L1 / 2;
    const w2h = W2 / 2;
    const l2h = L2 / 2;

    const frustumVertices = new Float32Array([
      // Front Wall (+Z): Vertices 1, 0, 4, 5
      -w1h, h2,  l1h,    w1h, h2,  l1h,    w2h,  0,  l2h,
      -w1h, h2,  l1h,    w2h,  0,  l2h,   -w2h,  0,  l2h,

      // Back Wall (-Z): Vertices 3, 2, 6, 7
       w1h, h2, -l1h,   -w1h, h2, -l1h,   -w2h,  0, -l2h,
       w1h, h2, -l1h,   -w2h,  0, -l2h,    w2h,  0, -l2h,

      // Right Side Wall (+X): Vertices 0, 3, 7, 4
       w1h, h2,  l1h,    w1h, h2, -l1h,    w2h,  0, -l2h,
       w1h, h2,  l1h,    w2h,  0, -l2h,    w2h,  0,  l2h,

      // Left Side Wall (-X): Vertices 2, 1, 5, 6
      -w1h, h2, -l1h,   -w1h, h2,  l1h,   -w2h,  0,  l2h,
      -w1h, h2, -l1h,   -w2h,  0,  l2h,   -w2h,  0, -l2h,
    ]);

    const frustumGeo = new THREE.BufferGeometry();
    frustumGeo.setAttribute('position', new THREE.BufferAttribute(frustumVertices, 3));
    frustumGeo.computeVertexNormals();

    const frustumMesh = new THREE.Mesh(frustumGeo, stainlessSteelMat);
    frustumMesh.castShadow = true;
    group.add(frustumMesh);

    // ==========================================
    // 3. HIGHLIGHTED VALLEY CORNER SEAMS (Angle C)
    // ==========================================
    // Four corner valley edges connecting top corners to bottom corners
    const valleyLineMat = new THREE.LineBasicMaterial({ color: 0xf59e0b, linewidth: 3 });
    const valleyPoints = [
      // Corner 1: (+w1h, h2, +l1h) to (+w2h, 0, +l2h)
      new THREE.Vector3(w1h, h2, l1h), new THREE.Vector3(w2h, 0, l2h),
      // Corner 2: (-w1h, h2, +l1h) to (-w2h, 0, +l2h)
      new THREE.Vector3(-w1h, h2, l1h), new THREE.Vector3(-w2h, 0, l2h),
      // Corner 3: (-w1h, h2, -l1h) to (-w2h, 0, -l2h)
      new THREE.Vector3(-w1h, h2, -l1h), new THREE.Vector3(-w2h, 0, -l2h),
      // Corner 4: (+w1h, h2, -l1h) to (+w2h, 0, -l2h)
      new THREE.Vector3(w1h, h2, -l1h), new THREE.Vector3(w2h, 0, -l2h),
    ];
    const valleyGeo = new THREE.BufferGeometry().setFromPoints(valleyPoints);
    const valleyLines = new THREE.LineSegments(valleyGeo, valleyLineMat);
    group.add(valleyLines);

    // Bottom Outlet Flange Joint (Mating to screw feeder trough)
    const botFlangeGeo = new THREE.BoxGeometry(W2 + 0.05, 0.015, L2 + 0.05);
    const botFlange = new THREE.Mesh(botFlangeGeo, rimMat);
    botFlange.position.set(0, 0, 0);
    group.add(botFlange);

    // ==========================================
    // 4. WET CASSAVA MASH BUFFER BED (Toggleable)
    // ==========================================
    if (showMashBed) {
      const mashH = h2 * 0.75;
      const mashTopW = W2 + (W1 - W2) * (mashH / h2);
      const mashTopL = L2 + (L1 - L2) * (mashH / h2);
      const mw1h = mashTopW / 2;
      const ml1h = mashTopL / 2;

      const mashVertices = new Float32Array([
        // Front Wall
        -mw1h, mashH,  ml1h,    mw1h, mashH,  ml1h,    w2h,  0.02,  l2h,
        -mw1h, mashH,  ml1h,    w2h,  0.02,  l2h,   -w2h,  0.02,  l2h,
        // Back Wall
         mw1h, mashH, -ml1h,   -mw1h, mashH, -ml1h,   -w2h,  0.02, -l2h,
         mw1h, mashH, -ml1h,   -w2h,  0.02, -l2h,    w2h,  0.02, -l2h,
        // Right Side Wall
         mw1h, mashH,  ml1h,    mw1h, mashH, -ml1h,    w2h,  0.02, -l2h,
         mw1h, mashH,  ml1h,    w2h,  0.02, -l2h,    w2h,  0.02,  l2h,
        // Left Side Wall
        -mw1h, mashH, -ml1h,   -mw1h, mashH,  ml1h,   -w2h,  0.02,  l2h,
        -mw1h, mashH, -ml1h,   -w2h,  0.02,  l2h,   -w2h,  0.02, -l2h,
        // Top Surface (Horizontal freeboard top)
        -mw1h, mashH, -ml1h,    mw1h, mashH, -ml1h,    mw1h, mashH,  ml1h,
        -mw1h, mashH, -ml1h,    mw1h, mashH,  ml1h,   -mw1h, mashH,  ml1h,
      ]);
      const mashGeo = new THREE.BufferGeometry();
      mashGeo.setAttribute('position', new THREE.BufferAttribute(mashVertices, 3));
      mashGeo.computeVertexNormals();
      const mashMesh = new THREE.Mesh(mashGeo, mashMat);
      group.add(mashMesh);
    }

    // ==========================================
    // 5. SCREW FEEDER CONVEYOR ASSEMBLY
    // ==========================================
    // Located right below hopper outlet flange (Y: -screwD/2 to -screwD*1.5)
    // Screw feeds along the X-axis (from -X drive end to +X discharge)
    const screwGroup = new THREE.Group();
    const screwCenterY = -screwD * 0.85;

    // A. Screw Trough (U-Trough / Tubular barrel)
    const troughR = screwD / 2 + 0.005; // 5 mm tip clearance
    const troughGeo = new THREE.CylinderGeometry(troughR, troughR, screwL, 24, 1, true, -Math.PI / 2, Math.PI);
    troughGeo.rotateZ(Math.PI / 2);
    const troughMesh = new THREE.Mesh(troughGeo, stainlessSteelMat);
    troughMesh.position.set(0, screwCenterY, 0);
    troughMesh.castShadow = true;
    screwGroup.add(troughMesh);

    // B. Center Drive Shaft (Ø38 mm)
    const shaftGeo = new THREE.CylinderGeometry(shaftR, shaftR, screwL + 0.25, 20);
    shaftGeo.rotateZ(Math.PI / 2);
    const shaftMesh = new THREE.Mesh(shaftGeo, shaftMat);
    shaftMesh.position.set(0, screwCenterY, 0);
    shaftMesh.castShadow = true;
    screwGroup.add(shaftMesh);

    // C. Helical Continuous Screw Flighting
    // Build parametric helical ribbon turns
    const flightTurns = Math.max(4, Math.round(screwL / screwPitch));
    const flightGroup = new THREE.Group();

    for (let turn = 0; turn < flightTurns; turn++) {
      const turnStartX = -screwL / 2 + turn * screwPitch;
      const turnCurveSegments = 16;
      const ribbonVertices: number[] = [];

      for (let s = 0; s < turnCurveSegments; s++) {
        const theta1 = (s / turnCurveSegments) * Math.PI * 2;
        const theta2 = ((s + 1) / turnCurveSegments) * Math.PI * 2;
        const x1 = turnStartX + (s / turnCurveSegments) * screwPitch;
        const x2 = turnStartX + ((s + 1) / turnCurveSegments) * screwPitch;

        // Inner radius at shaft, outer radius at flight tip
        const rIn = shaftR;
        const rOut = screwD / 2;

        const yIn1 = Math.cos(theta1) * rIn;
        const zIn1 = Math.sin(theta1) * rIn;
        const yOut1 = Math.cos(theta1) * rOut;
        const zOut1 = Math.sin(theta1) * rOut;

        const yIn2 = Math.cos(theta2) * rIn;
        const zIn2 = Math.sin(theta2) * rIn;
        const yOut2 = Math.cos(theta2) * rOut;
        const zOut2 = Math.sin(theta2) * rOut;

        // Quad split into 2 triangles
        ribbonVertices.push(
          x1, yIn1, zIn1,   x1, yOut1, zOut1,  x2, yOut2, zOut2,
          x1, yIn1, zIn1,   x2, yOut2, zOut2,  x2, yIn2, zIn2
        );
      }

      const ribbonGeo = new THREE.BufferGeometry();
      ribbonGeo.setAttribute('position', new THREE.Float32BufferAttribute(ribbonVertices, 3));
      ribbonGeo.computeVertexNormals();
      const ribbonMesh = new THREE.Mesh(ribbonGeo, screwFlightMat);
      ribbonMesh.castShadow = true;
      flightGroup.add(ribbonMesh);
    }
    flightGroup.position.set(0, screwCenterY, 0);
    screwGroup.add(flightGroup);

    // D. Electric Geared Motor & Drive Unit (at -X end)
    const motorL = 0.28;
    const motorR = screwD * 0.65;
    const motorGeo = new THREE.CylinderGeometry(motorR, motorR, motorL, 18);
    motorGeo.rotateZ(Math.PI / 2);
    const motorMesh = new THREE.Mesh(motorGeo, motorMat);
    motorMesh.position.set(-screwL / 2 - motorL / 2 - 0.05, screwCenterY, 0);
    motorMesh.castShadow = true;
    screwGroup.add(motorMesh);

    // Motor Terminal Box on top
    const termBox = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.10), motorMat);
    termBox.position.set(-screwL / 2 - motorL / 2 - 0.05, screwCenterY + motorR + 0.04, 0);
    screwGroup.add(termBox);

    // Gearbox Housing Coupling
    const gearboxGeo = new THREE.BoxGeometry(0.15, motorR * 2.2, motorR * 2.2);
    const gearbox = new THREE.Mesh(gearboxGeo, rimMat);
    gearbox.position.set(-screwL / 2 - 0.06, screwCenterY, 0);
    screwGroup.add(gearbox);

    // E. Discharge Drop Chute (at +X end)
    const dischargeGeo = new THREE.CylinderGeometry(screwD * 0.45, screwD * 0.4, 0.22, 16);
    const dischargeMesh = new THREE.Mesh(dischargeGeo, stainlessSteelMat);
    dischargeMesh.position.set(screwL / 2 - 0.12, screwCenterY - 0.11, 0);
    screwGroup.add(dischargeMesh);

    group.add(screwGroup);

  }, [W1, L1, W2, L2, h1, h2, screwD, screwL, screwPitch, shaftR, wireframe, translucent, showMashBed]);

  // Camera preset handlers
  const handlePreset = useCallback((preset: 'iso' | 'front' | 'side' | 'top') => {
    setCameraPreset(preset);
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    controls.target.set(0, h2 / 2, 0);

    if (preset === 'iso') {
      camera.position.set(1.4, 1.1, 1.6);
    } else if (preset === 'front') {
      // Front View looking along Z (Width Direction - shows Side Wall Angle A)
      camera.position.set(0, h2 / 2, 1.9);
    } else if (preset === 'side') {
      // Side View looking along X (Length Direction - shows End Wall Angle B)
      camera.position.set(1.9, h2 / 2, 0);
    } else if (preset === 'top') {
      // Top Plan View
      camera.position.set(0, 2.2, 0.001);
    }
    controls.update();
  }, [h2]);

  return (
    <div className={`relative bg-slate-950 rounded-xl border border-slate-800 overflow-hidden flex flex-col ${isFullscreen ? 'fixed inset-0 z-50 rounded-none' : 'w-full shadow-xl'}`}>
      {/* Top HUD Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3.5 bg-slate-900/90 border-b border-slate-800 text-xs text-slate-300 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <Rotate3d className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-sm">Interactive 3D Hopper &amp; Screw Feeder</span>
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                isSteep
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
              }`}>
                {isSteep ? '✓ Mass Flow (C ≥ 70°)' : '⚠ Funnel Flow Warning'}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              W1: {(W1 * 1000).toFixed(0)} mm • L1: {(L1 * 1000).toFixed(0)} mm • W2: {(W2 * 1000).toFixed(0)} mm • h2: {(h2 * 1000).toFixed(0)} mm
            </span>
          </div>
        </div>

        {/* Camera Views & Controls */}
        <div className="flex items-center gap-1.5 flex-wrap self-end sm:self-auto">
          <div className="inline-flex rounded-lg border border-slate-700 p-0.5 bg-slate-800/80 text-[11px]">
            <button
              type="button"
              onClick={() => handlePreset('iso')}
              className={`px-2.5 py-1 rounded transition-colors ${cameraPreset === 'iso' ? 'bg-sky-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'}`}
              title="Isometric Perspective"
            >
              Isometric
            </button>
            <button
              type="button"
              onClick={() => handlePreset('front')}
              className={`px-2.5 py-1 rounded transition-colors ${cameraPreset === 'front' ? 'bg-sky-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'}`}
              title="Front View (Shows Side Wall Angle A)"
            >
              Front (Angle A)
            </button>
            <button
              type="button"
              onClick={() => handlePreset('side')}
              className={`px-2.5 py-1 rounded transition-colors ${cameraPreset === 'side' ? 'bg-sky-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'}`}
              title="Side View (Shows End Wall Angle B)"
            >
              Side (Angle B)
            </button>
            <button
              type="button"
              onClick={() => handlePreset('top')}
              className={`px-2.5 py-1 rounded transition-colors ${cameraPreset === 'top' ? 'bg-sky-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'}`}
              title="Top Plan View"
            >
              Top Plan
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsRotating(!isRotating)}
            className={`p-1.5 rounded-lg border transition-colors ${isRotating ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}
            title={isRotating ? 'Pause Turntable' : 'Auto Turntable Spin'}
          >
            {isRotating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={() => setTranslucent(!translucent)}
            className={`p-1.5 rounded-lg border transition-colors ${translucent ? 'bg-sky-600 border-sky-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}
            title="Toggle Translucent Walls to See Screw Auger & Mash"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setWireframe(!wireframe)}
            className={`p-1.5 rounded-lg border transition-colors ${wireframe ? 'bg-sky-600 border-sky-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}
            title="Toggle Wireframe CAD Mesh"
          >
            <Box className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setShowMashBed(!showMashBed)}
            className={`p-1.5 rounded-lg border transition-colors ${showMashBed ? 'bg-amber-600 border-amber-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}
            title="Toggle Wet Cassava Mash Buffer Bed"
          >
            <Layers className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 transition-colors"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* 3D WebGL Canvas */}
      <div
        ref={mountRef}
        className={`w-full cursor-grab active:cursor-grabbing relative ${isFullscreen ? 'h-[calc(100vh-140px)]' : 'h-[420px]'}`}
      />

      {/* Floating Dynamic Engineering Angles HUD (Top-Left overlay) */}
      <div className="absolute top-16 left-3 pointer-events-none space-y-2 text-xs">
        {/* Angle Cards */}
        <div className="bg-slate-900/90 border border-slate-700/80 p-3 rounded-xl shadow-2xl backdrop-blur-md space-y-2 pointer-events-auto max-w-[280px]">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-sky-400">
              Trigonometrical Angles
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Dynamic Live</span>
          </div>

          {/* Side Wall Angle A */}
          <div className="flex items-center justify-between text-[11px]">
            <div>
              <span className="text-slate-300 font-bold block">Side Slope (Angle A)</span>
              <span className="text-[10px] text-slate-500 font-mono">arctan(h2 / Run_W)</span>
            </div>
            <span className="font-mono font-black text-sky-400 text-sm">
              {angleA}&deg;
            </span>
          </div>

          {/* End Wall Angle B */}
          <div className="flex items-center justify-between text-[11px]">
            <div>
              <span className="text-slate-300 font-bold block">End Slope (Angle B)</span>
              <span className="text-[10px] text-slate-500 font-mono">arctan(h2 / Run_L)</span>
            </div>
            <span className="font-mono font-black text-sky-400 text-sm">
              {angleB}&deg;
            </span>
          </div>

          {/* Corner Valley Angle C */}
          <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
            <div>
              <span className="text-amber-400 font-bold block">Corner Valley (Angle C)</span>
              <span className="text-[10px] text-amber-500/80 font-mono">arccot√(cot²A + cot²B)</span>
            </div>
            <div className="text-right">
              <span className="font-mono font-black text-amber-400 text-base block">
                {angleC}&deg;
              </span>
              <span className="text-[9px] text-emerald-400 font-bold block">
                {isSteep ? 'Standard ≥ 70° OK' : 'Below 70° Standard'}
              </span>
            </div>
          </div>
        </div>

        {/* Dimensions HUD */}
        <div className="bg-slate-900/85 border border-slate-700/60 p-2.5 rounded-xl shadow-lg backdrop-blur-md space-y-1 text-[11px] pointer-events-auto font-mono text-slate-300 max-w-[280px]">
          <div className="flex justify-between">
            <span className="text-slate-400">Top Rim (W1 × L1):</span>
            <span className="font-bold text-white">{(W1 * 1000).toFixed(0)} × {(L1 * 1000).toFixed(0)} mm</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Outlet (W2 × L2):</span>
            <span className="font-bold text-white">{(W2 * 1000).toFixed(0)} × {(L2 * 1000).toFixed(0)} mm</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Collar Height (h1):</span>
            <span className="font-bold text-white">{(h1 * 1000).toFixed(0)} mm</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Frustum Height (h2):</span>
            <span className="font-bold text-emerald-400">{(h2 * 1000).toFixed(0)} mm</span>
          </div>
          <div className="flex justify-between border-t border-slate-800 pt-1">
            <span className="text-slate-400">Total Height (H):</span>
            <span className="font-bold text-white">{(H * 1000).toFixed(0)} mm</span>
          </div>
        </div>
      </div>

      {/* Bottom Status / Reference Banner */}
      <div className="bg-slate-900/90 border-t border-slate-800 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          {isSteep ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          )}
          <span className="text-slate-300">
            <strong>Standard Compliance: </strong>
            {isSteep
              ? `Valley seam angle C = ${angleC}° satisfies the IITA / Kuye et al. standard steepness (≥ 70°) for dewatered cassava cake gravity mass flow.`
              : `Warning: Valley seam angle C = ${angleC}° is below 70° threshold. Cohesive cassava cake will bridge or arch across the outlet.`}
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0 text-[11px] font-mono text-slate-400">
          <span>Run_W: {(hopperDesign.runWidthM * 1000).toFixed(0)} mm</span>
          <span>•</span>
          <span>Run_L: {(hopperDesign.runLengthM * 1000).toFixed(0)} mm</span>
          <span>•</span>
          <span className="text-sky-400">Auger: Ø{(screwD * 1000).toFixed(0)} × {(screwL * 1000).toFixed(0)} mm</span>
        </div>
      </div>
    </div>
  );
};
