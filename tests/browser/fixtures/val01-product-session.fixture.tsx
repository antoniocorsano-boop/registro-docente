import React from 'react';
import {createRoot} from 'react-dom/client';
import {SecureRegistroRoot} from '../../../src/components/SecureRegistroRoot';
import '../../../src/index.css';
import '../../../src/styles/lsm01cBMobilePrimaryActionDock.css';
// Candidate only. No query parameter, localStorage or production entrypoint
// enables the migration. Use synthetic local archives in CI.
createRoot(document.getElementById('root')!).render(<SecureRegistroRoot archiveMigrationCandidate/>);
