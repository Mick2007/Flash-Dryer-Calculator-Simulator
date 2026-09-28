import * as THREE from 'three';
import { ParametricModel3D } from './parametricModel';

export interface DimensionSystem {
  group: THREE.Group;
  setVisible: (visible: boolean) => void;
  setEssentialOnly: (essentialOnly: boolean) => void;
  dispose: () => void;
}

/**
 * Creates a crisp high-DPI billboard text sprite for 3D CAD dimensions.
 */
function createDimensionBadge(
  text: string,
  subtext: string = '',
  bgColor: string = 'rgba(15, 23, 42, 0.92)',
  textColor: string = '#10b981'
): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;

  // Rounded rectangle container
  ctx.fillStyle = bgColor;
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(8, 8, 496, 144, 20);
  ctx.fill();
  ctx.stroke();

  // Primary dimension text
  ctx.font = 'bold 44px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace';
  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, subtext ? 60 : 80);

  // Secondary subtext
  if (subtext) {
    ctx.font = '500 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(subtext, 256, 112);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;

  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  });

  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.4, 0.44, 1);
  return sprite;
}

/**
 * Creates a CAD dimension line between two 3D points with witness lines.
 */
function createCadDimensionLine(
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  offsetDir: THREE.Vector3,
  offsetDist: number,
  label: string,
  sublabel: string = '',
  isEssential: boolean = true
): THREE.Group {
  const group = new THREE.Group();
  group.userData = { isEssential };

  const normOffset = offsetDir.clone().normalize().multiplyScalar(offsetDist);
  const q1 = p1.clone().add(normOffset);
  const q2 = p2.clone().add(normOffset);

  const lineMat = new THREE.LineBasicMaterial({
    color: 0x10b981,
    transparent: true,
    opacity: 0.85,
    linewidth: 1,
  });

  // Witness line 1: p1 -> q1 (extended slightly)
  const ext1 = q1.clone().add(normOffset.clone().normalize().multiplyScalar(0.1));
  const geoW1 = new THREE.BufferGeometry().setFromPoints([p1, ext1]);
  group.add(new THREE.Line(geoW1, lineMat));

  // Witness line 2: p2 -> q2 (extended slightly)
  const ext2 = q2.clone().add(normOffset.clone().normalize().multiplyScalar(0.1));
  const geoW2 = new THREE.BufferGeometry().setFromPoints([p2, ext2]);
  group.add(new THREE.Line(geoW2, lineMat));

  // Dimension line: q1 -> q2
  const geoDim = new THREE.BufferGeometry().setFromPoints([q1, q2]);
  group.add(new THREE.Line(geoDim, lineMat));

  // Arrowhead ticks at q1 and q2
  const tickSize = 0.08;
  const dir = q2.clone().sub(q1).normalize();
  const perp = new THREE.Vector3().crossVectors(dir, normOffset).normalize().multiplyScalar(tickSize);

  const geoTick1 = new THREE.BufferGeometry().setFromPoints([
    q1.clone().add(perp),
    q1.clone().sub(perp),
  ]);
  group.add(new THREE.Line(geoTick1, lineMat));

  const geoTick2 = new THREE.BufferGeometry().setFromPoints([
    q2.clone().add(perp),
    q2.clone().sub(perp),
  ]);
  group.add(new THREE.Line(geoTick2, lineMat));

  // Center Text Badge (Billboard sprite)
  const midPoint = q1.clone().add(q2).multiplyScalar(0.5);
  const badge = createDimensionBadge(label, sublabel);
  badge.position.copy(midPoint);
  group.add(badge);

  return group;
}

/**
 * Builds realistic 3D CAD dimensions and annotations with Essential-Only filtering.
 */
export function createDimensionAnnotations(params: ParametricModel3D, initialEssentialOnly: boolean = false): DimensionSystem {
  const group = new THREE.Group();
  group.name = '3d_cad_dimension_annotations';

  const venturiOutletX = params.venturiPosition.x + params.venturiThroatLengthM / 2 + params.venturiDivLengthM;
  const riserBaseX = venturiOutletX + params.bendRadiusM;

  // 1. Riser Height Dimension (Vertical alongside riser - ESSENTIAL)
  const riserBottom = new THREE.Vector3(riserBaseX, params.riserBaseYM, 0);
  const riserTop = new THREE.Vector3(riserBaseX, params.riserTopYM, 0);
  group.add(
    createCadDimensionLine(
      riserBottom,
      riserTop,
      new THREE.Vector3(-1, 0, 0),
      0.9,
      `Calculated Riser: ${params.riserHeightM.toFixed(1)} m`,
      `Total Developed Length: ${params.totalLengthM.toFixed(1)} m (Ref min: 20 m)`,
      true
    )
  );

  // 2. Flash Pipe Diameter Dimension (ESSENTIAL)
  const pipeRight = new THREE.Vector3(riserBaseX + params.pipeRadiusM, params.riserBaseYM + 1.2, 0);
  const pipeLeft = new THREE.Vector3(riserBaseX - params.pipeRadiusM, params.riserBaseYM + 1.2, 0);
  const calcDia = params.pipeDiameterCalculatedMm || params.pipeDiameterMm;
  group.add(
    createCadDimensionLine(
      pipeLeft,
      pipeRight,
      new THREE.Vector3(0, 0, 1),
      0.55,
      `Nominal: Ø${params.pipeDiameterMm} mm`,
      `Calculated required: Ø${calcDia.toFixed(1)} mm`,
      true
    )
  );

  // 3. Cyclone Barrel Diameter & Total Height (ESSENTIAL)
  const cyTop = new THREE.Vector3(
    params.cycloneCenterXM,
    params.cycloneBarrelTopYM,
    params.cycloneCenterZM
  );
  const cyBottom = new THREE.Vector3(
    params.cycloneCenterXM,
    params.cycloneDustOutletYM,
    params.cycloneCenterZM
  );
  group.add(
    createCadDimensionLine(
      cyBottom,
      cyTop,
      new THREE.Vector3(1, 0, 0),
      params.cycloneBarrelRadiusM + 0.65,
      `H_cyc = ${params.cycloneTotalHeightM.toFixed(2)} m`,
      `Cyclone Height (Ø${params.cycloneBarrelDiameterMm}mm Barrel)`,
      true
    )
  );

  // 4. Venturi Throat Diameter (DETAILED)
  const vPos = params.venturiPosition;
  const vThTop = new THREE.Vector3(vPos.x, vPos.y + params.venturiThroatRadiusM, vPos.z);
  const vThBot = new THREE.Vector3(vPos.x, vPos.y - params.venturiThroatRadiusM, vPos.z);
  group.add(
    createCadDimensionLine(
      vThBot,
      vThTop,
      new THREE.Vector3(0, -1, 1),
      0.45,
      `Ø${params.venturiThroatDiameterMm} mm`,
      'Venturi Mixing Throat',
      false
    )
  );

  // 5. Heat Exchanger Footprint (DETAILED)
  const hPos = params.hexPosition;
  const hLeft = new THREE.Vector3(hPos.x - params.hexWidthM / 2, 0, hPos.z);
  const hRight = new THREE.Vector3(hPos.x + params.hexWidthM / 2, 0, hPos.z);
  group.add(
    createCadDimensionLine(
      hLeft,
      hRight,
      new THREE.Vector3(0, 0, -1),
      0.65,
      `W = ${params.hexWidthM.toFixed(1)} m`,
      `Heat Exchanger (${params.hexPasses} Passes, ${params.hexDutyKW.toFixed(0)} kW)`,
      false
    )
  );

  // 6. Overall Factory Footprint Span (Length in X: Process Plant - ESSENTIAL)
  const footprintStartX = params.hasUpstreamBlower
    ? params.upstreamBlowerPosition.x - params.upstreamBlowerVoluteRadiusM
    : params.hexPosition.x - params.hexWidthM / 2;
  const footprintEndX = params.hasDownstreamBlower
    ? params.downstreamBlowerPosition.x + params.downstreamBlowerVoluteRadiusM * 0.75 + 0.5
    : params.cycloneCenterXM + params.cycloneBarrelRadiusM;
  const totalPlantLengthM = footprintEndX - footprintStartX;
  group.add(
    createCadDimensionLine(
      new THREE.Vector3(footprintStartX, 0, 0),
      new THREE.Vector3(footprintEndX, 0, 0),
      new THREE.Vector3(0, 0, 1),
      params.cycloneCenterZM + params.cycloneBarrelRadiusM + 1.2,
      `Plant Length = ${totalPlantLengthM.toFixed(1)} m`,
      'Total Ground Installation Footprint',
      true
    )
  );

  function setVisible(visible: boolean) {
    group.visible = visible;
  }

  function setEssentialOnly(essentialOnly: boolean) {
    group.children.forEach((child) => {
      if (child.userData && child.userData.isEssential !== undefined) {
        child.visible = essentialOnly ? child.userData.isEssential : true;
      }
    });
  }

  // Apply initial essentialOnly filter
  if (initialEssentialOnly) {
    setEssentialOnly(true);
  }

  function dispose() {
    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Sprite || obj instanceof THREE.Line) {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      }
    });
  }

  return {
    group,
    setVisible,
    setEssentialOnly,
    dispose,
  };
}
