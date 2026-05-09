import { NavLink } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/',         icon: '🏠', label: 'Home'     },
  { to: '/plan',     icon: '📋', label: 'Plan'     },
  { to: '/progress', icon: '📈', label: 'Progress' },
  { to: '/history',  icon: '📅', label: 'History'  },
  { to: '/settings', icon: '⚙️', label: 'Settings' },
];

export default function NavBar() {
  return (
    <nav className="nav-bar" aria-label="Main navigation">
      <div className="nav-items">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <span className="nav-icon" aria-hidden="true">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
