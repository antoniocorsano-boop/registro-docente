/** Non-sensitive build provenance. Not an APK digest, signature or release claim. */
export function resolveBuildIdentity(sha: unknown, kind: unknown) {
  const sourceSha = typeof sha === 'string' && /^[0-9a-f]{40}$/.test(sha) ? sha : null;
  const label = sourceSha && kind === 'lab' ? 'Collaudo B4.3'
    : sourceSha && kind === 'android' ? 'Android'
    : 'Versione locale';
  return {
    sourceSha,
    label,
    text: sourceSha ? label + ' · ' + sourceSha.slice(0, 12) : 'Compilazione non identificata'
  };
}

export const buildIdentity = resolveBuildIdentity(
  import.meta.env?.VITE_REGISTRO_BUILD_SHA,
  import.meta.env?.VITE_REGISTRO_BUILD_KIND
);
