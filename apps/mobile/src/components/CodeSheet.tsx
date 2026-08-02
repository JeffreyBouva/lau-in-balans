import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { verzilverCode } from '@/lib/codes';
import { useSessie } from '@/lib/sessie';
import { colors, fontFamily, text } from '@/theme/tokens';
import { Sheet } from '@/components/Sheet';
import { PrimaireKnop } from '@/components/PrimaireKnop';
import { CodeInvoer } from '@/components/CodeInvoer';

/**
 * Code verzilveren vanaf een slot-staat. Na succes: tier herladen — de app klapt open.
 * Het toetsenbord vangt `Sheet` zelf op (schermvullende KAV daar); hier geen tweede.
 */
export function CodeSheet({ zichtbaar, onSluit }: { zichtbaar: boolean; onSluit: () => void }) {
  const { herlaadTier } = useSessie();
  const [code, setCode] = useState('');
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  // Anders dan het onboarding-codescherm blijft dit component tussen twee keer openen door
  // gemonteerd (het hangt onder een tabscherm). Resetten bij het sluiten, zoals LauraSheet:
  // je begint schoon, en het wissen valt buiten beeld in plaats van vlak vóór het openen.
  useEffect(() => {
    if (!zichtbaar) {
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
    // Eerst sluiten, dán de tier herladen: zo speelt de sluit-animatie nog vóór de schermen
    // erachter omklappen naar hun open versie. bezig gaat hier ook terug — dit component
    // overleeft het omklappen, anders draait de knop bij de volgende opening nog.
    setBezig(false);
    onSluit();
    await herlaadTier();
  }

  return (
    // Wegtikken terwijl de RPC loopt zou een net verbruikte code in het niets laten lopen:
    // zolang bezig blijft de sheet staan.
    <Sheet zichtbaar={zichtbaar} onSluit={onSluit} sluitbaar={!bezig}>
      <View style={s.inhoud}>
        <Text style={s.titel}>Code van Laura</Text>
        <Text style={text.body}>Vul de 6-tekencode in die je van Laura hebt gekregen.</Text>
        <CodeInvoer waarde={code} onWijzig={(v) => { setCode(v); setFout(null); }}
          onVoltooi={verzilver} editable={!bezig} autoFocus />
        {fout && <Text style={[text.bodyKlein, { color: colors.clayInk }]}>{fout}</Text>}
        <PrimaireKnop label="Verzilveren" onPress={verzilver} bezig={bezig} />
      </View>
    </Sheet>
  );
}

const s = StyleSheet.create({
  inhoud: { paddingHorizontal: 26, paddingTop: 6, paddingBottom: 34, gap: 16 },
  titel: { fontFamily: fontFamily.serif, fontSize: 26, letterSpacing: -0.26, color: colors.ink },
});
