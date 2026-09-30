import { describe, it, expect } from 'vitest';
import { calculateFlashDryer } from './dryerCalculations';
import { DEFAULT_DRYER_INPUTS } from './constants';

describe('Flash Dryer Scaling Evaluation 1 - 4 t/h', () => {
  const feedRates = [1000, 2000, 3000, 4000];

  it('evaluates scaling behavior across industrial capacities', () => {
    for (const feed of feedRates) {
      const inputs = {
        ...DEFAULT_DRYER_INPUTS,
        capacityMode: 'feed' as const,
        feedRate: feed,
      };

      const res = calculateFlashDryer(inputs);
      const mb = res.materialBalance;
      const eb = res.energyBalance;
      const fd = res.fluidDynamics;
      const dim = res.dryerDimensions;
      const checks = res.validationChecks;

      // Conservation of mass
      expect(mb.drySolidsKgH).toBeCloseTo(feed * (1 - inputs.initialMoisture / 100), 2);
      expect(mb.waterRemovedKgH + mb.productRateKgH).toBeCloseTo(feed, 1);

      console.log(`\n=================== WET FEED: ${feed} kg/h (${feed / 1000} t/h) ===================`);
      console.log(`Product Output: ${mb.productRateKgH.toFixed(1)} kg/h (${(mb.productRateKgH / 1000).toFixed(3)} t/h) | Moisture: ${inputs.finalMoisture}%`);
      console.log(`Water Evaporated: ${mb.waterRemovedKgH.toFixed(1)} kg/h`);
      console.log(`Drying Air Flow: ${eb.dryAirMassFlowKgH.toFixed(1)} kg_da/h | Volumetric Inlet: ${fd.inletVolumetricFlowM3S.toFixed(2)} m³/s (${fd.inletVolumetricFlowM3H.toFixed(0)} m³/h)`);
      console.log(`Air-to-Starch Ratio: ${eb.airToStarchRatio.toFixed(2)} kg dry air / kg dry starch`);
      console.log(`Burner Heat Duty: ${eb.totalHeatDutyKW.toFixed(1)} kW | Fuel Rate (LPG): ${eb.equivalentFuelRequirement.lpgKgPerHour.toFixed(2)} kg/h`);
      console.log(`SEC: ${(eb.specificEnergyConsumptionKJperKgWater / 1000).toFixed(2)} MJ/kg water | ${eb.specificEnergyConsumptionKJperKgWater.toFixed(0)} kJ/kg water`);
      console.log(`Flash Tube: Standard ${dim.tubeDiameterStandardMm} mm (Calculated ${dim.tubeDiameterCalculatedMm.toFixed(1)} mm)`);
      console.log(`Superficial Velocity: ${dim.actualAirVelocityMperS.toFixed(2)} m/s (Target: ${inputs.airVelocity} m/s)`);
      console.log(`Cyclone: Diameter ${dim.cycloneDiameterMm.toFixed(0)} mm | Total Height ${(dim.cycloneTotalHeightMm / 1000).toFixed(2)} m`);
      console.log(`Cyclone Efficiency: ${dim.cycloneCollectionEfficiencyPercent.toFixed(2)}% | Cut-point d50: ${dim.cutPointD50Microns.toFixed(1)} µm`);
      console.log(`System ΔP: ${dim.fanTotalPressureDropPa.toFixed(0)} Pa | Fan Motor Power: ${dim.fanMotorPowerKW.toFixed(2)} kW`);
      console.log(`Airlock Diameter: ${dim.airlockDiameterMm} mm`);
      console.log(`Heat Exchanger Area: ${res.heatExchangerSpecs.requiredSurfaceAreaM2.toFixed(1)} m² | Face Area: ${res.heatExchangerSpecs.faceAreaM2.toFixed(2)} m²`);
      console.log(`Feeder Screw: ${dim.screwDiameterMm} mm @ ${dim.screwSpeedRpm} RPM | Motor: ${dim.screwRecommendedMotorKW.toFixed(2)} kW`);

      const invalidChecks = checks.filter(c => c.status === 'INVALID');
      const warningChecks = checks.filter(c => c.status === 'WARNING');
      const reviewChecks = checks.filter(c => c.status === 'NEEDS REVIEW');
      console.log(`Checks Summary: Invalid: ${invalidChecks.length}, Warnings: ${warningChecks.length}, Review: ${reviewChecks.length}`);
      if (warningChecks.length > 0) {
        console.log(`  Warnings: ${warningChecks.map(w => `${w.parameterName} [${w.actualValueText} vs ${w.recommendedBand}]`).join('; ')}`);
      }
      if (invalidChecks.length > 0) {
        console.log(`  INVALID: ${invalidChecks.map(w => `${w.parameterName} [${w.actualValueText}]`).join('; ')}`);
      }
    }
  });
});
