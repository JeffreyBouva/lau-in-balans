import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { verzilverCode } from '@/lib/codes';
import { useSessie } from '@/lib/sessie';
import { colors, fontFamily, text } from '@/theme/tokens';
import { Sheet } from '@/components/Sheet';
import { PrimaireKnop } from '@/components/PrimaireKnop';
import { CodeInvoer } from '@/components/CodeInvoer';

/** Code verzilveren vanaf een slot-staat. Na succes: tier herladen — de app klapt open. */
export function CodeSheet({ zichtbaar, onSluit }: { zichtbaar: boolean; onSluit: () => void }) {
  const { herlaadTier } = useSessie();
  const [code, setCode] = useState('');
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  // Anders dan het onboarding-codescherm blijft dit component tussen twee keer openen door
  // gemonteerd (het leeft in SlotKaart / een tabscherm). Zonder deze reset kijk je bij het
  // heropenen naar de code en de foutmelding van de vorige poging.
  useEffect(() => {
    if (zichtbaar) {
      setCode('');
      setFout(null);
    }
  }, [zichtbaar]);

  async function verzilver() {
    if (code.length < 6) { setFout('Vul de 6-tekencode in die je van Laura hebt gekregen.'); return; }
    setBezig(true); setFout(null);
    const resultaat = await verzilverCode(code);
    // Storing is iets anders dan een foute code — anders sturen we iemand met een prima
    // code naar Laura terwijl alleen de verbinding hapert.
    if (resultaat === 'storing') {
      setBezig(false);
      setFout('Het lukte even niet om je code te controleren. Probeer het zo nog eens.');
      return;
    }
    if (resultaat === 'ongeldig') {
      setBezig(false);
      setFout('Deze code klopt niet of is al gebruikt.');
      return;
    }
    // Succes: de sheet sluit wel, maar dit component blijft gemonteerd — dus bezig hier
    // wél terugzetten, anders staat de knop bij een volgende keer openen nog te draaien.
    await herlaadTier();
    setCode('');
    setBezig(false);
    onSluit();
  }

  return (
    <Sheet zichtbaar={zichtbaar} onSluit={onSluit}>
      {/* Sheet zelf heeft geen KeyboardAvoidingView: zonder deze wikkel valt het
          invoerveld onder het toetsenbord zodra het opent. */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.inhoud}>
          <Text style={s.titel}>Code van Laura</Text>
          <Text style={text.body}>Vul de 6-tekencode in die je van Laura hebt gekregen.</Text>
          <CodeInvoer waarde={code} onWijzig={(v) => { setCode(v); setFout(null); }}
            onVoltooi={verzilver} editable={!bezig} autoFocus />
          {fout && <Text style={[text.bodyKlein, { color: colors.clayInk }]}>{fout}</Text>}
          <PrimaireKnop label="Verzilveren" onPress={verzilver} bezig={bezig} />
        </View>
      </KeyboardAvoidingView>
    </Sheet>
  );
}

const s = StyleSheet.create({
  inhoud: { paddingHorizontal: 26, paddingTop: 6, paddingBottom: 34, gap: 16 },
  titel: { fontFamily: fontFamily.serif, fontSize: 26, letterSpacing: -0.26, color: colors.ink },
});
