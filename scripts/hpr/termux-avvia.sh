#!/bin/sh
# Avvio Termux: soltanto file locali e server vincolato a 127.0.0.1.
set -eu
cd "$(dirname "$0")"

case "$(pwd -P)/" in
  "$HOME"/*) ;;
  *) printf '%s\n' "Sposta la cartella di prova nella directory privata di Termux (HOME)." >&2; exit 1 ;;
esac

if ! command -v node >/dev/null 2>&1; then
  printf '%s\n' "Node.js assente. In Termux: pkg install nodejs-lts" >&2
  exit 1
fi
if ! command -v sha256sum >/dev/null 2>&1; then
  printf '%s\n' "Comando sha256sum assente." >&2
  exit 1
fi
if ! sha256sum -c SHA256SUMS >/dev/null; then
  printf '%s\n' "Integrità del pacchetto non verificata: NON avviare." >&2
  exit 1
fi
unset GEMINI_API_KEY GOOGLE_API_KEY OPENAI_API_KEY
export HPR_TERMUX_MODE=synthetic-only
export NODE_ENV=production
printf '%s\n' "Integrità verificata. L'app resterà disponibile soltanto sul telefono."
exec node server.cjs
