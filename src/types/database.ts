export type Calendar = { id: string; name: string; color: string; created_by: string; created_at: string };
export type Membership = { calendar_id: string; user_id: string; role: "owner" | "editor" | "viewer"; profiles: { email: string | null; display_name: string | null } | null };
export type EncryptedEvent = { id: string; calendar_id: string; encrypted_payload: string; starts_at: string; ends_at: string; all_day: boolean };
export type Question = { id: string; title: string; content: string; author_id: string; created_at: string; profiles: { email: string | null; display_name: string | null }[] };
