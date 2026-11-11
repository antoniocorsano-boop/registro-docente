import express, {type Request, type Response} from 'express';
import {createHash, timingSafeEqual} from 'node:crypto';
import {readFileSync, existsSync} from 'node:fs';
import path from 'node:path';
import type {AssessmentGenerationProvider} from '../../src/server/assessmentGenerationRoute.ts';
import {handleAssessmentGenerationRequest} from '../../src/server/assessmentGenerationRoute.ts';

/**
 * S3d-02: a separate, synthetic-only Android HPR application.
 * This module never imports or starts the ordinary server.ts, and never imports
 * any Gemini provider. It must NOT be used for normal Registro Docente traffic.
 */
export const REVIEW_CLASS = '3C Dimostrativa';
export const REVIEW_SOURCE_TITLE = 'Le trasformazioni dell’energia';
export const REVIEW_SOURCE_TEXT = 'Una centrale elettrica trasforma energia primaria in energia elettrica.';
export const REVIEW_OBJECTIVE = 'Riconoscere le trasformazioni energetiche.';

const FAKE_DRAFT = Object.freeze({
  schemaVersion: 1,
  kind: 'assessment-draft',
  title: 'Verifica di prova sulle trasformazioni energetiche',
  description: 'Proposta fittizia da rivedere: nessun servizio esterno utilizzato.',
  questions: [
    {
      type: 'multiple_choice',
      q: 'Quale trasformazione avviene in una centrale elettrica?',
      options: [
        'Da una forma di energia primaria a energia elettrica',
        'Da energia elettrica a materia',
        'Da materia a forza senza trasformazioni'
      ],
      correct: 0,
      explanation: 'Una centrale converte una forma di energia primaria in energia elettrica.'
    },
    {
      type: 'true_false',
      q: 'Una centrale elettrica può convertire energia meccanica in energia elettrica.',
      options: ['Vero', 'Falso'],
      correct: 0,
      explanation: 'Un generatore può trasformare energia meccanica in energia elettrica.'
    }
  ]
});

const fakeProvider: AssessmentGenerationProvider = {
  descriptor: {
    id: 's3d-android-local-simulation',
    displayName: 'Servizio simulato (nessun invio esterno)',
    model: 'synthetic-only'
  },
  async generate(_input, _options) {
    return {output: FAKE_DRAFT};
  }
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isApprovedSyntheticRequest(input: unknown): boolean {
  if (!isRecord(input) || !isRecord(input.source) || !isRecord(input.context)) return false;
  return input.classification === 'TEACHER_PROFESSIONAL'
    && input.explicitTeacherOptIn === true
    && input.source.kind === 'concept'
    && input.source.status === 'ready'
    && input.source.privacy === 'teacher-professional'
    && input.source.title === REVIEW_SOURCE_TITLE
    && input.source.text === REVIEW_SOURCE_TEXT
    && input.context.className === REVIEW_CLASS
    && input.context.objective === REVIEW_OBJECTIVE;
}

/** Credentials are only read from the environment and are never logged. */
export function validReviewAuthorization(header: string | undefined, secret: string): boolean {
  if (!header || !header.startsWith('Basic ')) return false;
  try {
    const raw = Buffer.from(header.slice(6), 'base64').toString('utf8');
    if (!raw.startsWith('docente-prova:')) return false;
    const actual = createHash('sha256').update(raw.slice('docente-prova:'.length)).digest();
    const expected = createHash('sha256').update(secret).digest();
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export interface AndroidReviewOptions {
  accessSecret: string;
  expectedSha: string;
  deployedSha: string;
  expiresAt: string;
  staticRoot?: string;
  now?: () => number;
}

function assertReviewOptions(input: AndroidReviewOptions): number {
  if (input.accessSecret.length < 32) throw new Error('HPR: access secret missing or too short');
  if (!/^[0-9a-f]{40}$/.test(input.expectedSha) || input.expectedSha !== input.deployedSha) {
    throw new Error('HPR: deployed commit does not match the qualified commit');
  }
  const expiry = Date.parse(input.expiresAt);
  if (!Number.isFinite(expiry) || expiry <= (input.now?.() ?? Date.now())) {
    throw new Error('HPR: review expiry missing or elapsed');
  }
  return expiry;
}

export function createAndroidReviewApp(options: AndroidReviewOptions) {
  const expires = assertReviewOptions(options);
  const now = options.now ?? Date.now;
  const staticRoot = options.staticRoot ?? path.resolve('dist');
  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.set({
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Content-Security-Policy': [
        "default-src 'self' data: blob:",
        "connect-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        "object-src 'none'",
        "frame-src 'none'",
        "worker-src 'none'",
        "base-uri 'self'",
        "form-action 'self'"
      ].join('; ')
    });
    next();
  });
  // No permanent service or open-ended review link.
  app.use((_req, res, next) => {
    if (now() >= expires) return res.status(410).send('Ambiente di prova scaduto.');
    next();
  });
  app.use((req, res, next) => {
    if (validReviewAuthorization(req.headers.authorization, options.accessSecret)) return next();
    res.set('WWW-Authenticate', 'Basic realm="Registro Docente - prova isolata", charset="UTF-8"');
    return res.status(401).send('Accesso riservato alla prova con dati fittizi.');
  });

  app.get('/__hpr/status', (_req: Request, res: Response) => res.json({
    environment: 'isolated-android-review',
    provider: 'simulated',
    remoteCalls: false,
    syntheticDataOnly: true,
    commitSha: options.expectedSha,
    expiresAt: options.expiresAt
  }));

  app.get('/api/copilot/assessment-draft/provider', (_req: Request, res: Response) => res.json({
    available: true,
    provider: 'Servizio simulato (nessun invio esterno)',
    model: 'synthetic-only'
  }));

  app.post('/api/copilot/assessment-draft', express.json({limit: '20kb'}),
    async (req: Request, res: Response) => {
      if (!isApprovedSyntheticRequest(req.body)) {
        return res.status(403).json({error: {
          code: 'REMOTE_POLICY_DENIED',
          message: 'Nella prova sono consentiti esclusivamente classe e materiale fittizi.',
          retriable: false
        }});
      }
      const result = await handleAssessmentGenerationRequest(req.body, fakeProvider);
      return res.status(result.status).json(result.body);
    }
  );

  // Every other API or method fails closed: no real provider, uploads, grades,
  // data recovery, background operations, or outbound traffic.
  app.all('/api/*', (_req: Request, res: Response) =>
    res.status(403).json({error: 'API non disponibile in questa prova.'})
  );
  app.all('/__hpr/*', (_req: Request, res: Response) => res.sendStatus(404));
  app.get(['/sw.js', '/service-worker.js', '/manifest.webmanifest'], (_req, res) =>
    res.sendStatus(404)
  );
  app.use(express.static(staticRoot, {index: false, etag: false, maxAge: 0}));

  app.get('*', (_req: Request, res: Response) => {
    const indexPath = path.join(staticRoot, 'index.html');
    if (!existsSync(indexPath)) return res.status(503).send('Compilazione di prova non disponibile.');
    // The normal HTML references third-party fonts and a PDF script.
    // Strip external includes here; the normal app remains unchanged.
    const html = readFileSync(indexPath, 'utf8')
      .replace(/<link\b[^>]*href=["']https?:\/\/[^"']+["'][^>]*>/gi, '')
      .replace(/<script\b[^>]*src=["']https?:\/\/[^"']+["'][^>]*><\/script>/gi, '')
      .replace(/<title>[^<]*<\/title>/i, '<title>Registro Docente — SOLO PROVA</title>');
    return res.type('html').send(html);
  });
  return app;
}
