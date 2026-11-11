import {createAndroidReviewApp} from './androidReviewApp.ts';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error('HPR: missing required configuration ' + name);
  return value;
}

// An isolated Render branch may start only in explicit synthetic mode,
// on the exact qualified commit, with a time-limited access secret.
// Do not add a fallback to server.ts or any real external provider.
if (required('HPR_ANDROID_MODE') !== 'synthetic-only') {
  throw new Error('HPR: real providers are prohibited');
}

const app = createAndroidReviewApp({
  accessSecret: required('HPR_ANDROID_ACCESS_SECRET'),
  expectedSha: required('HPR_EXPECTED_SHA'),
  deployedSha: required('RENDER_GIT_COMMIT'),
  expiresAt: required('HPR_EXPIRES_AT')
});
const port = Number.parseInt(process.env.PORT ?? '10000', 10);
if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  throw new Error('HPR: invalid port');
}
app.listen(port, '0.0.0.0', () => {
  console.log('HPR S3d Android: synthetic-only isolated review ready');
});
