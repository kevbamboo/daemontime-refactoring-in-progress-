import "./AuthModal.css";
import { guestLogin } from "../services/auth.service";
import { useNavigate } from "react-router-dom";

type AuthModalProps = {
  setAuthenticated: React.Dispatch<React.SetStateAction<boolean>>;
};

export default function AuthModal({ setAuthenticated }: AuthModalProps) {
  const navigate = useNavigate();

  async function handleGuestLogin() {
    const { error } = await guestLogin();

    if (!error) {
      setAuthenticated(true);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-mark">S</div>

        <h2>Ready to practice?</h2>

        <p>Choose how you'd like to continue.</p>

        <div className="auth-options">
          <button className="guest-button" onClick={handleGuestLogin}>
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
