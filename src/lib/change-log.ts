// Readable change history from the change_log table (0008). Shared by the
// MCP get_change_log tool and the admin History tab.

type Row = Record<string, unknown>;

// Never show these in the change history (the client link token is a
// private sign-in link; updated_* are bookkeeping).
const HIDDEN_LOG_FIELDS = new Set(["client_link_token", "updated_at", "updated_by"]);

function cleanLogRow(r: Row | null): Row | null {
  if (!r) return null;
  return Object.fromEntries(Object.entries(r).filter(([k]) => !HIDDEN_LOG_FIELDS.has(k)));
}

/** Change history rows, made readable: for updates only the changed fields. */
export function formatChangeLog(rows: Row[]) {
  return rows.map((x) => {
    const before = cleanLogRow(x.before as Row | null);
    const after = cleanLogRow(x.after as Row | null);
    const base = { at: x.at, actor: x.actor ?? "unknown", action: x.action, table: x.table_name, row_id: x.row_id };
    if (x.action === "update" && before && after) {
      const changed: Record<string, { from: unknown; to: unknown }> = {};
      for (const k of Object.keys(after)) {
        if (JSON.stringify(before[k] ?? null) !== JSON.stringify(after[k] ?? null)) changed[k] = { from: before[k] ?? null, to: after[k] ?? null };
      }
      return { ...base, changed };
    }
    return { ...base, row: after ?? before };
  });
}

export type ChangeLogEntry = ReturnType<typeof formatChangeLog>[number];
