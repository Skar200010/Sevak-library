import { useEffect, useState } from 'react'
import { LibraryBig, Lock, Mail, Eye, EyeOff, Loader2, ShieldCheck, KeyRound, ArrowLeft } from 'lucide-react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../supabaseClient.js'
import '../admin-dashboard.css'

export default function LoginView() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    let on = true
    supabase.auth.getSession().then(({ data }) => {
      if (!on) return
      if (data.session) navigate('/admin', { replace: true })
      else setChecking(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!on) return
      if (s) navigate('/admin', { replace: true })
      else setChecking(false)
    })
    return () => {
      on = false
      sub.subscription.unsubscribe()
    }
  }, [navigate])

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!email.trim() || !password) {
      setError('Enter your email and password.')
      return
    }
    setLoading(true)
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    })
    if (err) setError(err.message)
    setLoading(false)
  }

  if (checking) {
    return (
      <div className="admin-login-page">
        <div className="admin-login-checking">
          <Loader2 size={24} className="spin" />
          <p>Checking session...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-login-page">
      <div className="admin-login-bg" aria-hidden="true" />

      <div className="admin-login-card">
        <div className="admin-login-logo">
          <img src="/sevak-logo.png" alt="Sevak Library logo" />
        </div>
        <h1>Sevak Library</h1>
        <p className="admin-login-sub">Staff administration portal</p>

        <span className="admin-login-tag">
          <KeyRound size={12} /> Staff only
        </span>

        <form onSubmit={submit}>
          <div className="admin-field">
            <label htmlFor="admin-email">Email</label>
            <div className="admin-input-wrap">
              <Mail size={16} className="admin-input-icon" />
              <input
                id="admin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@sevaklibrary.org"
                autoComplete="username"
                autoFocus
              />
            </div>
          </div>

          <div className="admin-field">
            <label htmlFor="admin-password">Password</label>
            <div className="admin-input-wrap">
              <Lock size={16} className="admin-input-icon" />
              <input
                id="admin-password"
                type={show ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="admin-eye"
                onClick={() => setShow((s) => !s)}
                aria-label="Toggle password visibility"
              >
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && <p className="admin-login-error">{error}</p>}

          <button className="admin-login-btn" type="submit" disabled={loading}>
            {loading ? <Loader2 size={16} className="spin" /> : <ShieldCheck size={16} />}
            {loading ? 'Signing in...' : 'Sign in to dashboard'}
          </button>
        </form>

        <Link className="admin-login-back" to="/">
          <ArrowLeft size={14} /> Back to application form
        </Link>
      </div>
    </div>
  )
}
