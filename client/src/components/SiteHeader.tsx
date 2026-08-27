import "./SiteHeader.css";

export default function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-content">
        <a href="/" className="site-logo">
          Daemontime
        </a>

        <nav className="site-nav">
          <a href="/">Home</a>
          <a href="/games">Games</a>
        </nav>
      </div>
    </header>
  );
}
