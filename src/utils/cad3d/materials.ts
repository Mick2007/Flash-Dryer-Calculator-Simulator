import * as THREE from 'three';

export interface CadMaterials {
  stainlessSteel: THREE.MeshStandardMaterial;
  stainlessSteelDark: THREE.MeshStandardMaterial;
  stainlessSteelFlange: THREE.MeshStandardMaterial;
  structuralSteel: THREE.MeshStandardMaterial;
  motorBlue: THREE.MeshStandardMaterial;
  motorDark: THREE.MeshStandardMaterial;
  insulationJacket: THREE.MeshStandardMaterial;
  castIron: THREE.MeshStandardMaterial;
  groundGrid: THREE.LineBasicMaterial;
  selectedHighlight: THREE.MeshStandardMaterial;
  warningHighlight: THREE.MeshStandardMaterial;
  sectionalTransparent: THREE.MeshStandardMaterial;
  sectionalCutInternal: THREE.MeshStandardMaterial;
  brass: THREE.MeshStandardMaterial;
  rubberGasket: THREE.MeshStandardMaterial;
  clearanceZone: THREE.LineBasicMaterial;
}

export function createCadMaterials(): CadMaterials {
  // Industrial 304 Stainless Steel (Satin/brushed, realistic metallic roughness)
  const stainlessSteel = new THREE.MeshStandardMaterial({
    color: 0xd8dde3,
    metalness: 0.88,
    roughness: 0.28,
    side: THREE.DoubleSide,
    name: 'ss304_satin',
  });

  // Darker stainless steel for internal cones or accents
  const stainlessSteelDark = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    metalness: 0.85,
    roughness: 0.35,
    side: THREE.DoubleSide,
    name: 'ss304_dark',
  });

  // Flanges (machined face with subtle contrast)
  const stainlessSteelFlange = new THREE.MeshStandardMaterial({
    color: 0xb0bec5,
    metalness: 0.9,
    roughness: 0.22,
    name: 'ss304_flange',
  });

  // Structural Framework (Painted Carbon Steel, Charcoal / Slate Gray)
  const structuralSteel = new THREE.MeshStandardMaterial({
    color: 0x2a2723,
    metalness: 0.3,
    roughness: 0.6,
    name: 'structural_carbon_steel',
  });

  // Industrial Electric Motors (Standard TEFC Cyan/Blue Machinery Enamel)
  const motorBlue = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    metalness: 0.45,
    roughness: 0.38,
    name: 'machinery_blue_enamel',
  });

  // Motor drive shafts and fan covers
  const motorDark = new THREE.MeshStandardMaterial({
    color: 0x211e1a,
    metalness: 0.7,
    roughness: 0.4,
    name: 'motor_cast_iron',
  });

  // Heat Exchanger Outer Insulation Cladding (Embossed Aluminum Finish)
  const insulationJacket = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.65,
    roughness: 0.42,
    name: 'insulation_cladding',
  });

  // Heavy Cast Iron (Blower Volute & Rotary Airlock Housing)
  const castIron = new THREE.MeshStandardMaterial({
    color: 0x35322c,
    metalness: 0.5,
    roughness: 0.55,
    name: 'machinery_cast_iron',
  });

  // Component Selected Highlight (Vibrant golden/emerald glow outline effect)
  const selectedHighlight = new THREE.MeshStandardMaterial({
    color: 0x10b981,
    emissive: 0x059669,
    emissiveIntensity: 0.55,
    metalness: 0.7,
    roughness: 0.2,
    name: 'selected_highlight',
  });

  // Warning Highlight (Pulsing Amber/Orange for high velocity / airflow deviation alert)
  const warningHighlight = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xd97706,
    emissiveIntensity: 0.5,
    metalness: 0.6,
    roughness: 0.25,
    name: 'warning_highlight',
  });

  // Sectional Cut Transparent Material (for Cutaway View)
  const sectionalTransparent = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    metalness: 0.8,
    roughness: 0.3,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    side: THREE.DoubleSide,
    name: 'sectional_transparent',
  });

  // Sectional Internal Wall / Flow Path
  const sectionalCutInternal = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    metalness: 0.4,
    roughness: 0.5,
    side: THREE.BackSide,
    name: 'sectional_internal',
  });

  // Brass (bearings, nameplates, sight glasses)
  const brass = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    metalness: 0.85,
    roughness: 0.3,
    name: 'brass_hardware',
  });

  // Rubber Gaskets & Seals
  const rubberGasket = new THREE.MeshStandardMaterial({
    color: 0x16150f,
    metalness: 0.05,
    roughness: 0.9,
    name: 'elastomer_gasket',
  });

  const groundGrid = new THREE.LineBasicMaterial({
    color: 0x2a2723,
    transparent: true,
    opacity: 0.4,
  });

  // Maintenance clearance perimeter border
  const clearanceZone = new THREE.LineBasicMaterial({
    color: 0x0ea5e9,
    transparent: true,
    opacity: 0.6,
  });

  return {
    stainlessSteel,
    stainlessSteelDark,
    stainlessSteelFlange,
    structuralSteel,
    motorBlue,
    motorDark,
    insulationJacket,
    castIron,
    groundGrid,
    selectedHighlight,
    warningHighlight,
    sectionalTransparent,
    sectionalCutInternal,
    brass,
    rubberGasket,
    clearanceZone,
  };
}
