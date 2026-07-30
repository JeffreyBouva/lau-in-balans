import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { HANDMATEN, vandaagISO, type Handmaat, type Moment } from '@lau/shared';
import { colors, radii, fontFamily, text } from '@/theme/tokens';
import { useSessie } from '@/lib/sessie';
import { supabase } from '@/lib/supabase';
import { Sheet } from '@/components/Sheet';
import { PrimaireKnop } from '@/components/PrimaireKnop';
import { legeDraft, pas, heeftIets } from '@/state/logSheet';

const MOMENTEN: Moment[] = ['Ontbijt', 'Lunch', 'Avondeten', 'Tussendoor'];

/**
 * Bottom sheet — Eten loggen (handoff § 5). Getriggerd door de "Ik heb gegeten"-chip
 * in de chat. Momentkeuze + vier stepper-rijen sturen een lokale `Draft` (state/logSheet).
 * Bij Bewaren: één food_log + een log-bericht, dan sluiten en naar de chat, waar de
 * log-bubbel via realtime verschijnt.
 */
export function LogSheet({ zichtbaar, onSluit }: { zichtbaar: boolean; onSluit: () => void }) {
  const { clientId } = useSessie();
  const router = useRouter();
  const [draft, setDraft] = useState(legeDraft());
  const [bezig, setBezig] = useState(false);

  // Draft terug naar 1/1/1/0 telkens als de sheet opnieuw opent.
  useEffect(() => {
    if (zichtbaar) setDraft(legeDraft());
  }, [zichtbaar]);

  async function bewaar() {
    if (!heeftIets(draft)) {
      onSluit();
      return;
    }
    setBezig(true);
    const { data: log } = await supabase
      .from('food_logs')
      .insert({ client_id: clientId, datum: vandaagISO(), moment: draft.moment, porties: draft.porties, bron: 'chat' })
      .select('id')
      .single();
    if (log) await supabase.from('messages').insert({ client_id: clientId, sender: 'client', food_log_id: log.id });
    setDraft(legeDraft());
    setBezig(false);
    onSluit();
    router.replace('/(tabs)/chat'); // de log-bubbel verschijnt daar via realtime
    // fase 3: hierna reageert de lau-reply Edge Function op de log
  }

  return (
    <Sheet zichtbaar={zichtbaar} onSluit={onSluit}>
      <View style={s.inhoud}>
        {/* Titel + subregel */}
        <View style={s.kop}>
          <Text style={text.sheetTitel}>Wat heb je gegeten?</Text>
          <Text style={s.subregel}>Op handmaten. Bij benadering is goed genoeg.</Text>
        </View>

        {/* Momentkeuze — default Avondeten */}
        <View style={s.momentRij}>
          {MOMENTEN.map((m) => {
            const actief = draft.moment === m;
            return (
              <Pressable
                key={m}
                onPress={() => setDraft((d) => ({ ...d, moment: m }))}
                style={[s.moment, actief ? s.momentAan : s.momentUit]}
              >
                <Text style={[s.momentTekst, { color: actief ? colors.sageDeeper : colors.body }]}>{m}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Vier stepper-rijen */}
        <View style={s.rijen}>
          {HANDMATEN.map((h) => (
            <StepperRij
              key={h.key}
              handmaat={h}
              waarde={draft.porties[h.key]}
              onMin={() => setDraft((d) => pas(d, h.key, -1))}
              onPlus={() => setDraft((d) => pas(d, h.key, +1))}
            />
          ))}
        </View>

        {/* Acties */}
        <View style={s.acties}>
          <Pressable onPress={onSluit} style={s.later}>
            <Text style={s.laterTekst}>Later</Text>
          </Pressable>
          <View style={s.bewaren}>
            <PrimaireKnop label="Bewaren" onPress={bewaar} bezig={bezig} />
          </View>
        </View>
      </View>
    </Sheet>
  );
}

/** Eén stepper-rij in de log-sheet (handoff § 5): marker + naam/uitleg + 32×32 stepper (alleen de teller). */
function StepperRij({
  handmaat,
  waarde,
  onMin,
  onPlus,
}: {
  handmaat: Handmaat;
  waarde: number;
  onMin: () => void;
  onPlus: () => void;
}) {
  const minUit = waarde <= 0;
  return (
    <View style={s.rij}>
      <View style={[s.marker, { backgroundColor: handmaat.kleur }]} />
      <View style={s.rijTekst}>
        <Text style={s.rijNaam}>{handmaat.naam}</Text>
        <Text style={s.rijSub}>
          {handmaat.hand} · {handmaat.uitleg}
        </Text>
      </View>
      <View style={s.stepper}>
        <Pressable
          onPress={onMin}
          disabled={minUit}
          accessibilityRole="button"
          accessibilityLabel="Portie eraf"
          style={[s.stapKnop, s.stapMin, minUit && s.stapMinUit]}
        >
          <Text style={[s.stapMinTeken, minUit && s.stapMinTekenUit]}>−</Text>
        </Pressable>
        <Text style={s.teller}>{waarde}</Text>
        <Pressable
          onPress={onPlus}
          accessibilityRole="button"
          accessibilityLabel="Portie erbij"
          style={[s.stapKnop, s.stapPlus]}
        >
          <Text style={s.stapPlusTeken}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  inhoud: { paddingHorizontal: 26, paddingTop: 4, paddingBottom: 26, gap: 18 },

  // titel
  kop: { gap: 6 },
  subregel: { fontFamily: fontFamily.sans, fontSize: 14, lineHeight: 21, color: colors.muted },

  // momentkeuze
  momentRij: { flexDirection: 'row', gap: 8 },
  moment: { flex: 1, paddingVertical: 11, borderRadius: radii.controlSm, borderWidth: 1, alignItems: 'center' },
  momentUit: { backgroundColor: colors.bgSurface, borderColor: colors.hairline },
  momentAan: { backgroundColor: colors.sageSoft, borderColor: colors.sage },
  momentTekst: { fontFamily: fontFamily.sans, fontSize: 12.5 },

  // stepper-rijen
  rijen: { gap: 10 },
  rij: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    borderRadius: radii.card,
    paddingVertical: 15,
    paddingHorizontal: 17,
  },
  marker: { width: 14, height: 14, borderRadius: radii.marker },
  rijTekst: { flex: 1, gap: 2 },
  rijNaam: { fontFamily: fontFamily.sans, fontSize: 15, color: colors.ink },
  rijSub: { fontFamily: fontFamily.sans, fontSize: 12.5, color: colors.mutedSoft },

  // stepper
  stepper: { flexDirection: 'row', alignItems: 'center' },
  stapKnop: { width: 32, height: 32, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  stapMin: { backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.hairline },
  stapMinUit: { opacity: 0.4 },
  stapMinTeken: { fontFamily: fontFamily.sans, fontSize: 18, lineHeight: 20, color: colors.ink },
  stapMinTekenUit: { color: colors.muted },
  teller: { minWidth: 20, textAlign: 'center', fontFamily: fontFamily.sans, fontSize: 15, color: colors.body },
  stapPlus: { backgroundColor: colors.sage },
  stapPlusTeken: { fontFamily: fontFamily.sans, fontSize: 18, lineHeight: 20, color: colors.bgSurface },

  // acties
  acties: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  later: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  laterTekst: { fontFamily: fontFamily.sans, fontSize: 15, color: colors.body },
  bewaren: { flex: 1 },
});
