import { useEffect, useState } from "react";
import {
  socketService,
  type GameQuestion,
  type GameUpdate,
  type ReviewQuestion,
} from "../services/socket.service";
import "./GamePlay.css";

function Timer({ update }: { update: GameUpdate }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(interval);
  }, []);
  const elapsed = Math.max(0, now - (update.receivedAt ?? now));
  const seconds = Math.max(
    0,
    Math.ceil(
      ((update.endsAt ?? update.serverNow) - update.serverNow - elapsed) / 1000,
    ),
  );
  return (
    <span
      className="game-timer"
      role="timer"
      aria-label={`${seconds} seconds remaining`}
    >
      {seconds}
    </span>
  );
}

function Scoreboard({ update }: { update: GameUpdate }) {
  function getStatus(player: GameUpdate['scores'][number]) {
    if (!player.active) return 'Left';
    if (update.phase === 'finished') return 'Finished';
    if (player.submitted) return 'Submitted';
    if (update.phase === 'scoreboard') return 'No answer';
    return 'Answering';
  }

  return (
    <table className="scoreboard">
      <caption>
        {update.phase === "finished" ? "Final scoreboard" : "Scoreboard"}
      </caption>
      <thead>
        <tr>
          <th scope="col">Player</th>
          <th scope="col">Points</th>
          <th scope="col">Status</th>
        </tr>
      </thead>
      <tbody>
        {update.scores.map((player) => (
          <tr
            key={player.id}
            className={player.id === socketService.userId ? "your-score" : ""}
          >
            <th scope="row">
              {player.username}
              {player.id === socketService.userId ? " (You)" : ""}
            </th>
            <td>{player.score}</td>
            <td>{getStatus(player)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function StatusMessage({ update }: { update: GameUpdate }) {
  if (update.phase === 'finished') return null;
  if (update.phase !== 'scoreboard') {
    return <p role="status">Answer submitted. Waiting for the other players or the timer.</p>;
  }
  const message = update.questionIndex + 1 === update.totalQuestions
    ? 'Final results in...'
    : 'Next question in...';
  return <p role="status">{message}</p>;
}

function Question({
  gameId,
  question,
}: {
  gameId: string;
  question: GameQuestion;
}) {
  const [choice, setChoice] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit() {
    if (choice === null || busy) return;
    setBusy(true);
    setError("");
    try {
      await socketService.submitAnswer(gameId, question.index, choice);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit answer.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <fieldset className="question-choices" disabled={busy}>
        <legend className="question-text">{question.text}</legend>
        {question.choices.map((text, index) => (
          <label
            key={index}
            className={
              choice === index + 1 ? "answer-choice selected" : "answer-choice"
            }
          >
            <input
              type="radio"
              name="answer"
              value={index + 1}
              checked={choice === index + 1}
              onChange={() => setChoice(index + 1)}
            />
            <strong>{index + 1}.</strong>
            <span>{text}</span>
          </label>
        ))}
      </fieldset>
      {error && <p role="alert">{error}</p>}
      <button
        className="game-primary-button"
        disabled={choice === null || busy}
      >
        {busy ? "Submitting..." : "Submit answer"}
      </button>
    </form>
  );
}

function Review({ questions }: { questions: ReviewQuestion[] }) {
  const [index, setIndex] = useState(0);
  const [longExplanation, setLongExplanation] = useState(false);
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target;
      if (
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        (target instanceof HTMLElement &&
          (target.isContentEditable ||
            target.closest(
              'input:not([role="switch"]), textarea, select, [role="textbox"]',
            )))
      )
        return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        setIndex((current) =>
          Math.max(
            0,
            Math.min(
              questions.length - 1,
              current + (event.key === "ArrowLeft" ? -1 : 1),
            ),
          ),
        );
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [questions.length]);
  const question = questions[index];
  if (!question) return null;
  return (
    <section className="question-review" aria-label="Review your answers">
      <nav className="review-navigation" aria-label="Review questions">
        <button
          onClick={() => setIndex(index - 1)}
          disabled={index === 0}
          aria-label="Previous question"
        >
          ← Previous
        </button>
        <h3>
          Question {index + 1} of {questions.length}
        </h3>
        <button
          onClick={() => setIndex(index + 1)}
          disabled={index === questions.length - 1}
          aria-label="Next question"
        >
          Next →
        </button>
      </nav>
      <p className="question-text">{question.text}</p>
      <ol className="review-choices">
        {question.choices.map((text, i) => (
          <li
            key={i}
            className={
              i + 1 === question.correctAnswer
                ? "correct-answer"
                : i + 1 === question.yourAnswer
                  ? "wrong-answer"
                  : ""
            }
          >
            {text}
            {i + 1 === question.correctAnswer && (
              <strong> — Correct answer</strong>
            )}
            {i + 1 === question.yourAnswer && <strong> — Your answer</strong>}
          </li>
        ))}
      </ol>
      <p>Points earned: {question.points}</p>
      <h4>Explanation:</h4>
      <label className="explanation-toggle">
        <span>Short</span>
        <input
          type="checkbox"
          role="switch"
          aria-label="Use long explanation"
          checked={longExplanation}
          onChange={(event) => setLongExplanation(event.target.checked)}
          onClick={(event) => {
            if (event.detail > 0) event.currentTarget.blur();
          }}
        />
        <span className="switch-track" aria-hidden="true" />
        <span>Long</span>
      </label>
      <p className="explanation">
        {longExplanation
          ? question.longExplanation || "No long explanation available."
          : question.shortExplanation || "No short explanation available."}
      </p>
    </section>
  );
}

export default function GamePlay({ update }: { update: GameUpdate | null }) {
  if (!update)
    return (
      <section className="gameplay">
        <p>Waiting for game information...</p>
      </section>
    );
  if (update.phase === "interrupted")
    return (
      <section className="gameplay">
        <p role="status">{update.message}</p>
      </section>
    );
  if (update.phase === "countdown")
    return (
      <section className="gameplay game-countdown">
        <h3>Get ready</h3>
        <Timer update={update} />
        <p>The first question is coming up.</p>
      </section>
    );
  const showScores = update.phase !== "question" || update.submitted;
  return (
    <section className="gameplay">
      <div className="round-header">
        {update.phase !== "finished" && (
          <h3>{`Question ${update.questionIndex + 1} of ${update.totalQuestions}`}</h3>
        )}
        {update.endsAt !== null && <Timer update={update} />}
      </div>
      {showScores ? (
        <>
          <StatusMessage update={update} />
          <Scoreboard update={update} />
        </>
      ) : (
        update.question && (
          <Question
            key={update.questionIndex}
            gameId={update.gameId}
            question={update.question}
          />
        )
      )}
      {update.phase === "finished" && (
        <Review questions={update.review ?? []} />
      )}
    </section>
  );
}
