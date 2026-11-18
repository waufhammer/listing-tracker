// Which admin profile (Will / Assistant, picked in the admin sidebar) is
// making changes. The picker copies its choice into this cookie so server
// actions can credit change_log (0008) and feedback approvals to the right
// person. Attribution only: access is still the admin session cookie.

export const ADMIN_ACTOR_COOKIE = "admin_actor";
export const ADMIN_ACTORS = ["will", "assistant"] as const;
export type AdminActor = (typeof ADMIN_ACTORS)[number];

export function toAdminActor(v: string | undefined | null): AdminActor {
  return (ADMIN_ACTORS as readonly string[]).includes(v ?? "") ? (v as AdminActor) : "will";
}
