import { useState, useEffect } from "react";
import MessageBox from "./MessageBox";
import GameCard from "./GameCard";
import { socketService, type Game } from "../services/socket.service";
import "./GameBox.css";

export default function GameBox() {
  const [loaded, setLoaded] = useState(false);

  const [gameState, setGameState] = useState(0);
  const [currentGameId, setCurrentGameId] = useState("");

  const [games, setGames] = useState<Game[]>([]);

  const numCases = 4;

  useEffect(() => {
    const unsubscribe = socketService.subscribeToGames((games) => {
      setGames(games);
    });

    async function joinLobby() {
      await socketService.joinLobby();

      setLoaded(true);
    }

    joinLobby();

    /*
     * Remove the listener when GameBox unmounts.
     */
    return unsubscribe;
  }, []);

  if (!loaded) {
    return <div>Loading</div>;
  }

  function setNextState() {
    setGameState((gameState + 1) % numCases);
  }

  async function newGame() {
    await socketService.createGame();

    console.log(socketService.currentGameId);

    setCurrentGameId(socketService.currentGameId);
    setGameState(1);
  }

  function leaveBeforeStart() {
    socketService.leaveGame(currentGameId);

    setCurrentGameId("");
    setGameState(0);
  }

  function getGame() {
    switch (gameState) {
      case 0:
        return (
          <>
            <div className="game-box-header">
              <div>
                <span className="game-box-label">GAMES</span>
                <h2>Lobby</h2>
              </div>

              <button className="new-game-button" onClick={newGame}>
                New Game
              </button>
            </div>

            <div id="game-list">
              {games.map((game) => (
                <GameCard
                  key={game.gameId}
                  gameId={game.gameId}
                  host={game.host}
                  started={game.started}
                  setGameState={setGameState}
                  setCurrentGameId={setCurrentGameId}
                />
              ))}
            </div>
          </>
        );

      case 1:
        return (
          <>
            <div className="game-header">
              <div>
                <span className="game-label">GAME</span>
                <h2>{currentGameId}</h2>
              </div>

              <button className="leave-button" onClick={leaveBeforeStart}>
                <span className="leave-arrow" />
                <span>Leave</span>
              </button>
            </div>

            <div className="players-section">
              <h3>Players</h3>
              <p>Waiting for players to join...</p>
            </div>
          </>
        );

      case 2:
        return <button>Submit</button>;

      case 3:
        return <button onClick={setNextState}>Lobby</button>;

      default:
        return <div>Error Loading</div>;
    }
  }

  return (
    <div id="game">
      <div id="game-box">
        <div>{getGame()}</div>
      </div>

      <MessageBox gameState={gameState} />
    </div>
  );
}
