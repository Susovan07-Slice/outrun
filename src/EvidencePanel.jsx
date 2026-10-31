/**
 * src/EvidencePanel.jsx
 * 
 * Outrun Phase 5: The Proof — Interactive Evidence & Confidence Rubric Inspector
 */

import React from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  FileCheck,
  Database,
  Calendar,
  Layers,
  Info,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';
import { evaluateProofRubric } from './analytics/proof';

const EvidencePanel = ({ species, corridorData, occurrences }) => {
  if (!species) return null;

  const assessment = evaluateProofRubric({
    species_id: species.species_id,
    scientific_name: species.scientific_name,
    common_name: species.common_name,
    family: species.family,
    evidence_level: species.evidence_level,
    tracked_individuals: species.tracked_individuals,
    occurrence_count: species.occurrence_count,
    occurrences: occurrences || [],
    traits: species.traits,
    corridorData,
  });

  const getGradeColor = (grade) => {
    if (grade.includes('Grade A')) return '#047857';
    if (grade.includes('Grade B')) return '#2563EB';
    if (grade.includes('Grade C')) return '#D97706';
    return '#DC2626';
  };

  return (
    <div className="evidence-panel-wrapper">
      {/* Rubric Score Top Banner */}
      <div className="proof-banner-card">
        <div className="proof-banner-left">
          <div className="proof-score-circle" style={{ borderColor: getGradeColor(assessment.confidence_grade) }}>
            <span className="score-num font-mono">{assessment.total_score}</span>
            <span className="score-den">/ {assessment.max_score}</span>
          </div>
          <div>
            <div className="proof-grade-title" style={{ color: getGradeColor(assessment.confidence_grade) }}>
              {assessment.confidence_grade}
            </div>
            <p className="proof-rubric-desc">
              Rubric-based scientific confidence derived from empirical sample density, multi-model agreement, and trait join completeness.
            </p>
          </div>
        </div>

        <div className="proof-rubric-version font-mono">
          {assessment.rubric_version}
        </div>
      </div>

      {/* 4 Rubric Dimensions */}
      <div className="proof-dimensions-list">
        <div className="section-small-title">EVALUATED METHODOLOGICAL DIMENSIONS (METHODS.md Section 6)</div>
        {assessment.dimensions.map((dim, i) => {
          const isPassed = dim.status === 'passed';
          const isPartial = dim.status === 'partial';

          return (
            <div key={i} className={`proof-dim-card ${dim.status}`}>
              <div className="dim-head-row">
                <div className="dim-name-group">
                  {isPassed ? (
                    <CheckCircle2 size={16} color="#047857" />
                  ) : isPartial ? (
                    <HelpCircle size={16} color="#D97706" />
                  ) : (
                    <AlertCircle size={16} color="#DC2626" />
                  )}
                  <span className="dim-title">{dim.dimension}</span>
                </div>
                <span className="dim-score-pill font-mono">
                  {dim.score} / {dim.weight} pts
                </span>
              </div>

              <div className="dim-criterion">{dim.criterion}</div>
              <p className="dim-details">{dim.details}</p>
            </div>
          );
        })}
      </div>

      {/* Provenance Manifest & Primary Data Sources */}
      <div className="proof-sources-box">
        <div className="section-small-title">PRIMARY DATA SOURCES & ATTRIBUTION</div>
        <div className="sources-table-responsive">
          <table className="proof-table">
            <thead>
              <tr>
                <th>Dataset</th>
                <th>Type</th>
                <th>Licence</th>
                <th>Formal Citation</th>
              </tr>
            </thead>
            <tbody>
              {assessment.provenance_manifest.primary_sources.map((src, i) => (
                <tr key={i}>
                  <td className="src-name font-mono">{src.name}</td>
                  <td>{src.type}</td>
                  <td><span className="licence-badge">{src.license}</span></td>
                  <td className="src-cite font-mono">{src.citation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assumptions & Limitations (Transparent Science) */}
      <div className="proof-limits-grid">
        <div className="proof-limit-box">
          <span className="limit-title">Documented Assumptions</span>
          <ul>
            {assessment.methodological_assumptions.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="proof-limit-box warning">
          <span className="limit-title">Honest Sourced Limitations</span>
          <ul>
            {assessment.honest_limitations.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default EvidencePanel;
