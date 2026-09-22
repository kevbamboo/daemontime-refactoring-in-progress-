import { useEffect, useState } from "react";
import { socketService } from "../services/socket.service";
import type { SubmitEvent } from "react";
import "./MessageBox.css";

export default function MessageBox({ gameState }: { gameState: number }) {
  const [, redraw] = useState(0);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [warning, setWarning] = useState(false);
  useEffect(
    () => socketService.subscribeToMessages(() => redraw((n) => n + 1)),
    [],
  );
  const messages =
    gameState === 0 ? socketService.lobbyMessages : socketService.gameMessages;
  useEffect(() => {
    if (!cooldownUntil) return;
    const interval = window.setInterval(() => {
      const remaining = Math.max(0, cooldownUntil - Date.now());
      setCooldownSeconds(Math.ceil(remaining / 1000));
      if (!remaining) {
        window.clearInterval(interval);
        setCooldownUntil(0);
      }
    }, 100);
    return () => window.clearInterval(interval);
  }, [cooldownUntil]);

  function startWarning() {
    setWarning(false);
    window.requestAnimationFrame(() => setWarning(true));
  }

  function startCooldown() {
    const until = Date.now() + 3000;
    setCooldownUntil(until);
    setCooldownSeconds(3);
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    setError("");
    if (cooldownUntil > Date.now()) {
      startWarning();
      return;
    }
    const form = e.currentTarget as HTMLFormElement;
    const input = form.elements.namedItem("chat") as HTMLInputElement;
    setSending(true);
    try {
      const gameId = socketService.currentGameId;
      if (gameState !== 0 && !gameId)
        throw new Error("Join a game before sending game messages");
      await socketService.sendMessage(
        input.value,
        gameState === 0 ? undefined : gameId,
      );
      input.value = "";
      startCooldown();
    } catch (error) {
      if (error instanceof Error && error.message === "Message cooldown active") {
        startCooldown();
        startWarning();
      } else {
        setError(error instanceof Error ? error.message : "Unable to send message");
      }
    } finally {
      setSending(false);
    }
  }
  return (
    <div id="message-box">
      <div id="messages" aria-live="polite">
        {messages.map((message) => (
          <p key={message.id}>
            <strong>{message.username}</strong>
            <span>{message.text}</span>
          </p>
        ))}
      </div>
      {error && <p role="alert">{error}</p>}
      <form
        id="message-form"
        className={warning ? "message-form-warning" : ""}
        onSubmit={handleSubmit}
        onAnimationEnd={() => setWarning(false)}
      >
        <input
          id="message-input"
          name="chat"
          type="text"
          placeholder="Say something..."
          maxLength={2000}
          required
        />
        <button id="message-button" type="submit" disabled={sending}>
          Send {cooldownSeconds > 0 && <small aria-label={`${cooldownSeconds} seconds remaining`}>{cooldownSeconds}</small>}
        </button>
      </form>
    </div>
  );
}
