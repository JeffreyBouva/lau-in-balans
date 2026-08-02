// Gedeelde helpers voor de maandlimiet op Lau-gebruik (fase 7). lau-reply en
// lau-ochtend moeten precies dezelfde maandgrens en dezelfde limietbepaling hanteren
// als de dashboard-RPC ai_gebruik_deze_maand — anders telt Laura iets anders dan de
// afkap doet, en dat is precies het soort verschil dat je pas op 1 augustus merkt.
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

const ZONE = 'Europe/Amsterdam';

/** Fallback als app_config.ai_maandlimiet ontbreekt of onleesbaar is. */
export const STANDAARD_MAANDLIMIET = 300;

// Offset van Europe/Amsterdam op één concreet moment, in milliseconden (+1u in de
// winter, +2u in de zomer). Truc: formatteer het moment als Amsterdamse wandklok en
// lees die string terug alsóf het UTC was — het verschil met het echte moment ís de
// offset. 'sv-SE' geeft 'YYYY-MM-DD HH:mm:ss'; hourCycle 'h23' zorgt dat middernacht
// als 00 uitkomt en niet als 24 (wat de datum een dag zou verschuiven).
function zoneOffsetMs(moment: Date): number {
  const wandklok = new Intl.DateTimeFormat('sv-SE', {
    timeZone: ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(moment);
  return Date.parse(`${wandklok.replace(' ', 'T')}Z`) - moment.getTime();
}

/**
 * Begin van de huidige AMSTERDAMSE kalendermaand, als UTC-ISO-string — direct
 * bruikbaar in `.gte('created_at', ...)`. Trekt dezelfde grens als de RPC
 * ai_gebruik_deze_maand, die in Amsterdamse lokale tijd vergelijkt: rond de
 * maandwissel schelen UTC en Amsterdam 1-2 uur, en een bericht van 31 juli 23:30
 * lokale tijd hoort in juli te tellen, niet in augustus.
 */
export function maandStartAmsterdamUTC(nu: Date = new Date()): string {
  // 1. In welk Amsterdams jaar/maand zitten we nú? Niet in UTC kijken: op 1 augustus
  //    00:30 lokale tijd is het in UTC nog 31 juli.
  const [jaar, maand] = new Intl.DateTimeFormat('sv-SE', {
    timeZone: ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(nu)
    .split('-')
    .map(Number);
  // 2. Amsterdamse middernacht op de 1e, eerst als kaal wandklok-getal (alsof die
  //    lokale tijd UTC wás).
  const wandklok = Date.UTC(jaar, maand - 1, 1, 0, 0, 0, 0);
  // 3. Het echte UTC-moment = die wandklok mín de zone-offset op dát moment. De
  //    offset hangt zelf van het moment af, dus ijken we twee keer: eerst met een
  //    ruwe schatting (offset op de wandklok zelf), dan met het gecorrigeerde
  //    moment. Een maandstart valt nooit binnen enkele uren van een DST-sprong (die
  //    zitten op de laatste zondag van maart/oktober om 01:00 UTC), dus na ronde
  //    twee staat de uitkomst vast.
  const ruw = wandklok - zoneOffsetMs(new Date(wandklok));
  const exact = wandklok - zoneOffsetMs(new Date(ruw));
  return new Date(exact).toISOString();
}

/**
 * Limiet voor deze klant: de eigen override wint van de config-default, en die van
 * de ingebakken 300. `configWaarde` is de rauwe jsonb-waarde uit app_config.
 */
export function bepaalLimiet(aiLimiet: unknown, configWaarde: unknown): number {
  if (typeof aiLimiet === 'number' && Number.isFinite(aiLimiet) && aiLimiet > 0) return aiLimiet;
  const uitConfig = Number(configWaarde);
  // Number(null) is 0 en Number(undefined) is NaN — beide vallen hier netjes door
  // naar de standaard, net als een per ongeluk op 0 gezette config-waarde.
  if (Number.isFinite(uitConfig) && uitConfig > 0) return uitConfig;
  return STANDAARD_MAANDLIMIET;
}

/**
 * Zelfde uitkomst als bepaalLimiet, maar leest app_config zelf. Voor aanroepers die
 * de config-query niet al parallel meenemen (lau-ochtend loopt per klant).
 */
export async function leesMaandlimiet(db: SupabaseClient, aiLimiet: unknown): Promise<number> {
  const { data } = await db.from('app_config').select('value').eq('key', 'ai_maandlimiet').maybeSingle();
  return bepaalLimiet(aiLimiet, (data as { value: unknown } | null)?.value);
}
