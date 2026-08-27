import { useState, type SubmitEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login } from "../services/auth.service";
import "./Login.css";

type LoginProps = {
  setAuthenticated: React.Dispatch<React.SetStateAction<boolean>>;
};

export default function Login({ setAuthenticated }: LoginProps) {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);

  async function handleLogin(e: SubmitEvent) {
    e.preventDefault();
    console.log("handling");

    const form = e.currentTarget as HTMLFormElement;

    const email = (form.elements.namedItem("email") as HTMLInputElement).value;

    const password = (form.elements.namedItem("password") as HTMLInputElement)
      .value;
    console.log(1);
    try {
      const { data, error } = await login(email, password);

      if (error) {
        console.error("Login error:", error);
        return;
      }

      console.log("Logged in:", data);
      setAuthenticated(true);
      navigate("/");
    } catch (err) {
      console.error("Login exception:", err);
    }
  }

  return (
    <main id="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="logo-mark">S</div>

          <h1>Welcome back</h1>
          <p>Keep working toward your SAT goals.</p>
        </div>

        <form id="login-form" onSubmit={handleLogin}>
          <div className="input-container">
            <input
              type="email"
              id="email"
              name="email"
              placeholder=" "
              required
            />
            <label htmlFor="email">Email</label>
          </div>

          <div className="input-container password-container">
            <input
              type={showPassword ? "text" : "password"}
              id="password"
              name="password"
              placeholder=" "
              required
            />
            <label htmlFor="password">Password</label>

            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                // Eye
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r="3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
              ) : (
                // Eye with slash
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M3 3l18 18"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M10.6 10.6a2 2 0 0 0 2.8 2.8"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M9.9 4.2A10.8 10.8 0 0 1 12 4c5.5 0 9.5 5 10 8-.2 1.1-.8 2.1-1.5 3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M6.2 6.2C3.9 7.8 2.4 10.2 2 12c.5 3 4.5 8 10 8 1.6 0 3-.4 4.3-1"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </button>
          </div>

          <div className="forgot-password">
            <a href="#">Forgot password?</a>
          </div>

          <button type="submit">Log in</button>
        </form>

        <div className="signup-prompt">
          Don't have an account? <Link to="/signup">Create one</Link>
        </div>
      </div>
    </main>
  );
}

// supabase has reset password
