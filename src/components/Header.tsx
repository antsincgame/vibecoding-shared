import { useState, useEffect, useRef, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, ChevronDown, Flame } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';

/* ── Types ── */

export interface NavLink {
  to: string;
  label: string;
  style?: React.CSSProperties;
  external?: boolean;
  icon?: ReactNode;
}

export interface MegaMenuSection {
  title: string;
  items: { label: string; slug: string; isNew?: boolean; isHot?: boolean }[];
}

export interface MegaMenuCategory {
  label: string;
  slug: string;
  sections: MegaMenuSection[];
}

export interface HeaderConfig {
  logoText: string;
  logoImage?: string;
  logoTo?: string;
  navLinks?: NavLink[];
  megaMenu?: MegaMenuCategory[];
  onOpenSearch?: () => void;
  searchPlaceholder?: string;
  telegramLink?: string;
  loginPath?: string;
  signupPath?: string;
  profilePath?: string;
  extraLinks?: NavLink[];
}

/* ── Component ── */

export default function Header({
  logoText,
  logoImage,
  logoTo = '/',
  navLinks,
  megaMenu,
  onOpenSearch,
  searchPlaceholder = 'Найти услуги',
  telegramLink,
  loginPath = '/auth',
  signupPath = '/auth?tab=signup',
  profilePath = '/dashboard',
  extraLinks,
}: HeaderConfig) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeMega, setActiveMega] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const location = useLocation();
  const { user, profile } = useAuth();

  useEffect(() => {
    setIsMenuOpen(false);
    setActiveMega(null);
  }, [location]);

  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isMenuOpen]);

  const handleMegaEnter = (slug: string) => {
    clearTimeout(timeoutRef.current);
    setActiveMega(slug);
  };

  const handleMegaLeave = () => {
    timeoutRef.current = setTimeout(() => setActiveMega(null), 150);
  };

  const activeCat = megaMenu?.find((c) => c.slug === activeMega);
  const isAdmin = profile?.role === 'admin';
  const isTeacher = profile?.role === 'teacher';
  const isModerator = profile?.role === 'moderator';
  const displayName = profile?.full_name || user?.email || 'Профиль';

  return (
    <>
      <header className="vc-header">
        <nav className="vc-header-nav">
          {/* Logo */}
          <Link to={logoTo} className="vc-header-logo">
            {logoImage ? <img src={logoImage} alt={logoText} style={{height:'40px'}} /> : <span className="neon-text glitch" data-text={logoText}>{logoText}</span>}
          </Link>

          {/* Desktop */}
          <div className="vc-nav-desktop">
            {/* Search button (freelance) */}
            {onOpenSearch && (
              <button onClick={onOpenSearch} className="vc-search-btn">
                <Search size={16} />
                <span>{searchPlaceholder}</span>
                <kbd>Ctrl+K</kbd>
              </button>
            )}

            {/* Simple nav links (school) */}
            {navLinks?.map((link) =>
              link.external ? (
                <a
                  key={link.to}
                  href={link.to}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="vc-nav-link"
                  style={link.style}
                >
                  {link.icon}
                  {link.label}
                </a>
              ) : (
                <Link key={link.to} to={link.to} className="vc-nav-link" style={link.style}>
                  {link.label}
                </Link>
              )
            )}

            {/* Mega menu (freelance) */}
            {megaMenu && (
              <div className="vc-categories">
                {megaMenu.map((cat) => (
                  <div
                    key={cat.slug}
                    className="vc-cat-item"
                    onMouseEnter={() => handleMegaEnter(cat.slug)}
                    onMouseLeave={handleMegaLeave}
                  >
                    <button className={`vc-nav-link vc-nav-dropdown ${activeMega === cat.slug ? 'active' : ''}`}>
                      {cat.label}
                      <ChevronDown size={12} className={`vc-chevron ${activeMega === cat.slug ? 'rotated' : ''}`} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Extra links (admin, teacher) */}
            {extraLinks?.map((link) => {
              if (link.label === 'Работы учеников' && !(isAdmin || isTeacher)) return null;
              if (link.label === 'Админка' && !(isAdmin || isModerator)) return null;
              return (
                <Link key={link.to} to={link.to} className="vc-nav-link" style={link.style}>
                  {link.label}
                </Link>
              );
            })}

            {/* Telegram */}
            {telegramLink && (
              <a href={telegramLink} target="_blank" rel="noopener noreferrer" className="vc-nav-link vc-telegram">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.461-1.901-.903-1.056-.693-1.653-1.124-2.678-1.8-1.185-.781-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.062 3.345-.479.329-.913.489-1.302.481-.428-.008-1.252-.242-1.865-.442-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635.099-.002.321.023.465.14.121.099.155.232.171.325.016.093.036.305.02.47z" />
                </svg>
              </a>
            )}

            {/* Auth */}
            {user ? (
              <Link to={profilePath} className="vc-nav-link vc-auth-btn">{displayName}</Link>
            ) : (
              <>
                <Link to={loginPath} className="vc-nav-link vc-auth-btn">Вход</Link>
                <Link to={signupPath} className="vc-nav-link vc-auth-btn vc-signup-btn">Регистрация</Link>
              </>
            )}
          </div>

          {/* Burger */}
          <button
            className={`vc-burger ${isMenuOpen ? 'active' : ''}`}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Menu"
          >
            <span className="vc-burger-line" />
            <span className="vc-burger-line" />
            <span className="vc-burger-line" />
          </button>
        </nav>

        {/* Mega dropdown */}
        {activeCat && (
          <div
            className="vc-mega-dropdown"
            onMouseEnter={() => { clearTimeout(timeoutRef.current); setActiveMega(activeCat.slug); }}
            onMouseLeave={handleMegaLeave}
          >
            <div className="vc-mega-inner">
              <div className="vc-mega-grid">
                {activeCat.sections.map((section) => (
                  <div key={section.title} className="vc-mega-section">
                    <h4 className="vc-mega-title">{section.title}</h4>
                    <ul className="vc-mega-list">
                      {section.items.map((item) => (
                        <li key={item.slug}>
                          <Link
                            to={`/categories/${item.slug}`}
                            className="vc-mega-link"
                            onClick={() => setActiveMega(null)}
                          >
                            <span>{item.label}</span>
                            {item.isNew && <span className="vc-badge-new">new</span>}
                            {item.isHot && <Flame size={12} className="vc-badge-hot" />}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Mobile overlay */}
        {isMenuOpen && <div className="vc-mobile-overlay" onClick={() => setIsMenuOpen(false)} />}

        {/* Mobile menu */}
        <div className={`vc-mobile-menu ${isMenuOpen ? 'open' : ''}`}>
          {onOpenSearch && (
            <button
              onClick={() => { onOpenSearch(); setIsMenuOpen(false); }}
              className="vc-mobile-search"
            >
              <Search size={16} />
              <span>{searchPlaceholder}...</span>
            </button>
          )}

          {navLinks?.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="vc-mobile-link"
              onClick={() => setIsMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}

          {megaMenu?.map((cat) => (
            <Link
              key={cat.slug}
              to={`/categories/${cat.sections[0]?.items[0]?.slug || ''}`}
              className="vc-mobile-link"
              onClick={() => setIsMenuOpen(false)}
            >
              {cat.label}
            </Link>
          ))}

          {user ? (
            <Link
              to={profilePath}
              className="vc-mobile-link vc-mobile-auth"
              onClick={() => setIsMenuOpen(false)}
            >
              {displayName}
            </Link>
          ) : (
            <>
              <Link
                to={loginPath}
                className="vc-mobile-link vc-mobile-auth"
                onClick={() => setIsMenuOpen(false)}
              >
                Вход
              </Link>
              <Link
                to={signupPath}
                className="vc-mobile-link vc-mobile-auth vc-mobile-signup"
                onClick={() => setIsMenuOpen(false)}
              >
                Регистрация
              </Link>
            </>
          )}
        </div>
      </header>
    </>
  );
}
