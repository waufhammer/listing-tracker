'use client';

const TYPE_STYLES = {
  'Buyer Showing': 'bg-green-50 text-green-700',
  'Open House': 'bg-blue-50 text-blue-700',
  'Agent Preview': 'bg-purple-50 text-purple-700',
};

function fmt(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function ActivityLogTab({ activities }) {
  if (!activities.length) {
    return (
      <div className="text-center py-16 text-brand-gray-text">
        <svg className="w-10 h-10 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <p className="text-sm">No activity logged yet.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-brand-gray-medium">
            <th className="text-left py-3 px-4 text-xs font-semibold text-brand-gray-text uppercase tracking-wide">Date</th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-brand-gray-text uppercase tracking-wide">Type</th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-brand-gray-text uppercase tracking-wide">Agent</th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-brand-gray-text uppercase tracking-wide">Feedback</th>
            <th className="text-center py-3 px-4 text-xs font-semibold text-brand-gray-text uppercase tracking-wide">Follow-up Sent</th>
            <th className="text-center py-3 px-4 text-xs font-semibold text-brand-gray-text uppercase tracking-wide">Buyer Packet</th>
          </tr>
        </thead>
        <tbody>
          {activities.map((a, i) => (
            <tr
              key={a.id}
              className={`border-b border-brand-gray-medium last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
            >
              <td className="py-3 px-4 text-brand-dark whitespace-nowrap">{fmt(a.date)}</td>
              <td className="py-3 px-4">
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${TYPE_STYLES[a.type] || 'bg-gray-100 text-gray-600'}`}>
                  {a.type || '—'}
                </span>
                {a.type === 'Open House' && a.openHouseGroups > 0 && (
                  <span className="ml-2 text-xs text-brand-gray-text">{a.openHouseGroups} group{a.openHouseGroups !== 1 ? 's' : ''}</span>
                )}
              </td>
              <td className="py-3 px-4 text-brand-dark">{a.agentName || '—'}</td>
              <td className="py-3 px-4 text-brand-gray-text max-w-xs">
                {a.feedback ? (
                  <span className="line-clamp-2">{a.feedback}</span>
                ) : (
                  <span className="text-gray-300">—</span>
                )}
              </td>
              <td className="py-3 px-4 text-center">
                {a.followUpSent ? (
                  <span className="text-brand-green font-bold">✓</span>
                ) : (
                  <span className="text-gray-300">—</span>
                )}
              </td>
              <td className="py-3 px-4 text-center">
                {a.buyerPacketRequested ? (
                  <span className="text-brand-green font-bold">✓</span>
                ) : (
                  <span className="text-gray-300">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
