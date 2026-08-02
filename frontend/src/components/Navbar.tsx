import { NavLink } from "react-router-dom";
import { useTheme } from "../hooks/useTheme";
import { FileTextIcon, SearchIcon, TrendingUpIcon, SunIcon, MoonIcon } from "./icons";
import "./Navbar.css";

const SkillLensLogo = () => (
  <svg width="36" height="36" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="skillLensGrad" x1="4" y1="4" x2="36" y2="36" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#9333ea" />
        <stop offset="45%" stopColor="#6366f1" />
        <stop offset="100%" stopColor="#00c2ff" />
      </linearGradient>
    </defs>
    {/* Lens Ring */}
    <circle cx="17" cy="17" r="12" stroke="url(#skillLensGrad)" strokeWidth="3.4" strokeLinecap="round" />
    {/* Lens Handle */}
    <path d="M26 26L34 34" stroke="url(#skillLensGrad)" strokeWidth="4.5" strokeLinecap="round" />
    {/* Bottom Curve Support */}
    <path d="M10 20.5C13 23 21 23 24 19.5" stroke="url(#skillLensGrad)" strokeWidth="2.2" strokeLinecap="round" />
    {/* Bar 1 */}
    <rect x="11.5" y="16" width="2.4" height="4.5" rx="1.2" fill="url(#skillLensGrad)" />
    {/* Bar 2 */}
    <rect x="15.5" y="13" width="2.4" height="7.5" rx="1.2" fill="url(#skillLensGrad)" />
    {/* Bar 3 */}
    <rect x="19.5" y="9.5" width="2.4" height="11" rx="1.2" fill="url(#skillLensGrad)" />
    {/* Dot above Bar 3 */}
    <circle cx="20.7" cy="7.2" r="1.3" fill="url(#skillLensGrad)" />
  </svg>
);

export default function Navbar() {
  const [theme, toggleTheme] = useTheme();

  return (
    <nav className="navbar" role="navigation" aria-label="Main navigation">
      <div className="navbar-inner">
        {/* Brand Logo */}
        <a href="/" className="navbar-brand" aria-label="Skill Lens home">
          <span className="navbar-icon">
            <SkillLensLogo />
          </span>
          <span className="navbar-title">
            Skill <span className="navbar-title-accent">Lens</span>
          </span>
        </a>

        {/* Center Pill Switcher Capsule */}
        <div className="nav-capsule">
          <NavLink
            to="/"
            end
            id="nav-matcher"
            className={({ isActive }) =>
              `nav-capsule__link ${isActive ? "nav-capsule__link--active" : ""}`
            }
          >
            <FileTextIcon size={15} />
            <span>Resume Matcher</span>
          </NavLink>

          <NavLink
            to="/explore"
            id="nav-explorer"
            className={({ isActive }) =>
              `nav-capsule__link ${isActive ? "nav-capsule__link--active" : ""}`
            }
          >
            <SearchIcon size={15} />
            <span>Role Explorer</span>
          </NavLink>

          <NavLink
            to="/trends"
            id="nav-trends"
            className={({ isActive }) =>
              `nav-capsule__link ${isActive ? "nav-capsule__link--active" : ""}`
            }
          >
            <TrendingUpIcon size={15} />
            <span>Trends</span>
          </NavLink>
        </div>

        {/* Right Circular Theme Toggle Button */}
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          id="btn-theme-toggle"
          title={theme === "dark" ? "Light mode" : "Dark mode"}
        >
          {theme === "dark" ? <MoonIcon /> : <SunIcon />}
        </button>
      </div>
    </nav>
  );
}
