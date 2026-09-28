import type { jsPDF } from 'jspdf';
import type { CalculationResults } from '../types/dryer';

/**
 * Sanitizes strings for jsPDF standard Helvetica font to prevent glyph glitches
 * (e.g. replacing Greek letters, arrows, degree symbols, and special unicode math symbols).
 */
function cleanPdfText(text: string): string {
  if (!text) return '';
  return String(text)
    .replace(/→/g, ' -> ')
    .replace(/←/g, ' <- ')
    .replace(/Δ/g, 'Delta_')
    .replace(/δ/g, 'delta_')
    .replace(/µ/g, 'u')
    .replace(/·/g, '*')
    .replace(/×/g, 'x')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/°/g, ' deg ')
    .replace(/π/g, 'pi')
    .replace(/τ/g, 'tau')
    .replace(/ρ/g, 'rho')
    .replace(/η/g, 'eta')
    .replace(/[–—]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");
}

// jsPDF is loaded on demand rather than statically imported.
//
// The library is roughly 350 kB minified and is only needed when the user
// actually exports a PDF — which for most sessions is never. A static import put
// it in the initial bundle and inflated the main chunk for every visitor.
// `import type` above keeps the return type accurate without loading the code.
export async function generateEngineeringPdf(results: CalculationResults): Promise<jsPDF> {
  const { jsPDF: JsPDF } = await import('jspdf');
  const doc = new JsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 182 mm
  const footerBottom = 12;
  const usableHeight = pageHeight - footerBottom; // content must not cross this
  let y = margin;

  /**
   * Guards page boundaries strictly. Clamps needed height to usable area
   * so oversized blocks never cause cascading empty pages.
   */
  function checkPageBreak(neededHeight: number) {
    const safeH = Math.min(neededHeight, usableHeight - (margin + 8));
    if (y + safeH > usableHeight) {
      doc.addPage();
      y = margin + 8; // Leave margin for running header
    }
  }

  function drawSectionTitle(title: string) {
    checkPageBreak(12);
    y += 2.5;
    doc.setFillColor(238, 243, 248);
    doc.rect(margin, y - 3.5, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 35, 70);
    doc.text(title, margin + 2.5, y + 1.2);
    y += 6.5;
  }

  // ==========================================
  // COVER BANNER & HEADER
  // ==========================================
  doc.setFillColor(15, 30, 60);
  doc.rect(margin, y, contentWidth, 23, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text('FLASH DRYER ENGINEERING DESIGN REPORT', margin + 4, y + 7.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(215, 230, 250);
  doc.text('High-Quality Cassava Flour (HQCF) Pneumatic Conveying Drying Calculations', margin + 4, y + 13.5);
  doc.text('Reference Standards: CIRAD (Chapuis 2015) & IITA/Kuye et al. (2011) | https://flashdryer.cirad.fr/design-tools', margin + 4, y + 18.5);
  y += 26;

  // Engineering Disclaimer
  doc.setFillColor(254, 243, 199);
  doc.setDrawColor(245, 158, 11);
  doc.setLineWidth(0.35);
  doc.rect(margin, y, contentWidth, 11, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(146, 64, 14);
  doc.text('PRELIMINARY ENGINEERING DESIGN NOTICE:', margin + 3, y + 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(180, 83, 9);
  doc.text('All dimensions and capacities output by this calculator represent preliminary mechanical design specifications.', margin + 3, y + 7.2);
  doc.text('Subject to detailed workshop design, local fabrication constraints, material availability, and testing validation.', margin + 3, y + 9.8);
  y += 14;

  // ==========================================
  // 1. EXECUTIVE SUMMARY & KEY PERFORMANCE INDICATORS
  // ==========================================
  drawSectionTitle('1. DESIGN SUMMARY & KEY PERFORMANCE INDICATORS');

  const halfWidth = (contentWidth - 4) / 2;
  const col1X = margin;
  const col2X = margin + halfWidth + 4;

  const leftMetrics = [
    { label: 'Dry Flour Production Rate', val: `${results.materialBalance.productRateKgH.toFixed(1)} kg/h` },
    { label: 'Wet Cassava Feed Rate', val: `${results.materialBalance.feedRateKgH.toFixed(1)} kg/h` },
    { label: 'Moisture Removal Rate', val: `${results.materialBalance.waterRemovedKgH.toFixed(1)} kg/h` },
    { label: 'Drying Air Mass Flow', val: `${results.energyBalance.dryAirMassFlowKgS.toFixed(3)} kg/s (${results.energyBalance.dryAirMassFlowKgH.toFixed(0)} kg/h)` },
    { label: 'Dilution Ratio (Dry air / dry solids)', val: `${results.energyBalance.airToStarchRatio.toFixed(1)} : 1 (wet feed: ${results.energyBalance.airToWetFeedRatio.toFixed(1)}:1)` },
    { label: 'Air Heater Thermal Duty', val: `${results.energyBalance.totalHeatDutyKW.toFixed(1)} kW (${results.energyBalance.totalHeatDutyKcalH.toFixed(0)} kcal/h)` },
  ];

  const rightMetrics = [
    { label: 'Nominal Pipe Diameter (Selected)', val: `Dia: ${results.dimensions.tubeDiameterStandardMm} mm (Calc: ${results.dimensions.tubeDiameterCalculatedMm.toFixed(1)} mm)` },
    { label: 'Total Developed Pipe Length', val: `${results.dimensions.totalPipeLengthM.toFixed(1)} m (Riser: ${results.dimensions.verticalColumnHeightM.toFixed(1)} m)` },
    { label: 'Particle Residence Time', val: `${results.dimensions.estimatedResidenceTimeSec.toFixed(2)} seconds` },
    { label: 'Operating Air Velocity', val: `${results.dimensions.actualAirVelocityMperS.toFixed(1)} m/s (Design: ${results.inputs.airVelocity.toFixed(1)} m/s)` },
    { label: 'Specific Energy Consump. (SEC)', val: `${results.energyBalance.specificEnergyConsumptionKJperKgWater.toFixed(0)} kJ/kg H2O` },
    { label: 'Heat Exchanger Passes & Area', val: `${results.heatExchanger.numberOfPasses} Passes (${results.heatExchanger.surfaceAreaM2.toFixed(1)} m^2, ${results.heatExchanger.totalTubesCount} tubes)` },
  ];

  const rowCount = Math.max(leftMetrics.length, rightMetrics.length);
  for (let r = 0; r < rowCount; r++) {
    checkPageBreak(6);
    doc.setFillColor(r % 2 === 0 ? 250 : 255, r % 2 === 0 ? 252 : 255, r % 2 === 0 ? 254 : 255);
    doc.rect(margin, y, contentWidth, 5.2, 'F');

    // Left Column
    if (leftMetrics[r]) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(50, 60, 80);
      doc.text(leftMetrics[r].label, col1X + 2, y + 3.6);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 30, 60);
      doc.text(leftMetrics[r].val, col1X + halfWidth - 2, y + 3.6, { align: 'right' });
    }

    // Right Column
    if (rightMetrics[r]) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(50, 60, 80);
      doc.text(rightMetrics[r].label, col2X + 2, y + 3.6);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 30, 60);
      doc.text(rightMetrics[r].val, col2X + halfWidth - 2, y + 3.6, { align: 'right' });
    }

    doc.setDrawColor(225, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(margin, y + 5.2, margin + contentWidth, y + 5.2);
    y += 5.5;
  }
  y += 3;

  // ==========================================
  // 2. DESIGN INPUT PARAMETERS & OPERATING CONDITIONS
  // ==========================================
  drawSectionTitle('2. DESIGN INPUT PARAMETERS & OPERATING CONDITIONS');

  const inputRows = [
    ['Input Parameter', 'Value', 'Unit', 'Classification', 'Design Reference / Notes'],
    ['Cassava Initial Moisture (w1)', `${results.inputs.initialMoisture.toFixed(1)}`, '% w.b.', 'User Input', 'Cassava mash moisture after mechanical dewatering (35-45%)'],
    ['Cassava Final Moisture (w2)', `${results.inputs.finalMoisture.toFixed(1)}`, '% w.b.', 'User Input', 'Target HQCF standard moisture (< 13.5% for storage)'],
    ['Drying Air Inlet Temperature', `${results.inputs.inletAirTemp.toFixed(1)}`, 'deg C', 'User Input', 'CIRAD energy-efficient benchmark: 170 - 180 deg C'],
    ['Exhaust Air Outlet Temperature', `${results.inputs.outletAirTemp.toFixed(1)}`, 'deg C', 'User Input', 'Recommended: 70 - 80 deg C (Prevents gelatinization > 85 deg C)'],
    ['Heat Exchanger Passes (N_pass)', `${results.heatExchanger.numberOfPasses}`, 'passes', 'User Input', `Multi-pass cross-flow bundle (${results.heatExchanger.surfaceAreaM2.toFixed(1)} m^2, ${results.heatExchanger.totalTubesCount} tubes)`],
    ['Ambient Temperature & RH', `${results.inputs.ambientTemp.toFixed(1)} / ${results.inputs.ambientRH.toFixed(0)}`, 'deg C / %', 'User Input', 'Tropical ambient condition for cassava processing regions'],
    ['Design Air Velocity', `${results.inputs.airVelocity.toFixed(1)}`, 'm/s', 'User Input', 'CIRAD optimal transport velocity: 12 - 15 m/s'],
    ['Cassava Particle Diameter', `${results.inputs.particleDiameter.toFixed(0)}`, 'um', 'Source Data', 'CIRAD pilot experimental mean: 230 um (range 215 - 245 um)'],
    ['Cassava Particle Solid Density', `${results.inputs.particleDensity.toFixed(0)}`, 'kg/m^3', 'Source Data', 'Standard cassava starch granular density: 1480 kg/m^3'],
    ['Cassava Flour Bulk Density', `${results.inputs.bulkDensity.toFixed(0)}`, 'kg/m^3', 'Source Data', 'Bulk density for feeder hopper sizing: 550 - 650 kg/m^3'],
    ['Installation Altitude', `${results.inputs.altitude.toFixed(0)}`, 'm', 'User Input', `Barometric pressure: ${results.psychrometrics.atmosphericPressureKPa.toFixed(2)} kPa`],
  ];

  // Column widths: Total = contentWidth (182 mm)
  // [48, 24, 18, 22, 70]
  const colW = [48, 24, 18, 22, 70];

  inputRows.forEach((row, idx) => {
    const isHeader = idx === 0;
    const c0Lines = doc.splitTextToSize(cleanPdfText(row[0]), colW[0] - 3);
    const c1Lines = doc.splitTextToSize(cleanPdfText(row[1]), colW[1] - 3);
    const c2Lines = doc.splitTextToSize(cleanPdfText(row[2]), colW[2] - 3);
    const c3Lines = doc.splitTextToSize(cleanPdfText(row[3]), colW[3] - 3);
    const c4Lines = doc.splitTextToSize(cleanPdfText(row[4]), colW[4] - 3);

    const maxLines = Math.max(c0Lines.length, c1Lines.length, c2Lines.length, c3Lines.length, c4Lines.length);
    const rowH = isHeader ? 5.5 : Math.max(4.8, maxLines * 3.2 + 1.8);

    checkPageBreak(rowH + 1);

    if (isHeader) {
      doc.setFillColor(225, 235, 248);
      doc.rect(margin, y, contentWidth, rowH, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(15, 35, 75);
    } else {
      doc.setFillColor(idx % 2 === 0 ? 250 : 255, idx % 2 === 0 ? 252 : 255, idx % 2 === 0 ? 254 : 255);
      doc.rect(margin, y, contentWidth, rowH, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(40, 45, 55);
    }

    let currX = margin;
    doc.text(c0Lines, currX + 1.5, y + 3.4);
    currX += colW[0];
    doc.text(c1Lines, currX + 1.5, y + 3.4);
    currX += colW[1];
    doc.text(c2Lines, currX + 1.5, y + 3.4);
    currX += colW[2];
    doc.text(c3Lines, currX + 1.5, y + 3.4);
    currX += colW[3];
    doc.text(c4Lines, currX + 1.5, y + 3.4);

    doc.setDrawColor(220, 226, 235);
    doc.setLineWidth(0.2);
    doc.line(margin, y + rowH, margin + contentWidth, y + rowH);
    y += rowH;
  });
  y += 3.5;

  // ==========================================
  // 3. DETAILED ENGINEERING CALCULATION STEPS & DERIVATIONS
  // ==========================================
  drawSectionTitle('3. DETAILED ENGINEERING CALCULATION STEPS & DERIVATIONS');

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.2);
  doc.setTextColor(90, 95, 105);
  doc.text('Formatted strictly according to standard: Equation -> Variables -> Substitution -> Result', margin + 2, y);
  y += 4;

  results.steps.forEach((step) => {
    // Pre-calculate heights for dynamic layout
    const expLines = step.simpleExplanation ? doc.splitTextToSize(`Explanation: ${cleanPdfText(step.simpleExplanation)}`, contentWidth - 6) : [];
    const eqLines = doc.splitTextToSize(`Equation:  ${cleanPdfText(step.equation)}`, contentWidth - 6);
    const srcLines = doc.splitTextToSize(`Source: ${cleanPdfText(step.sourceCitation)}`, contentWidth - 6);
    const subLines = doc.splitTextToSize(`Substitution: ${cleanPdfText(step.substitution)}`, contentWidth - 6);
    const resLines = doc.splitTextToSize(`Result: ${cleanPdfText(step.formattedResult)}`, contentWidth - 6);
    const noteLines = step.notes ? doc.splitTextToSize(`Engineering Note: ${cleanPdfText(step.notes)}`, contentWidth - 6) : [];

    const totalStepH = 6 + (expLines.length > 0 ? expLines.length * 3.1 + 1 : 0) + (eqLines.length * 3.3) + (srcLines.length * 3.1) + (subLines.length * 3.3) + (resLines.length * 3.5) + (noteLines.length > 0 ? noteLines.length * 3.1 + 1 : 0) + 3;

    checkPageBreak(totalStepH);

    // Title banner of step
    doc.setFillColor(243, 247, 252);
    doc.setDrawColor(210, 222, 235);
    doc.setLineWidth(0.3);
    doc.rect(margin, y, contentWidth, 5.2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    doc.setTextColor(15, 35, 75);
    doc.text(`${cleanPdfText(step.parameterName)} (${cleanPdfText(step.symbol)})`, margin + 2.5, y + 3.6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(90, 105, 125);
    doc.text(`[${cleanPdfText(step.category)}] | ${cleanPdfText(step.sourceClassification)}`, pageWidth - margin - 2.5, y + 3.6, { align: 'right' });
    y += 6.0;

    // Simple Explanation
    if (expLines.length > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.9);
      doc.setTextColor(15, 90, 50);
      doc.text(expLines, margin + 2.5, y + 2.4);
      y += expLines.length * 3.1 + 1;
    }

    // Equation
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(25, 55, 95);
    doc.text(eqLines, margin + 2.5, y + 2.6);
    y += eqLines.length * 3.3;

    // Citation
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.8);
    doc.setTextColor(100, 105, 115);
    doc.text(srcLines, margin + 2.5, y + 2.4);
    y += srcLines.length * 3.1;

    // Substitution
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(45, 50, 60);
    doc.text(subLines, margin + 2.5, y + 2.6);
    y += subLines.length * 3.3;

    // Result
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    doc.setTextColor(15, 100, 50);
    doc.text(resLines, margin + 2.5, y + 2.8);
    y += resLines.length * 3.5;

    // Engineering Note if any
    if (noteLines.length > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(85, 90, 100);
      doc.text(noteLines, margin + 2.5, y + 2.4);
      y += noteLines.length * 3.1 + 1;
    }
    y += 2.5;
  });

  // ==========================================
  // 4. PRELIMINARY MECHANICAL DIMENSIONS SCHEDULE
  // ==========================================
  drawSectionTitle('4. PRELIMINARY MECHANICAL DESIGN DIMENSIONS SCHEDULE');

  const dimRows = [
    ['Equipment Component', 'Nominal Dimension', 'Standard / Schedule Spec', 'Fabrication Material', 'Notes & Rationale'],
    ['Flash Drying Pipe (Vertical Riser)', `Nominal: Dia ${results.dimensions.tubeDiameterStandardMm} mm (Calc: ${results.dimensions.tubeDiameterCalculatedMm.toFixed(1)} mm) x H: ${results.dimensions.verticalColumnHeightM.toFixed(1)} m`, 'Schedule 10 / 2.0 mm wall', 'SS 304 (Food Contact)', `Nominal size is a selected standard fabrication value; final verification required. v_air = ${results.dimensions.actualAirVelocityMperS.toFixed(1)} m/s`],
    ['Total Developed Pipe Length', `${results.dimensions.totalPipeLengthM.toFixed(1)} meters total`, 'Flanged spool sections', 'SS 304 / Insulated', 'Includes U-bends to meet CIRAD L >= 20m rule'],
    ['Venturi Disperser Throat', `Dia: ${results.dimensions.venturiThroatDiameterMm} mm`, '75% of main pipe diameter', 'SS 304 with inspection port', `Gas accelerated to ${results.dimensions.venturiThroatVelocityMperS.toFixed(1)} m/s to disintegrate lumps`],
    ['Multi-Pass Air Heat Exchanger', `${results.heatExchanger.surfaceAreaM2.toFixed(1)} m^2 (${results.heatExchanger.numberOfPasses} Passes)`, `${results.heatExchanger.totalTubesCount} Tubes (${results.heatExchanger.tubesPerPass}/pass x ${results.heatExchanger.tubeLengthPerPassM.toFixed(1)}m)`, 'Carbon Steel / SS 304', `Duty: ${results.heatExchanger.thermalDutyKW.toFixed(0)} kW, Delta_P = ${results.heatExchanger.airSidePressureDropPa} Pa`],
    ['Cyclone Separator Body (Dc)', `Dia: ${results.dimensions.cycloneDiameterMm} mm x H: ${results.dimensions.cycloneTotalHeightMm} mm`, results.dimensions.cycloneType === 'stairmand' ? 'Stairmand High-Efficiency' : 'Lapple Standard', 'SS 304 (Sheet metal)', `Gas inlet: ${results.dimensions.cycloneInletHeightMm}x${results.dimensions.cycloneInletWidthMm} mm`],
    ['Cyclone Vortex Finder (De)', `Dia: ${results.dimensions.cycloneVortexFinderDiameterMm} mm x L: ${results.dimensions.cycloneVortexFinderLengthMm} mm`, 'Central top exhaust nozzle', 'SS 304', 'Prevents short-circuiting of fine flour granules'],
    ['Reception Buffer Hopper (IITA)', `Top: ${(results.hopperDesign.topWidthM * 1000).toFixed(0)}x${(results.hopperDesign.topLengthM * 1000).toFixed(0)} mm, Outlet: ${(results.hopperDesign.outletWidthM * 1000).toFixed(0)}x${(results.hopperDesign.outletLengthM * 1000).toFixed(0)} mm`, `Vol: ${(results.hopperDesign.totalGeometricVolumeM3 * 1000).toFixed(0)} L (Gross), H: ${(results.hopperDesign.overallHeightM * 1000).toFixed(0)} mm`, 'SS 304 (2.0 mm sheet)', `Valley angle C = ${results.hopperDesign.valleyAngleDeg}° for mass gravity flow, 10-min buffer (${results.hopperDesign.massHeldKg.toFixed(0)} kg)`],
    ['Wet Cassava Screw Feeder (IITA)', `Dia: ${results.dimensions.screwDiameterMm} mm (4"), Pitch: ${results.dimensions.screwPitchMm} mm, L: ${results.dimensions.screwLengthMm} mm`, `${results.dimensions.screwSpeedRpm} RPM (${results.screwFeederDesign.actualCapacityKgH.toFixed(0)} kg/h capacity)`, 'SS 304 screw & trough', `Theo power: ${results.screwFeederDesign.totalTheoreticalPowerHP.toFixed(3)} HP. Installed motor: ${results.screwFeederDesign.recommendedMotorPowerKW.toFixed(2)} kW (${results.screwFeederDesign.recommendedMotorPowerHP.toFixed(1)} HP) + VFD`],
    ['Dried Product Rotary Airlock', 'Size: 150 mm / 6-inch rotor', 'Pocketed rotor with scraper', 'Cast SS 304 / Viton tips', 'Maintains gas seal at cyclone bottom discharge'],
    ['Centrifugal Blower Fan', `Motor: ${results.dimensions.fanMotorPowerKW.toFixed(1)} kW @ ${results.dimensions.fanTotalPressureDropPa} Pa`, 'Radial / backward-curved fan', 'Mild Steel (Dry Air) / SS', 'Duty disclosure: preliminary model retains same airflow and fan-duty basis. Final fan selection requires complete pressure-drop calculation.'],
    ['Supporting Structural Frame', `L: ${results.dimensions.frameFootprintLengthM.toFixed(1)}m x W: ${results.dimensions.frameFootprintWidthM.toFixed(1)}m x H: ${results.dimensions.frameOverallHeightM.toFixed(1)}m`, 'H-Beam / RHS Tubing', 'Structural Carbon Steel A36', 'Equipped with access ladders & maintenance platforms'],
  ];

  // Column widths: Total = contentWidth (182 mm)
  // [42, 38, 32, 25, 45]
  const dimColW = [42, 38, 32, 25, 45];

  dimRows.forEach((row, idx) => {
    const isHeader = idx === 0;
    const c0Lines = doc.splitTextToSize(cleanPdfText(row[0]), dimColW[0] - 2);
    const c1Lines = doc.splitTextToSize(cleanPdfText(row[1]), dimColW[1] - 2);
    const c2Lines = doc.splitTextToSize(cleanPdfText(row[2]), dimColW[2] - 2);
    const c3Lines = doc.splitTextToSize(cleanPdfText(row[3]), dimColW[3] - 2);
    const c4Lines = doc.splitTextToSize(cleanPdfText(row[4]), dimColW[4] - 2);

    const maxLineCount = Math.max(c0Lines.length, c1Lines.length, c2Lines.length, c3Lines.length, c4Lines.length);
    const rowH = isHeader ? 5.5 : Math.max(4.8, maxLineCount * 3.2 + 1.8);

    checkPageBreak(rowH + 1);

    if (isHeader) {
      doc.setFillColor(225, 235, 248);
      doc.rect(margin, y, contentWidth, rowH, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.0);
      doc.setTextColor(15, 35, 75);
    } else {
      doc.setFillColor(idx % 2 === 0 ? 250 : 255, idx % 2 === 0 ? 252 : 255, idx % 2 === 0 ? 254 : 255);
      doc.rect(margin, y, contentWidth, rowH, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.0);
      doc.setTextColor(40, 45, 55);
    }

    let currX = margin;
    doc.text(c0Lines, currX + 1.5, y + 3.2);
    currX += dimColW[0];
    doc.text(c1Lines, currX + 1.5, y + 3.2);
    currX += dimColW[1];
    doc.text(c2Lines, currX + 1.5, y + 3.2);
    currX += dimColW[2];
    doc.text(c3Lines, currX + 1.5, y + 3.2);
    currX += dimColW[3];
    doc.text(c4Lines, currX + 1.5, y + 3.2);

    doc.setDrawColor(220, 226, 235);
    doc.setLineWidth(0.2);
    doc.line(margin, y + rowH, margin + contentWidth, y + rowH);
    y += rowH;
  });
  y += 3.5;

  // ==========================================
  // 5. AUTOMATED ENGINEERING CHECKS & SAFETY MARGINS
  // ==========================================
  drawSectionTitle('5. AUTOMATED ENGINEERING CHECKS & SAFETY MARGINS');

  results.checks.forEach((chk) => {
    const titleText = cleanPdfText(`[${chk.category.toUpperCase()}] ${chk.title} - Current: ${chk.currentValue} (Target: ${chk.recommendedRange})`);
    const msgText = cleanPdfText(chk.message);
    const titleLines = doc.splitTextToSize(titleText, contentWidth - 6);
    const msgLines = doc.splitTextToSize(msgText, contentWidth - 6);
    const boxH = 4 + (titleLines.length * 3.4) + (msgLines.length * 3.2) + 2;

    checkPageBreak(boxH + 2);

    let boxColor = [240, 245, 250];
    let textColor = [30, 60, 100];
    if (chk.severity === 'danger') {
      boxColor = [254, 242, 242];
      textColor = [185, 28, 28];
    } else if (chk.severity === 'warning') {
      boxColor = [254, 243, 199];
      textColor = [180, 83, 9];
    } else if (chk.severity === 'success') {
      boxColor = [240, 253, 244];
      textColor = [21, 128, 61];
    }

    doc.setFillColor(boxColor[0], boxColor[1], boxColor[2]);
    doc.rect(margin, y, contentWidth, boxH, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.text(titleLines, margin + 2.5, y + 3.6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.0);
    doc.setTextColor(50, 55, 65);
    doc.text(msgLines, margin + 2.5, y + 3.6 + (titleLines.length * 3.4));

    y += boxH + 2.5;
  });
  y += 2;

  // ==========================================
  // 6. RESEARCH & DESIGN METHODOLOGY REFERENCES
  // ==========================================
  drawSectionTitle('6. PRIMARY RESEARCH & DESIGN METHODOLOGY REFERENCES');

  const refs = [
    '1. CIRAD Flash Dryer Design Tools Suite: Online Open-Access Engineering Suite (Pipe, Feeder, Cyclone, Heat Exchanger, Blower), Alliance Bioversity International - CIAT & CIRAD. https://flashdryer.cirad.fr/design-tools',
    '2. CIRAD Pilot Flash Dryer Report (2015): "Guidelines for the design and construction of an experimental pneumatic dryer for cassava products RTB Post-harvest", Arnaud Chapuis, CIRAD/CIAT/Univalle, Cali, Colombia. https://flashdryer.cirad.fr/content/download/4152/31238/version/1/file/201512_Pilot_flash_dryer_report_VF.pdf',
    '3. Design and Fabrication of a Flash Dryer for the Production of High-Quality Cassava Flour: A. Kuye, D.B. Ayo, L.O. Sanni, A.O. Raji, E.I. Kwaya, O.O. Otuu, R. Okechukwu (2011/2017), International Institute of Tropical Agriculture (IITA). https://www.academia.edu/40091307',
    '4. Schiller, L. & Naumann, A. (1933): A drag coefficient correlation for intermediate Reynolds number spheres, VDI-Zeitung, 77: 318-320.',
    '5. Stairmand, C.J. (1951): The design and performance of cyclone separators, Trans. Inst. Chem. Engrs., 29: 356-383.'
  ];

  doc.setFontSize(7.0);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 65, 75);
  refs.forEach((ref) => {
    const splitText = doc.splitTextToSize(cleanPdfText(ref), contentWidth - 4);
    checkPageBreak(splitText.length * 3.2 + 2);
    doc.text(splitText, margin + 2, y + 2.6);
    y += splitText.length * 3.2 + 2;
  });

  // ==========================================
  // FINAL CLEAN PASS: RUNNING HEADERS & FOOTERS (ZERO OVERLAP)
  // ==========================================
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Running Header (Pages 2+)
    if (i > 1) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.0);
      doc.setTextColor(100, 110, 125);
      doc.text('CASSAVA FLASH DRYER SIZING REPORT | CIRAD & IITA METHODOLOGY', margin, 9.0);
      doc.text(`DATE: ${new Date().toISOString().split('T')[0]}`, pageWidth - margin, 9.0, { align: 'right' });
      doc.setDrawColor(210, 220, 230);
      doc.setLineWidth(0.2);
      doc.line(margin, 10.5, pageWidth - margin, 10.5);
    }

    // Running Footer (All Pages - strictly written once)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.0);
    doc.setTextColor(120, 130, 140);
    doc.setDrawColor(210, 220, 230);
    doc.setLineWidth(0.2);
    doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);
    doc.text('PRELIMINARY ENGINEERING DESIGN - SUBJECT TO DETAILED FABRICATION VALIDATION', margin, pageHeight - 6.5);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 6.5, { align: 'right' });
  }

  return doc;
}
