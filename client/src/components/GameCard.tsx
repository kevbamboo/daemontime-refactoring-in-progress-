import type { Game } from '../services/socket.service';
import './GameCard.css';

type GameCardProps = {
  game: Game;
  disabled: boolean;
  onJoin: () => void;
};

export default function GameCard({ game, disabled, onJoin }: GameCardProps) {
  const { started } = game;
  const host = game.players.find(player => player.id === game.hostId)?.username;

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
                <strong>{game.players.length}</strong>
              </div>
            </div>
          </div>

          {/* BACK */}
          <div className="game-card-back">
            <div className="game-card-back-title">GAME DETAILS</div>

            <div className="game-card-details">
              <div>
                <strong>{game.numberOfProblems}</strong>
                <span>Questions</span>
              </div>

              <div>
                <strong>{game.timeLimit}</strong>
                <span>Seconds</span>
              </div>
            </div>
          </div>
        </div>

        {/* FIXED BUTTON */}
        <button
          className="game-card-join-button"
          onClick={onJoin}
          disabled={disabled || started}
        >
          {started ? "In Progress" : "Join Game"} <span>→</span>
        </button>
      </div>
    </div>
  );
}
