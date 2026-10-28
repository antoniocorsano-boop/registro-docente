import React, { useMemo, useState } from 'react';
import {
  Bookmark,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Clock3,
  MessageCircle,
  Sparkles,
  Target,
  X
} from 'lucide-react';
import type { CopilotMissionPreviewV1, CopilotMissionV1, MissionResumeDecision } from '../copilot/mission';
import { stageMissionReview } from '../copilot/missionReviewHandoff';
import type {
  CopilotOpportunityResolution,
  CopilotOpportunityScope,
  CopilotOpportunityV1
} from '../copilot/opportunityResolver';

interface CopilotDeckProps {
  opportunities: CopilotOpportunityResolution;
  missions: CopilotMissionV1[];
  resolvePreview: (opportunity: CopilotOpportunityV1) => CopilotMissionPreviewV1 | null;
  resolveMaterialFingerprint: (opportunity: CopilotOpportunityV1) => string;
  onPutAside: (opportunity: CopilotOpportunityV1) => Promise<void>;
  onIgnore: (opportunity: CopilotOpportunityV1) => Promise<void>;
  onStart?: (opportunity: CopilotOpportunityV1, preview: CopilotMissionPreviewV1, materialFingerprint: string) => Promise<void>;
  onResume?: (mission: CopilotMissionV1) => Promise<MissionResumeDecision>;
  onOpenConversation: () => void;
}

const GROUPS: Array<{
  scope: CopilotOpportunityScope;
  label: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
}> = [
  { scope: 'contextual', label: 'Qui', icon: Target },
  { scope: 'today', label: 'Oggi', icon: CalendarDays },
  { scope: 'later', label: 'Più tardi', icon: Clock3 }
];

function PreviewBlock({
  preview,
  onStart
}: {
  preview: CopilotMissionPreviewV1;
  onStart?: () => void;
}) {
  const rows: Array<[string, string[]]> = [
    ['Obiettivo', [preview.goal]],
    ['Contesto', preview.context],
    ['Userà', preview.uses],
    ['Produrrà', preview.produces],
    ['Non farà', preview.willNotDo]
  ];

  return (
    <div className="mt-3 rounded-xl border border-cyan-900/60 bg-slate-950/80 p-3" data-testid="copilot-mission-preview">
      <dl className="space-y-2">
        {rows.map(([label, values]) => (
          <div key={label}>
            <dt className="text-[11px] font-bold uppercase tracking-wide text-cyan-300">{label}</dt>
            <dd className="mt-0.5 text-xs leading-relaxed text-slate-300">{values.join(' · ')}</dd>
          </div>
        ))}
      </dl>
      <button
        type="button"
        disabled={!onStart}
        onClick={onStart}
        className="mt-3 min-h-[44px] w-full rounded-lg bg-cyan-400 px-3 py-2 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-45"
      >
        ▶ Avvia incarico
      </button>
      {!onStart && (
        <p className="mt-1 text-center text-[11px] text-slate-500">Il Play sarà abilitato quando il mandato è pronto per l’esecuzione governata.</p>
      )}
    </div>
  );
}

function OpportunityCard({
  opportunity,
  preview,
  onPreview,
  onPutAside,
  onIgnore,
  onStart
}: {
  opportunity: CopilotOpportunityV1;
  preview: CopilotMissionPreviewV1 | null;
  onPreview: () => void;
  onPutAside: () => void;
  onIgnore: () => void;
  onStart?: () => void;
}) {
  return (
    <article className="rounded-xl border border-slate-700/80 bg-slate-900/75 p-3" data-testid={`copilot-opportunity-${opportunity.id}`}>
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-slate-100">{opportunity.title}</h4>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            <span className="font-semibold text-slate-300">Perché:</span> {opportunity.whyNow}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={onPreview} className="min-h-[44px] rounded-lg border border-cyan-700 px-3 py-2 text-xs font-semibold text-cyan-100">
          Anteprima
        </button>
        {opportunity.scope !== 'later' && (
          <button type="button" onClick={onPutAside} className="min-h-[44px] rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300">
            <Bookmark className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
            Metti da parte
          </button>
        )}
        <button type="button" onClick={onIgnore} className="min-h-[44px] rounded-lg px-3 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200">
          Ignora
        </button>
      </div>

      {preview && <PreviewBlock preview={preview} onStart={onStart} />}
    </article>
  );
}

export const CopilotDeck: React.FC<CopilotDeckProps> = ({
  opportunities,
  missions,
  resolvePreview,
  resolveMaterialFingerprint,
  onPutAside,
  onIgnore,
  onStart,
  onResume,
  onOpenConversation
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [previewBinding, setPreviewBinding] = useState<{ id: string; materialFingerprint: string } | null>(null);
  const [showOverflow, setShowOverflow] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const visibleOpportunities = useMemo(
    () => showOverflow ? [...opportunities.primary, ...opportunities.overflow] : opportunities.primary,
    [opportunities, showOverflow]
  );

  const groups = useMemo(() => GROUPS.map(group => ({
    ...group,
    opportunities: visibleOpportunities.filter(item => item.scope === group.scope)
  })), [visibleOpportunities]);

  const activeMissions = missions.filter(mission => mission.status !== 'archived');

  const run = async (id: string, action: () => Promise<void>, closeDeckOnSuccess = false) => {
    if (busyId) return;
    setBusyId(id);
    try {
      await action();
      setPreviewBinding(null);
      if (closeDeckOnSuccess) setIsOpen(false);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <button
        type="button"
        data-testid="library-copilot-trigger"
        aria-label="Apri Copilota"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(true)}
        className="fixed right-4 bottom-36 md:bottom-20 z-[72] min-h-[44px] rounded-full border border-cyan-400/50 bg-slate-950/95 px-4 py-2.5 text-sm font-semibold text-cyan-100 shadow-2xl backdrop-blur"
      >
        <Sparkles className="mr-2 inline h-4 w-4" aria-hidden="true" />
        Copilota
      </button>

      {isOpen && (
        <section
          aria-label="Opportunità del Copilota"
          data-testid="copilot-deck"
          className="fixed inset-x-2 bottom-2 z-[80] max-h-[82dvh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-950/98 shadow-2xl backdrop-blur md:inset-x-auto md:right-4 md:bottom-4 md:w-[430px]"
        >
          <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur">
            <div>
              <h2 className="text-sm font-bold text-slate-100">Copilota</h2>
              <p className="mt-0.5 text-xs text-slate-400">Poche opportunità motivate. L’AI parte solo quando premi Play.</p>
            </div>
            <button type="button" aria-label="Chiudi opportunità del Copilota" onClick={() => setIsOpen(false)} className="min-h-[44px] min-w-[44px] rounded-lg p-2 text-slate-400 hover:text-white">
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </header>

          <div className="space-y-4 p-4">
            {activeMissions.length > 0 && (
              <section aria-label="Missioni del Copilota" className="space-y-2">
                {activeMissions.map(mission => (
                  <article key={mission.id} className="rounded-xl border border-slate-700 bg-slate-900/70 p-3">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Incarico</div>
                    <div className="mt-1 text-sm font-semibold text-slate-100">{mission.goal}</div>
                    {mission.status === 'ready' ? (
                      <>
                        <p className="mt-1 text-xs text-emerald-300">Pronta da controllare</p>
                        <button
                          type="button"
                          onClick={() => {
                            stageMissionReview(mission);
                            setIsOpen(false);
                            onOpenConversation();
                          }}
                          className="mt-2 min-h-[44px] rounded-lg border border-emerald-700 px-3 py-2 text-xs font-semibold text-emerald-100"
                        >
                          Controlla risultato
                        </button>
                      </>
                    ) : mission.status === 'suspended' ? (
                      <>
                        <p className="mt-1 text-xs text-slate-400">Contesto invariato · il lavoro può essere ripreso.</p>
                        <button
                          type="button"
                          disabled={!onResume || busyId === mission.id}
                          onClick={() => {
                            if (!onResume || busyId) return;
                            setBusyId(mission.id);
                            void onResume(mission)
                              .then(decision => {
                                setPreviewBinding(decision === 'repreview'
                                  ? { id: mission.opportunityId, materialFingerprint: '' }
                                  : null);
                                if (decision === 'resume') setIsOpen(false);
                              })
                              .finally(() => setBusyId(null));
                          }}
                          className="mt-2 min-h-[44px] rounded-lg border border-cyan-700 px-3 py-2 text-xs font-semibold text-cyan-100 disabled:opacity-45"
                        >
                          ▶ Riprendi
                        </button>
                      </>
                    ) : (
                      <p className="mt-1 text-xs text-slate-400">Incarico supervisionato in corso.</p>
                    )}
                  </article>
                ))}
                <p className="sr-only">Il contesto è cambiato da quando hai iniziato.</p>
              </section>
            )}

            {groups.map(group => {
              const Icon = group.icon;
              return (
                <section key={group.scope} aria-labelledby={`copilot-group-${group.scope}`} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-slate-400" aria-hidden={true} />
                    <h3 id={`copilot-group-${group.scope}`} className="text-xs font-bold uppercase tracking-wider text-slate-300">{group.label}</h3>
                  </div>
                  {group.opportunities.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-800 px-3 py-2 text-xs text-slate-600">Nessuna opportunità forte in questo gruppo.</p>
                  ) : group.opportunities.map(opportunity => {
                    const materialFingerprint = resolveMaterialFingerprint(opportunity);
                    const preview = previewBinding?.id === opportunity.id
                      && previewBinding.materialFingerprint === materialFingerprint
                      ? resolvePreview(opportunity)
                      : null;
                    const start = onStart && preview
                      ? () => void run(
                          opportunity.id,
                          () => onStart(opportunity, preview, previewBinding!.materialFingerprint),
                          true
                        )
                      : undefined;
                    return (
                      <OpportunityCard
                        key={opportunity.id}
                        opportunity={opportunity}
                        preview={preview}
                        onPreview={() => setPreviewBinding(current => (
                          current?.id === opportunity.id && current.materialFingerprint === materialFingerprint
                            ? null
                            : { id: opportunity.id, materialFingerprint }
                        ))}
                        onPutAside={() => void run(opportunity.id, () => onPutAside(opportunity))}
                        onIgnore={() => void run(opportunity.id, () => onIgnore(opportunity))}
                        onStart={start}
                      />
                    );
                  })}
                </section>
              );
            })}

            {opportunities.overflow.length > 0 && (
              <button
                type="button"
                onClick={() => setShowOverflow(value => !value)}
                className="min-h-[44px] w-full rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300"
              >
                {showOverflow ? <ChevronUp className="mr-1 inline h-4 w-4" aria-hidden="true" /> : <ChevronDown className="mr-1 inline h-4 w-4" aria-hidden="true" />}
                Altre possibilità
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenConversation();
              }}
              className="min-h-[44px] w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-200"
            >
              <MessageCircle className="mr-2 inline h-4 w-4" aria-hidden="true" />
              Parla con il Copilota
            </button>
          </div>
        </section>
      )}
    </>
  );
};
