import { View, Text, StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import { HANDMATEN, type Moment, type Porties, type Sender } from '@lau/shared';
import { colors, radii, fontFamily } from '@/theme/tokens';
import { useVloeiendeTekst } from '@/lib/useVloeiendeTekst';

type BerichtData = { sender: Sender; tekst: string | null; food_log_id: string | null };
type Log = { moment: Moment; porties: Porties };

/**
 * Rendert de lichte markdown die Lau/Laura kunnen sturen: **vet** wordt een zwaardere
 * font-span (regelafbrekingen doet <Text> zelf via \n). Split op **…**: even stukjes zijn
 * gewone tekst, oneven stukjes de vet-inhoud. Sluit een ** niet, dan blijft het letterlijk.
 */
function RijkeTekst({ tekst, style }: { tekst: string; style: StyleProp<TextStyle> }) {
  const delen = tekst.split(/\*\*(.+?)\*\*/g);
  return (
    <Text style={style}>
      {delen.map((deel, i) => (i % 2 === 1 ? <Text key={i} style={s.vet}>{deel}</Text> : deel))}
    </Text>
  );
}

/**
 * Eén chatbubbel (handoff § 2 "Drie berichttypes" + de laura-rij). Het type wordt
 * uit het bericht afgeleid:
 * - food_log_id != null → log-bubbel (rechts, sage-soft): eyebrow met het moment +
 *   per handmaat met porties > 0 een regel "n × hand naam".
 * - sender 'ai'    → Lau-bubbel (links, wit, rand hairlineSofter).
 * - sender 'coach' → Laura-bubbel (links, laura-bubbel-bg, rand clayBorder). Zo ziet
 *   de klant dat een mens antwoordt (guardrail: Laura visueel onderscheiden van Lau).
 * - sender 'client' → klant-bubbel (rechts, sage-soft).
 */
export function Bericht({ bericht, log }: { bericht: BerichtData; log?: Log }) {
  // Vloeiende reveal voor Lau's streamende antwoord (historische berichten: direct volledig).
  const vloeiend = useVloeiendeTekst(bericht.tekst ?? '');

  // Log-bubbel — de porties zijn los opgehaald (zie chat-scherm) en komen via `log`
  // binnen; zolang die nog niet geresolved is tonen we alleen de lege bubbel.
  if (bericht.food_log_id != null) {
    return (
      <View style={s.log}>
        {log != null && <Text style={s.logEyebrow}>{log.moment}</Text>}
        {log != null &&
          HANDMATEN.filter((h) => log.porties[h.key] > 0).map((h) => (
            <View key={h.key} style={s.logRegel}>
              <View style={[s.logMarker, { backgroundColor: h.kleur }]} />
              <Text style={s.logTekst}>
                {log.porties[h.key]} × {h.hand.toLowerCase()} {h.naam.toLowerCase()}
              </Text>
            </View>
          ))}
      </View>
    );
  }

  if (bericht.sender === 'ai') {
    return (
      <View style={s.lau}>
        <RijkeTekst tekst={vloeiend} style={s.lauTekst} />
      </View>
    );
  }

  if (bericht.sender === 'coach') {
    return (
      <View style={s.laura}>
        <RijkeTekst tekst={bericht.tekst ?? ''} style={s.lauraTekst} />
      </View>
    );
  }

  // sender === 'client'
  return (
    <View style={s.klant}>
      <Text style={s.klantTekst}>{bericht.tekst}</Text>
    </View>
  );
}

// Radii-hoeken per bubbeltype (klok: TL, TR, BR, BL).
const linksTip = {
  borderTopLeftRadius: radii.cardLg,
  borderTopRightRadius: radii.cardLg,
  borderBottomRightRadius: radii.cardLg,
  borderBottomLeftRadius: radii.bubbleTip,
} as const;
const rechtsTip = {
  borderTopLeftRadius: radii.cardLg,
  borderTopRightRadius: radii.cardLg,
  borderBottomRightRadius: radii.bubbleTip,
  borderBottomLeftRadius: radii.cardLg,
} as const;

const s = StyleSheet.create({
  // Lau (ai) — links, wit, rand hairlineSofter
  lau: {
    alignSelf: 'flex-start',
    maxWidth: '82%',
    paddingVertical: 14,
    paddingHorizontal: 18,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.hairlineSofter,
    ...linksTip,
  },
  lauTekst: { fontFamily: fontFamily.sans, fontSize: 15, lineHeight: 24, color: colors.sageInk },
  vet: { fontFamily: fontFamily.sansMedium },

  // Klant (client) — rechts, sage-soft
  klant: {
    alignSelf: 'flex-end',
    maxWidth: '78%',
    paddingVertical: 14,
    paddingHorizontal: 18,
    backgroundColor: colors.sageSoft,
    ...rechtsTip,
  },
  klantTekst: { fontFamily: fontFamily.sans, fontSize: 15, lineHeight: 23, color: colors.sageInk },

  // Laura (coach) — links, laura-bubbel-bg, rand clayBorder
  laura: {
    alignSelf: 'flex-start',
    maxWidth: '82%',
    paddingVertical: 14,
    paddingHorizontal: 18,
    backgroundColor: colors.lauraBubbleBg,
    borderWidth: 1,
    borderColor: colors.clayBorder,
    ...linksTip,
  },
  lauraTekst: { fontFamily: fontFamily.sans, fontSize: 15, lineHeight: 23, color: colors.lauraBubbleInk },

  // Voedingslog — rechts, sage-soft, met eyebrow + portie-regels
  log: {
    alignSelf: 'flex-end',
    maxWidth: '82%',
    paddingVertical: 15,
    paddingHorizontal: 17,
    backgroundColor: colors.sageSoft,
    gap: 7,
    ...rechtsTip,
  },
  logEyebrow: {
    fontFamily: fontFamily.sansMedium,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.sageMid,
  },
  logRegel: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  logMarker: { width: 11, height: 11, borderRadius: radii.marker },
  logTekst: { fontFamily: fontFamily.sans, fontSize: 14.5, color: colors.sageInk },
});
