import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, radii, fontFamily, text } from '@/theme/tokens';
import { relatieveDag } from '@/lib/datum';
import { stoot } from '@/lib/haptics';
import { useCodeAanvraag, MAX_BERICHT, NIET_BESCHIKBAAR } from '@/lib/hooks/useCodeAanvraag';
import { Sheet } from '@/components/Sheet';
import { PrimaireKnop } from '@/components/PrimaireKnop';

/** Vanaf hier telt de teller mee — daaronder is de limiet ruis. */
const TELLER_VANAF = 900;

/**
 * Een code aanvragen vanuit de slot-staat (feedback § 3). De aanvraag is niets meer dan
 * een regel in Laura's werkvoorraad: zij neemt zelf contact op en zet handmatig een code
 * klaar. Bewust GEEN prijzen, bedragen, koop-taal of externe links (App Store 3.1.3) —
 * dit is een verzoek om contact, geen aankoop.
 *
 * Drie standen: het formulier · "je aanvraag staat al klaar" (er stond er al één open) ·
 * de bevestiging na het versturen. Een annuleer-knop bestaat niet: de klant mag z'n eigen
 * aanvraag lezen en aanmaken, niet wijzigen of verwijderen.
 *
 * Het toetsenbord vangt `Sheet` zelf op (schermvullende KAV daar); hier geen tweede.
 */
export function CodeAanvraagSheet({ zichtbaar, onSluit }: { zichtbaar: boolean; onSluit: () => void }) {
  // De sheet-zichtbaarheid stuurt het laden: dicht = niet query'en, en elke heropening
  // haalt een verse stand op (Laura kan de aanvraag inmiddels opgepakt hebben).
  const { openAanvraag, laden, nogNietBeschikbaar, vraagAan } = useCodeAanvraag(zichtbaar);
  const [bericht, setBericht] = useState('');
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);
  const [verzonden, setVerzonden] = useState(false);

  // Dit component blijft tussen twee keer openen door gemonteerd (het hangt onder een
  // scherm). Resetten bij het sluiten, zoals CodeSheet en LauraSheet: je begint schoon en
  // het wissen valt buiten beeld in plaats van vlak vóór het openen.
  useEffect(() => {
    if (!zichtbaar) {
      setBericht('');
      setFout(null);
      setVerzonden(false);
    }
  }, [zichtbaar]);

  async function verstuur() {
    setBezig(true);
    setFout(null);
    const { error } = await vraagAan(bericht);
    setBezig(false);
    if (error) { setFout(error); return; } // invoer blijft staan, opnieuw proberen kan
    stoot();
    setVerzonden(true);
  }

  return (
    // Wegtikken terwijl de insert loopt zou je in het ongewisse laten of de aanvraag
    // aankwam: zolang bezig blijft de sheet staan.
    <Sheet zichtbaar={zichtbaar} onSluit={onSluit} sluitbaar={!bezig}>
      <View style={s.inhoud}>
        {verzonden ? (
          <View style={s.klaar} accessibilityRole="text" accessibilityLiveRegion="polite">
            <View style={s.vink}>
              <Text style={s.vinkTeken}>✓</Text>
            </View>
            <Text style={s.titel}>Je aanvraag staat klaar.</Text>
            <Text style={text.body}>Laura neemt contact met je op.</Text>
          </View>
        ) : nogNietBeschikbaar ? (
          <>
            <Text style={s.titel}>Vraag een code aan</Text>
            <Text style={text.body}>{NIET_BESCHIKBAAR}</Text>
          </>
        ) : laden && !openAanvraag ? (
          <View style={s.laden}>
            <ActivityIndicator color={colors.sage} />
          </View>
        ) : openAanvraag ? (
          <>
            <Text style={s.titel}>Je aanvraag staat klaar</Text>
            <Text style={text.body}>{staatKlaarZin(openAanvraag.created_at)}</Text>
            <Text style={s.subregel}>
              Zodra je een code van haar krijgt, vul je die in bij “Ik heb een code”.
            </Text>
          </>
        ) : (
          <>
            <Text style={s.titel}>Vraag een code aan</Text>
            <Text style={text.body}>
              Laura krijgt je aanvraag te zien en neemt zelf contact met je op om te kijken wat bij je past.
              Je hoeft verder niets te doen.
            </Text>
            <View style={s.veld}>
              <TextInput
                style={s.textarea}
                value={bericht}
                onChangeText={(v) => { setBericht(v); setFout(null); }}
                placeholder="Wil je iets meegeven? (mag leeg)"
                placeholderTextColor={colors.mutedSoft}
                accessibilityLabel="Wil je iets meegeven? (mag leeg)"
                maxLength={MAX_BERICHT}
                editable={!bezig}
                multiline
                textAlignVertical="top"
              />
              {/* Pas tellen als de limiet in zicht komt — daarvoor is het ruis. */}
              {bericht.length > TELLER_VANAF && (
                <Text style={s.teller}>{bericht.length} / {MAX_BERICHT}</Text>
              )}
            </View>
            {fout && <Text style={s.fout}>{fout}</Text>}
            <PrimaireKnop label="Aanvraag versturen" onPress={verstuur} bezig={bezig} />
          </>
        )}

        {/* Bij het formulier is de primaire knop de uitweg; in elke andere stand valt er
            niets meer te doen en is sluiten de enige actie. */}
        {(verzonden || nogNietBeschikbaar || openAanvraag !== null) && (
          <Pressable
            onPress={onSluit}
            accessibilityRole="button"
            style={({ pressed }) => [s.sluit, pressed && { backgroundColor: colors.bgNeutralSoft }]}
          >
            <Text style={s.sluitTekst}>Sluiten</Text>
          </Pressable>
        )}
      </View>
    </Sheet>
  );
}

/** "Je aanvraag van gisteren staat klaar bij Laura." — zonder leesbare datum de korte vorm. */
function staatKlaarZin(createdAt: string): string {
  const wanneer = relatieveDag(createdAt);
  return wanneer ? `Je aanvraag van ${wanneer} staat klaar bij Laura.` : 'Je aanvraag staat klaar bij Laura.';
}

const s = StyleSheet.create({
  inhoud: { paddingHorizontal: 26, paddingTop: 6, paddingBottom: 34, gap: 16 },
  titel: { fontFamily: fontFamily.serif, fontSize: 26, letterSpacing: -0.26, color: colors.ink },
  subregel: { fontFamily: fontFamily.sans, fontSize: 13.5, lineHeight: 21, color: colors.mutedSoft },
  laden: { paddingVertical: 28, alignItems: 'center' },

  // formulier
  veld: { gap: 6 },
  textarea: {
    minHeight: 104,
    paddingVertical: 15,
    paddingHorizontal: 17,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    borderRadius: radii.cardLg,
    backgroundColor: colors.bgSurface,
    fontFamily: fontFamily.sans,
    fontSize: 15,
    lineHeight: 24,
    color: colors.ink,
  },
  teller: { alignSelf: 'flex-end', fontFamily: fontFamily.sans, fontSize: 12.5, color: colors.mutedSoft },
  fout: { fontFamily: fontFamily.sans, fontSize: 14, lineHeight: 21, color: colors.clayInk },

  // bevestiging
  klaar: { gap: 12, alignItems: 'flex-start' },
  vink: {
    width: 56,
    height: 56,
    borderRadius: radii.pill,
    backgroundColor: colors.sageSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vinkTeken: { fontSize: 24, lineHeight: 28, color: colors.sage },

  // sluiten
  sluit: {
    alignSelf: 'stretch',
    paddingVertical: 15,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sluitTekst: { fontFamily: fontFamily.sans, fontSize: 16, color: colors.body },
});
