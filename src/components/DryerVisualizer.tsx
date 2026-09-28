import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { extractParametricModel } from '../utils/cad3d/parametricModel';
import {
  Eye,
  Rotate3d,
  Maximize2,
  Minimize2,
  Layers,
  ArrowRight,
  Info,
  Sliders,
  CheckCircle2,
  Sparkles,
  Compass,
  FileCode2,
  Box,
  Spline,
  Ruler
} from 'lucide-react';
import { CalculationResults } from '../types/dryer';
import { CadExportModal } from './CadExportModal';
import type { CadViewMode } from './Cad3dViewer';

// three.js is the single largest dependency in this project and the 3D viewer is
// the only consumer of it. Loading it on demand keeps roughly 600 kB of WebGL
// code out of the initial bundle, so the calculator is usable without paying for
// the 3D model until the user actually opens it.
const Cad3dViewer = React.lazy(() =>
  import('./Cad3dViewer').then((m) => ({ default: m.Cad3dViewer })),
);

interface DryerVisualizerProps {
  results: CalculationResults;
  onSelectPressureType?: (type: 'positive' | 'negative' | 'balanced') => void;
}

export const DryerVisualizer: React.FC<DryerVisualizerProps> = ({ results, onSelectPressureType }) => {
  const [viewMode, setViewMode] = useState<CadViewMode>('isometric');
  const [selectedComponent, setSelectedComponent] = useState<string | null>('column');
  const [showDimensions, setShowDimensions] = useState<boolean>(true);
  const [showFlowArrows, setShowFlowArrows] = useState<boolean>(true);
  const [isCadModalOpen, setIsCadModalOpen] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showInspectorInFullscreen, setShowInspectorInFullscreen] = useState<boolean>(true);

  // Toggle fullscreen mode with fallback for iframe sandboxing
  const toggleFullscreen = useCallback(() => {
    if (!isFullscreen) {
      setIsFullscreen(true);
      try {
        if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      } catch {
        // ignore
      }
    } else {
      setIsFullscreen(false);
      try {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      } catch {
        // ignore
      }
    }
  }, [isFullscreen]);

  // Handle ESC key and browser fullscreen change events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
        try {
          if (document.fullscreenElement && document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
          }
        } catch {
          // ignore
        }
      }
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [isFullscreen]);

  const { dimensions, energyBalance, materialBalance, fluidDynamics, inputs, heatExchanger } = results;

  // Engineering geometry parameters in millimeters / meters
  const D_tube_mm = Number.isFinite(dimensions?.tubeDiameterStandardMm) ? dimensions.tubeDiameterStandardMm : 180;
  const H_col_m = Number.isFinite(dimensions?.verticalColumnHeightM) ? dimensions.verticalColumnHeightM : 7.0;
  const D_cyclone_mm = Number.isFinite(dimensions?.cycloneDiameterMm) ? dimensions.cycloneDiameterMm : 650;
  const H_cyclone_mm = Number.isFinite(dimensions?.cycloneTotalHeightMm) ? dimensions.cycloneTotalHeightMm : 2600;
  const D_venturi_mm = Number.isFinite(dimensions?.venturiThroatDiameterMm) ? dimensions.venturiThroatDiameterMm : Math.round(D_tube_mm * 0.75);
  const D_screw_mm = Number.isFinite(dimensions?.screwDiameterMm) ? dimensions.screwDiameterMm : 150;

  // ITEM 16: the 3D model's own centreline length, for display against the engine
  // figure. Extracted here so the readout can state whether the drawing actually
  // matches the design. The parametric model is the same object the viewer builds
  // from, so these numbers describe the assembly on screen.
  const parametricModel = useMemo(() => extractParametricModel(results), [results]);
  const modelCenterlineM = parametricModel.pipeCenterlineLengthM;
  const modelLengthDeltaPercent = parametricModel.pipeLengthDifferencePercent;

  // Component description & engineering specifications lookup
  const getComponentDetails = (comp: string) => {
    switch (comp) {
      case 'column':
      case 'pipe':
      case 'drying_tube':
      case 'flash_pipe_system':
        return {
          title: `Vertical Flash Drying Pipe (${H_col_m.toFixed(1)}m Riser & Loops)`,
          category: 'Pneumatic Conveying Riser',
          specs: [
            { label: 'Nominal Pipe Diameter', val: `Ø${D_tube_mm} mm (Selected standard catalogue size)` },
            { label: 'Calculated Required Diameter', val: `Ø${dimensions.tubeDiameterCalculatedMm.toFixed(1)} mm (Theoretical requirement)` },
            { label: 'Riser Height', val: `${H_col_m.toFixed(1)} meters (CIRAD Standard)` },
            { label: 'Total Developed Length', val: `${dimensions.totalPipeLengthM.toFixed(1)} meters (CIRAD L ≥ 20m)` },
            // ITEM 16: the 3D model's own centreline length, against the engine
            // figure. This was computed and discarded, so a model that was 3.5 m
            // short of the design still looked correct. It is now shown.
            { label: '3D Model Centreline', val: `${modelCenterlineM.toFixed(2)} m modelled (${modelLengthDeltaPercent >= 0 ? '+' : ''}${modelLengthDeltaPercent.toFixed(2)}% vs design)` },
            { label: 'Actual Air Velocity', val: `${dimensions.actualAirVelocityMperS.toFixed(1)} m/s` },
            { label: 'Residence Time', val: `${dimensions.estimatedResidenceTimeSec.toFixed(2)} seconds` },
            { label: 'Fabrication Schedule', val: 'Nominal size is a selected standard fabrication value; final verification required' },
            { label: 'Spool Connections', val: 'PN10 Flanged spools with EPDM food-grade gaskets' },
            { label: 'Pipe Elbows', val: '3D Long-Radius (R = 1.5 - 2.0 D) smooth swept bends' },
            { label: 'Material', val: 'AISI 304 Stainless Steel (Satin/Sanitary finish)' },
          ],
          desc: 'Primary vertical pneumatic conveying riser where rapid convective heat transfer takes place between hot air and suspended cassava granules. Nominal size is a selected standard fabrication value; final pressure-drop, velocity, and mechanical verification are required before manufacture.',
        };
      case 'cyclone':
      case 'cyclone_separator':
        return {
          title: `${dimensions.cycloneType === 'stairmand' ? 'Stairmand High-Efficiency' : 'Lapple'} Cyclone Separator`,
          category: 'Centrifugal Gas-Solid Separator',
          specs: [
            { label: 'Barrel Diameter (Dc)', val: `${D_cyclone_mm} mm` },
            { label: 'Total Height (H)', val: `${H_cyclone_mm} mm` },
            { label: 'Cylinder Height (h)', val: `${dimensions.cycloneCylinderHeightMm} mm` },
            { label: 'Cone Height (B)', val: `${dimensions.cycloneConeHeightMm} mm` },
            { label: 'Vortex Finder (De)', val: `${dimensions.cycloneVortexFinderDiameterMm} mm` },
            { label: 'Inlet Velocity', val: `${dimensions.cycloneInletVelocityMperS.toFixed(1)} m/s` },
            { label: 'Pressure Drop (ΔP)', val: `${dimensions.cyclonePressureDropPa.toFixed(0)} Pa` },
            { label: 'Material & Finish', val: 'AISI 304 Stainless Steel with rolled cone plates' },
          ],
          desc: 'Centrifugal vortex separator designed according to Stairmand / Lapple standard proportions, disengaging dry cassava flour from humid exhaust air with >98% separation efficiency.',
        };
      case 'feeder':
      case 'screw_feeder':
        return {
          title: 'Wet Cassava Mash Feeder & Lump Disintegrator',
          category: 'Material Metering & Disintegration',
          specs: [
            { label: 'Screw Diameter', val: `${D_screw_mm} mm` },
            { label: 'Screw Pitch', val: `${dimensions.screwPitchMm} mm` },
            { label: 'Rotational Speed', val: `${dimensions.screwSpeedRpm} RPM (Variable Inverter Drive)` },
            { label: 'Feed Rate', val: `${materialBalance.feedRateKgH.toFixed(1)} kg/h wet mash` },
            { label: 'Feeder Hopper', val: 'Sloped sheet-metal hopper with top reinforcement rim' },
            { label: 'Disintegrator Rotor', val: 'High-speed pin rotor breaking cohesive dewatered cake' },
            { label: 'Drive Motor', val: '0.75 kW TEFC Inverter-Duty Geared Motor' },
          ],
          desc: 'Variable-speed metering screw conveyor fitted with a high-speed pin disintegrator rotor to break cohesive dewatered cassava filter-cake into fine particles before injection into the venturi.',
        };
      case 'venturi':
      case 'venturi_section':
        return {
          title: 'Venturi Gas Accelerator & Mixing Throat',
          category: 'Pneumatic Injection & Dispersion',
          specs: [
            { label: 'Throat Diameter (Dt)', val: `${D_venturi_mm} mm (75% of main pipe diameter)` },
            { label: 'Throat Air Velocity', val: `${dimensions.venturiThroatVelocityMperS.toFixed(1)} m/s` },
            { label: 'Convergent Angle', val: '21° included angle for minimum turbulence loss' },
            { label: 'Divergent Angle', val: '7° gentle expansion angle to prevent boundary separation' },
            { label: 'Inlet Air Temp', val: `${inputs.inletAirTemp}°C` },
            { label: 'Inspection Port', val: 'Quick-release sanitary clamp cleanout door' },
          ],
          desc: 'Venturi convergence accelerates drying air to ~25 m/s, generating high turbulent shear to instantly disperse wet cassava clumps into the pneumatic stream without wall sticking.',
        };
      case 'heater':
      case 'heat_exchanger':
        return {
          title: `Multi-Pass Air Heat Exchanger (${heatExchanger.numberOfPasses} Passes)`,
          category: 'Thermal Energy Generation',
          specs: [
            { label: 'Specified Passes', val: `${heatExchanger.numberOfPasses} Passes (${heatExchanger.type === 'cross_flow_finned' ? 'Finned Tubes' : 'Bare Tubes'})` },
            { label: 'Required Heat Transfer Area', val: `${heatExchanger.surfaceAreaM2.toFixed(1)} m²` },
            { label: 'Thermal Duty', val: `${heatExchanger.thermalDutyKW.toFixed(1)} kW (${heatExchanger.thermalDutyKcalH.toFixed(0)} kcal/h)` },
            { label: 'Tube Layout', val: `${heatExchanger.totalTubesCount} tubes (${heatExchanger.tubesPerPass} tubes/pass)` },
            { label: 'Tube Length per Pass', val: `${heatExchanger.tubeLengthPerPassM.toFixed(1)} meters` },
            { label: 'Effective LMTD', val: `${heatExchanger.effectiveLmtdC.toFixed(1)} °C (Ft = ${heatExchanger.correctionFactorFt})` },
            { label: 'Air-Side Pressure Drop (ΔP)', val: `${heatExchanger.airSidePressureDropPa} Pa` },
            { label: 'Air Temperature Span', val: `${inputs.ambientTemp}°C → ${inputs.inletAirTemp}°C` },
          ],
          desc: `Supplies clean, uncontaminated hot drying air using a ${heatExchanger.numberOfPasses}-pass cross-flow heat exchanger bundle. Increasing passes enhances thermal effectiveness (F_t) while maintaining uniform temperature distribution.`,
        };
      case 'blower':
      case 'blower_fan':
      case 'centrifugal_blower':
      case 'upstream_blower':
      case 'downstream_blower':
      case 'blower_fan_upstream':
      case 'blower_fan_downstream': {
        const pType = results.pressureSystem?.type ?? 'negative';
        const isPos = pType === 'positive';
        const isNeg = pType === 'negative';
        const isBal = pType === 'balanced';

        const blowerTitle = isPos
          ? 'Upstream Forced-Draft Blower Fan Assembly'
          : isNeg
          ? 'Downstream Induced-Draft Exhaust Fan Assembly'
          : 'Dual-Fan Balanced Draft System (Supply FD + Exhaust ID)';

        const blowerPositionDesc = isPos
          ? 'Upstream: Grounded on floor skid before Air Heat Exchanger'
          : isNeg
          ? 'Downstream: Grounded on floor skid adjacent to Cyclone Separator'
          : 'Dual-Fan: Upstream Supply Fan (before Heater) + Downstream Exhaust Fan (after Cyclone)';

        const airflowDirDesc = isPos
          ? 'Ambient Air → FD Blower → Air Heater → Venturi Mixer → Flash Riser → Cyclone → Atmospheric Sweep Stack'
          : isNeg
          ? 'Ambient Air → Intake Weather Hood → Air Heater → Venturi Mixer → Flash Riser → Cyclone → Overhead Suction Duct → ID Exhaust Fan → Vertical Stack'
          : 'Ambient Air → FD Supply Fan → Air Heater → Venturi (~0 Pa Neutral Point) → Flash Riser → Cyclone → Overhead Suction Duct → ID Exhaust Fan → Vertical Stack';

        const processPressureDesc = isPos
          ? `+${results.pressureSystem.feederGaugePressurePa} Pa at Venturi / +${results.pressureSystem.ductGaugePressurePa} Pa in Flash Tube`
          : isNeg
          ? `${results.pressureSystem.feederGaugePressurePa} Pa at Venturi / ${results.pressureSystem.ductGaugePressurePa} Pa in Flash Tube`
          : `0 Pa (Neutral Reference Point) at Venturi / ${results.pressureSystem.ductGaugePressurePa} Pa in Flash Tube`;

        return {
          title: blowerTitle,
          category: `Pneumatic Draft & Pressure System (${pType.toUpperCase()})`,
          specs: [
            { label: 'Pressure Mode', val: isPos ? 'Positive Pressure (Forced Draft)' : isNeg ? 'Negative Pressure (Induced Draft)' : 'Balanced Draft (Push-Pull)' },
            { label: 'Blower Position', val: blowerPositionDesc },
            { label: 'Airflow Direction', val: airflowDirDesc },
            { label: 'Process Pressure', val: processPressureDesc },
            { label: 'Pressure Differential (ΔP)', val: `${dimensions.fanTotalPressureDropPa} Pa (${(dimensions.fanTotalPressureDropPa / 9.81).toFixed(0)} mmH2O)` },
            { label: 'Motor Rating', val: isBal ? `Supply FD: ${(dimensions.fanMotorPowerKW * 0.45).toFixed(1)} kW • Exhaust ID: ${(dimensions.fanMotorPowerKW * 0.55).toFixed(1)} kW (Total ${(dimensions.fanMotorPowerKW).toFixed(1)} kW)` : `${dimensions.fanMotorPowerKW.toFixed(1)} kW (1450 RPM TEFC)` },
            { label: 'Volumetric Flow', val: `${fluidDynamics.inletVolumetricFlowM3H.toFixed(0)} m³/h (${fluidDynamics.inletVolumetricFlowM3S.toFixed(3)} m³/s)` },
            { label: 'Air Handled', val: results.pressureSystem.fanAirCondition },
            { label: 'Impeller Wear Risk', val: results.pressureSystem.fanWearAndFoulingRisk },
            { label: 'Dust Leakage Risk', val: results.pressureSystem.dustLeakageRisk },
          ],
          desc: results.pressureSystem.operatingPrinciple,
        };
      }
      case 'rotary':
      case 'airlock':
      case 'rotary_airlock':
        return {
          title: 'Product Discharge Rotary Airlock Valve',
          category: 'Pressure Seal & Solids Discharge',
          specs: [
            { label: 'Rotor Size', val: '150 mm (6-inch) 8-vane closed-pocket rotor' },
            { label: 'Output Capacity', val: `${materialBalance.productRateKgH.toFixed(1)} kg/h dry flour` },
            { label: 'Drive Motor', val: '0.37 kW Geared Motor (20 RPM)' },
            { label: 'Air Seal', val: 'Viton wiper blades preventing atmospheric air ingress' },
            { label: 'Discharge Chute', val: 'Direct flange connection to bagging hopper' },
          ],
          desc: 'Airlock rotary valve discharging dried cassava flour into bagging container while preventing atmospheric air ingress into the cyclone under negative pressure.',
        };
      case 'structure':
      case 'support_frame':
        return {
          title: 'Structural Steel Support Framework & Skids',
          category: 'Civil & Structural Mechanical Engineering',
          specs: [
            { label: 'Main Columns', val: '100 x 100 x 4.0 mm HSS Square Hollow Section' },
            { label: 'Framework Height', val: `${(H_col_m + 1.2).toFixed(1)} meters (Elevated Riser Tower)` },
            { label: 'Tie Beams & Braces', val: '80 x 80 mm Structural Channel & K-Truss Braces' },
            { label: 'Pipe Guide Clamps', val: 'Heavy-duty rubber-lined saddles at 2.4m & 4.8m' },
            { label: 'Cyclone Support', val: '4-leg welded support tower with perimeter ring beam' },
            { label: 'Footing Baseplates', val: '220 x 220 x 12 mm baseplates with M16 anchor bolts' },
            { label: 'Protective Coating', val: 'Two-pack epoxy primer with polyurethane industrial enamel' },
          ],
          desc: 'Rigid structural steel framework designed to withstand dynamic pneumatic vibration, wind loads, and thermal expansion while providing safe access platforms.',
        };
      default:
        return {
          title: 'Flash Dryer Mechanical Assembly',
          category: 'Subsystem',
          specs: [],
          desc: 'Click on any 3D component in the viewport to inspect its calculated engineering dimensions and specifications.',
        };
    }
  };

  const activeDetails = getComponentDetails(selectedComponent || 'column');

  return (
    <div
      className={
        isFullscreen
          ? 'fixed inset-0 z-50 bg-slate-950 flex flex-col w-screen h-screen overflow-hidden text-slate-100 select-none animate-in fade-in duration-150'
          : 'bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden space-y-0 relative'
      }
    >
      {/* Top Simulator Control Ribbon */}
      <div
        className={
          isFullscreen
            ? 'p-2.5 sm:p-3 border-b border-slate-800 bg-slate-900/95 backdrop-blur flex flex-col md:flex-row md:items-center justify-between gap-2.5 shrink-0 z-10'
            : 'p-3 sm:p-4 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-3'
        }
      >
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-emerald-600 text-white shadow-xs">
            <Box className="w-4 h-4" />
          </div>
          <div>
            <h3
              className={
                isFullscreen
                  ? 'text-sm font-bold text-white flex items-center gap-2'
                  : 'text-sm font-bold text-slate-900 flex items-center gap-2'
              }
            >
              <span>Parametric 3D Mechanical CAD {isFullscreen ? 'Studio' : 'Assembly'}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold uppercase tracking-wider border border-emerald-500/30">
                {isFullscreen ? 'FULLSCREEN IMMERSION' : 'True 3D Solids'}
              </span>
            </h3>
            <p className={isFullscreen ? 'text-xs text-slate-400' : 'text-xs text-slate-500'}>
              Parametrically regenerated • Pipe Ø{D_tube_mm}mm • Riser {H_col_m.toFixed(1)}m • {dimensions.totalPipeLengthM.toFixed(1)}m Total Developed Length
            </p>
          </div>
        </div>

        {/* View Mode & CAD Action Buttons */}
        <div className="flex items-center flex-wrap gap-1.5">
          {/* Camera View Switcher */}
          <div
            className={
              isFullscreen
                ? 'inline-flex rounded-lg border border-slate-700 p-0.5 bg-slate-800 text-xs shadow-xs'
                : 'inline-flex rounded-lg border border-slate-300 p-0.5 bg-white text-xs shadow-xs'
            }
          >
            <button
              type="button"
              onClick={() => setViewMode('isometric')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                viewMode === 'isometric'
                  ? isFullscreen
                    ? 'bg-emerald-600 text-white font-bold shadow-xs'
                    : 'bg-slate-900 text-white font-bold shadow-xs'
                  : isFullscreen
                  ? 'text-slate-300 hover:text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Isometric 3D
            </button>
            <button
              type="button"
              onClick={() => setViewMode('front')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                viewMode === 'front'
                  ? isFullscreen
                    ? 'bg-emerald-600 text-white font-bold shadow-xs'
                    : 'bg-slate-900 text-white font-bold shadow-xs'
                  : isFullscreen
                  ? 'text-slate-300 hover:text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Front Elevation
            </button>
            <button
              type="button"
              onClick={() => setViewMode('side')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                viewMode === 'side'
                  ? isFullscreen
                    ? 'bg-emerald-600 text-white font-bold shadow-xs'
                    : 'bg-slate-900 text-white font-bold shadow-xs'
                  : isFullscreen
                  ? 'text-slate-300 hover:text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Side View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('top')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                viewMode === 'top'
                  ? isFullscreen
                    ? 'bg-emerald-600 text-white font-bold shadow-xs'
                    : 'bg-slate-900 text-white font-bold shadow-xs'
                  : isFullscreen
                  ? 'text-slate-300 hover:text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Top Footprint
            </button>
            <button
              type="button"
              onClick={() => setViewMode('sectional')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                viewMode === 'sectional'
                  ? 'bg-emerald-600 text-white font-bold shadow-xs'
                  : isFullscreen
                  ? 'text-slate-300 hover:text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sectional Flow
            </button>
            <button
              type="button"
              onClick={() => setViewMode('exploded')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                viewMode === 'exploded'
                  ? 'bg-amber-600 text-white font-bold shadow-xs'
                  : isFullscreen
                  ? 'text-slate-300 hover:text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Exploded View
            </button>
          </div>

          {/* Toggle Dimensions */}
          <button
            type="button"
            onClick={() => setShowDimensions(!showDimensions)}
            className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
              showDimensions
                ? isFullscreen
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-semibold'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold'
                : isFullscreen
                ? 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
            }`}
          >
            Dimensions {showDimensions ? 'ON' : 'OFF'}
          </button>

          {/* Toggle Flow Arrows */}
          <button
            type="button"
            onClick={() => setShowFlowArrows(!showFlowArrows)}
            className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
              showFlowArrows
                ? isFullscreen
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-semibold'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold'
                : isFullscreen
                ? 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
            }`}
          >
            Flow Arrows {showFlowArrows ? 'ON' : 'OFF'}
          </button>

          {/* Aerodynamic Pressure Mode Selector & Status Chip */}
          {onSelectPressureType ? (
            <div
              className={`inline-flex rounded-lg border p-0.5 text-xs font-semibold shadow-xs ${
                isFullscreen
                  ? 'border-slate-700 bg-slate-800'
                  : 'border-slate-300 bg-white'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectPressureType('negative')}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  results.pressureSystem.type === 'negative'
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-xs'
                    : isFullscreen
                    ? 'text-slate-300 hover:text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Negative Pressure: Downstream ID Fan after Cyclone"
              >
                (-) Negative
              </button>
              <button
                type="button"
                onClick={() => onSelectPressureType('positive')}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  results.pressureSystem.type === 'positive'
                    ? 'bg-amber-400 text-slate-950 font-bold shadow-xs'
                    : isFullscreen
                    ? 'text-slate-300 hover:text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Positive Pressure: Upstream FD Blower before Heater"
              >
                (+) Positive
              </button>
              <button
                type="button"
                onClick={() => onSelectPressureType('balanced')}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  results.pressureSystem.type === 'balanced'
                    ? 'bg-sky-400 text-slate-950 font-bold shadow-xs'
                    : isFullscreen
                    ? 'text-slate-300 hover:text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Balanced Draft: Push-Pull Dual Fan (FD Supply + ID Exhaust)"
              >
                (±) Balanced
              </button>
            </div>
          ) : (
            <div
              className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${
                results.pressureSystem.type === 'negative'
                  ? isFullscreen
                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/80'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : results.pressureSystem.type === 'positive'
                  ? isFullscreen
                    ? 'bg-amber-950/60 text-amber-300 border-amber-800/80'
                    : 'bg-amber-50 text-amber-800 border-amber-300'
                  : isFullscreen
                  ? 'bg-sky-950/60 text-sky-300 border-sky-800/80'
                  : 'bg-sky-50 text-sky-800 border-sky-300'
              }`}
              title={results.pressureSystem.summary}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  results.pressureSystem.type === 'negative'
                    ? 'bg-emerald-500'
                    : results.pressureSystem.type === 'positive'
                    ? 'bg-amber-500'
                    : 'bg-sky-500'
                }`}
              />
              <span>{results.pressureSystem.badgeLabel}</span>
              <span className="font-mono text-[10px] opacity-80">
                ({results.pressureSystem.ductGaugePressurePa > 0 ? '+' : ''}
                {results.pressureSystem.ductGaugePressurePa} Pa)
              </span>
            </div>
          )}

          {/* Toggle Inspector Panel (Fullscreen Mode) */}
          {isFullscreen && (
            <button
              type="button"
              onClick={() => setShowInspectorInFullscreen(!showInspectorInFullscreen)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                showInspectorInFullscreen
                  ? 'bg-slate-800 text-emerald-400 border-slate-700 hover:bg-slate-700'
                  : 'bg-slate-800/70 text-slate-300 border-slate-700 hover:text-white'
              }`}
              title={showInspectorInFullscreen ? 'Collapse Inspector to Maximize 3D Viewport' : 'Show Component Inspector Specs'}
            >
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              <span>{showInspectorInFullscreen ? 'Hide Inspector' : 'Show Inspector'}</span>
            </button>
          )}

          {/* Export CAD */}
          <button
            type="button"
            onClick={() => setIsCadModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs border border-slate-700"
          >
            <FileCode2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export CAD (.DXF / .SVG)</span>
          </button>

          {/* Fullscreen 3D Toggle Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen Mode (Esc)' : 'Expand 3D CAD Studio to Fullscreen'}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all shadow-xs border ${
              isFullscreen
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-400 font-extrabold ring-2 ring-amber-400/40'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 hover:shadow-md'
            }`}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen 3D'}</span>
            {isFullscreen && <span className="text-[10px] font-mono opacity-80">(Esc)</span>}
          </button>
        </div>
      </div>

      {/* Main 3D Viewport & Mechanical Inspection Layout */}
      <div
        className={
          isFullscreen
            ? 'flex-1 flex flex-col lg:flex-row overflow-hidden relative'
            : 'grid grid-cols-1 lg:grid-cols-12 gap-0'
        }
      >
        {/* Three.js Parametric 3D CAD Canvas */}
        <div
          className={
            isFullscreen
              ? 'flex-1 h-full bg-slate-950 flex flex-col relative overflow-hidden'
              : 'lg:col-span-8 bg-slate-950 flex flex-col relative min-h-[500px] lg:min-h-[600px] overflow-hidden'
          }
        >
          <React.Suspense
            fallback={
              <div className="flex-1 flex items-center justify-center bg-slate-950 text-slate-400 text-xs font-mono tracking-wider uppercase">
                Loading 3D assembly…
              </div>
            }
          >
            <Cad3dViewer
              results={results}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              selectedComponent={selectedComponent}
              onSelectComponent={setSelectedComponent}
              showDimensions={showDimensions}
              showFlowArrows={showFlowArrows}
              isSectional={viewMode === 'sectional'}
              isFullscreen={isFullscreen}
              onToggleFullscreen={toggleFullscreen}
            />
          </React.Suspense>
        </div>

        {/* Component Inspection Sidebar */}
        {(!isFullscreen || showInspectorInFullscreen) && (
          <div
            className={
              isFullscreen
                ? 'w-full lg:w-96 bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 p-4 sm:p-5 flex flex-col justify-between text-slate-200 overflow-y-auto shrink-0 shadow-2xl'
                : 'lg:col-span-4 bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 p-4 sm:p-5 flex flex-col justify-between text-slate-200'
            }
          >
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    COMPONENT INSPECTOR
                  </span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                  Parametric 3D
                </span>
              </div>

              {/* Component Selector Buttons */}
              <div className="flex flex-wrap gap-1.5 py-3 border-b border-slate-800">
                {[
                  { id: 'column', label: 'Flash Tube' },
                  { id: 'cyclone', label: 'Cyclone' },
                  { id: 'venturi', label: 'Venturi Mixer' },
                  { id: 'feeder', label: 'Screw Feeder' },
                  { id: 'heater', label: 'Air Heater' },
                  { id: 'blower', label: 'Blower Fan' },
                  { id: 'rotary', label: 'Rotary Valve' },
                  { id: 'structure', label: 'Support Frame' },
                ].map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedComponent(c.id)}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                      selectedComponent === c.id
                        ? 'bg-emerald-500 text-slate-950 font-bold shadow-xs'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              {/* Active Component Details Card */}
              <div className="py-3 space-y-3">
                <div>
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-xs" />
                      {activeDetails.title}
                    </h4>
                  </div>
                  <div className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider mt-0.5">
                    {activeDetails.category}
                  </div>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    {activeDetails.desc}
                  </p>
                </div>

                {/* Engineering Specs Table */}
                <div className="bg-slate-950/90 rounded-lg p-3 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Calculated Engineering Specifications
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono">1:1 Metric Scale</span>
                  </div>
                  {activeDetails.specs.map((s, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs py-1 border-b border-slate-800/60 last:border-0"
                    >
                      <span className="text-slate-400">{s.label}:</span>
                      <span className="font-semibold text-emerald-300 text-right">{s.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Fabrication & CAD Integrity Notice */}
            <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-400 space-y-1">
              <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
                <Info className="w-3.5 h-3.5" />
                <span>Preliminary Mechanical CAD Notice</span>
              </div>
              <p className="text-[10px] leading-relaxed text-slate-400">
                3D geometry is parametrically linked to CIRAD / IITA heat &amp; mass balance calculations. Orbit with left click, pan with right click, and scroll to zoom.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 2D CAD Blueprint Export Modal (.DXF / .SVG) */}
      <CadExportModal
        results={results}
        isOpen={isCadModalOpen}
        onClose={() => setIsCadModalOpen(false)}
      />
    </div>
  );
};
