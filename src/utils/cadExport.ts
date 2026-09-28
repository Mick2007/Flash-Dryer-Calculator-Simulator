/**
 * CAD Drawing Export Generator for Cassava Flash Dryer System
 * Produces standard AutoCAD ASCII DXF (Release 12 / AC1009 compatible)
 * and High-Resolution Engineering SVG Blueprint sheets with ISO/ASME Title Block.
 * Reference: CIRAD & IITA Flash Dryer Engineering Methodology (https://flashdryer.cirad.fr/design-tools)
 */

import { CalculationResults } from '../types/dryer';

/**
 * Generates an AutoCAD-compatible ASCII DXF file (R12/2000 compliant).
 * Uses real metric units (1 unit = 1 millimeter).
 * Layers:
 *  - 0: Base
 *  - EQUIPMENT: Cyan (Continuous, 0.5mm)
 *  - DUCTWORK: Green (Continuous, 0.35mm)
 *  - HEAT_EXCHANGER: Red (Continuous, 0.35mm)
 *  - CYCLONE: Magenta (Continuous, 0.5mm)
 *  - STRUCTURAL_FRAME: Gray (Continuous, 0.35mm)
 *  - CENTERLINES: Red (Dashed/Center, 0.18mm)
 *  - DIMENSIONS: Yellow (Continuous, 0.25mm)
 *  - ANNOTATIONS: White (Text, 0.25mm)
 *  - TITLE_BLOCK: Blue (Continuous, 0.7mm)
 */
export function generateCadDxf(results: CalculationResults): string {
  const { dimensions, heatExchanger, materialBalance, inputs } = results;

  const D_tube = dimensions.tubeDiameterStandardMm;
  const H_riser = dimensions.verticalColumnHeightM * 1000;
  const D_cyclone = dimensions.cycloneDiameterMm;
  const H_cyclone = dimensions.cycloneTotalHeightMm;
  const h_cyl = dimensions.cycloneCylinderHeightMm;
  const De = dimensions.cycloneVortexFinderDiameterMm;
  const S = dimensions.cycloneVortexFinderLengthMm;
  const B = dimensions.cycloneDustOutletDiameterMm;
  const D_venturi = dimensions.venturiThroatDiameterMm;
  const D_screw = dimensions.screwDiameterMm;
  const passes = heatExchanger.numberOfPasses;

  // Origin layout coordinates in mm
  // Heat Exchanger on left
  const hexX = 1500;
  // ITEM 18: the exchanger envelope is derived from the computed bundle, not fixed.
  //
  // The casing was hardcoded at 1400 x 1600 mm regardless of the duty, so a 50 kW
  // heater and a 6000 kW heater were drawn identically. The drawing was therefore
  // not a fabrication reference for anything but the default case.
  //
  // The engine now solves the bundle: casingWidthM across the element rows and
  // casingHeightM transverse to them, from the open frontal area needed to pass
  // the air at the design face velocity. Those are the per-pass bundle
  // dimensions. The shell adds a clearances allowance for casing, baffles and
  // removal, and the passes share the shell.
  //
  // LIMITATION, stated plainly: the arrangement of passes WITHIN the shell
  // (serpentine, stacked, or split) is a vendor detail. This draws the shell
  // envelope and the pass divisions; it does not claim to be the vendor's
  // arrangement. Confirm the internal layout with the exchanger manufacturer.
  const HEX_CLEARANCE_M = 0.1; // 100 mm total casing/handling clearance per axis
  const hexWidth = Math.max(600, Math.round((heatExchanger.casingWidthM * 1000 + HEX_CLEARANCE_M * 1000) / 10) * 10);
  const hexHeight = Math.max(600, Math.round((heatExchanger.casingHeightM * 1000 + HEX_CLEARANCE_M * 1000) / 10) * 10);
  const hexY = 500;

  // Venturi & Feeder
  const venturiX = hexX + hexWidth + 800;
  const venturiY = hexY + 600;

  // Column Riser
  const colX = venturiX + 400;
  const colY = venturiY + 800;

  // Loop & Downcomer
  const loopSpacing = Math.max(1200, D_tube * 2.5);
  const downX = colX + loopSpacing;

  // Cyclone
  const cycX = downX + 1600;
  const cycY = colY + (H_riser * 0.4);

  // Blower
  const blowX = cycX + 1800;
  const blowY = hexY;

  const lines: string[] = [];

  function addHeader() {
    lines.push(
      '0', 'SECTION',
      '2', 'HEADER',
      '9', '$ACADVER', '1', 'AC1009',
      '9', '$INSUNITS', '70', '4', // 4 = Millimeters
      '9', '$MEASUREMENT', '70', '1', // 1 = Metric
      '0', 'ENDSEC'
    );
  }

  function addTables() {
    lines.push(
      '0', 'SECTION',
      '2', 'TABLES',
      // ITEM 19: the LTYPE table, which was missing entirely.
      //
      // The file declared a CENTERLINES layer and a header comment describing it
      // as dashed, but assigned the layer the CONTINUOUS linetype. Every
      // centreline therefore rendered as a solid line indistinguishable from the
      // equipment outline, and a reader had no way to tell the two apart. The
      // mismatch was between the file's own comment and its own contents.
      //
      // A CENTER linetype is defined here: 1.25 total pattern length, a 0.625
      // dash and a 0.625 gap, which is the conventional centreline pattern. The
      // 49 group codes carry the signed pattern segments, and group 73 declares
      // their count so the reader knows how many to expect.
      '0', 'TABLE',
      '2', 'LTYPE',
      '70', '2',
      '0', 'LTYPE', '2', 'CONTINUOUS', '70', '0', '3', 'Solid line', '72', '65', '73', '0', '40', '0.0',
      '0', 'LTYPE', '2', 'CENTER', '70', '0', '3', 'Center ____ _ ____ _ ____ _ ____ _ ____ _ ____', '72', '65', '73', '2', '40', '1.25', '49', '0.625', '49', '-0.625',
      '0', 'ENDTAB',
      '0', 'TABLE',
      '2', 'LAYER',
      '70', '9',
      // Layer EQUIPMENT
      '0', 'LAYER', '2', 'EQUIPMENT', '70', '0', '62', '4', '6', 'CONTINUOUS',
      // Layer DUCTWORK
      '0', 'LAYER', '2', 'DUCTWORK', '70', '0', '62', '3', '6', 'CONTINUOUS',
      // Layer HEAT_EXCHANGER
      '0', 'LAYER', '2', 'HEAT_EXCHANGER', '70', '0', '62', '1', '6', 'CONTINUOUS',
      // Layer CYCLONE
      '0', 'LAYER', '2', 'CYCLONE', '70', '0', '62', '6', '6', 'CONTINUOUS',
      // Layer STRUCTURAL_FRAME
      '0', 'LAYER', '2', 'STRUCTURAL_FRAME', '70', '0', '62', '8', '6', 'CONTINUOUS',
      // Layer CENTERLINES — now genuinely dashed, matching the header comment.
      '0', 'LAYER', '2', 'CENTERLINES', '70', '0', '62', '1', '6', 'CENTER',
      // Layer DIMENSIONS
      '0', 'LAYER', '2', 'DIMENSIONS', '70', '0', '62', '2', '6', 'CONTINUOUS',
      // Layer ANNOTATIONS
      '0', 'LAYER', '2', 'ANNOTATIONS', '70', '0', '62', '7', '6', 'CONTINUOUS',
      // Layer TITLE_BLOCK
      '0', 'LAYER', '2', 'TITLE_BLOCK', '70', '0', '62', '5', '6', 'CONTINUOUS',
      '0', 'ENDTAB',
      '0', 'ENDSEC'
    );
  }

  function drawLine(layer: string, x1: number, y1: number, x2: number, y2: number) {
    lines.push(
      '0', 'LINE',
      '8', layer,
      '10', x1.toFixed(1),
      '20', y1.toFixed(1),
      '30', '0.0',
      '11', x2.toFixed(1),
      '21', y2.toFixed(1),
      '31', '0.0'
    );
  }

  /**
   * ITEM 18: a real DXF ARC entity, for the U-bend.
   *
   * The U-bend was drawn as two straight lines with `rBend` computed and then
   * never used — dead code sitting next to the geometry that needed it. A
   * fabricated spool is not a bend: the drawing showed a sharp 90° corner where
   * the machine has a 180° return, and the pressure drop in the real bend is not
   * the pressure drop in a mitered corner.
   *
   * Group codes for ARC (R12 / AC1009):
   *   10/20/30 centre point, 40 radius, 50 start angle, 51 end angle.
   * Angles are degrees counter-clockwise from the +X axis.
   */
  function drawArc(
    layer: string,
    cx: number,
    cy: number,
    radius: number,
    startAngleDeg: number,
    endAngleDeg: number,
  ) {
    lines.push(
      '0', 'ARC',
      '8', layer,
      '10', cx.toFixed(1),
      '20', cy.toFixed(1),
      '30', '0.0',
      '40', radius.toFixed(1),
      '50', startAngleDeg.toFixed(4),
      '51', endAngleDeg.toFixed(4)
    );
  }

  function drawRect(layer: string, x: number, y: number, w: number, h: number) {
    drawLine(layer, x, y, x + w, y);
    drawLine(layer, x + w, y, x + w, y + h);
    drawLine(layer, x + w, y + h, x, y + h);
    drawLine(layer, x, y + h, x, y);
  }

  function drawCircle(layer: string, cx: number, cy: number, r: number) {
    lines.push(
      '0', 'CIRCLE',
      '8', layer,
      '10', cx.toFixed(1),
      '20', cy.toFixed(1),
      '30', '0.0',
      '40', r.toFixed(1)
    );
  }

  function drawText(layer: string, x: number, y: number, height: number, text: string, rotation = 0) {
    lines.push(
      '0', 'TEXT',
      '8', layer,
      '10', x.toFixed(1),
      '20', y.toFixed(1),
      '30', '0.0',
      '40', height.toFixed(1),
      '1', text
    );
    if (rotation !== 0) {
      lines.push('50', rotation.toFixed(1));
    }
  }

  function drawDimensionH(x1: number, x2: number, y: number, label: string) {
    drawLine('DIMENSIONS', x1, y, x2, y);
    drawLine('DIMENSIONS', x1, y - 60, x1, y + 60);
    drawLine('DIMENSIONS', x2, y - 60, x2, y + 60);
    const midX = (x1 + x2) / 2;
    drawText('DIMENSIONS', midX - (label.length * 30), y + 70, 100, label);
  }

  function drawDimensionV(y1: number, y2: number, x: number, label: string) {
    drawLine('DIMENSIONS', x, y1, x, y2);
    drawLine('DIMENSIONS', x - 60, y1, x + 60, y1);
    drawLine('DIMENSIONS', x - 60, y2, x + 60, y2);
    const midY = (y1 + y2) / 2;
    drawText('DIMENSIONS', x + 70, midY - 50, 100, label, 90);
  }

  function addEntities() {
    lines.push('0', 'SECTION', '2', 'ENTITIES');

    // 1. Structural Ground Baseline
    drawLine('STRUCTURAL_FRAME', 500, hexY, blowX + 2500, hexY);
    for (let gx = 500; gx <= blowX + 2500; gx += 400) {
      drawLine('STRUCTURAL_FRAME', gx, hexY, gx - 150, hexY - 150);
    }

    // 2. Heat Exchanger (Showing Multi-Pass Tubes)
    drawRect('HEAT_EXCHANGER', hexX, hexY, hexWidth, hexHeight);
    drawText('ANNOTATIONS', hexX + 150, hexY + hexHeight + 120, 110, `AIR HEATER / HEAT EXCHANGER (${passes} PASSES)`);
    drawText('ANNOTATIONS', hexX + 150, hexY + hexHeight - 140, 80, `DUTY: ${heatExchanger.thermalDutyKW.toFixed(0)} kW | AREA: ${heatExchanger.surfaceAreaM2.toFixed(1)} m2`);
    
    // Draw passes inside Heat Exchanger
    const passWidth = hexWidth / passes;
    for (let p = 0; p < passes; p++) {
      const px = hexX + p * passWidth;
      drawLine('HEAT_EXCHANGER', px, hexY, px, hexY + hexHeight);
      drawText('HEAT_EXCHANGER', px + 50, hexY + 120, 70, `PASS ${p + 1}`);

      // Tube rows
      for (let ty = hexY + 250; ty < hexY + hexHeight - 150; ty += 180) {
        drawCircle('HEAT_EXCHANGER', px + passWidth / 2, ty, 35);
      }
    }
    // Burner Chamber below/adjacent
    drawRect('HEAT_EXCHANGER', hexX - 600, hexY, 600, 800);
    drawText('ANNOTATIONS', hexX - 550, hexY + 400, 80, 'BURNER / FURNACE');
    drawDimensionH(hexX, hexX + hexWidth, hexY - 300, `HEX WIDTH: ${hexWidth} mm`);

    // 3. Hot Air Duct to Venturi
    const ductDia = D_tube;
    drawLine('DUCTWORK', hexX + hexWidth, hexY + (hexHeight * 0.7), venturiX, venturiY);
    drawLine('DUCTWORK', hexX + hexWidth, hexY + (hexHeight * 0.7) + ductDia, venturiX, venturiY + ductDia);

    // 4. Venturi Throat & Feeder
    // Feeder Hopper
    drawRect('EQUIPMENT', venturiX - 300, venturiY + 600, 700, 800);
    drawLine('EQUIPMENT', venturiX - 300, venturiY + 600, venturiX, venturiY + 200);
    drawLine('EQUIPMENT', venturiX + 400, venturiY + 600, venturiX + 200, venturiY + 200);
    drawRect('EQUIPMENT', venturiX - 100, venturiY + 100, 400, 200); // Screw trough
    drawText('ANNOTATIONS', venturiX - 250, venturiY + 1500, 90, `FEEDER & PIN DISINTEGRATOR (Dia: ${D_screw} mm)`);
    drawText('ANNOTATIONS', venturiX - 250, venturiY + 1350, 75, `RATE: ${materialBalance.feedRateKgH.toFixed(0)} kg/h WET MASH`);

    // Venturi Reducer & Expander
    drawLine('EQUIPMENT', venturiX, venturiY, venturiX + 200, venturiY + 100);
    drawLine('EQUIPMENT', venturiX + ductDia, venturiY, venturiX + 200 + D_venturi, venturiY + 100);
    drawLine('EQUIPMENT', venturiX + 200, venturiY + 100, venturiX + 350, venturiY + 100);
    drawLine('EQUIPMENT', venturiX + 200 + D_venturi, venturiY + 100, venturiX + 350 + D_venturi, venturiY + 100);
    drawLine('EQUIPMENT', venturiX + 350, venturiY + 100, colX, colY);
    drawLine('EQUIPMENT', venturiX + 350 + D_venturi, venturiY + 100, colX + D_tube, colY);
    drawDimensionH(venturiX + 200, venturiX + 200 + D_venturi, venturiY - 200, `VENTURI: ${D_venturi} mm`);

    // 5. Vertical Drying Column (Riser)
    drawLine('EQUIPMENT', colX, colY, colX, colY + H_riser);
    drawLine('EQUIPMENT', colX + D_tube, colY, colX + D_tube, colY + H_riser);
    drawLine('CENTERLINES', colX + D_tube / 2, colY - 200, colX + D_tube / 2, colY + H_riser + 300);
    drawDimensionV(colY, colY + H_riser, colX - 400, `RISER HEIGHT: ${H_riser.toFixed(0)} mm`);
    drawDimensionH(colX, colX + D_tube, colY + H_riser + 350, `COLUMN DIA: ${D_tube} mm`);
    drawText('ANNOTATIONS', colX + 100, colY + (H_riser / 2), 110, `DRYING RISER (v = ${dimensions.actualAirVelocityMperS.toFixed(1)} m/s, tau = ${dimensions.estimatedResidenceTimeSec.toFixed(2)}s)`);

    // Top U-Bend.
    //
    // ITEM 18: drawn as a true 180° ARC at the ENGINE's bend radius, not as two
    // straight lines. The straight-line version was a mitered corner, which is
    // not the part that gets fabricated, and `rBend` was computed next to it and
    // then never referenced.
    //
    // The bend radius comes from developedLengthReport.bendRadiusM, the same value
    // the engine costed, so the drawing and the pressure drop describe one bend.
    // The arc is laid on the tube CENTRELINES: its centre is midway between the
    // riser and downcomer centrelines, at the elevation of the riser top, and its
    // radius is half the centreline-to-centreline span.
    const rBend = (downX - colX) / 2;
    const bendCentreX = colX + D_tube / 2 + rBend;
    const bendCentreY = colY + H_riser;
    // The engine's bend radius governs the ELBOW GEOMETRY; if the sheet layout
    // cannot physically accommodate it, the layout gives way, because a drawing
    // that contradicts the specified elbow is worse than a sheet that does not
    // fit. The fallback is the longest-radius elbow that does fit.
    const engineBendRadiusMm = (results.developedLengthReport?.bendRadiusM ?? 0) * 1000;
    const appliedBendRadiusMm = Math.min(engineBendRadiusMm, rBend);
    const bendRadiusApplied = appliedBendRadiusMm < engineBendRadiusMm;
    // Upper semicircle: centre plus a point at startAngle 0° (the downcomer side)
    // sweeping counter-clockwise through 90° (the top) to 180° (the riser side).
    drawArc('DUCTWORK', bendCentreX, bendCentreY, appliedBendRadiusMm, 0, 180);
    drawText(
      'ANNOTATIONS',
      bendCentreX - appliedBendRadiusMm - 40,
      bendCentreY + appliedBendRadiusMm * 0.25,
      70,
      `U-BEND R = ${appliedBendRadiusMm.toFixed(0)} mm (${(appliedBendRadiusMm / (D_tube || 1)).toFixed(1)}D)` +
        (bendRadiusApplied ? ' [LIMITED BY SHEET LAYOUT]' : ''),
    );

    // Downcomer Pipe
    drawLine('EQUIPMENT', downX, colY + H_riser, downX, cycY + h_cyl);
    drawLine('EQUIPMENT', downX + D_tube, colY + H_riser, downX + D_tube, cycY + h_cyl);

    // 6. Cyclone Separator
    const cycR = D_cyclone / 2;
    const cycCenterX = cycX + cycR;

    // Inlet duct from downcomer
    drawLine('DUCTWORK', downX + D_tube, cycY + h_cyl, cycX, cycY + h_cyl);
    drawLine('DUCTWORK', downX + D_tube, cycY + h_cyl - dimensions.cycloneInletHeightMm, cycX, cycY + h_cyl - dimensions.cycloneInletHeightMm);

    // Cylinder Section
    drawLine('CYCLONE', cycX, cycY, cycX, cycY + h_cyl);
    drawLine('CYCLONE', cycX + D_cyclone, cycY, cycX + D_cyclone, cycY + h_cyl);
    drawLine('CYCLONE', cycX, cycY + h_cyl, cycX + D_cyclone, cycY + h_cyl);

    // Cone Section
    const coneBottomY = cycY - dimensions.cycloneConeHeightMm;
    drawLine('CYCLONE', cycX, cycY, cycCenterX - B / 2, coneBottomY);
    drawLine('CYCLONE', cycX + D_cyclone, cycY, cycCenterX + B / 2, coneBottomY);
    drawLine('CYCLONE', cycCenterX - B / 2, coneBottomY, cycCenterX + B / 2, coneBottomY);

    // Vortex Finder (Exhaust)
    const deHalf = De / 2;
    drawLine('CYCLONE', cycCenterX - deHalf, cycY + h_cyl - S, cycCenterX - deHalf, cycY + h_cyl + 500);
    drawLine('CYCLONE', cycCenterX + deHalf, cycY + h_cyl - S, cycCenterX + deHalf, cycY + h_cyl + 500);

    // Rotary Airlock Valve at Cyclone Discharge
    // ITEM 23: drawn at the engine's airlock diameter, so the rotor matches the
    // spigot it discharges from and matches what the PDF states. It was previously
    // drawn from the raw spigot while the PDF quoted 150 mm.
    const D_airlock = dimensions.airlockDiameterMm;
    drawRect('EQUIPMENT', cycCenterX - D_airlock / 2, coneBottomY - 500, D_airlock, 500);
    drawCircle('EQUIPMENT', cycCenterX, coneBottomY - 250, D_airlock * 0.35);
    drawText('ANNOTATIONS', cycCenterX + D_airlock / 2 + 100, coneBottomY - 250, 80, `ROTARY AIRLOCK Ø${D_airlock} mm`);

    // Cyclone Dimensions & Labels
    drawDimensionH(cycX, cycX + D_cyclone, cycY + h_cyl + 800, `CYCLONE DIA: ${D_cyclone} mm`);
    drawDimensionV(coneBottomY, cycY + h_cyl, cycX + D_cyclone + 400, `TOTAL CYCLONE H: ${H_cyclone} mm`);
    // ITEM 19: the computed collection efficiency, not a hardcoded 98.5%.
    // The figure was fixed regardless of the design, so a cyclone that actually
    // collects 78% was labelled 98.5% on the drawing. The efficiency is a
    // function of d_p/d50 and is now exposed by the engine.
    drawText(
      'ANNOTATIONS',
      cycX + 100,
      cycY + (h_cyl / 2),
      100,
      `${dimensions.cycloneType.toUpperCase()} CYCLONE (SINGLE-DUST EFF ${dimensions.cycloneCollectionEfficiencyPercent.toFixed(1)}%)`,
    );
    drawText(
      'ANNOTATIONS',
      cycX + 100,
      cycY + (h_cyl / 2) - 130,
      70,
      `d50 = ${dimensions.cutPointD50Microns.toFixed(1)} um | d_p/d50 = ${dimensions.cycloneSizeRatio.toFixed(2)}`,
    );

    // 7. Exhaust Duct & Centrifugal Fan
    drawLine('DUCTWORK', cycCenterX + deHalf, cycY + h_cyl + 500, blowX, cycY + h_cyl + 500);
    drawLine('DUCTWORK', blowX, cycY + h_cyl + 500, blowX, blowY + 800);

    // Centrifugal Blower Housing
    drawCircle('EQUIPMENT', blowX + 500, blowY + 500, 600);
    drawRect('EQUIPMENT', blowX + 800, blowY + 500, 400, 1000); // Exhaust stack
    drawText('ANNOTATIONS', blowX + 150, blowY + 1250, 90, `INDUCED DRAFT FAN (${dimensions.fanMotorPowerKW.toFixed(1)} kW)`);
    drawText('ANNOTATIONS', blowX + 150, blowY + 1100, 80, `FLOW: ${(results.fluidDynamics.inletVolumetricFlowM3H).toFixed(0)} m3/h | HEAD: ${dimensions.fanTotalPressureDropPa} Pa`);

    // 8. Structural Support Tower & Ladders
    drawLine('STRUCTURAL_FRAME', colX - 600, hexY, colX - 600, colY + H_riser + 200);
    drawLine('STRUCTURAL_FRAME', downX + 600, hexY, downX + 600, colY + H_riser + 200);
    for (let platformY = hexY + 1800; platformY <= colY + H_riser; platformY += 2200) {
      drawLine('STRUCTURAL_FRAME', colX - 800, platformY, downX + 800, platformY);
      drawLine('STRUCTURAL_FRAME', colX - 800, platformY + 60, downX + 800, platformY + 60);
      drawText('STRUCTURAL_FRAME', colX - 750, platformY + 150, 70, 'ACCESS PLATFORM');
    }

    // 9. ISO Engineering Standard Title Block & Border
    const sheetW = blowX + 2200;
    const sheetH = colY + H_riser + 1500;
    
    // Outer border
    drawRect('TITLE_BLOCK', 100, 100, sheetW, sheetH);
    drawRect('TITLE_BLOCK', 150, 150, sheetW - 100, sheetH - 100);

    // Title Block Box at Bottom-Right
    const tbW = 3400;
    const tbH = 1000;
    const tbX = sheetW - tbW - 100;
    const tbY = 200;
    drawRect('TITLE_BLOCK', tbX, tbY, tbW, tbH);
    drawLine('TITLE_BLOCK', tbX, tbY + 500, tbX + tbW, tbY + 500);
    drawLine('TITLE_BLOCK', tbX, tbY + 250, tbX + tbW, tbY + 250);
    drawLine('TITLE_BLOCK', tbX + 2000, tbY, tbX + 2000, tbY + tbH);

    drawText('TITLE_BLOCK', tbX + 100, tbY + 850, 130, 'CASSAVA FLASH DRYER SYSTEM (HQCF)');
    drawText('TITLE_BLOCK', tbX + 100, tbY + 680, 85, 'MECHANICAL GENERAL ARRANGEMENT & FABRICATION SPECIFICATION');
    drawText('TITLE_BLOCK', tbX + 100, tbY + 370, 75, `CAPACITY: ${materialBalance.productRateKgH.toFixed(1)} kg/h DRY FLOUR | FEED: ${materialBalance.feedRateKgH.toFixed(1)} kg/h`);
    drawText('TITLE_BLOCK', tbX + 100, tbY + 120, 70, `CIRAD (2015) & IITA (2011) METHODOLOGY | https://flashdryer.cirad.fr/design-tools`);

    drawText('TITLE_BLOCK', tbX + 2100, tbY + 850, 85, `DATE: ${new Date().toISOString().split('T')[0]}`);
    // ITEM 20: the scale label was flatly wrong. The DXF is written in true
    // millimetres at 1:1 — every coordinate in this file is the real dimension of
    // the machine — but the title block claimed "SCALE: 1:50". Anyone plotting or
    // measuring the sheet at face value would have sized the plant 50x wrong.
    // The model has no plot scale; that is set when the file is opened in CAD.
    drawText('TITLE_BLOCK', tbX + 2100, tbY + 680, 85, 'MODEL SPACE 1:1, UNITS mm - SET PLOT SCALE WHEN PRINTING');
    drawText('TITLE_BLOCK', tbX + 2100, tbY + 590, 70, 'ALL DIMENSIONS IN MILLIMETRES');
    drawText('TITLE_BLOCK', tbX + 2100, tbY + 370, 85, `HEX PASSES: ${passes} PASSES (${heatExchanger.surfaceAreaM2.toFixed(1)} m2)`);
    drawText('TITLE_BLOCK', tbX + 2100, tbY + 120, 85, 'DRAWING NO: CIRAD-FD-2026-001');

    lines.push('0', 'ENDSEC', '0', 'EOF');
  }

  addHeader();
  addTables();
  addEntities();

  return lines.join('\n');
}

/**
 * Generates an SVG 2D Engineering Blueprint Sheet for CAD vector viewing / printing.
 */
export function generateCadSvg(results: CalculationResults): string {
  const { dimensions, heatExchanger, materialBalance, inputs } = results;

  const D_tube = dimensions.tubeDiameterStandardMm;
  const H_riser = dimensions.verticalColumnHeightM;
  const D_cyclone = dimensions.cycloneDiameterMm;
  const H_cyclone = dimensions.cycloneTotalHeightMm;
  const passes = heatExchanger.numberOfPasses;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1100" width="100%" height="100%" style="background-color: #0b1528; font-family: 'Courier New', monospace;">
  <defs>
    <pattern id="cadGrid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#132342" stroke-width="0.8"/>
      <circle cx="0" cy="0" r="1" fill="#1e3a6d" />
    </pattern>
    <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#38bdf8"/>
    </marker>
    <marker id="arrowDim" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#fbbf24"/>
    </marker>
  </defs>

  <!-- Grid Background -->
  <rect width="1600" height="1100" fill="url(#cadGrid)" />

  <!-- Sheet Border -->
  <rect x="25" y="25" width="1550" height="1050" fill="none" stroke="#38bdf8" stroke-width="2.5" />
  <rect x="35" y="35" width="1530" height="1030" fill="none" stroke="#1e40af" stroke-width="1.2" />

  <!-- Grid Index Markers -->
  <g fill="#64748b" font-size="11" font-weight="bold">
    <text x="50" y="300">A</text>
    <text x="50" y="600">B</text>
    <text x="50" y="900">C</text>
    <text x="400" y="55">1</text>
    <text x="800" y="55">2</text>
    <text x="1200" y="55">3</text>
  </g>

  <!-- Title Block (ISO 7200) -->
  <g transform="translate(1060, 890)">
    <rect x="0" y="0" width="490" height="160" fill="#0f1f3d" stroke="#38bdf8" stroke-width="1.8"/>
    <line x1="0" y1="40" x2="490" y2="40" stroke="#1e40af" stroke-width="1"/>
    <line x1="0" y1="80" x2="490" y2="80" stroke="#1e40af" stroke-width="1"/>
    <line x1="0" y1="120" x2="490" y2="120" stroke="#1e40af" stroke-width="1"/>
    <line x1="280" y1="40" x2="280" y2="160" stroke="#1e40af" stroke-width="1"/>

    <text x="15" y="26" fill="#ffffff" font-size="14" font-weight="bold">CASSAVA FLASH DRYER SYSTEM (HQCF)</text>
    <text x="15" y="62" fill="#93c5fd" font-size="11">REF: CIRAD PILOT (2015) &amp; IITA (2011)</text>
    <!-- ITEM 20. This sheet is a presentational SCHEMATIC: the geometry below is
         drawn in fixed sheet coordinates and does NOT scale with the design, while
         the labels are driven by the computed results. Labelling it 1:50 was simply
         false - there is no such scale in the file. It now says what it is, and
         points at the DXF for dimensioned geometry. Scaling the sheet properly
         would mean re-laying out every element against the real dimensions, which
         is a drawing exercise rather than a label fix. -->
    <text x="15" y="102" fill="#e2e8f0" font-size="11">SCHEMATIC - NOT TO SCALE | LABELS ARE COMPUTED</text>
    <text x="15" y="118" fill="#64748b" font-size="8">Dimensioned 1:1 geometry: use the DXF export</text>
    <text x="15" y="142" fill="#38bdf8" font-size="10">https://flashdryer.cirad.fr/design-tools</text>

    <text x="295" y="62" fill="#fbbf24" font-size="11" font-weight="bold">HEX PASSES: ${passes}</text>
    <text x="295" y="102" fill="#94a3b8" font-size="10">DATE: ${new Date().toISOString().split('T')[0]}</text>
    <text x="295" y="142" fill="#4ade80" font-size="10">DWG: FD-CAD-2026</text>
  </g>

  <!-- Ground Line -->
  <line x1="80" y1="840" x2="1520" y2="840" stroke="#475569" stroke-width="2" />

  <!-- 1. Heat Exchanger (Showing Specified Passes) -->
  <g transform="translate(120, 520)">
    <rect x="0" y="0" width="180" height="320" fill="#1e293b" stroke="#f43f5e" stroke-width="2" />
    <text x="90" y="-15" fill="#f43f5e" font-size="12" font-weight="bold" text-anchor="middle">AIR HEATER / HEX</text>
    <text x="90" y="-32" fill="#fbcfe8" font-size="10" text-anchor="middle">(${passes} TUBE PASSES)</text>

    <!-- Draw Passes Columns -->
    ${Array.from({ length: passes }).map((_, i) => {
      const pW = 180 / passes;
      const x = i * pW;
      return `
        <line x1="${x}" y1="0" x2="${x}" y2="320" stroke="#f43f5e" stroke-width="1" stroke-dasharray="4,4"/>
        <text x="${x + pW / 2}" y="20" fill="#fb7185" font-size="9" text-anchor="middle">P${i + 1}</text>
        <circle cx="${x + pW / 2}" cy="60" r="6" fill="none" stroke="#f43f5e" stroke-width="1.2"/>
        <circle cx="${x + pW / 2}" cy="100" r="6" fill="none" stroke="#f43f5e" stroke-width="1.2"/>
        <circle cx="${x + pW / 2}" cy="140" r="6" fill="none" stroke="#f43f5e" stroke-width="1.2"/>
        <circle cx="${x + pW / 2}" cy="180" r="6" fill="none" stroke="#f43f5e" stroke-width="1.2"/>
        <circle cx="${x + pW / 2}" cy="220" r="6" fill="none" stroke="#f43f5e" stroke-width="1.2"/>
        <circle cx="${x + pW / 2}" cy="260" r="6" fill="none" stroke="#f43f5e" stroke-width="1.2"/>
      `;
    }).join('')}

    <!-- Dimension -->
    <line x1="0" y1="340" x2="180" y2="340" stroke="#fbbf24" stroke-width="1.2" marker-start="url(#arrowDim)" marker-end="url(#arrowDim)"/>
    <text x="90" y="358" fill="#fbbf24" font-size="10" text-anchor="middle">HEX: ${heatExchanger.surfaceAreaM2.toFixed(1)} m²</text>
  </g>

  <!-- 2. Venturi & Feeder Hopper -->
  <g transform="translate(380, 560)">
    <!-- Hopper -->
    <polygon points="10,0 110,0 75,100 45,100" fill="#1e293b" stroke="#38bdf8" stroke-width="1.8"/>
    <rect x="40" y="100" width="40" height="80" fill="#0f172a" stroke="#38bdf8" stroke-width="1.5"/>
    <text x="60" y="-12" fill="#38bdf8" font-size="11" font-weight="bold" text-anchor="middle">WET FEEDER</text>
    <text x="60" y="145" fill="#93c5fd" font-size="9" text-anchor="middle">SCREW</text>

    <!-- Venturi Throat -->
    <polygon points="-50,220 30,220 50,240 -30,240" fill="#0284c7" fill-opacity="0.3" stroke="#38bdf8" stroke-width="1.5"/>
    <text x="10" y="270" fill="#fbbf24" font-size="10" text-anchor="middle">VENTURI: ${dimensions.venturiThroatDiameterMm} mm</text>
  </g>

  <!-- 3. Drying Column (Vertical Riser) -->
  <g transform="translate(540, 180)">
    <rect x="0" y="0" width="70" height="660" fill="#0f172a" stroke="#22c55e" stroke-width="2.5"/>
    <line x1="35" y1="-20" x2="35" y2="680" stroke="#ef4444" stroke-width="1" stroke-dasharray="10,4,2,4"/>
    <text x="35" y="330" fill="#86efac" font-size="12" font-weight="bold" transform="rotate(-90 35 330)" text-anchor="middle">
      VERTICAL RISER PIPE: DIA ${D_tube} mm × H ${H_riser.toFixed(1)} m
    </text>

    <!-- Height Dimension -->
    <line x1="-35" y1="0" x2="-35" y2="660" stroke="#fbbf24" stroke-width="1.2" marker-start="url(#arrowDim)" marker-end="url(#arrowDim)"/>
    <text x="-50" y="330" fill="#fbbf24" font-size="11" transform="rotate(-90 -50 330)" text-anchor="middle">${(H_riser * 1000).toFixed(0)} mm</text>
  </g>

  <!-- Return Loop & Downcomer -->
  <g transform="translate(610, 180)">
    <path d="M 0 0 L 140 0 L 140 380" fill="none" stroke="#22c55e" stroke-width="2" />
    <path d="M 0 70 L 70 70 L 70 380" fill="none" stroke="#22c55e" stroke-width="2" />
  </g>

  <!-- 4. Cyclone Separator -->
  <g transform="translate(760, 360)">
    <!-- Barrel -->
    <rect x="0" y="0" width="200" height="180" fill="#1e293b" stroke="#e879f9" stroke-width="2.2"/>
    <!-- Cone -->
    <polygon points="0,180 200,180 130,400 70,400" fill="#1e293b" stroke="#e879f9" stroke-width="2.2"/>
    <!-- Vortex Finder -->
    <rect x="50" y="-80" width="100" height="140" fill="none" stroke="#e879f9" stroke-width="1.8"/>
    <!-- Rotary Airlock -->
    <circle cx="100" cy="440" r="30" fill="#0f172a" stroke="#e879f9" stroke-width="2"/>
    <line x1="75" y1="440" x2="125" y2="440" stroke="#e879f9" stroke-width="1.5"/>
    <line x1="100" y1="415" x2="100" y2="465" stroke="#e879f9" stroke-width="1.5"/>

    <text x="100" y="90" fill="#f0abfc" font-size="12" font-weight="bold" text-anchor="middle">
      ${dimensions.cycloneType.toUpperCase()} CYCLONE
    </text>
    <text x="100" y="115" fill="#f5d0fe" font-size="10" text-anchor="middle">
      DIA: ${D_cyclone} mm | H: ${H_cyclone} mm
    </text>
    <text x="100" y="490" fill="#4ade80" font-size="10" font-weight="bold" text-anchor="middle">
      ROTARY AIRLOCK Ø${dimensions.airlockDiameterMm} mm
    </text>
    <text x="100" y="118" fill="#f5d0fe" font-size="9" text-anchor="middle">
      EFF ${dimensions.cycloneCollectionEfficiencyPercent.toFixed(1)}% (d50 ${dimensions.cutPointD50Microns.toFixed(1)} µm)
    </text>

    <!-- Diameter Dimension -->
    <line x1="0" y1="-25" x2="200" y2="-25" stroke="#fbbf24" stroke-width="1.2" marker-start="url(#arrowDim)" marker-end="url(#arrowDim)"/>
    <text x="100" y="-35" fill="#fbbf24" font-size="10" text-anchor="middle">Dc = ${D_cyclone} mm</text>
  </g>

  <!-- 5. Blower Fan -->
  <g transform="translate(1040, 560)">
    <circle cx="90" cy="140" r="80" fill="#1e293b" stroke="#38bdf8" stroke-width="2"/>
    <circle cx="90" cy="140" r="30" fill="#0f172a" stroke="#38bdf8" stroke-width="1.5"/>
    <rect x="130" y="40" width="50" height="120" fill="#1e293b" stroke="#38bdf8" stroke-width="1.8"/>
    <text x="90" y="245" fill="#38bdf8" font-size="11" font-weight="bold" text-anchor="middle">
      INDUCED DRAFT FAN
    </text>
    <text x="90" y="265" fill="#93c5fd" font-size="10" text-anchor="middle">
      ${dimensions.fanMotorPowerKW.toFixed(1)} kW @ ${dimensions.fanTotalPressureDropPa} Pa
    </text>
  </g>

  <!-- Connective Duct from Cyclone to Blower -->
  <path d="M 860 280 L 1100 280 L 1100 560" fill="none" stroke="#38bdf8" stroke-width="2" stroke-dasharray="6,4"/>

  <!-- Flow Direction Arrows -->
  <path d="M 300 680 L 370 680" stroke="#38bdf8" stroke-width="2" marker-end="url(#arrow)"/>
  <path d="M 575 620 L 575 420" stroke="#22c55e" stroke-width="2.5" marker-end="url(#arrow)"/>
  <path d="M 720 280 L 760 360" stroke="#e879f9" stroke-width="2" marker-end="url(#arrow)"/>
</svg>`;
}

/**
 * Triggers download of generated CAD file (.dxf or .svg) in browser
 */
export function downloadCadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
