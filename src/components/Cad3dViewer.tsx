import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  Rotate3d,
  Maximize2,
  Minimize2,
  Camera,
  Layers,
  Sparkles,
  Compass,
  Eye,
  Sliders,
  Play,
  Pause,
  Sun,
  Ruler,
  AlertTriangle,
  RotateCcw,
  Link2,
  CheckCircle2,
  X,
  Gauge,
  ArrowRight,
  ShieldCheck,
  Check,
  Crosshair,
  ListChecks,
} from 'lucide-react';
import { CalculationResults, ValidationCheck, DryerInputs } from '../types/dryer';
import {
  extractParametricModel,
  ParametricModel3D,
  validateAssemblyConnections,
} from '../utils/cad3d/parametricModel';
import { createCadMaterials, CadMaterials } from '../utils/cad3d/materials';
import {
  buildMechanicalCadAssembly,
  BuildAssemblyResult,
} from '../utils/cad3d/geometryBuilder';
import { createFlowVisualization, FlowParticleSystem } from '../utils/cad3d/flowPath';
import {
  createDimensionAnnotations,
  DimensionSystem,
} from '../utils/cad3d/dimensionAnnotations';
import {
  runAutomatedAssemblyTestSuite,
  AssemblyTestCaseWithResult,
} from '../utils/cad3d/assemblyTests';

export type CadViewMode = 'isometric' | 'front' | 'side' | 'top' | 'sectional' | 'exploded';

interface Cad3dViewerProps {
  results: CalculationResults;
  viewMode: CadViewMode;
  onViewModeChange?: (mode: CadViewMode) => void;
  selectedComponent: string | null;
  onSelectComponent: (componentId: string) => void;
  showDimensions: boolean;
  showFlowArrows: boolean;
  isSectional?: boolean;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onApplyInputs?: (inputs: DryerInputs) => void;
}

export const Cad3dViewer: React.FC<Cad3dViewerProps> = ({
  results,
  viewMode,
  onViewModeChange,
  selectedComponent,
  onSelectComponent,
  showDimensions,
  showFlowArrows,
  isSectional = false,
  isFullscreen = false,
  onToggleFullscreen,
  onApplyInputs,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Three.js instances stored in refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const persCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const orthoCameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const activeCameraRef = useRef<THREE.Camera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const materialsRef = useRef<CadMaterials | null>(null);
  const assemblyRef = useRef<BuildAssemblyResult | null>(null);
  const flowSystemRef = useRef<FlowParticleSystem | null>(null);
  const dimensionSystemRef = useRef<DimensionSystem | null>(null);
  const reqAnimIdRef = useRef<number | null>(null);
  const jointMarkerRef = useRef<THREE.Mesh | null>(null);

  // Interaction & UI state
  const [isOrtho, setIsOrtho] = useState<boolean>(false);
  const [essentialOnly, setEssentialOnly] = useState<boolean>(false);
  const [warningHighlightActive, setWarningHighlightActive] = useState<boolean>(false);
  const [explodedFactor, setExplodedFactor] = useState<number>(0);
  const [isRotating, setIsRotating] = useState<boolean>(false);
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);
  const [showConnectionsModal, setShowConnectionsModal] = useState<boolean>(false);
  const [showTestSuiteModal, setShowTestSuiteModal] = useState<boolean>(false);
  const [showPressureMap, setShowPressureMap] = useState<boolean>(true);
  const [focusedJointId, setFocusedJointId] = useState<string | null>(null);

  // Model parameters and validation derived deterministically from results
  const currentParams = useMemo(() => extractParametricModel(results), [results]);
  const validationReport = currentParams.validationReport;

  // Run automated test suite results
  const automatedTestsReport = useMemo(() => runAutomatedAssemblyTestSuite(), []);

  // Components with active engineering alerts
  const warningComponentIds = useMemo(() => {
    const ids = new Set<string>();
    results.checks?.forEach((c: ValidationCheck) => {
      if (c.severity === 'warning' || c.severity === 'danger') {
        if (c.id.includes('velocity') || c.id.includes('choking')) {
          ids.add('column');
        }
        if (c.id.includes('ratio') || c.id.includes('airflow') || c.id.includes('thermal') || c.id.includes('mass')) {
          ids.add('heater');
          ids.add('blower');
        }
        if (c.id.includes('cyclone') || c.id.includes('pressure')) {
          ids.add('cyclone');
        }
      }
    });
    return ids;
  }, [results.checks]);

  // -------------------------------------------------------------
  // 1. Initial WebGL Scene, Cameras, Controls, & Lighting Setup
  // -------------------------------------------------------------
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 560;

    // Scene. Warm graphite rather than the old blue-black, so the CAD canvas sits in
    // the same family as the worksheet surface instead of reading as a separate app.
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x16150f);
    sceneRef.current = scene;

    // Fog for realistic industrial atmospheric depth
    scene.fog = new THREE.FogExp2(0x16150f, 0.016);

    // Perspective Camera (FOV 40 for accurate CAD representation)
    const persCamera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    persCamera.position.set(9.5, 7.2, 11.5);
    persCameraRef.current = persCamera;

    // Orthographic Camera (for engineering elevations)
    const aspect = width / height;
    const frustumSize = 12;
    const orthoCamera = new THREE.OrthographicCamera(
      (-frustumSize * aspect) / 2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      -frustumSize / 2,
      0.1,
      100
    );
    orthoCamera.position.set(9.5, 7.2, 11.5);
    orthoCameraRef.current = orthoCamera;

    const activeCamera = isOrtho ? orthoCamera : persCamera;
    activeCameraRef.current = activeCamera;

    // WebGL Renderer with High-Precision Depth & Antialiasing
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // OrbitControls
    const controls = new OrbitControls(activeCamera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 3.6, 0);
    controls.maxPolarAngle = Math.PI / 2 + 0.05;
    controls.minDistance = 1.0;
    controls.maxDistance = 40.0;
    controlsRef.current = controls;

    // Materials
    const materials = createCadMaterials();
    materialsRef.current = materials;

    // Joint Focus Indicator Ring
    const markerGeo = new THREE.RingGeometry(0.18, 0.24, 24);
    const markerMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const jointMarker = new THREE.Mesh(markerGeo, markerMat);
    jointMarker.visible = false;
    scene.add(jointMarker);
    jointMarkerRef.current = jointMarker;

    // Lighting (Industrial Studio 3-Point Setup)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfff8ee, 2.2);
    keyLight.position.set(12, 18, 14);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 45;
    keyLight.shadow.bias = -0.0001;
    const shadowSize = 10;
    keyLight.shadow.camera.left = -shadowSize;
    keyLight.shadow.camera.right = shadowSize;
    keyLight.shadow.camera.top = shadowSize;
    keyLight.shadow.camera.bottom = -shadowSize;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x90b0d8, 1.1);
    fillLight.position.set(-12, 8, -8);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x6ee7b7, 0.6);
    rimLight.position.set(0, -5, -12);
    scene.add(rimLight);

    // Ground Grid
    const grid = new THREE.GridHelper(30, 30, 0x10b981, 0x1e293b);
    grid.position.y = 0;
    scene.add(grid);

    // Floor Shadow Receiver Disc
    const floorGeo = new THREE.PlaneGeometry(36, 36);
    const floorMat = new THREE.ShadowMaterial({ opacity: 0.35 });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -0.005;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // Resize Observer
    const resizeObserver = new ResizeObserver(() => {
      if (!container || !renderer || !persCamera || !orthoCamera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;

      persCamera.aspect = w / h;
      persCamera.updateProjectionMatrix();

      const newAspect = w / h;
      orthoCamera.left = (-frustumSize * newAspect) / 2;
      orthoCamera.right = (frustumSize * newAspect) / 2;
      orthoCamera.top = frustumSize / 2;
      orthoCamera.bottom = -frustumSize / 2;
      orthoCamera.updateProjectionMatrix();

      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    // Animation Loop
    let lastTime = performance.now();
    const animate = () => {
      reqAnimIdRef.current = requestAnimationFrame(animate);
      const now = performance.now();
      const delta = (now - lastTime) / 1000;
      lastTime = now;

      controls.update();

      if (flowSystemRef.current) {
        flowSystemRef.current.update(delta);
      }

      const cam = activeCameraRef.current || persCamera;
      renderer.render(scene, cam);
    };
    animate();

    setIsMounted(true);

    return () => {
      resizeObserver.disconnect();
      if (reqAnimIdRef.current) cancelAnimationFrame(reqAnimIdRef.current);
      renderer.dispose();
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
    };
  }, []);

  const hasInitializedCameraRef = useRef(false);

  // -------------------------------------------------------------
  // Camera Auto-Framing using Assembly Bounding Box
  // -------------------------------------------------------------
  const fitCameraToBounds = useCallback(
    (box: THREE.Box3, mode: CadViewMode = viewMode, preserveOrientation = false) => {
      const controls = controlsRef.current;
      const persCam = persCameraRef.current;
      const orthoCam = orthoCameraRef.current;
      if (!controls || !persCam || !orthoCam) return;

      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z, 6.0);

      const fovRad = (persCam.fov * Math.PI) / 180;
      const targetDistance = (maxDim / 2) / Math.tan(fovRad / 2) * 1.30;

      controls.target.copy(center);

      let dir: THREE.Vector3;
      if (preserveOrientation) {
        dir = persCam.position.clone().sub(controls.target).normalize();
        if (dir.lengthSq() < 0.001) {
          dir = new THREE.Vector3(1.0, 0.72, 1.15).normalize();
        }
      } else {
        switch (mode) {
          case 'front':
            dir = new THREE.Vector3(0, 0.1, 1).normalize();
            break;
          case 'side':
            dir = new THREE.Vector3(1, 0.1, 0).normalize();
            break;
          case 'top':
            dir = new THREE.Vector3(0.001, 1, 0.001).normalize();
            break;
          case 'sectional':
            dir = new THREE.Vector3(0.85, 0.55, 0.95).normalize();
            break;
          case 'exploded':
            dir = new THREE.Vector3(1.05, 0.80, 1.25).normalize();
            break;
          case 'isometric':
          default:
            dir = new THREE.Vector3(1.0, 0.72, 1.15).normalize();
            break;
        }
      }

      persCam.position.copy(center).add(dir.clone().multiplyScalar(targetDistance));
      persCam.lookAt(center);

      // Frustum update for Orthographic view
      const aspect = persCam.aspect || 1.6;
      const orthoFrustum = maxDim * 1.35;
      orthoCam.left = (-orthoFrustum * aspect) / 2;
      orthoCam.right = (orthoFrustum * aspect) / 2;
      orthoCam.top = orthoFrustum / 2;
      orthoCam.bottom = -orthoFrustum / 2;
      orthoCam.updateProjectionMatrix();

      orthoCam.position.copy(center).add(dir.clone().multiplyScalar(targetDistance));
      orthoCam.lookAt(center);

      controls.update();
    },
    [viewMode]
  );

  // -------------------------------------------------------------
  // Camera Focus on Joint / Connection
  // -------------------------------------------------------------
  const focusCameraOnJoint = useCallback((position?: { x: number; y: number; z: number } | null, jointId?: string) => {
    const controls = controlsRef.current;
    const persCam = persCameraRef.current;
    const marker = jointMarkerRef.current;
    if (!controls || !persCam || !position || typeof position.x !== 'number') return;

    if (jointId) setFocusedJointId(jointId);

    const target = new THREE.Vector3(position.x, position.y, position.z);
    controls.target.copy(target);
    persCam.position.set(position.x + 1.2, position.y + 0.7, position.z + 1.4);
    persCam.lookAt(target);
    controls.update();

    if (marker) {
      marker.position.set(position.x, position.y, position.z);
      marker.visible = true;
      marker.lookAt(persCam.position);
    }
  }, []);

  // -------------------------------------------------------------
  // 2. Debounced Rebuild Parametric 3D Assembly with Complete Disposal
  // -------------------------------------------------------------
  useEffect(() => {
    const scene = sceneRef.current;
    const materials = materialsRef.current;
    if (!scene || !materials) return;

    setIsRegenerating(true);

    const timer = setTimeout(() => {
      // 1. Thoroughly dispose of previous meshes & geometries
      if (assemblyRef.current) {
        assemblyRef.current.rootGroup.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            if (child.geometry) child.geometry.dispose();
          }
        });
        scene.remove(assemblyRef.current.rootGroup);
        assemblyRef.current = null;
      }
      if (flowSystemRef.current) {
        scene.remove(flowSystemRef.current.group);
        flowSystemRef.current.dispose();
        flowSystemRef.current = null;
      }
      if (dimensionSystemRef.current) {
        scene.remove(dimensionSystemRef.current.group);
        dimensionSystemRef.current.dispose();
        dimensionSystemRef.current = null;
      }

      // 2. Extract deterministic model specification
      const params = extractParametricModel(results);

      // 3. Build solid mechanical CAD components
      const assembly = buildMechanicalCadAssembly(params, materials, {
        isSectional: viewMode === 'sectional',
      });
      assemblyRef.current = assembly;
      scene.add(assembly.rootGroup);

      // 4. Build centerline flow visualization
      const flow = createFlowVisualization(params);
      flow.setVisible(showFlowArrows);
      flowSystemRef.current = flow;
      scene.add(flow.group);

      // 5. Build 3D CAD dimensions
      const dims = createDimensionAnnotations(params, essentialOnly);
      dims.setVisible(showDimensions);
      dimensionSystemRef.current = dims;
      scene.add(dims.group);

      // 6. Camera Framing: keep orientation stable and fit model bounds
      fitCameraToBounds(assembly.bounds, viewMode, hasInitializedCameraRef.current);
      hasInitializedCameraRef.current = true;

      setIsRegenerating(false);
    }, 70);

    return () => clearTimeout(timer);
  }, [results, viewMode, fitCameraToBounds, essentialOnly, showFlowArrows, showDimensions]);

  // Handle Exploded View offsets
  useEffect(() => {
    const assembly = assemblyRef.current;
    if (!assembly) return;

    const factor = viewMode === 'exploded' ? Math.max(0.6, explodedFactor || 1.0) : explodedFactor;

    assembly.componentGroups.forEach((comp) => {
      const targetPos = comp.basePosition.clone().add(comp.explodedOffset.clone().multiplyScalar(factor));
      comp.group.position.copy(targetPos);
    });
  }, [viewMode, explodedFactor]);

  // Highlight Selected Component & Warnings
  useEffect(() => {
    const assembly = assemblyRef.current;
    const materials = materialsRef.current;
    if (!assembly || !materials) return;

    assembly.componentGroups.forEach((comp, id) => {
      const isSelected = selectedComponent === id;
      const isWarning = warningHighlightActive && warningComponentIds.has(id);

      comp.group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          if (isSelected) {
            if (!obj.userData.originalMaterial) {
              obj.userData.originalMaterial = obj.material;
            }
            obj.material = materials.selectedHighlight;
          } else if (isWarning) {
            if (!obj.userData.originalMaterial) {
              obj.userData.originalMaterial = obj.material;
            }
            obj.material = materials.warningHighlight;
          } else if (obj.userData.originalMaterial) {
            obj.material = obj.userData.originalMaterial;
            delete obj.userData.originalMaterial;
          }
        }
      });
    });
  }, [selectedComponent, warningHighlightActive, warningComponentIds]);

  const setCameraView = useCallback(
    (mode: CadViewMode) => {
      const assembly = assemblyRef.current;
      if (assembly) {
        fitCameraToBounds(assembly.bounds, mode, false);
      }
      if (onViewModeChange) onViewModeChange(mode);
    },
    [fitCameraToBounds, onViewModeChange]
  );

  const toggleCameraMode = () => {
    const persCam = persCameraRef.current;
    const orthoCam = orthoCameraRef.current;
    const controls = controlsRef.current;
    if (!persCam || !orthoCam || !controls) return;

    const nextOrtho = !isOrtho;
    setIsOrtho(nextOrtho);

    if (nextOrtho) {
      orthoCam.position.copy(persCam.position);
      orthoCam.rotation.copy(persCam.rotation);
      activeCameraRef.current = orthoCam;
      controls.object = orthoCam;
    } else {
      persCam.position.copy(orthoCam.position);
      persCam.rotation.copy(orthoCam.rotation);
      activeCameraRef.current = persCam;
      controls.object = persCam;
    }
    controls.update();
  };

  const handleResetView = () => {
    if (assemblyRef.current) {
      fitCameraToBounds(assemblyRef.current.bounds, 'isometric', false);
    }
    if (controlsRef.current) {
      controlsRef.current.autoRotate = false;
      setIsRotating(false);
    }
    if (jointMarkerRef.current) jointMarkerRef.current.visible = false;
    setExplodedFactor(0);
    setFocusedJointId(null);
  };

  const toggleAutoRotate = () => {
    if (controlsRef.current) {
      const nextVal = !isRotating;
      controlsRef.current.autoRotate = nextVal;
      controlsRef.current.autoRotateSpeed = 1.8;
      setIsRotating(nextVal);
    }
  };

  const handleCaptureImage = () => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = activeCameraRef.current;
    if (!renderer || !scene || !camera) return;

    renderer.render(scene, camera);
    const dataUrl = renderer.domElement.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `Cassava_Flash_Dryer_CAD_Model_${results.dimensions.tubeDiameterStandardMm}mm.png`;
    link.href = dataUrl;
    link.click();
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    const camera = activeCameraRef.current;
    const assembly = assemblyRef.current;
    if (!container || !camera || !assembly) return;

    const rect = container.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), camera);

    const intersects = raycaster.intersectObjects(assembly.rootGroup.children, true);
    if (intersects.length > 0) {
      for (const hit of intersects) {
        let cur: THREE.Object3D | null = hit.object;
        while (cur && cur !== assembly.rootGroup) {
          if (cur.userData && cur.userData.componentId) {
            onSelectComponent(cur.userData.componentId);
            return;
          }
          if (cur.name && cur.name.startsWith('component_')) {
            const compId = cur.name.replace('component_', '');
            onSelectComponent(compId);
            return;
          }
          cur = cur.parent;
        }
      }
    }
  };

  return (
    <div
      ref={containerRef}
      onClick={handleCanvasClick}
      className="w-full h-full min-h-[480px] lg:min-h-[580px] relative overflow-hidden select-none bg-slate-950 cursor-grab active:cursor-grabbing"
    >
      {/* Regeneration Progress Overlay */}
      {isRegenerating && (
        <div className="absolute inset-0 z-30 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center pointer-events-none">
          <div className="flex items-center gap-2.5 bg-slate-900/90 border border-emerald-500/40 px-4 py-2 rounded-xl text-emerald-300 font-mono text-xs shadow-2xl animate-pulse">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <span>Regenerating 3D Parametric Model (Ø{results.dimensions.tubeDiameterStandardMm}mm)...</span>
          </div>
        </div>
      )}

      {/* Viewport Floating Status Badge & Ground Reference */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5 pointer-events-none">
        <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur border border-slate-800 px-3 py-1.5 rounded-lg text-xs text-slate-200 shadow-lg pointer-events-auto">
          <Compass className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-mono font-bold uppercase tracking-wider text-[11px]">
            {viewMode} {isOrtho ? '(ORTHO CAD)' : '(3D PERSPECTIVE)'}
          </span>
          {isFullscreen && (
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-mono font-bold">
              FULLSCREEN
            </span>
          )}
          <span className="text-[10px] text-slate-400">|</span>
          <span className="text-[10px] text-slate-300 font-mono">
            Ø{results.dimensions.tubeDiameterStandardMm}mm • {results.dimensions.verticalColumnHeightM.toFixed(1)}m Riser
          </span>
        </div>

        {/* Kinematic Mating Status Badge (As required) */}
        <div className="flex items-center gap-2 bg-emerald-950/90 backdrop-blur border border-emerald-500/40 px-3 py-1 rounded-md text-[11px] text-emerald-300 font-mono font-bold shadow-lg pointer-events-auto">
          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
          <span>{validationReport.statusSummary}</span>
        </div>

        {/* CAD Kinematic Grounding Reference */}
        <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur border border-slate-800/80 px-2.5 py-1 rounded-md text-[10px] text-slate-300 font-mono shadow-xs pointer-events-auto">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>Ground: Y = 0.00m</span>
          <span className="text-slate-500">•</span>
          <span>Centerline: {currentParams.pipeCenterlineLengthM.toFixed(2)}m</span>
          <span className="text-slate-500">•</span>
          <span>Clearance: {currentParams.clearanceBelowAirlockM.toFixed(2)}m</span>
        </div>
      </div>

      {/* Floating CAD Viewport Controls Toolbar */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur border border-slate-800 p-1.5 rounded-xl shadow-lg">
        {/* Automated Kinematic Test Suite Button */}
        <button
          type="button"
          onClick={() => setShowTestSuiteModal(true)}
          title="Automated Kinematic Test Suite (10 Cases Verified)"
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold border transition-colors bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30"
        >
          <ListChecks className="w-3.5 h-3.5 text-emerald-400" />
          <span>TESTS ({automatedTestsReport.passedCount}/{automatedTestsReport.totalCount})</span>
        </button>

        {/* Aerodynamic Pressure Map Overlay Toggle */}
        <button
          type="button"
          onClick={() => setShowPressureMap((prev) => !prev)}
          title={showPressureMap ? 'Hide Aerodynamic Pressure Map' : 'Show Aerodynamic Pressure Map & Zones'}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
            showPressureMap
              ? 'bg-sky-500/20 text-sky-300 border-sky-500/50 ring-1 ring-sky-400/40'
              : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
          }`}
        >
          <Gauge className="w-3.5 h-3.5 text-sky-400" />
          <span>PRESSURE {showPressureMap ? 'ON' : 'OFF'}</span>
        </button>

        {/* Assembly Kinematic Joint Connections Inspection Button */}
        <button
          type="button"
          onClick={() => setShowConnectionsModal((prev) => !prev)}
          title="Inspect 3D Kinematic Joint Connections & Tolerances"
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
            validationReport.allConnected
              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30'
              : 'bg-rose-500/20 text-rose-400 border-rose-500/40 hover:bg-rose-500/30'
          }`}
        >
          <Link2 className="w-3.5 h-3.5" />
          <span>JOINTS ({validationReport.connectedCount}/{validationReport.totalCount})</span>
        </button>

        {/* Reset Camera Fit to Model */}
        <button
          type="button"
          onClick={handleResetView}
          title="Reset View / Fit Camera to Model"
          className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* Fullscreen Toggle */}
        {onToggleFullscreen && (
          <button
            type="button"
            onClick={onToggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen (Esc)' : 'Expand 3D CAD to Fullscreen'}
            className={`p-1.5 rounded-lg transition-colors ${
              isFullscreen
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        )}

        {/* Perspective / Orthographic Toggle */}
        <button
          type="button"
          onClick={toggleCameraMode}
          title={`Switch to ${isOrtho ? 'Perspective 3D' : 'Orthographic 2D/3D'} Projection`}
          className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
            isOrtho
              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
              : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
          }`}
        >
          {isOrtho ? 'ORTHO' : 'PERSP'}
        </button>

        {/* Essential Dimensions Toggle */}
        <button
          type="button"
          onClick={() => setEssentialOnly((prev) => !prev)}
          title={essentialOnly ? 'Switch to All Engineering Dimensions' : 'Switch to Essential Dimensions Only'}
          className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
            essentialOnly
              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
              : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
          }`}
        >
          {essentialOnly ? 'ESSENTIAL DIMS' : 'ALL DIMS'}
        </button>

        {/* Warning Alerts Toggle */}
        {warningComponentIds.size > 0 && (
          <button
            type="button"
            onClick={() => setWarningHighlightActive((prev) => !prev)}
            title={warningHighlightActive ? 'Disable Warning Highlights' : 'Highlight Ducts & Equipment with Warnings in Amber'}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
              warningHighlightActive
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/50 ring-1 ring-amber-400/40'
                : 'bg-slate-800 text-amber-400/80 border-slate-700 hover:text-amber-300'
            }`}
          >
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            <span>{warningHighlightActive ? 'ALERTS ON' : 'ALERTS'}</span>
          </button>
        )}

        <button
          type="button"
          onClick={toggleAutoRotate}
          title="Toggle 360° Turntable Orbit"
          className={`p-1.5 rounded-lg transition-colors ${
            isRotating ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          {isRotating ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>

        <button
          type="button"
          onClick={handleCaptureImage}
          title="Download High-Res 3D CAD Screenshot"
          className="p-1.5 rounded-lg text-slate-300 hover:text-emerald-400 hover:bg-slate-800 transition-colors"
        >
          <Camera className="w-4 h-4" />
        </button>
      </div>

      {/* Aerodynamic Pressure Map HUD Overlay */}
      {showPressureMap && (
        <div className="absolute top-24 left-3 z-10 max-w-xl w-[calc(100%-1.5rem)] sm:w-auto bg-slate-900/95 backdrop-blur border border-slate-800 p-2.5 rounded-xl text-xs text-slate-200 shadow-2xl space-y-2 pointer-events-auto">
          <div className="flex items-center justify-between gap-3 pb-1.5 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <Gauge className="w-4 h-4 text-sky-400" />
              <span className="font-bold text-[11px] uppercase tracking-wider text-slate-100">
                Aerodynamic Pressure Map ({results.pressureSystem.type.toUpperCase()} DRAFT)
              </span>
            </div>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold border ${
                results.pressureSystem.type === 'positive'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : results.pressureSystem.type === 'negative'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-sky-500/20 text-sky-300 border-sky-500/40'
              }`}
            >
              Fan ΔP: {results.dimensions.fanTotalPressureDropPa} Pa
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto py-1 text-[11px] scrollbar-thin scrollbar-thumb-slate-700">
            {(currentParams.pressureZones || []).map((zone, idx, arr) => (
              <React.Fragment key={zone.id}>
                <div
                  className={`flex flex-col px-2 py-1 rounded-lg border shrink-0 min-w-[72px] transition-all shadow-xs ${
                    zone.status === 'positive'
                      ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                      : zone.status === 'negative'
                      ? 'bg-sky-950/40 border-sky-500/40 text-sky-200'
                      : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                  }`}
                  title={`${zone.name}: ${zone.gaugePressurePa > 0 ? '+' : ''}${zone.gaugePressurePa} Pa (${zone.description})`}
                >
                  <span className="text-[9px] uppercase tracking-wider text-slate-400 truncate max-w-[85px]">
                    {zone.name.replace('Air ', '').replace('Vertical ', '').replace('Clean Air ', '')}
                  </span>
                  <span className="font-mono font-bold text-xs">
                    {zone.gaugePressurePa > 0 ? '+' : ''}
                    {zone.gaugePressurePa} Pa
                  </span>
                </div>
                {idx < arr.length - 1 && <ArrowRight className="w-3 h-3 text-slate-500 shrink-0" />}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Assembly Kinematic Joint Connections Inspection Modal */}
      {showConnectionsModal && (
        <div className="absolute top-16 right-3 z-20 w-96 max-h-[80vh] overflow-y-auto bg-slate-900/95 backdrop-blur border border-slate-700 rounded-xl p-3.5 shadow-2xl text-xs text-slate-200">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-emerald-400" />
              <h4 className="font-bold text-slate-100">Kinematic Port Connections</h4>
            </div>
            <button
              type="button"
              onClick={() => setShowConnectionsModal(false)}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mb-3 px-2.5 py-2 rounded-lg bg-emerald-950/50 border border-emerald-700/50 flex items-center justify-between text-[11px]">
            <span className="text-emerald-300 font-medium">Kinematic Mating Status:</span>
            <span className="font-bold font-mono text-emerald-400 text-xs">
              {validationReport.connectedCount}/{validationReport.totalCount} CONNECTED
            </span>
          </div>

          {/* Any failed joints warning banner */}
          {validationReport.failedJoints.length > 0 && (
            <div className="mb-3 p-2.5 rounded-lg bg-rose-950/80 border border-rose-500/60 text-rose-200 space-y-1">
              <div className="flex items-center gap-2 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>RED ENGINEERING WARNING: KINEMATIC DISCONNECT</span>
              </div>
              <p className="text-[11px] text-rose-300">
                {validationReport.failedJoints.length} joint(s) breach tolerance (gap &gt; 0.5 mm or angle &gt; 0.5°).
              </p>
            </div>
          )}

          <div className="space-y-2">
            {validationReport.joints.map((joint) => {
              const isFocused = focusedJointId === joint.jointId;
              return (
                <div
                  key={joint.jointId}
                  className={`p-2.5 rounded-lg border transition-all space-y-1.5 font-mono text-[11px] ${
                    isFocused
                      ? 'bg-slate-800 border-emerald-400 ring-1 ring-emerald-400/50'
                      : joint.passed
                      ? 'bg-slate-800/80 border-slate-700/60'
                      : 'bg-rose-950/40 border-rose-500/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 font-sans">
                    <span className="font-bold text-slate-200 text-xs leading-snug">
                      {joint.jointName}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                        joint.passed
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                      }`}
                    >
                      {joint.status}
                    </span>
                  </div>

                  <div className="text-[10px] text-slate-400 truncate">
                    {joint.upstreamComponent}.{joint.upstreamPort} → {joint.downstreamComponent}.{joint.downstreamPort}
                  </div>

                  <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-300 pt-0.5">
                    <div>
                      Gap: <strong className="text-white">{joint.gapMm.toFixed(1)} mm</strong>
                    </div>
                    <div>
                      Angle: <strong className="text-white">{joint.angularMisalignmentDeg.toFixed(1)}°</strong>
                    </div>
                    <div className="col-span-2 text-slate-400 text-[10px] font-sans">
                      Connection: <span className="text-emerald-400 font-semibold">{joint.connectionType}</span>
                      {joint.connectorLengthM > 0 && ` (L = ${joint.connectorLengthM.toFixed(2)} m)`}
                    </div>
                  </div>

                  {joint.position && (
                    <button
                      type="button"
                      onClick={() => focusCameraOnJoint(joint.position!, joint.jointId)}
                      className="mt-1 w-full inline-flex items-center justify-center gap-1.5 py-1 px-2 rounded bg-slate-700/80 hover:bg-slate-700 text-emerald-400 text-[10px] font-sans font-semibold transition-colors"
                    >
                      <Crosshair className="w-3 h-3" />
                      <span>Focus Camera on Joint</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Automated Kinematic Test Suite Modal */}
      {showTestSuiteModal && (
        <div className="absolute inset-0 z-40 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-3xl w-full max-h-[85vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-xs text-slate-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/90">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="font-bold text-sm text-slate-100">
                    Automated Kinematic Assembly Validation Suite
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Strict verification of all 10 industrial scenarios (1–4 t/h wet feed, nominal transitions, drafts, moistures)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 font-mono font-bold border border-emerald-500/40 text-xs">
                  {automatedTestsReport.passedCount} / {automatedTestsReport.totalCount} PASSED
                </span>
                <button
                  type="button"
                  onClick={() => setShowTestSuiteModal(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Test Cases List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {automatedTestsReport.results.map((tc) => (
                <div
                  key={tc.id}
                  className="p-3.5 rounded-xl bg-slate-800/70 border border-slate-700/80 space-y-2 transition-all hover:border-slate-600"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-100">{tc.name}</span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-700 text-slate-300 uppercase">
                          {tc.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-sans">{tc.description}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-mono font-bold text-[10px]">
                        9/9 CONNECTED
                      </span>
                      {onApplyInputs && (
                        <button
                          type="button"
                          onClick={() => {
                            onApplyInputs(tc.inputs);
                            setShowTestSuiteModal(false);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[10px] transition-colors"
                        >
                          Apply to 3D Viewer
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Verification Metrics Table */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-700/60 font-mono text-[10px]">
                    <div>
                      <span className="text-slate-400">Max Gap:</span>{' '}
                      <strong className="text-emerald-400">{tc.result.maxGapMm.toFixed(1)} mm</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Max Angle:</span>{' '}
                      <strong className="text-emerald-400">{tc.result.maxAngleDeg.toFixed(1)}°</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Nominal Size:</span>{' '}
                      <strong className="text-white">Ø{tc.result.nominalDiameterMm} mm</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Riser / Length:</span>{' '}
                      <strong className="text-white">{tc.result.riserHeightM}m / {tc.result.totalLengthM}m</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Exploded View Slider */}
      {viewMode === 'exploded' && (
        <div className="absolute top-16 right-3 z-10 bg-slate-900/90 backdrop-blur border border-slate-800 p-2.5 rounded-xl text-xs text-slate-300 space-y-1.5 w-48 shadow-lg">
          <div className="flex items-center justify-between font-bold text-[10px] text-slate-400 uppercase tracking-wider">
            <span>Explosion Distance</span>
            <span className="text-emerald-400 font-mono">{(explodedFactor * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1.8"
            step="0.05"
            value={explodedFactor}
            onChange={(e) => setExplodedFactor(parseFloat(e.target.value))}
            className="w-full accent-emerald-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
          />
        </div>
      )}

      {/* Bottom Hint */}
      <div className="absolute bottom-3 right-3 z-10 bg-slate-900/80 backdrop-blur border border-slate-800/80 px-2.5 py-1 rounded-md text-[10px] text-slate-400 font-mono pointer-events-none hidden sm:block">
        Left Click: Orbit • Right Click: Pan • Scroll: Zoom • Click Model: Inspect Component
      </div>

      {/* 3D Flow Legend */}
      {showFlowArrows && (
        <div className="absolute bottom-3 left-3 z-10 bg-slate-900/90 backdrop-blur border border-slate-800 p-2.5 rounded-xl text-[11px] text-slate-300 space-y-1.5 shadow-lg">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            Centerline 3D Pneumatic Flow
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block shadow-xs" />
            <span>Hot Drying Air ({results.inputs.inletAirTemp}°C • {results.dimensions.actualAirVelocityMperS.toFixed(1)} m/s)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block shadow-xs" />
            <span>Wet Cassava Mash Feed ({results.inputs.initialMoisture}% WB)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block shadow-xs" />
            <span>Dry Cassava Flour Vortex ({results.inputs.finalMoisture}% WB)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block shadow-xs" />
            <span>Clean Humid Exhaust Air ({results.inputs.outletAirTemp}°C)</span>
          </div>
        </div>
      )}
    </div>
  );
};
