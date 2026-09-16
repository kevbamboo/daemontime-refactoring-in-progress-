import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { socketService } from '../services/socket.service';
import './NewGameModal.css';

export default function NewGameModal({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget as HTMLFormElement;
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const timeLimit = Number(data.get('timeLimit'));
    const numberOfProblems = Number(data.get('numberOfProblems'));
    if (![timeLimit, numberOfProblems].every(value => Number.isInteger(value) && value >= 5 && value <= 99)) {
      setError('Enter whole numbers from 5 to 99.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await socketService.createGame({ timeLimit, numberOfProblems });
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to create game.');
    } finally {
      setBusy(false);
    }
  }

  return <dialog ref={dialog} className="new-game-modal" aria-labelledby="new-game-title"
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <h2 id="new-game-title">New Game</h2>
    <form onSubmit={submit}>
      <label htmlFor="new-game-time">Time limit (seconds)</label>
      <input id="new-game-time" name="timeLimit" type="number" min={5} max={99} step={1} defaultValue={30} required disabled={busy} autoFocus />
      <label htmlFor="new-game-problems">Number of problems</label>
      <input id="new-game-problems" name="numberOfProblems" type="number" min={5} max={99} step={1} defaultValue={5} required disabled={busy} />
      <p className="new-game-hint">Choose whole numbers from 5 to 99.</p>
      {error && <p role="alert">{error}</p>}
      <div className="new-game-actions">
        <button type="button" disabled={busy} onClick={onClose}>Cancel</button>
        <button type="submit" disabled={busy}>{busy ? 'Creating...' : 'Create Game'}</button>
      </div>
    </form>
  </dialog>;
}
