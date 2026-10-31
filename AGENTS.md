# Outrun: Agent Operating Rules & Non-Negotiables

PROJECT: Outrun — Global Climate-Pressure and Corridor Platform for MIGRATORY BIRDS ONLY (class Aves).
Layers: The Race, The Twin, The Break, The Fix, The Watch, The Proof.

The following non-negotiable rules apply across all phases and prompts:

1. **No Data Fabrication or Synthesis**
   Never fabricate, hand-type, or synthesize occurrence records, statuses, traits, or citations. If an API call fails or rate-limits, fail loudly and record the failure in `ingestion_runs.failures_json`. Never fill gaps with placeholder coordinates or fake species.

2. **Strict Occurrence Schema & Provenance**
   Every single occurrence record MUST preserve all 10 provenance fields:
   - `gbifID` (Primary Key)
   - `decimalLatitude` (`lat`)
   - `decimalLongitude` (`lon`)
   - `eventDate`
   - `datasetKey`
   - `license`
   - `basisOfRecord`
   - `countryCode`
   - `coordinateUncertaintyInMeters` (`coord_uncertainty_m`)
   - `retrieved_at` (ISO timestamp)

3. **Universal Epistemic Labeling**
   Every value across the platform must be explicitly labeled as one of:
   - `observed` (Empirically recorded observation, e.g. GBIF Human Observation)
   - `forecast` (Short-term synoptic / meteorological prediction)
   - `projected` (Medium to long-term climate scenario model, e.g. CMIP6)
   - `simulated` (Agent-based flyway corridor simulation / twin)

4. **Honest Missingness ("Insufficient evidence")**
   Missing or unverified evidence must always display "Insufficient evidence", never an invented or zero-filled value.

5. **Conservation Status Provenance**
   Conservation status comes ONLY from a verified authoritative source (e.g. IUCN Red List API with assessment year and source URL).
   Without a verified token and API response, store `status = NULL` and `monitoring_group = 'review_required'`.
   Absence of a threat status NEVER implies or allows inferring "common" or "least concern".

6. **Cloudflare Worker Constraints & Separation of Concerns**
   Adhere strictly to Cloudflare Free Plan limits:
   - Max 50 external subrequests per Worker request
   - Max 10 ms CPU per Worker request
   - Max 100k requests/day, 1,000 KV writes/day, 100k D1 row writes/day
   The Cloudflare Worker serves cached data from D1 / KV only. Heavy data ingestion, GBIF pagination, AVONET parsing, and spatial indexing run strictly in local scripts / external batch jobs, never inside the Worker.

7. **Attribution & Third-Party Code**
   Third-party repositories are libraries and references only. Do not copy whole external projects. Maintain `SOURCES.md` tracking every external library, dataset, API endpoint, citation, and license.
