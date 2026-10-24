const BLOCKING_SEVERITIES = new Set(['P0', 'P1']);

export function analyzeUxEvidence(contract, evidence) {
  const invariants = Array.isArray(contract?.invariants) ? contract.invariants : [];
  const observations = Array.isArray(evidence?.observations) ? evidence.observations : [];
  const observationsById = new Map(observations.map(observation => [observation?.id, observation]));

  const findings = [];

  for (const invariant of invariants) {
    if (!invariant?.id) continue;

    const observation = observationsById.get(invariant.id);
    if (observation?.status === 'PASS') continue;

    findings.push({
      id: invariant.id,
      severity: invariant.severity || 'P0',
      status: 'FAIL',
      node: observation?.node || null,
      expected: observation?.expected || invariant.message || null,
      observed: observation?.observed || 'Missing UX-QA observation',
      evidence: Array.isArray(observation?.evidence) ? observation.evidence : []
    });
  }

  const blockingFindings = findings.filter(finding => BLOCKING_SEVERITIES.has(finding.severity));

  return {
    findings,
    blockingFindings,
    result: blockingFindings.length === 0 ? 'PASS' : 'FAIL'
  };
}
