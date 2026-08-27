import type { SubmitEvent } from "react";
import "./MessageBox.css";

export default function MessageBox({ gameState }: { gameState: number }) {
  function handleSubmit(e: SubmitEvent) {
    e.preventDefault();

    const form = e.currentTarget as HTMLFormElement;
    const chat = (form.elements.namedItem("chat") as HTMLInputElement).value;

    console.log(chat);
  }

  return (
    <div id="message-box">
      <div className="message-box-header">
        <span className="message-box-label">
          {gameState === 0 ? "LOBBY" : "GAME"}
        </span>

        <h2>{gameState === 0 ? "Lobby Chat Room" : "Game Chat Room"}</h2>
      </div>

      <div id="messages">Chats</div>

      <form id="message-form" onSubmit={handleSubmit}>
        <input
          id="message-input"
          name="chat"
          type="text"
          placeholder="Say something..."
          required
        />

        <button id="message-button" type="submit">
          Send
        </button>
      </form>
    </div>
  );
}
