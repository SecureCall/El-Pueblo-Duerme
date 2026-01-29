// PANTALLA MÍNIMA DEL JUEGO
export default function GamePage({ params }: { params: { gameId: string } }) {
  return (
    <div>
      <h1>El Pueblo Duerme</h1>
      <h2>Partida: {params.gameId}</h2>
      <p>⚠️ JUEGO EN CONSTRUCCIÓN</p>
      <p>Falta implementar: TODO</p>
    </div>
  );
}
