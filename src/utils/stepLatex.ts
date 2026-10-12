/**
 * LaTeX SOURCE FOR EVERY DERIVATION STEP
 *
 * The `equation` field in `dryerCalculations.ts` is plain text, and stays that
 * way: it is the copyable, searchable, plain-text form, and the derivation
 * search box matches against it. This file holds the typeset form for the same
 * equations, and `latexForStep` joins the two.
 *
 * WHY A SEPARATE MAP RATHER THAN A SECOND STRING ON addStep.
 * Two `addStep` arguments would sit side by side at every call site and drift
 * apart the moment one was edited. Keeping all 60 expressions in one table makes
 * the whole set reviewable at a glance, and `checkAllEquationsHaveLatex` proves
 * the table cannot fall behind the engine.
 *
 * KEYED BY `category|symbol`, NOT BY SYMBOL ALONE. Three symbols legitimately
 * appear twice under different categories — `F_r` and `rho_b` in both Hopper and
 * Screw Feeder Design, `P_motor` in Screw Feeder Design and Feeding & Ancillary —
 * with genuinely different equations each time. Keying on the symbol alone would
 * silently give three steps the wrong expression.
 */

/**
 * EXTRA LaTeX FOR CARD-STYLE DISPLAYS THAT HAVE NO CalculationStep.
 *
 * `DimensionCalculator` renders its nine cyclone cards by building the formula
 * string inline with interpolated values, so those equations never pass through
 * `addStep` and are not in the table above. They are keyed by the card's own
 * symbol instead, and the substitution line stays plain text because it carries
 * live values.
 *
 * Kept in this file rather than beside the JSX so every LaTeX string in the app
 * is reviewable in one place, and so `stepLatex.test.ts` can compile-check these
 * along with the rest.
 */
export const INLINE_LATEX: Record<string, string> = {
  cyclone_Dc: String.raw`D_c = \sqrt{\frac{Q_{v,\mathrm{out}}}{C_{\mathrm{area}} \, v_{ci}}}`,
  cyclone_a: String.raw`a = k_a \, D_c`,
  cyclone_b: String.raw`b = k_b \, D_c`,
  cyclone_De: String.raw`D_e = k_{De} \, D_c`,
  cyclone_S: String.raw`S = k_S \, D_c`,
  cyclone_h: String.raw`h = k_h \, D_c`,
  cyclone_z: String.raw`z = \left(H - h\right) = k_z \, D_c`,
  cyclone_H: String.raw`H = h + z = k_H \, D_c`,
  cyclone_B: String.raw`B = k_B \, D_c`,
};

/** Plain-text equation -> LaTeX. */
const LATEX: Record<string, string> = {
  // ---------------------------------------------------------- Material Balance
  'Material Balance|F_ds': String.raw`F_{\mathrm{ds}} = F_{\mathrm{wet}} \times \left(1 - w_1\right)`,
  'Material Balance|F_prod': String.raw`F_{\mathrm{prod}} = \frac{F_{\mathrm{ds}}}{1 - w_2}`,
  'Material Balance|W_e': String.raw`W_e = F_{\mathrm{wet}} - F_{\mathrm{prod}}`,
  'Material Balance|Delta_w_pct': String.raw`\Delta w_{\%} = \left(\frac{w_1 - w_2}{w_1}\right) \times 100`,

  // ------------------------------------------------------ Psychrometric & Air
  'Psychrometric & Air|P_atm': String.raw`P_{\mathrm{atm}} = 101.325 \left(1 - 2.25577 \times 10^{-5}\, z\right)^{5.25588}`,
  'Psychrometric & Air|Y_amb': String.raw`Y_{\mathrm{amb}} = 0.622 \, \frac{P_v}{P_{\mathrm{atm}} - P_v}`,
  'Psychrometric & Air|rho_in': String.raw`\rho_{\mathrm{in}} = \frac{P_{\mathrm{atm}} \left(1 + 1.608\, Y_{\mathrm{amb}}\right)}{R_{\mathrm{da}} \left(T_{\mathrm{in}} + 273.15\right) \left(1 + Y_{\mathrm{amb}}\right)}`,

  // ------------------------------------------------------------- Energy Balance
  'Energy Balance|h_fg': String.raw`h_{fg} = 2501 - 2.361 \, T_{\mathrm{out}}`,
  'Energy Balance|Q_evap': String.raw`Q_{\mathrm{evap}} = W_e \left[h_{fg} + C_{p,w} \left(T_{\mathrm{out}} - T_{\mathrm{feed}}\right)\right]`,
  'Energy Balance|Q_solid': String.raw`Q_{\mathrm{solid}} = \left[F_{\mathrm{ds}} \, C_{p,s} + F_{\mathrm{prod}} \, w_2 \, C_{p,w}\right] \left(T_{\mathrm{prod}} - T_{\mathrm{feed}}\right)`,
  'Energy Balance|G_da': String.raw`G_{\mathrm{da}} = \frac{Q_{\mathrm{evap}} + Q_{\mathrm{solid}} + Q_{\mathrm{loss}}}{\left(C_{p,a} + Y_{\mathrm{amb}} C_{p,v}\right) \left(T_{\mathrm{in}} - T_{\mathrm{out}}\right)}`,
  'Energy Balance|R_as': String.raw`R_{\mathrm{as}} = \frac{G_{\mathrm{da},h}}{F_{\mathrm{ds}}}`,
  'Energy Balance|Q_heater': String.raw`Q_{\mathrm{heater}} = G_{\mathrm{da}} \left(C_{p,a} + Y_{\mathrm{amb}} C_{p,v}\right) \left(T_{\mathrm{in}} - T_{\mathrm{amb}}\right)`,
  'Energy Balance|A_hex': String.raw`A_{\mathrm{hex}} = \frac{Q_{\mathrm{heater}}}{U \left(F_t \, \Delta T_{\mathrm{lm}}\right)}`,

  // ------------------------------------------------------------ Fluid Dynamics
  'Fluid Dynamics|v_t': String.raw`v_t = \frac{\mathrm{Re}_t \, \mu_{\mathrm{air}}}{\rho_{\mathrm{avg}} \, d_p}
    \qquad \text{with} \qquad
    \mathrm{Ar} = 18\,\mathrm{Re}_t \left(1 + 0.15\,\mathrm{Re}_t^{0.687}\right)`,
  'Fluid Dynamics|v_salt': String.raw`v_{\mathrm{salt}} = K_s \, v_{\mathrm{terminal}} \left(1 + 0.6\, \mu_s\right)`,
  'Fluid Dynamics|P_gauge': String.raw`\text{System Mode:}\quad \textbf{Negative pressure}\ (-)`,

  // ---------------------------------------------------------- Dryer Dimensions
  'Dryer Dimensions|D_tube': String.raw`D_{\mathrm{tube}} = \sqrt{\frac{4\, \overline{Q}_v}{\pi \, v_{\mathrm{air}}}}`,
  'Dryer Dimensions|L_pipe': String.raw`L_{\mathrm{pipe}} = \max\!\left(20.0,\; \tau \, u_s\right)
    \qquad
    H_{\mathrm{col}} = \operatorname{clamp}\!\left(5.5,\; 0.35\, L_{\mathrm{pipe}},\; 8.0\right)`,
  'Dryer Dimensions|D_venturi': String.raw`D_{\mathrm{venturi}} = 0.75 \, D_{\mathrm{tube}}`,

  // ----------------------------------------------------------------- Hopper
  'Hopper Design|Basis': String.raw`\text{IITA/RMRDC HQCF Flash Dryer Design} \quad (\text{Section 3.1})`,
  'Hopper Design|F_r': String.raw`F_r = \text{User Input Design Capacity}`,
  'Hopper Design|rho_b': String.raw`\rho_b = \text{Material Property Value}`,
  'Hopper Design|t_r': String.raw`t_r = \text{Operational Loading Interval}`,
  'Hopper Design|m': String.raw`m = F_r \left(\frac{t_r}{60}\right)`,
  'Hopper Design|V_required': String.raw`V_{\mathrm{required}} = \frac{m}{\rho_b}`,
  'Hopper Design|Allowance': String.raw`\text{Allowance} = 10\% \; \text{Volumetric Freeboard Margin}`,
  'Hopper Design|H_c': String.raw`H_c = 1.1 \left[\frac{F_r \, t_r}{\rho_b \, 60}\right]`,
  'Hopper Design|h2': String.raw`h_2 = \frac{3 \left(H_c - h_1 W_1 L_1\right)}{W_1 L_1 + W_2 L_2 + \sqrt{\left(W_1 L_1\right)\left(W_2 L_2\right)}}`,
  'Hopper Design|Angle_C': String.raw`A = \arctan\!\left(\frac{h_2}{\mathrm{Run}_L}\right)
    \qquad
    B = \arctan\!\left(\frac{h_2}{\mathrm{Run}_W}\right)
    \qquad
    \cot^{2} C = \cot^{2} A + \cot^{2} B`,
  'Hopper Design|V_total': String.raw`V_{\mathrm{total}} = V_{\mathrm{upper}} + V_{\mathrm{lower}}
    = h_1 \left(W_1 L_1\right) + \frac{h_2}{3}\left[A_1 + A_2 + \sqrt{A_1 A_2}\right]
    \;\ge\; H_c`,

  // ----------------------------------------------------------- Screw Feeder
  'Screw Feeder Design|F_r': String.raw`F_r = \text{Design Feed Throughput}`,
  'Screw Feeder Design|rho_b': String.raw`\rho_b = \text{Material Assumption}`,
  'Screw Feeder Design|Q_v': String.raw`Q_v = \frac{F_r}{\rho_b}`,
  'Screw Feeder Design|Q_v,imp': String.raw`Q_{v,\mathrm{imp}} = Q_v \times 35.3147`,
  'Screw Feeder Design|D_screw': String.raw`D_{\mathrm{screw}} = \text{Selected Nominal Size}`,
  'Screw Feeder Design|Loading': String.raw`\text{Loading} = 30\% \quad (\text{CEMA Standard Class 30 Material})`,
  'Screw Feeder Design|C_rpm': String.raw`V_{\mathrm{rev}} = \text{pitch} \times \frac{\pi}{4} \left(D_o^{2} - D_{\mathrm{shaft}}^{2}\right)
    \;\longrightarrow\;
    C_{\mathrm{rpm}} = V_{\mathrm{rev}} \, F_{\mathrm{loading}} \times 60`,
  'Screw Feeder Design|N_req': String.raw`N_{\mathrm{req}} = \frac{Q_{v,\mathrm{imp}}}{C_{\mathrm{rpm}}}`,
  'Screw Feeder Design|N_selected': String.raw`N_{\mathrm{selected}} = \text{Selected Standard Operating Speed}`,
  'Screw Feeder Design|Q_actual': String.raw`Q_{\mathrm{actual}} = C_{\mathrm{rpm}} \, N_{\mathrm{selected}}`,
  'Screw Feeder Design|Margin': String.raw`\text{Margin} = \left(\frac{Q_{\mathrm{actual}} - Q_{v,\mathrm{imp}}}{Q_{v,\mathrm{imp}}}\right) \times 100`,
  'Screw Feeder Design|P_f': String.raw`P_f = \frac{L \, N \, F_d \, F_b}{1\,000\,000}`,
  'Screw Feeder Design|P_m': String.raw`P_m = \frac{C \, L \, W \, F_f \, F_m \, F_p}{1\,000\,000}`,
  'Screw Feeder Design|F_o': String.raw`F_o = 3.0 \quad (\text{CEMA Heavy Starting / Low HP Factor})`,
  'Screw Feeder Design|E': String.raw`E = 0.88 \quad (88\% \; \text{Transmission Efficiency})`,
  'Screw Feeder Design|P_total': String.raw`P_{\mathrm{total}} = \frac{\left(P_f + P_m\right) F_o}{E}`,
  'Screw Feeder Design|P_motor': String.raw`P_{\mathrm{motor}} = \text{Commercial Standard Geared Motor Rating with VFD}`,

  // ------------------------------------------------------- Cyclone Separator
  'Cyclone Separator|D_c': String.raw`D_c = \sqrt{\frac{Q_{v,\mathrm{out}}}{C_{\mathrm{area}} \, v_{ci}}}`,
  'Cyclone Separator|a': String.raw`a = k_a \, D_c`,
  'Cyclone Separator|b': String.raw`b = k_b \, D_c`,
  'Cyclone Separator|D_e': String.raw`D_e = k_{De} \, D_c`,
  'Cyclone Separator|S': String.raw`S = k_S \, D_c`,
  'Cyclone Separator|h': String.raw`h = k_h \, D_c`,
  'Cyclone Separator|z': String.raw`z = \left(H - h\right) = k_z \, D_c`,
  'Cyclone Separator|H': String.raw`H = h + z = k_H \, D_c`,
  'Cyclone Separator|B': String.raw`B = k_B \, D_c`,
  'Cyclone Separator|d_50': String.raw`d_{50} = \sqrt{\frac{9 \, \mu_{\mathrm{air}} \, b}{2 \pi N_e \, v_{ci} \left(\rho_p - \rho_{\mathrm{air}}\right)}}`,
  'Cyclone Separator|Delta_P_cyc': String.raw`\Delta P = \mathrm{Eu} \left(\frac{1}{2}\, \rho_{\mathrm{out}} \, v_{ci}^{2}\right)`,

  // ------------------------------------------------------ Feeding & Ancillary
  'Feeding & Ancillary|P_motor': String.raw`P_{\mathrm{motor}} = \frac{Q_v \, \Delta P_{\mathrm{total}} / \eta_{\mathrm{fan}}}{\eta_{\mathrm{belt}}} \times \mathrm{SF}_{\mathrm{service}}`,
};

/**
 * The LaTeX form of a step's equation, or null when the step has no entry.
 *
 * Returned rather than throwing so the UI can fall back to the plain-text
 * `equation` instead of rendering an empty box.
 */
export function latexForStep(category: string, symbol: string): string | null {
  return LATEX[`${category}|${symbol}`] ?? null;
}

/** Every key currently in the step table. Used by the completeness test. */
export function allLatexKeys(): string[] {
  return Object.keys(LATEX);
}

/** Every key in the inline (non-step) table. Used by the compile test. */
export function allInlineLatexKeys(): string[] {
  return Object.keys(INLINE_LATEX);
}
