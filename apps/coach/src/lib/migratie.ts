/**
 * Herkent "dit object bestaat nog niet" — dan is de bijbehorende migratie nog niet gepusht
 * (`supabase db push` is een handmatige stap). Schermen die op een verse migratie leunen
 * gebruiken dit om een uitleg te tonen in plaats van een kale foutmelding.
 *
 * PGRST202 = functie niet in de schema-cache · PGRST205 = tabel niet in de schema-cache ·
 * 42883 = undefined_function · 42P01 = undefined_table · 42501 = geen execute-recht (de
 * grant hoort bij dezelfde migratie). Een ingelogde coach kan die codes na de push niet
 * meer krijgen.
 *
 * LET OP: een ontbrekende SELECT-policy geeft géén fout maar 0 rijen — een lijst oogt dan
 * gewoon leeg. Pas een schrijfactie legt het verschil bloot; daarom zetten de hooks de
 * vlag ook daar, en niet alleen op de laadbeurt.
 */
export function ontbreektNog(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (['PGRST202', 'PGRST205', '42883', '42P01', '42501'].includes(error.code ?? '')) return true;
  const m = (error.message ?? '').toLowerCase();
  return m.includes('schema cache'); // bewust smal: 'does not exist' matcht ook onverwante schemafouten
}
