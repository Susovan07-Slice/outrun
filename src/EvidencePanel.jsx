/**
 * src/EvidencePanel.jsx
 *
 * The Proof: how far the numbers shown for a species can be trusted, in plain language.
 * The score comes from the rubric in analytics/proof.ts; sources and limitations are
 * folded away so the panel reads as a summary first.
 */

import React from 'react';
import { CheckCircle2, HelpCircle, AlertCircle, ChevronDown } from 'lucide-react';
import { evaluateProofRubric } from './analytics/proof';

const GRADE_WORDS = {
  'Grade A (High)': ['High confidence', 'var(--success)'],
  'Grade B (Moderate)': ['Moderate confidence', 'var(--teal)'],
  'Grade C (Low)': ['Low confidence', 'var(--warn)'],
  'Insufficient evidence': ['Insufficient evidence', 'var(--danger)'],
};

// One sentence on what most limits confidence: the lowest-scoring part, relative to its weight.
function weakestPoint(dims) {
  const weakest = [...dims].sort((a, b) => a.score / a.weight - b.score / b.weight)[0];
  return weakest && weakest.score < weakest.weight ? weakest : null;
}

const EvidencePanel = ({ species, corridorData, occurrences, tracksSimulated = false }) => {
  if (!species) return null;

  const assessment = evaluateProofRubric({
    species_id: species.species_id,
    scientific_name: species.scientific_name,
    common_name: species.common_name,
    family: species.family,
    evidence_level: species.evidence_level,
    tracked_individuals: species.tracked_individuals,
    tracks_simulated: tracksSimulated,
    occurrence_count: species.occurrence_count,
    occurrences: occurrences || [],
    traits: species.traits,
    corridorData,
  });

  const [gradeWords, gradeColor] = GRADE_WORDS[assessment.confidence_grade] || ['', 'var(--ink)'];
  const weakest = weakestPoint(assessment.dimensions);

  return (
    <div className="proof">
      <div className="proof__summary">
        <div className="proof__score" style={{ borderColor: gradeColor }}>
          <span className="proof__num">{assessment.total_score}</span>
          <span className="proof__den">/ {assessment.max_score}</span>
        </div>
        <div>
          <div className="proof__grade" style={{ color: gradeColor }}>{gradeWords}</div>
          <p className="proof__lead">
            Scored from the data behind this species.
            {weakest && <> Main limit: <strong>{weakest.dimension.toLowerCase()}</strong>.</>}
          </p>
        </div>
      </div>

      <ul className="proof__dims">
        {assessment.dimensions.map((dim) => {
          const Icon = dim.status === 'passed' ? CheckCircle2 : dim.status === 'partial' ? HelpCircle : AlertCircle;
          const tone = dim.status === 'passed' ? 'var(--success)' : dim.status === 'partial' ? 'var(--warn)' : 'var(--danger)';
          return (
            <li key={dim.dimension} className="proof__dim" title={`Scoring: ${dim.criterion}`}>
              <div className="proof__dim-head">
                <Icon size={15} color={tone} />
                <span className="proof__dim-name">{dim.dimension}</span>
                <span className="proof__dots" aria-label={`${dim.score} of ${dim.weight} points`}>
                  {Array.from({ length: dim.weight }, (_, i) => (
                    <span key={i} className={i < dim.score ? 'is-on' : ''} />
                  ))}
                </span>
              </div>
              <p className="proof__dim-text">{dim.details}</p>
            </li>
          );
        })}
      </ul>

      <details className="proof__more">
        <summary>Data sources <ChevronDown size={14} /></summary>
        <ul className="proof__sources">
          {assessment.provenance_manifest.primary_sources.map((src) => (
            <li key={src.name}>
              <strong>{src.name}</strong> · <span className="licence-badge">{src.license}</span>
              <div className="cite">{src.citation}</div>
            </li>
          ))}
        </ul>
      </details>

      <details className="proof__more">
        <summary>Assumptions & limits <ChevronDown size={14} /></summary>
        <ul className="proof__list">
          {assessment.honest_limitations.map((item) => <li key={item}>{item}</li>)}
          {assessment.methodological_assumptions.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </details>
    </div>
  );
};

export default EvidencePanel;
