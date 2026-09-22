import { Link } from "react-router-dom";
import "./SiteHeader.css";

export default function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-content">
        <Link to="/" className="site-logo">
          Daemontime
        </Link>

        <nav className="site-nav">
          <Link to="/">Home</Link>
          <Link to="/games">Games</Link>
        </nav>
      </div>
    </header>
  );
}
