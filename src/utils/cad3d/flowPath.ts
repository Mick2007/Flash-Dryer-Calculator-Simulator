import * as THREE from 'three';
import { ParametricModel3D } from './parametricModel';

export interface FlowParticleSystem {
  group: THREE.Group;
  update: (delta: number) => void;
  setVisible: (visible: boolean) => void;
  dispose: () => void;
}

interface ParticleTracker {
  mesh: THREE.Mesh;
  curve: THREE.CatmullRomCurve3;
  progress: number;
  speed: number;
  startColor: THREE.Color;
  endColor: THREE.Color;
}

export function createFlowVisualization(params: ParametricModel3D): FlowParticleSystem {
  const group = new THREE.Group();
  group.name = '3d_flow_visualization';

  const particles: ParticleTracker[] = [];

  // Helper to safely build a CatmullRomCurve3 from points if at least 2 distinct points exist
  const createSafeCurve = (rawPoints: { x: number; y: number; z: number }[] | undefined, defaultPts: THREE.Vector3[]): THREE.CatmullRomCurve3 | null => {
    let pts: THREE.Vector3[] = [];
    if (rawPoints && rawPoints.length >= 2) {
      pts = rawPoints.map(p => new THREE.Vector3(p.x, p.y, p.z));
    } else if (defaultPts && defaultPts.length >= 2) {
      pts = defaultPts;
    }
    if (pts.length < 2) return null;
    return new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.15);
  };

  // Reusable arrow geometry (cone pointer)
  const arrowGeo = new THREE.ConeGeometry(0.045, 0.14, 12);
  arrowGeo.rotateX(Math.PI / 2); // Orient forward along Z

  // 1. Main Pneumatic Drying Path (Venturi -> 7m Riser -> Loops -> Cyclone Inlet)
  const mainCurve = createSafeCurve(params.centerlinePoints, [
    new THREE.Vector3(0, 1.2, 0),
    new THREE.Vector3(3, 8.2, 0),
  ]);
  if (mainCurve) {
    const mainCount = 36;
    for (let i = 0; i < mainCount; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xc2522a });
      const mesh = new THREE.Mesh(arrowGeo, mat);
      group.add(mesh);

      particles.push({
        mesh,
        curve: mainCurve,
        progress: i / mainCount,
        speed: 0.14,
        startColor: new THREE.Color(0xc2522a), // Hot air at inlet
        endColor: new THREE.Color(0x6fa89a),   // Cooling air carrying flour at cyclone
      });
    }
  }

  // 2. Wet Feed Injection Path (Hopper -> Screw -> Venturi)
  const feedCurve = createSafeCurve(params.feedCenterlinePoints, [
    new THREE.Vector3(params.feederPosition.x, params.feederPosition.y + 0.5, 0),
    new THREE.Vector3(params.venturiPosition.x, params.venturiPosition.y, 0),
  ]);
  if (feedCurve) {
    const feedCount = 10;
    for (let i = 0; i < feedCount; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xd8a03a });
      const mesh = new THREE.Mesh(arrowGeo, mat);
      group.add(mesh);

      particles.push({
        mesh,
        curve: feedCurve,
        progress: i / feedCount,
        speed: 0.18,
        startColor: new THREE.Color(0xd8a03a), // Wet cassava mash
        endColor: new THREE.Color(0xc2522a),
      });
    }
  }

  // 3. Cyclone Helical Vortex Separation Path (Spiral down cone into airlock)
  const cyX = params.cycloneCenterXM;
  const cyZ = params.cycloneCenterZM;
  const cyR = params.cycloneBarrelRadiusM;
  const dustR = params.cycloneDustOutletRadiusM;
  const startY = params.cycloneInletYM;
  const endY = params.cycloneDustOutletYM;

  const spiralPoints: THREE.Vector3[] = [];
  const spiralTurns = 4.5;
  const spiralSteps = 45;
  for (let i = 0; i <= spiralSteps; i++) {
    const t = i / spiralSteps;
    const angle = t * spiralTurns * 2 * Math.PI;
    const currR = t < 0.35 ? cyR * 0.85 : (cyR * 0.85 * (1 - (t - 0.35) / 0.65) + dustR * 0.9);
    const currY = startY - t * (startY - endY);
    spiralPoints.push(new THREE.Vector3(
      cyX + currR * Math.cos(angle),
      currY,
      cyZ + currR * Math.sin(angle)
    ));
  }
  spiralPoints.push(new THREE.Vector3(cyX, params.airlockPosition.y, cyZ));
  spiralPoints.push(new THREE.Vector3(cyX, params.clearanceBelowAirlockM * 0.5, cyZ));

  const productCurve = createSafeCurve(spiralPoints, []);
  if (productCurve) {
    const productCount = 18;
    for (let i = 0; i < productCount; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0x6fa89a });
      const mesh = new THREE.Mesh(arrowGeo, mat);
      group.add(mesh);

      particles.push({
        mesh,
        curve: productCurve,
        progress: i / productCount,
        speed: 0.12,
        startColor: new THREE.Color(0x6fa89a), // Dry cassava starch
        endColor: new THREE.Color(0x2f6b5e),
      });
    }
  }

  // 4. Exhaust Air Vortex (Rising up vortex finder)
  const exhaustCurve = createSafeCurve(params.exhaustCenterlinePoints, [
    new THREE.Vector3(cyX, params.cycloneBarrelTopYM + 0.4, cyZ),
    new THREE.Vector3(cyX, params.cycloneBarrelTopYM + 2.0, cyZ),
  ]);
  if (exhaustCurve) {
    const exhaustCount = 12;
    for (let i = 0; i < exhaustCount; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xcfb98a });
      const mesh = new THREE.Mesh(arrowGeo, mat);
      group.add(mesh);

      particles.push({
        mesh,
        curve: exhaustCurve,
        progress: i / exhaustCount,
        speed: 0.20,
        startColor: new THREE.Color(0xcfb98a), // Moisture-laden exhaust vapour
        endColor: new THREE.Color(0x8b877e),
      });
    }
  }

  function update(delta: number) {
    particles.forEach(p => {
      if (!p.curve || !p.mesh) return;
      p.progress += delta * p.speed;
      if (p.progress > 1) {
        p.progress = p.progress % 1;
      }

      // Sample curve position and tangent direction safely
      try {
        const pt = p.curve.getPointAt(p.progress);
        if (!pt || !Number.isFinite(pt.x)) return;

        const tangent = p.curve.getTangentAt(p.progress);
        if (!tangent || !Number.isFinite(tangent.x)) return;
        tangent.normalize();

        p.mesh.position.copy(pt);

        // Orient cone towards tangent direction
        const target = pt.clone().add(tangent);
        p.mesh.lookAt(target);

        // Interpolate color along path
        if (p.mesh.material instanceof THREE.MeshBasicMaterial) {
          p.mesh.material.color.copy(p.startColor).lerp(p.endColor, p.progress);
        }
      } catch {
        // Ignore sampling edge cases
      }
    });
  }

  function setVisible(visible: boolean) {
    group.visible = visible;
  }

  function dispose() {
    particles.forEach(p => {
      p.mesh.geometry.dispose();
      if (Array.isArray(p.mesh.material)) {
        p.mesh.material.forEach(m => m.dispose());
      } else {
        p.mesh.material.dispose();
      }
    });
  }

  return {
    group,
    update,
    setVisible,
    dispose,
  };
}
