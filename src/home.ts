// Tu casa: cambia estos valores por los tuyos. Todo lo que depende del sitio (tiempo, mar, avisos, gasolina,
// rutas y tráfico) sale de aquí. El ejemplo es Barcelona.
export const HOME = {
  /** Nombre corto que se ve en el inicio y en el widget */
  name: 'Barcelona',
  lat: 41.3874,
  lon: 2.1686,
  timeZone: 'Europe/Madrid',
  /** Un punto de mar cercano para el oleaje y el agua (Open-Meteo Marine); null si no tienes mar cerca */
  sea: { lat: 41.37, lon: 2.2 } as { lat: number; lon: number } | null,
  /** Avisos de Meteoalarm: el país del feed y un texto que aparezca en el nombre de tu zona */
  alerts: { feed: 'feeds-spain', area: /barcelona/i, label: 'Barcelona' },
  /** Gasolineras (sólo España): IDMunicipio del Ministerio. Búscalo en
   *  https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/Listados/MunicipiosPorProvincia/<provincia> */
  fuelTown: { id: '881', label: 'Barcelona' } as { id: string; label: string } | null,
  /** Horas punta (lunes a viernes), en horas decimales: en ellas el tráfico se mira más a menudo */
  peakHours: [
    [7, 9.5],
    [13.5, 15.5],
    [17, 19.5],
  ] as [number, number][],
};
