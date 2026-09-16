import { useState } from 'react';
import "./AuthModal.css";
import { guestLogin } from "../services/auth.service";
import { useNavigate } from "react-router-dom";

export default function AuthModal() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleGuestLogin() {
    setBusy(true);
    try { const result = await guestLogin(); setError(result.error?.message ?? ''); }
    catch { setError('Unable to sign in. Please retry.'); }
    finally { setBusy(false); }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-mark">S</div>

        <h2>Ready to practice?</h2>

        <p>Choose how you'd like to continue.</p>

        {error && <p role="alert">{error}</p>}<div className="auth-options">
          <button className="guest-button" onClick={handleGuestLogin} disabled={busy}>
            Continue as Guest
          </button>

          <button
            className="secondary-button"
            onClick={() => navigate("/login")}
          >
            Log in
          </button>

          <button
            className="secondary-button"
            onClick={() => navigate("/signup")}
          >
            Create an account
          </button>
        </div>
      </div>
    </div>
  );
}
