// CORS-headers voor web-aanroepen (native doet geen preflight). De functie verifieert
// de JWT zelf via getUser(), dus origin '*' is veilig — auth is de echte poort.
export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
