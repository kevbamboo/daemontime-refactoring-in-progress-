import { useEffect, useState } from 'react';
import MessageBox from './MessageBox';
import GameCard from './GameCard';
import NewGameModal from './NewGameModal';
import { socketService, type Game } from '../services/socket.service';
import './GameBox.css';

export default function GameBox() {
  const [games, setGames] = useState<Game[]>([]);
  const [, redraw] = useState(0);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    const gamesOff = socketService.subscribeToGames(setGames);
    const statusOff = socketService.subscribeToStatus(() => redraw(n => n + 1));
    return () => { gamesOff(); statusOff(); };
  }, []);
  const game = games.find(g => g.players.some(p => p.id === socketService.userId));
  // Starting a game deliberately does not advance the gameplay screen yet.
  const gameState = game ? 1 : 0;
  async function action(fn: () => Promise<unknown>) {
    setBusy(true);
    try { await fn(); } catch (error) { socketService.reportError(error); }
    finally { setBusy(false); }
  }
  return <div id="game">
    {socketService.error && <p role="alert">{socketService.error}</p>}
    {!socketService.ready ? <div>Connecting… <button onClick={() => void action(() => socketService.retryConnection())}>Retry</button></div> : <>
      <div id="game-box">{!game ? <>
        <div className="game-box-header"><h2>Lobby</h2><button className="new-game-button" disabled={busy} onClick={() => setCreating(true)}>New Game</button></div>
        <div id="game-list">{games.map(g => <GameCard key={g.gameId} game={g} disabled={busy} onJoin={() => void action(() => socketService.joinGame(g.gameId))} />)}</div>
      </> : <>
        <div className="game-header"><h2>{game.gameId}</h2><button className="leave-button" disabled={busy} onClick={() => void action(() => socketService.leaveGame(game.gameId))}>Leave</button></div>
        <div className="players-section"><h3>Players</h3><ol>{game.players.map(player => <li key={player.id}>{player.username}{player.id === game.hostId ? ' (Host)' : ''}</li>)}</ol>
          {game.players.length === 1 && <p>Waiting for players to join...</p>}
          {socketService.isCurrentGameHost && <button className="start-game-button" disabled={busy || game.started} onClick={() => void action(() => socketService.startGame(game.gameId))}>{game.started ? 'Started' : 'Start Game'}</button>}
        </div>
      </>}</div>
      <MessageBox gameState={gameState} />
    </>}
    {creating && <NewGameModal onClose={() => setCreating(false)} />}
  </div>;
}
