import React, { useState } from 'react';
import { AppSettings, ClassData } from '../types';
import { encryptDataWithPassword, decryptDataWithPassword } from '../cryptoUtils';
import { createBackupPayload } from '../security/backupPayload';
import type { CompleteSecureAppSnapshot } from '../security/secureAppStorage';
import { today } from '../utils';
import {
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  FileCheck2,
  Trash2,
  KeyRound,
  Download,
  Upload,
  AlertTriangle,
  ServerOff,
  FileText,
  CheckCircle2
} from 'lucide-react';

interface PrivacyViewProps {
  settings: AppSettings;
  classes: ClassData[];
  backupSnapshot: CompleteSecureAppSnapshot;
  isPrivacyShieldActive: boolean;
  onTogglePrivacyShield: () => void;
  onExportEncryptedBackup: (encryptedJson: string) => void;
  onImportEncryptedBackup: (decryptedData: unknown) => Promise<void>;
  onFactoryReset: () => void;
}

export const PrivacyView: React.FC<PrivacyViewProps> = ({
  settings,
  classes,
  backupSnapshot,
  isPrivacyShieldActive,
  onTogglePrivacyShield,
  onExportEncryptedBackup,
  onImportEncryptedBackup,
  onFactoryReset
}) => {
  const [encryptPassword, setEncryptPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isEncrypting, setIsEncrypting] = useState(false);

  const [decryptPassword, setDecryptPassword] = useState('');
  const [selectedEncryptedFile, setSelectedEncryptedFile] = useState<File | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);

  // Total students & evaluations protected
  let totalStudents = 0;
  let totalGrades = 0;
  classes.forEach(c => {
    totalStudents += c.students.length;
    totalGrades += (c.grades || []).length;
  });

  const handleExportEncrypted = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!encryptPassword) {
      alert('Inserisci una password di cifratura.');
      return;
    }
    if (encryptPassword !== confirmPassword) {
      alert('Le password inserite non coincidono.');
      return;
    }
    if (encryptPassword.length < 6) {
      alert('La password deve contenere almeno 6 caratteri per garantire adeguata sicurezza.');
      return;
    }

    setIsEncrypting(true);
    try {
      const payload = createBackupPayload(backupSnapshot);
      const encryptedString = await encryptDataWithPassword(payload, encryptPassword);

      // Download file
      const blob = new Blob([encryptedString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Backup_Cifrato_GDPR_${today()}.enc.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onExportEncryptedBackup(encryptedString);

      setEncryptPassword('');
      setConfirmPassword('');
      alert('Backup protetto con crittografia AES-256-GCM esportato con successo!');
    } catch (err) {
      console.error(err);
      alert('Errore durante la cifratura del backup.');
    } finally {
      setIsEncrypting(false);
    }
  };

  const handleImportEncrypted = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEncryptedFile) {
      alert('Seleziona prima il file di backup cifrato (.enc.json).');
      return;
    }
    if (!decryptPassword) {
      alert('Inserisci la password di decifratura.');
      return;
    }

    setIsDecrypting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const encryptedText = event.target?.result as string;
        const decryptedData = await decryptDataWithPassword(encryptedText, decryptPassword);

        await onImportEncryptedBackup(decryptedData);
        setDecryptPassword('');
        setSelectedEncryptedFile(null);
        alert('Backup cifrato verificato e ripristinato con successo!');
      } catch (err: any) {
        console.error(err);
        alert(err.message || 'Password errata o file non valido.');
      } finally {
        setIsDecrypting(false);
      }
    };
    reader.readAsText(selectedEncryptedFile);
  };

  return (
    <div className="space-y-4">
      {/* Privacy First Hero Banner */}
      <div className="neon-card neon-card-highlight p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-[var(--border)]">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-[0_0_15px_rgba(16,185,129,0.25)]">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span>Privacy First & Protezione dei dati</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-950 text-emerald-300 border border-emerald-600">
                  Local First
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Architettura tecnica Privacy First: vault locale cifrato, controllo del docente e confini espliciti per ogni eventuale servizio remoto.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-xs text-slate-300 bg-slate-900 px-3 py-1.5 rounded-lg border border-[var(--border)]">
              🔒 <b>{totalStudents}</b> Alunni protetti · <b>{totalGrades}</b> Valutazioni
            </span>
          </div>
        </div>

        {/* 3 Pillars of Privacy */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div className="p-3.5 rounded-lg bg-[var(--surface-variant)] border border-[var(--border)]">
            <div className="flex items-center gap-2 text-cyan-400 mb-1.5 font-bold text-xs uppercase tracking-wider">
              <ServerOff className="w-4 h-4" /> Vault Locale Cifrato
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              I dati del Registro sono conservati nel Secure Local Vault cifrato sul dispositivo. I provider IA locali sono la modalità predefinita; un <b>provider remoto</b>, se configurato, richiede una scelta esplicita e non deve ricevere dati personali degli studenti.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-[var(--surface-variant)] border border-[var(--border)]">
            <div className="flex items-center gap-2 text-purple-400 mb-1.5 font-bold text-xs uppercase tracking-wider">
              <EyeOff className="w-4 h-4" /> Privacy Shield per la LIM
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Maschera istantaneamente i nominativi con iniziali protette quando proietti il registro sulla LIM in classe davanti agli alunni.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-[var(--surface-variant)] border border-[var(--border)]">
            <div className="flex items-center gap-2 text-emerald-400 mb-1.5 font-bold text-xs uppercase tracking-wider">
              <Lock className="w-4 h-4" /> Crittografia AES-256
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Esporta backup cifrati protetti da password personale tramite Web Crypto API: nessuno potrà aprirli senza la tua chiave.
            </p>
          </div>
        </div>

        {/* Quick Toggle: Privacy Shield (Modalità LIM) */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-[var(--border)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              {isPrivacyShieldActive ? (
                <EyeOff className="w-5 h-5 text-purple-400" />
              ) : (
                <Eye className="w-5 h-5 text-slate-400" />
              )}
              <h3 className="text-sm font-bold text-white">
                Privacy Shield / Modalità LIM & Proiezione in Aula
              </h3>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isPrivacyShieldActive ? 'badge-ok' : 'bg-slate-800 text-slate-400'}`}>
                {isPrivacyShieldActive ? 'ATTIVO (NOMI MASCHERATI)' : 'DISATTIVO (NOMI COMPLETI)'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Quando abilitato, tutti i nomi degli studenti vengono mostrati come iniziali (es. <i>"B. F. ••••"</i>) in tabelloni, griglie e moduli di voto per tutelare la riservatezza tra pari.
            </p>
          </div>

          <button
            type="button"
            onClick={onTogglePrivacyShield}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
              isPrivacyShieldActive
                ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_15px_rgba(192,132,252,0.4)]'
                : 'neon-btn-primary'
            }`}
          >
            {isPrivacyShieldActive ? (
              <>
                <Eye className="w-4 h-4" /> Disattiva Modalità LIM
              </>
            ) : (
              <>
                <EyeOff className="w-4 h-4" /> Attiva Modalità LIM
              </>
            )}
          </button>
        </div>
      </div>

      {/* AES-256-GCM Encrypted Backup Card */}
      <div className="neon-card p-5">
        <div className="mb-4 pb-3 border-b border-[var(--border)]">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-400" /> Backup Cifrato con Password (AES-256-GCM)
          </h3>
          <p className="text-xs text-slate-400">
            Se desideri conservare il backup su una chiavetta USB o inviartelo via email, cifralo con una password. In caso di smarrimento del supporto, i dati dei minori rimarranno inaccessibili.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Export Encrypted Form */}
          <form onSubmit={handleExportEncrypted} className="p-4 rounded-lg bg-[var(--surface-variant)] border border-[var(--border)] space-y-3">
            <h4 className="text-xs uppercase tracking-wider font-bold text-slate-200 flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5 text-emerald-400" /> Esporta Backup Cifrato (.enc.json)
            </h4>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Password di Protezione
              </label>
              <input
                type="password"
                placeholder="Inserisci password sicura (min. 6 caratteri)"
                value={encryptPassword}
                onChange={e => setEncryptPassword(e.target.value)}
                className="w-full p-2 neon-input text-xs text-white"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Conferma Password
              </label>
              <input
                type="password"
                placeholder="Ripeti la password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full p-2 neon-input text-xs text-white"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isEncrypting}
              className="w-full py-2.5 rounded-lg neon-btn-primary text-xs font-semibold flex items-center justify-center gap-1.5 mt-2"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>{isEncrypting ? 'Cifratura in corso...' : 'Cifra e Scarica File'}</span>
            </button>
          </form>

          {/* Import Encrypted Form */}
          <form onSubmit={handleImportEncrypted} className="p-4 rounded-lg bg-[var(--surface-variant)] border border-[var(--border)] space-y-3">
            <h4 className="text-xs uppercase tracking-wider font-bold text-slate-200 flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5 text-cyan-400" /> Ripristina Backup Cifrato
            </h4>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Seleziona File Cifrato
              </label>
              <input
                type="file"
                accept=".json"
                onChange={e => setSelectedEncryptedFile(e.target.files?.[0] || null)}
                className="w-full p-1.5 neon-input text-xs text-white file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:bg-slate-800 file:text-slate-200"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Password di Decifratura
              </label>
              <input
                type="password"
                placeholder="Inserisci la password impostata alla cifratura"
                value={decryptPassword}
                onChange={e => setDecryptPassword(e.target.value)}
                className="w-full p-2 neon-input text-xs text-white"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isDecrypting}
              className="w-full py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-cyan-300 flex items-center justify-center gap-1.5 mt-2 transition-colors"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{isDecrypting ? 'Decifratura in corso...' : 'Decifra e Ripristina Registro'}</span>
            </button>
          </form>
        </div>
      </div>

      {/* GDPR Data Treatment Sheet (Art. 30 GDPR) */}
      <div className="neon-card p-5">
        <div className="mb-4 pb-3 border-b border-[var(--border)]">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <FileCheck2 className="w-4 h-4 text-cyan-400" /> Scheda Trattamento Dati Personali (Art. 30 GDPR)
          </h3>
          <p className="text-xs text-slate-400">
            Sintesi dei principi di conformità per gli adempimenti istituzionali e il DPO d'Istituto.
          </p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4 space-y-2.5 text-xs text-slate-300 leading-relaxed font-sans">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pb-2 border-b border-slate-800">
            <div>
              <b className="text-slate-400 uppercase text-[10px] block">Titolare del Trattamento</b>
              <span className="font-semibold text-white">{settings.school}</span>
            </div>
            <div>
              <b className="text-slate-400 uppercase text-[10px] block">Incaricato / Docente</b>
              <span className="font-semibold text-white">{settings.teacher} ({settings.subject})</span>
            </div>
          </div>

          <div>
            <b className="text-slate-400 uppercase text-[10px] block">Finalità del Trattamento</b>
            <span>Registrazione e valutazione formativa e sommativa degli apprendimenti, delle competenze (D.M. 221/2025) e della partecipazione didattica (D.Lgs. 62/2017).</span>
          </div>

          <div>
            <b className="text-slate-400 uppercase text-[10px] block">Base Giuridica</b>
            <span>Esecuzione di un compito di interesse pubblico o connesso all'esercizio di pubblici poteri di cui è investito il titolare (Art. 6, par. 1, lett. e del GDPR).</span>
          </div>

          <div>
            <b className="text-slate-400 uppercase text-[10px] block">Misure di Sicurezza Tecniche ed Organizzative</b>
            <span>Trattamento confinato all'hardware del docente (Local Storage sandbox). Crittografia nativa opzionale AES-256-GCM. Funzionalità di oscuramento nomi durante le sessioni di didattica d'aula (LIM).</span>
          </div>
        </div>
      </div>

      {/* Right to be Forgotten / Factory Reset */}
      <div className="neon-card p-5 border border-rose-950/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-rose-400 flex items-center gap-2">
              <Trash2 className="w-4 h-4" /> Diritto all'Oblio & Reset Completo del Registro
            </h3>
            <p className="text-xs text-slate-400">
              Al termine dell'anno scolastico o dopo aver depositato i registri ufficiali, puoi eliminare definitivamente tutte le informazioni memorizzate in locale sul browser.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              if (confirm('ATTENZIONE: Stai per eliminare TUTTI i dati del registro (classi, alunni, voti, note e impostazioni). Questa azione è irreversibile!\n\nHai già scaricato una copia di backup?')) {
                if (prompt('Scrivi "CANCELLA" per confermare l\'eliminazione definitiva:') === 'CANCELLA') {
                  onFactoryReset();
                }
              }
            }}
            className="px-4 py-2.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800 text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> Reset Totale Sicuro
          </button>
        </div>
      </div>
    </div>
  );
};
