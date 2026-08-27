import { socketService } from "../services/socket.service";
import "./GameCard.css";

type GameCardProps = {
  gameId: string;
  host: string;
  started: boolean;
  setGameState: React.Dispatch<React.SetStateAction<number>>;
  setCurrentGameId: React.Dispatch<React.SetStateAction<string>>;
  setCurrentGameHost: React.Dispatch<React.SetStateAction<string>>;
};

export default function GameCard({
  gameId,
  host,
  started,
  setGameState,
  setCurrentGameId,
  setCurrentGameHost,
}: GameCardProps) {
  async function joinGame() {
    const joined = await socketService.joinGame(gameId);
    if (!joined) {
      return;
    }

    socketService.isCurrentGameHost = false;
    setGameState(1);
    await socketService.setUpGameSockets(gameId);
    setCurrentGameId(gameId);
    setCurrentGameHost(host);
  }

  return (
    <div className="game-card">
      <div className="game-card-inner">
        {/* FLIPPING CONTENT */}
        <div className="game-card-flip">
          {/* FRONT */}
          <div className="game-card-front">
            <div className="game-card-status">
              <span className={started ? "status-dot started" : "status-dot"} />
              {started ? "In Progress" : "Open"}
            </div>

            <div className="game-card-info">
              <div>
                <span>HOST</span>
                <strong>{host}</strong>
              </div>

              <div>
                <span>PLAYERS</span>
                <strong>—</strong>
              </div>
            </div>
          </div>

          {/* BACK */}
          <div className="game-card-back">
            <div className="game-card-back-title">GAME DETAILS</div>

            <div className="game-card-details">
              <div>
                <strong>20</strong>
                <span>Questions</span>
              </div>

              <div>
                <strong>25</strong>
                <span>Minutes</span>
              </div>
            </div>
          </div>
        </div>

        {/* FIXED BUTTON */}
        <button
          className="game-card-join-button"
          onClick={joinGame}
          disabled={started}
        >
          {started ? "In Progress" : "Join Game"} <span>→</span>
        </button>
      </div>
    </div>
  );
}
