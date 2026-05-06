import type { Account, Attendee } from '../../types';

interface EngagementPlanPanelProps {
  account: Account | null;
  selectedPersona: Attendee | null;
  onSelectPersona: (persona: Attendee) => void;
}

/**
 * Panel 3: Engagement Plan Generator
 * - Persona selector (from EBC attendees)
 * - AI-generated narrative (why T&C matters for this persona)
 * - Conversation starters (2-3, grounded in public signals)
 * - Recommended T&C plays
 * - Revenue opportunity estimate table
 * - Matched proof points
 */
export function EngagementPlanPanel({
  account,
  selectedPersona,
  onSelectPersona,
}: EngagementPlanPanelProps) {
  if (!account) {
    return (
      <div className="flex items-center justify-center h-full text-muted">
        <div className="text-center p-4">
          <p className="text-lg font-medium">Engagement Plan</p>
          <p className="text-sm mt-1">
            Select an account to generate engagement plans
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
        Engagement Plan
      </h2>

      {/* Persona Selector */}
      <div>
        <p className="text-xs text-muted mb-2">Select Persona</p>
        <div className="space-y-1.5">
          {account.ebc_data.attendees.map((attendee) => (
            <button
              key={attendee.name}
              onClick={() => onSelectPersona(attendee)}
              className={`w-full text-left p-2.5 rounded-lg border transition-colors ${
                selectedPersona?.name === attendee.name
                  ? 'bg-purple-500/10 border-purple-500/30'
                  : 'bg-dark-700 border-dark-600 hover:border-dark-500'
              }`}
            >
              <p className="text-sm text-white font-medium">{attendee.name}</p>
              <p className="text-xs text-muted">
                {attendee.title} · {attendee.persona}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Plan Output (placeholder for AI generation) */}
      {selectedPersona && (
        <div className="space-y-4 pt-4 border-t border-dark-600">
          <div className="bg-dark-700 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-white mb-2">
              Plan for {selectedPersona.name}
            </h3>
            <p className="text-xs text-muted">
              AI-generated engagement plan will appear here. This will include a
              persona-specific narrative, conversation starters, recommended T&C
              plays, revenue estimates, and matched proof points.
            </p>
          </div>

          <button className="w-full py-2.5 bg-purple-500 hover:bg-purple-400 text-white text-sm font-medium rounded-lg transition-colors">
            Generate Engagement Plan
          </button>
        </div>
      )}
    </div>
  );
}
