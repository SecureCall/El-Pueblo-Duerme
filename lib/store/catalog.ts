export const STORE_PRICES: Record<string, number> = {
  'avatar-aldeano-sabio': 300, 'avatar-bruja': 400, 'avatar-guardia': 350,
  'avatar-panadero': 200, 'avatar-doncella': 250, 'avatar-monja': 250,
  'avatar-herrero': 300, 'avatar-nina': 350, 'avatar-tejedora': 200,
  'avatar-boticario': 300, 'avatar-cazador': 350, 'avatar-clerigo': 300,
  'avatar-granjero': 200, 'avatar-lobo-oveja': 600, 'avatar-medico-plaga': 500,
  'avatar-noble': 400, 'avatar-pescador': 200, 'avatar-picaro': 450,
  'avatar-trovador': 300,
  'marco-dorado': 300, 'marco-sangre': 350, 'tema-luna': 400,
  'emote-aullido': 200, 'emote-cuchillo': 200, 'sala-premium': 800,
  'destacar-sala': 300, 'estadisticas': 600, 'titulo-maestro-lobo': 400,
  'titulo-aldea-legendario': 400, 'mensaje-dorado': 700,
  'cofre-misterioso': 250, 'cofre-epico': 600, 'pase-temporada': 1500,
};

export function getStorePrice(itemId: string): number | null {
  const price = STORE_PRICES[itemId];
  return Number.isInteger(price) && price > 0 ? price : null;
}
