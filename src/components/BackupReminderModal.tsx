import React from 'react';
import { Download, X, ShieldCheck } from 'lucide-react';

interface BackupReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: () => void;
}

export const BackupReminderModal: React.FC<BackupReminderModalProps> = ({
  isOpen,
  onClose,
  onExport
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#030712]/85 backdrop-blur-sm flex justify-center items-center p-4">
      <div className="w-full max-w-md neon-card neon-card-highlight p-6 text-center animate-in fade-in zoom-in-95 duration-200">
        <div className="w-12 h-12 rounded-full bg-[var(--primary)]/15 border border-[var(--primary)]/40 flex items-center justify-center mx-auto mb-3 text-[var(--primary)]">
          <ShieldCheck className="w-7 h-7" />
        </div>

        <h3 className="text-lg font-bold text-[var(--primary)] mb-2 drop-shadow-[0_0_8px_var(--primary)]">
          Dati Salvati in Locale con Successo!
        </h3>

        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-6">
          Tutte le modifiche, valutazioni e note sono state memorizzate in sicurezza nella memoria locale del tuo browser. Ti raccomandiamo di scaricare periodicamente una copia di backup JSON per prevenire perdite accidentali.
        </p>

        <div className="flex gap-3">
          <button
            onClick={() => {
              onExport();
              onClose();
            }}
            className="flex-2 py-3 px-4 rounded-lg neon-btn-primary text-xs sm:text-sm font-semibold flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" /> Scarica Backup JSON
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-750 text-xs sm:text-sm font-semibold text-slate-300 flex items-center justify-center gap-1.5"
          >
            <X className="w-4 h-4" /> Chiudi
          </button>
        </div>
      </div>
    </div>
  );
};
