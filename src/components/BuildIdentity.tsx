import React from 'react';
import { buildIdentity } from '../product/buildIdentity';

/** Compact, read-only, shared by the locked gate and navigation drawer. */
export function BuildIdentity() {
  return (
    <p data-testid="registro-build-identity" data-source-sha={buildIdentity.sourceSha ?? undefined}
      title={buildIdentity.sourceSha ?? undefined}
      className="text-xs leading-5 text-slate-400 text-center break-words">
      {buildIdentity.text}
    </p>
  );
}
