# Outrun: Three-Minute Demo Script & Honest Limitations

**PROJECT**: Outrun — Global Climate-Pressure and Corridor Platform for MIGRATORY BIRDS ONLY (Class Aves).  
**Layers**: The Race, The Twin, The Break, The Fix, The Watch, The Proof.

---

## 1. Three-Minute Live Demo Script

### Hook (20 seconds)
> *"Chilika Lake and coastal Odisha host over a million migratory waterbirds every single winter. But climate change is rapidly shifting the ecological conditions they depend on across thousands of kilometers. This is Outrun: an open observatory that tracks whether class Aves can outrun shifting climate envelopes across their migratory corridors."*

### World View (30 seconds)
> *"We start with a full global scoreboard of 20 canonical migratory species, partitioned strictly by epistemic evidence levels: GPS-tracked birds, empirical occurrence records, or insufficient evidence. In our SPECIESWATCH view, notice that we segregate Threatened/Priority, Common/Widespread, and Review-Required groups so unlike metrics are never commingled. Every record preserves full GBIF provenance down to license and uncertainty, with zero fabricated coordinates."*

### API Connection & Provenance (30 seconds)
> *"Every external call goes through our Cloudflare Worker and local D1 database, complying strictly with free-tier edge limits. When we inspect synoptic weather at a flyway stopover, the Worker batches requests and serves from D1 or our static cache. Watch what happens if the network drops: our offline fallback immediately serves verified snapshots labeled 'forecast' with honest retrieved timestamps. We never display fake live data."*

### The Race (30 seconds)
> *"Clicking into 'The Race', we calculate climate velocity in both breeding and non-breeding ranges using the Loarie et al. formulation: temporal warming trend divided by spatial temperature gradient. Right next to it, we display the species' AVONET Hand-Wing Index dispersal rank. But notice our verdict: 'Insufficient evidence for a verdict'. Sourced ornithology does not provide an empirical speed conversion from wing morphology to km/decade, so we refuse to assert an unscientific 'keeping up' or 'left behind' claim."*

### The Twin & The Break (40 seconds)
> *"Under 'The Twin', we model the empirical 5th-to-95th percentile thermal niche derived from ERA5 baseline observations against CMIP6 multi-model projections to 2050. The slider reveals envelope turnover and model spread uncertainty between EC-Earth and MPI-ESM. Switching to 'Break & Fix', our Graphology spatial network removes each suitable cluster to measure loss of reachable habitat. It isolates this critical pinch-point right here: losing this single cell severs the flyway into multiple fragmented components."*

### The Fix & Executive Brief (30 seconds)
> *"Under 'The Fix', we toggle 'Protect Link'. Our POST /api/simulate endpoint recomputes graph connectivity in real time, demonstrating restored reachable area and consolidated fragmentation—while explicitly stating our assumption that habitat connectivity does not guarantee demographic animal survival. Finally, one click generates an executive scientific brief and print-to-PDF dossier with our 4-factor Proof confidence rubric, ready for conservation planners."*

---

## 2. Honest Limitations (Say These Yourself)

1. **Routes Drawn Only From Verified Telemetry**:
   Flight trajectories are drawn exclusively from real, published GPS telemetry datasets (e.g. Movebank/GBIF Aves datasets). Species without tracking fixes display verified human occurrences only—no trajectories are ever synthesized or hand-drawn per Non-Negotiable Rule 1.

2. **Thermal Envelope Macro-Climate Model Only**:
   Climate-envelope suitability in The Twin models macro-climatic atmospheric temperature niche compatibility only. It does not account for land cover changes, wetlands drainage, agriculture, wind turbines, power lines, or predator density.

3. **Dispersal Proxy vs. Ground Speed**:
   The Hand-Wing Index (HWI) is a morphological dispersal proxy, not a physical velocity in km/decade. Outrun displays ranks and raw velocity values side-by-side but strictly provides *"Insufficient evidence for a verdict"* rather than asserting arbitrary thresholds.

4. **Open-Meteo Climate API Date Range & Model Spread**:
   CMIP6 HighResMIP models end at year 2050 under current Open-Meteo Climate API coverage. We explicitly expose the spread between `EC_Earth3P_HR` and `MPI_ESM1_2_XR` as modeled uncertainty.

5. **Modeled Corridors are Topological Potentials**:
   Candidate critical links identify graph-theoretic topological vulnerabilities, not confirmed behavioral choke-points. Outrun is designed to support field investigations and corridor prioritization, and never claims to save animals or predict population viability.

6. **Authoritative Status Gating (Rule 5)**:
   Absence of a threat status in public dumps never implies "Least Concern". Without a verified IUCN API token response, status is stored strictly as `NULL` under `review_required`.
