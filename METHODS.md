# Outrun: Scientific & Analytical Methods (METHODS.md)

This document provides complete mathematical formulations, methodological references, graph topologies, and epistemic boundaries for **The Race**, **The Twin**, **The Break**, and **The Fix** implemented in Outrun.

---

## 1. The Race: Climate Velocity & Dispersal Proxy Comparison

### 1.1 Climate Velocity Formulation
Climate velocity represents the local speed and direction required for an organism to track constant temperature isoclines across geographic space. Outrun follows the formulation established by **Loarie et al. (2009)** and **Burrows et al. (2011)**, reimplemented natively in TypeScript without third-party AGPL code.

Climate velocity $V$ ($\text{km/decade}$) at each grid cell is computed as the ratio of the temporal temperature trend to the local spatial temperature gradient:

$$V = \frac{\frac{\partial T}{\partial t}}{\|\nabla T\|}$$

#### A. Temporal Trend ($\frac{\partial T}{\partial t}$)
The temporal trend is computed from the decadal temperature change between the empirical ERA5 baseline period (2005–2024, midpoint 2014.5) and the CMIP6 HighResMIP multi-model projection period (2025–2050, midpoint 2037.5), spanning $\Delta t = 2.3\text{ decades}$:

$$\frac{\partial T}{\partial t} = \frac{T_{\text{projected, ensemble}} - T_{\text{baseline}}}{\Delta t} \quad \left(^\circ\text{C / decade}\right)$$

#### B. Local Spatial Temperature Gradient ($\|\nabla T\|$)
The local spatial temperature gradient is calculated using centered finite differences with latitude-corrected longitudinal distances:

1. **North-South (Meridional) Gradient**:
   $$\frac{\partial T}{\partial y} = \frac{T(\text{lat} + \Delta\text{lat}, \text{lon}) - T(\text{lat} - \Delta\text{lat}, \text{lon})}{2 \times d_y}$$
   where $d_y = \Delta\text{lat} \times 111.132\text{ km}$ ($1^\circ\text{ latitude} \approx 111.132\text{ km}$).

2. **East-West (Zonal) Gradient**:
   $$\frac{\partial T}{\partial x} = \frac{T(\text{lat}, \text{lon} + \Delta\text{lon}) - T(\text{lat}, \text{lon} - \Delta\text{lon})}{2 \times d_x}$$
   where $d_x = \Delta\text{lon} \times 111.132 \times \cos\left(\text{lat} \times \frac{\pi}{180}\right)\text{ km}$ (latitude-corrected longitudinal distance).

3. **Gradient Magnitude & Numerical Stabilization**:
   $$\|\nabla T\| = \sqrt{\left(\frac{\partial T}{\partial y}\right)^2 + \left(\frac{\partial T}{\partial x}\right)^2} \quad \left(^\circ\text{C / km}\right)$$
   To prevent mathematical singularities (division by zero) across flat plains or homogeneous oceanic regions, a numerical threshold $\epsilon = 10^{-4}\ ^\circ\text{C/km}$ is applied:
   $$V = \frac{\frac{\partial T}{\partial t}}{\max\left(\|\nabla T\|, 10^{-4}\right)}$$

### 1.2 AVONET Hand-Wing Index (HWI) Comparison
- **Metric**: The Hand-Wing Index (HWI), sourced from AVONET (Tobias et al. 2022), is defined as $\text{HWI} = 100 \times \frac{\text{Kipps' distance}}{\text{Wing length}}$.
- **Observatory Ranking**: All matched bird species in Outrun are ordered by HWI, providing a relative rank of morphological flight and dispersal efficiency.
- **Epistemic Label**: `projected` for CMIP6 velocity; `observed` for morphological traits.
- **Honest Verdict Policy ("Insufficient evidence for a verdict")**:
  Outrun **strictly rejects** assigning categorical labels such as *"Keeping up"* or *"Left behind"*. HWI is a dimensionless morphological adaptation proxy, not an empirical ground speed in $\text{km/decade}$. Sourced literature does not provide an authoritative physical velocity threshold equating an HWI value to a required climate tracking speed. The platform honestly displays: **"Insufficient evidence for a verdict"**.

---

## 2. The Twin: Climate-Envelope Suitability & Uncertainty

### 2.1 Empirical Envelope Derivation
For each species and season (`breeding` vs `non_breeding`):
1. Verified baseline temperatures ($T$) are extracted at all empirical GBIF occurrence coordinates and GPS tracking fixes during the ERA5 baseline period (2005–2024).
2. The 5th ($p_{05}$), 10th ($p_{10}$), median ($p_{50}$), 90th ($p_{90}$), and 95th ($p_{95}$) percentiles of observed temperatures are computed.
3. The interval $[p_{05}, p_{95}]$ defines the empirical seasonal climatic niche.

### 2.2 Suitability Scoring Function
For any cell temperature $T$, climate suitability $S(T) \in [0.0, 1.0]$ is scored as follows:
- **Optimal Core Niche** ($T \in [p_{10}, p_{90}]$): $S(T) = 1.0$
- **Lower Marginal Transition** ($T \in [p_{05}, p_{10})$): $S(T) = 0.5 + 0.5 \times \frac{T - p_{05}}{p_{10} - p_{05}}$
- **Upper Marginal Transition** ($T \in (p_{90}, p_{95}]$): $S(T) = 1.0 - 0.5 \times \frac{T - p_{90}}{p_{95} - p_{90}}$
- **Sub-Marginal Decay** ($T < p_{05}$ or $T > p_{95}$): Exponential decay $S(T) = \max\left(0.0, 0.5 \times e^{-\frac{|T - p_{\text{boundary}}|}{3.0}}\right)$

### 2.3 Model Spread as Projection Uncertainty
Suitability is evaluated independently for each CMIP6 model:
1. $S_{\text{m1}}$ under `EC_Earth3P_HR`
2. $S_{\text{m2}}$ under `MPI_ESM1_2_XR`
- **Future Ensemble Suitability**: $S_{\text{future}} = \frac{S_{\text{m1}} + S_{\text{m2}}}{2}$
- **Model Uncertainty Spread**: $\sigma_{\text{spread}} = |S_{\text{m1}} - S_{\text{m2}}|$

### 2.4 Epistemic Label & Limitations
- **Epistemic Label**: strictly `simulated`.
- **Transparent Limitation**: Suitability models **macro-climate thermal envelope only**. It does not account for land cover, wetlands drainage, agriculture, power lines, wind farms, or predator density.

---

## 3. The Break: Graphology Corridor & Critical Link Ranking

### 3.1 Network Topology
Outrun constructs an undirected spatial graph $G = (V, E)$ using `graphology`:
- **Nodes ($V$)**: All grid cells with future climate suitability $S_{\text{future}} \ge 0.5$. Each node has a latitude-corrected surface area:
  $$\text{Area}(v) = (5 \times 111.132) \times \left(5 \times 111.132 \times \cos(\text{lat}_v)\right) \quad (\text{km}^2)$$
- **Edges ($E$)**: An edge connects node $u$ and node $v$ if their great-circle distance (Haversine) satisfies:
  $$\text{Dist}(u, v) \le D_{\text{max}} \quad (D_{\text{max}} = 1,200\text{ km, documented migratory flight step})$$

### 3.2 Connectivity Metrics
- **Reachable Suitable Area**: Surface area of the largest connected component ($LCC$).
- **Network Fragmentation**: Total number of connected components ($N_{\text{components}}$).

### 3.3 Bottleneck Sensitivity Analysis ("The Break")
To rank candidate critical links, each node $v \in V$ is sequentially removed:
1. Recompute the sub-graph $G \setminus \{v\}$.
2. Calculate area loss: $\Delta A(v) = A_{\text{reachable}}(G) - A_{\text{reachable}}(G \setminus \{v\})$.
3. Calculate fragmentation increase: $\Delta C(v) = N_{\text{components}}(G \setminus \{v\}) - N_{\text{components}}(G)$.
4. Compute composite criticality score:
   $$\text{Score}(v) = \frac{\Delta A(v)}{1000} + 250 \times \Delta C(v)$$
Nodes with the highest score are designated as **"candidate critical links"** (pinch points where habitat loss fragments the flyway).

---

## 4. The Fix: Simulation Engine (`POST /api/simulate`)

### 4.1 Intervention Protocol
The Worker endpoint `POST /api/simulate` accepts:
`{ species: string, season: string, protected_node_id: string, action: 'protect' | 'restore' }`
- **Simulation**: Modifies the target node's suitability and recomputes the exact same network connectivity metrics ($A_{\text{reachable}}$, $N_{\text{components}}$, $N_{\text{edges}}$).
- **Output**: Returns baseline metrics, simulation result, difference ($\Delta A$, $\% \text{ change}$, $\Delta C$), and explicit assumptions.

### 4.2 Ethical Non-Negotiable
- **Never claim animals saved**: Outrun models topological network connectivity change. It does not model population demographics, survival rates, or reproductive output. Results must always state: *"Protection restores/maintains modeled corridor connectivity and does not predict animal demographic survival."*

---

## 5. The Watch: Synoptic Weather Risk Engine & Seasonal Gating

### 5.1 Seasonal Window Gating Protocol
To prevent false-positive hazard alarms during seasons when a species is absent, Outrun enforces a strict seasonal gating policy:
- **Active Window**: Derived from empirical GBIF human observations and onboard GPS telemetry timestamp distributions. An active calendar month is defined as any month containing $\ge 5\%$ of verified empirical occurrences, falling back to canonical migratory schedules (Breeding: May–Aug; Non-Breeding: Nov–Feb) if occurrences are sparse.
- **Gating Rule**: If the current UTC calendar month falls outside a species' seasonal window, synoptic weather hazards are labeled `dormant_outside_window` and `forecast_risk = false`.

### 5.2 Atmospheric Hazard Thresholds & Authoritative Literature Citations
Every physical threshold evaluated across `/api/weather` is explicitly linked to published ornithological literature or categorized as a transparent model assumption:
1. **Severe Wind Speed ($W_{10m} > 54.0\text{ km/h} \approx 15.0\text{ m/s}$)**:
   - *Authoritative Citation*: Liechti, F. (2006). *The influence of weather on migration*. Journal of Ornithology, 147(2), 202–211; Shamoun-Baranes, J., et al. (2017).
   - *Assumption*: High crosswinds and gale-force headwinds induce mechanical flight turbulence exceeding aerodynamic metabolic endurance.
2. **Heavy Precipitation ($P > 5.0\text{ mm/hr}$)**:
   - *Authoritative Citation*: Newton, I. (2007). *The Migration Ecology of Birds*. Academic Press.
   - *Assumption*: Sustained precipitation increases plumage thermal conductance, degrades aerofoil lift, and triggers immediate stopover grounding.
3. **Acute Thermal Stress Boundaries ($T > 38.0^\circ\text{C}$ or $T < -20.0^\circ\text{C}$)**:
   - *Authoritative Citation*: McKechnie, A. E., & Wolf, B. O. (2010). *Climate change increases the likelihood of catastrophic avian mortality events during extreme heat waves*. PNAS, 107(18), 8077–8084.
   - *Assumption*: Ambient temperatures exceeding biological thermal neutral zones necessitate unsustainable evaporative water loss or induce rapid hypothermia during high-altitude pass crossings.

---

## 6. The Proof: 4-Factor Rubric-Based Scientific Confidence

To avoid false illusions of precision, Outrun scores all species corridor models across a transparent, 10-point methodological rubric:

$$\text{Confidence Score} = S_{\text{evidence}} + S_{\text{temporal}} + S_{\text{climate}} + S_{\text{traits}} \in [0, 10]$$

| Dimension | Points | Criteria & Evaluation Rule |
| :--- | :--- | :--- |
| **1. Empirical Evidence Quality** | 0–3 pts | • **3 pts**: Verified onboard GPS telemetry tracks (monotonic, deduplicated).<br>• **2 pts**: Stratified human occurrences $\ge 500$ records with coordinate uncertainty $< 10\text{ km}$.<br>• **1 pt**: Restricted occurrence sample ($< 500$ records).<br>• **0 pts**: Zero verified records ("Insufficient evidence"). |
| **2. Temporal & Seasonal Span** | 0–3 pts | • **3 pts**: Verified annual cycle coverage spanning $\ge 8$ distinct calendar months.<br>• **2 pts**: Partial annual cycle spanning 4–7 distinct months.<br>• **1 pt**: Narrow seasonal sampling ($< 4$ months; breeding/wintering bias).<br>• **0 pts**: Unverified or missing timestamps. |
| **3. CMIP6 Multi-Model Agreement** | 0–2 pts | • **2 pts**: Strong multi-model agreement ($\sigma_{\text{spread}} \le 0.15$ between `EC_Earth3P_HR` and `MPI_ESM1_2_XR`).<br>• **1 pt**: Moderate multi-model spread ($0.15 < \sigma_{\text{spread}} \le 0.30$).<br>• **0 pts**: High model divergence ($\sigma_{\text{spread}} > 0.30$). |
| **4. Taxonomic & Trait Completeness** | 0–2 pts | • **2 pts**: Confirmed AVONET join with verified Hand-Wing Index (HWI) and Migration Category.<br>• **1 pt**: Partial AVONET record.<br>• **0 pts**: Unmatched taxon in AVONET 2022. |

### 6.1 Grade Thresholds
- **Score $\ge 8 / 10$**: **Grade A (High Scientific Confidence)**
- **Score $5–7 / 10$**: **Grade B (Moderate Scientific Confidence)**
- **Score $3–4 / 10$**: **Grade C (Low Scientific Confidence)**
- **Score $< 3 / 10$**: **"Insufficient evidence"** (Rule 4 Honest Missingness policy enforced)

---

## 7. The Brief: Executive Scientific Dossier Protocol (`GET /api/brief`)

The `/api/brief` endpoint synthesizes an audit-ready, one-page printable executive dossier strictly from computed metrics and verified source metadata:
1. **Taxonomy & IUCN Provenance**: Authoritative status from verified API responses only; otherwise labeled `Insufficient evidence (stored as NULL per Rule 5)`.
2. **The Race Dossier**: Breeding and non-breeding velocity next to AVONET HWI dispersal rank with explicit non-verdict disclosure.
3. **The Twin & Break Dossier**: Projected envelope cell turnover under CMIP6 2050 and top candidate critical link identification.
4. **The Watch & Proof Dossier**: Seasonal gating status, active atmospheric hazards, and the 4-factor rubric confidence score.
5. **Print-to-PDF Formatting**: Built with dedicated `@media print` layout styles ensuring a clean, unclipped single-page A4/Letter printable report.

---

## 8. SpeciesWatch: Segregated Metric Definitions

To ensure scientific integrity, the platform partitions the observatory into three distinct monitoring tabs. Unlike scores are never commingled or ranked against each other:
1. **Threatened / Priority**: Evaluated on **Flyway Topological Criticality & Core Area Vulnerability** (Severing loss percentage $\Delta A / A$, candidate critical bottleneck count, and connectivity fragmentation increase $\Delta C$).
2. **Common / Widespread**: Evaluated on **Geographic Climate Tracking Pressure & Dispersal Capacity** (Climate velocity $V$ in $\text{km/decade}$ and AVONET HWI morphological dispersal rank).
3. **Review Required**: Evaluated on **Epistemic Missingness & Provenance Gaps** (Rule 5 conservation token audit, occurrence sample threshold $< 500$, and trait join verification).
