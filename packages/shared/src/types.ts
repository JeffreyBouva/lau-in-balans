export type HandKey = 'eiwit' | 'groente' | 'koolhydraten' | 'vet';
export type Porties = Record<HandKey, number>;

export type Moment = 'Ontbijt' | 'Lunch' | 'Avondeten' | 'Tussendoor';
export type Sender = 'ai' | 'client' | 'coach';
export type ClientStatus = 'nieuw' | 'actief' | 'stil' | 'gestopt';
export type FlagStatus = 'open' | 'resolved';
export type LogBron = 'chat' | 'eten';
export type NoteType = 'intake' | 'sessie' | 'los';
export type Veiligheidsvlag = 'geen' | 'soms' | 'voorzichtig' | 'overgeslagen';
export type Platform = 'ios' | 'android';

/** Het gestructureerde per-klant AI-profiel — de personalisatiemotor. */
export interface AIProfile {
  doelen: string[];
  portiedoelen: Porties;
  knelpunten: string[];
  voorkeuren: string[];
  beperkingen: string[];
  checkinRitme: string[];
  aanpak: string;
  toon: string;
  vermijdenInCoaching: string;
  veiligheidsvlag: Veiligheidsvlag;
}

// ── DB-rijtypes (spiegel van supabase/migrations — snake_case zoals Postgres) ──

export interface CoachRow {
  id: string;
  naam: string;
  created_at: string;
}

export interface ClientRow {
  id: string;
  coach_id: string;
  naam: string;
  leeftijd: number | null;
  startdatum: string; // ISO-datum
  status: ClientStatus;
  created_at: string;
}

export interface AiProfileVersionRow {
  id: string;
  client_id: string;
  versie: number;
  profiel: AIProfile;
  author: string | null; // null = door de klant zelf (onboarding of profielscherm)
  created_at: string;
}

export interface MessageRow {
  id: string;
  client_id: string;
  sender: Sender;
  tekst: string | null;
  food_log_id: string | null;
  created_at: string;
  read_at: string | null;
}

export interface FoodLogRow {
  id: string;
  client_id: string;
  datum: string;
  moment: Moment;
  porties: Porties;
  bron: LogBron;
  created_at: string;
}

export interface FlagRow {
  id: string;
  client_id: string;
  tekst: string | null;
  redenen: string[];
  status: FlagStatus;
  created_at: string;
  resolved_by: string | null;
  resolved_at: string | null;
}

export interface CoachNoteRow {
  id: string;
  client_id: string;
  datum: string;
  tekst: string;
  type: NoteType;
  created_at: string;
}

export interface WeeklySessionRow {
  id: string;
  client_id: string;
  datum: string;
  notitie: string;
  signalen: string[];
  voorstellen: unknown; // vorm wordt in fase 5 vastgelegd (session-suggest)
  resulting_profile_version: string | null;
  created_at: string;
}

export interface PushTokenRow {
  client_id: string;
  expo_push_token: string;
  platform: Platform;
  updated_at: string;
}
