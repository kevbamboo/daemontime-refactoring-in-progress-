import { useState, type SubmitEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signup } from "../services/auth.service";
import "./Signup.css";
import PasswordToggle from "./PasswordToggle";

export default function Signup() {
  const navigate = useNavigate();
  const [notice, setNotice] = useState("");
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

      if (data.session) navigate("/");
      else
        setNotice(
          "Check your email to confirm your account before logging in.",
        );
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Unable to sign up. Please retry.",
      );
    }
  }

  return (
    <div id="signup-page">
      {notice && <p role="status">{notice}</p>}
      <form id="signup-form" onSubmit={handleSignup}>
        <div className="signup-header">
          <div className="auth-heading">
            <h1>Create your account</h1>
            <p>Start practicing and improve your SAT score.</p>
          </div>
          <div className="logo-mark">DT</div>
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

          <PasswordToggle
            visible={showPassword}
            onToggle={() => setShowPassword((current) => !current)}
          />
        </div>

        <button type="submit">Sign up</button>

        <div className="signup-login">
          Already have an account? <Link to="/login">Log in</Link>
        </div>
      </form>
    </div>
  );
}
