import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { LibraryBig, LayoutDashboard, Users, LogOut, Loader2, Inbox } from 'lucide-react'
import { Routes, Route, NavLink, useNavigate, useLocation, useParams } from 'react-router-dom'
import '../admin-dashboard.css'
import { supabase } from '../supabaseClient.js'
import { ToastProvider } from './toast.jsx'
import Dashboard from './Dashboard.jsx'
import Applications from './Applications.jsx'
import ApplicationDetail from './ApplicationDetail.jsx'
import { useApps } from './useApps.js'

function LoadingScreen() {
  return (
    <div className="admin-loading">
      <Loader2 size={26} className="spin" />
      <p>Loading dashboard...</p>
    </div>
  )
}

function DetailRoute({ rows, refresh }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const row = rows.find((r) => String(r.id) === id)
  const onOpen = (r) => navigate(`/admin/applications/${r.id}`)
  return (
    <>
      <Applications rows={rows} onOpen={onOpen} />
      {row ? (
        <ApplicationDetail row={row} onClose={() => navigate('/admin/applications')} refresh={refresh} />
      ) : (
        <div className="admin-empty-block">
          <Inbox size={34} />
          <p>Application not found.</p>
        </div>
      )}
    </>
  )
}

export default function AdminApp() {
  const [session, setSession] = useState(null)
  const [ready, setReady] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { rows, loading, refresh } = useApps(!!session)
  const contentRef = useRef(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
      if (!data.session) navigate('/admin/login', { replace: true })
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      if (!s) navigate('/admin/login', { replace: true })
    })
    return () => sub.subscription.unsubscribe()
  }, [navigate])

  useEffect(() => {
    if (!session || !rows) return
    const ctx = gsap.context(() => {
      gsap.fromTo(
        contentRef.current,
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' }
      )
    }, contentRef)
    return () => ctx.revert()
  }, [session, rows, location.pathname])

  if (!ready) return <LoadingScreen />
  if (!session) return null

  const nav = [
    { to: '/admin', label: 'Dashboard', icon: <LayoutDashboard size={19} />, end: true },
    { to: '/admin/applications', label: 'Applications', icon: <Users size={19} /> }
  ]

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const navClass = ({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`
  const bottomClass = ({ isActive }) => `bottom-item ${isActive ? 'active' : ''}`
  const onOpen = (r) => navigate(`/admin/applications/${r.id}`)

  return (
    <ToastProvider>
      <div className="admin-shell">
        <aside className="admin-sidebar">
          <div className="admin-brand">
            <span className="admin-brand-mark"><LibraryBig size={20} /></span>
            <span className="admin-brand-text">
              <strong>Sevak Library</strong>
              <small>Admin</small>
            </span>
          </div>
          <nav className="admin-nav">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={navClass}>
                {n.icon}
                <span>{n.label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="admin-sidebar-foot">
            <button className="admin-nav-item" onClick={signOut}>
              <LogOut size={19} />
              <span>Sign out</span>
            </button>
          </div>
        </aside>

        <main className="admin-main">
          <div className="admin-topbar">
            <div className="admin-topbar-info">
              <span className="admin-user-avatar">{session.user.email ? session.user.email.charAt(0).toUpperCase() : 'S'}</span>
              <span className="admin-user-mail">{session.user.email}</span>
            </div>
            <button className="admin-signout" onClick={signOut}>
              <LogOut size={15} /> Sign out
            </button>
          </div>

          <div className="admin-content" ref={contentRef}>
            {loading && !rows ? (
              <div className="admin-loading"><Loader2 size={26} className="spin" /><p>Loading applications...</p></div>
            ) : (
              <Routes>
                <Route index element={<Dashboard rows={rows || []} onOpen={onOpen} />} />
                <Route path="applications" element={<Applications rows={rows || []} onOpen={onOpen} />} />
                <Route path="applications/:id" element={<DetailRoute rows={rows || []} refresh={refresh} />} />
              </Routes>
            )}
          </div>
        </main>

        <nav className="admin-bottombar">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={bottomClass}>
              {n.icon}
              <span>{n.label}</span>
            </NavLink>
          ))}
          <button className="bottom-item" onClick={signOut}>
            <LogOut size={19} />
            <span>Sign out</span>
          </button>
        </nav>
      </div>
    </ToastProvider>
  )
}
