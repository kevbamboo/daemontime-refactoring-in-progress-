import { useState, type SubmitEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signup } from "../services/auth.service";
import "./Signup.css";

export default function Signup() {
  const navigate = useNavigate();
  const [notice, setNotice] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  async function handleSignup(e: SubmitEvent) {
    e.preventDefault();

    const form = e.currentTarget as HTMLFormElement;

    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const username = (form.elements.namedItem("username") as HTMLInputElement)
      .value;

    const password = (form.elements.namedItem("password") as HTMLInputElement)
      .value;

    try {
      const { data, error } = await signup(email, username, password);

      if (error) {
        setNotice(error.message);
        return;
      }



      if (data.session) navigate("/"); else setNotice("Check your email to confirm your account before logging in.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Unable to sign up. Please retry.");
    }
  }

  return (
    <div id="signup-page">
      {notice && <p role="status">{notice}</p>}<form id="signup-form" onSubmit={handleSignup}>
        <div className="signup-header">
          <h1>Create your account</h1>
          <p>Start practicing and improve your SAT score.</p>
        </div>

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

        <div className="input-container">
          <input
            type="text"
            id="username"
            name="username"
            placeholder=" "
            required
          />
          <label htmlFor="username">Username</label>
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

        <button type="submit">Sign up</button>

        <div className="signup-login">
          Already have an account? <Link to="/login">Log in</Link>
        </div>
      </form>
    </div>
  );
}
