import { useEffect, useState } from 'react';
import { socketService } from '../services/socket.service';
import type { SubmitEvent } from 'react';
import './MessageBox.css';

export default function MessageBox({ gameState }: { gameState: number }) {
  const [, redraw] = useState(0);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  useEffect(() => socketService.subscribeToMessages(() => redraw(n => n + 1)), []);
  const messages = gameState === 0 ? socketService.lobbyMessages : socketService.gameMessages;
  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const input = form.elements.namedItem('chat') as HTMLInputElement;
    setSending(true); setError('');
    try {
      const gameId = socketService.currentGameId;
      if (gameState !== 0 && !gameId) throw new Error('Join a game before sending game messages');
      await socketService.sendMessage(input.value, gameState === 0 ? undefined : gameId);
      input.value = '';
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to send message'); }
    finally { setSending(false); }
  }
  return <div id="message-box">
    <div className="message-box-header"><h2>{gameState === 0 ? 'Lobby' : 'Game'} Chat Room</h2></div>
    <div id="messages" aria-live="polite">{messages.map(message => <p key={message.id}><strong>{message.username}: </strong>{message.text}</p>)}</div>
    {error && <p role="alert">{error}</p>}
    <form id="message-form" onSubmit={handleSubmit}>
      <input id="message-input" name="chat" type="text" placeholder="Say something..." maxLength={2000} required />
      <button id="message-button" type="submit" disabled={sending}>Send</button>
    </form>
  </div>;
}
