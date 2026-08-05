import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient.js'
import { getFileUrl } from './api.js'
import { formatDate, formatINR } from './formUtils.js'

const STATUS_META = {
  SUBMITTED: { label: 'Payment pending', cls: 'status-pending' },
  PAYMENT_SUBMITTED: { label: 'Payment submitted', cls: 'status-pending' },
  VERIFIED: { label: 'Payment verified', cls: 'status-verified' },
  APPROVED: { label: 'Approved', cls: 'status-approved' }
}

const STATUS_ORDER = ['SUBMITTED', 'PAYMENT_SUBMITTED', 'VERIFIED', 'APPROVED']

export default function AdminPanel() {
  const [session, setSession] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [loading, setLoading] = useState(false)

  const [rows, setRows] = useState([])
  const [filter, setFilter] = useState('ALL')
  const [selected, setSelected] = useState(null)
  const [fileUrls, setFileUrls] = useState({})
  const [busyId, setBusyId] = useState(null)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const load = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('applications')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      setRows(data || [])
    } catch (e) {
      setNotice(`Could not load applications: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session) load()
  }, [session])

  const login = async () => {
    setAuthError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setAuthError(error.message)
  }

  const logout = async () => {
    await supabase.auth.signOut()
  }

  const open = async (row) => {
    setSelected(row)
    setNotice('')
    const pp = await getFileUrl(row.passport_photo)
    const ip = await getFileUrl(row.identity_photo)
    setFileUrls({ passport: pp, identity: ip })
  }

  const verify = async (row) => {
    setBusyId(row.id)
    setNotice('')
    const { data, error } = await supabase.rpc('mark_payment_verified', { p_id: row.id })
    if (error) {
      setNotice(`Verify failed: ${error.message}`)
    } else {
      setNotice(`Payment verified for ${data.ref}.`)
      load()
    }
    setBusyId(null)
  }

  const approve = async (row) => {
    setBusyId(row.id)
    setNotice('')
    const { data, error } = await supabase.rpc('approve_application', { p_id: row.id })
    if (error) {
      setNotice(`Approve failed: ${error.message}`)
      setBusyId(null)
      return
    }
    try {
      const {
        data: { session: s }
      } = await supabase.auth.getSession()
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-membership-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${s?.access_token}`
          },
          body: JSON.stringify({ applicationId: row.id })
        }
      )
      const j = await res.json().catch(() => ({}))
      const emailMsg = j.sent ? 'Membership email sent.' : `Email not sent (${j.error || res.status}). Check mail_log.`
      setNotice(`Membership ID ${data.membership_id} issued. ${emailMsg}`)
    } catch (e) {
      setNotice(`Membership ID ${data.membership_id} issued, but email failed: ${e.message}`)
    }
    setBusyId(null)
    load()
  }

  if (!session) {
    return (
      <div className="page">
        <div className="card">
          <h3 className="section-title">Sevak Library — Staff Login</h3>
          <div className="field">
            <label className="field-label" htmlFor="aemail">
              Email
            </label>
            <input
              id="aemail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@sevaklibrary.org"
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="apass">
              Password
            </label>
            <input
              id="apass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          {authError && <p className="error-text">{authError}</p>}
          <div className="nav-buttons">
            <a href="#/" className="btn-secondary admin-link-btn">
              Back to form
            </a>
            <button className="btn-primary" onClick={login}>
              Sign in
            </button>
          </div>
        </div>
      </div>
    )
  }

  const filtered = filter === 'ALL' ? rows : rows.filter((r) => r.status === filter)

  return (
    <div className="page admin-page">
      <header className="form-header">
        <h1>Staff Panel</h1>
        <p className="description">Verify payments and approve memberships.</p>
      </header>

      <div className="admin-topbar">
        <div className="admin-filters">
          {['ALL', ...STATUS_ORDER].map((s) => (
            <button
              key={s}
              className={`filter-chip ${filter === s ? 'active' : ''}`}
              onClick={() => setFilter(s)}
            >
              {s === 'ALL' ? 'All' : STATUS_META[s].label}
            </button>
          ))}
        </div>
        <button className="btn-secondary" onClick={logout}>
          Sign out
        </button>
      </div>

      {notice && <p className="help-text admin-notice">{notice}</p>}

      {loading ? (
        <p className="help-text">Loading applications...</p>
      ) : filtered.length === 0 ? (
        <p className="help-text">No applications in this state.</p>
      ) : (
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Ref</th>
                <th>Name</th>
                <th>Plan</th>
                <th>Fee</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const meta = STATUS_META[r.status] || { label: r.status, cls: '' }
                return (
                  <tr key={r.id}>
                    <td>{r.ref}</td>
                    <td>{r.full_name}</td>
                    <td>{r.membership_type}</td>
                    <td>{formatINR(r.membership_fee)}</td>
                    <td>
                      <span className={`badge ${meta.cls}`}>{meta.label}</span>
                      {r.membership_id && <div className="mid">{r.membership_id}</div>}
                    </td>
                    <td className="row-actions">
                      <button className="btn-secondary small" onClick={() => open(r)}>
                        View
                      </button>
                      {r.status === 'PAYMENT_SUBMITTED' && (
                        <button
                          className="btn-secondary small"
                          disabled={busyId === r.id}
                          onClick={() => verify(r)}
                        >
                          Verify txn
                        </button>
                      )}
                      {(r.status === 'VERIFIED' || r.status === 'PAYMENT_SUBMITTED') && (
                        <button
                          className="btn-primary small"
                          disabled={busyId === r.id}
                          onClick={() => approve(r)}
                        >
                          Approve
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{selected.full_name}</h3>
            <p className="help-text">Ref: {selected.ref}</p>
            <dl className="detail-list">
              <dt>Email</dt>
              <dd>{selected.email}</dd>
              <dt>Mobile</dt>
              <dd>{selected.mobile}</dd>
              <dt>Plan</dt>
              <dd>{selected.membership_type}</dd>
              <dt>Fee</dt>
              <dd>{formatINR(selected.membership_fee)}</dd>
              <dt>Start → End</dt>
              <dd>
                {formatDate(selected.start_date)} → {formatDate(selected.end_date)}
              </dd>
              <dt>Identity proof</dt>
              <dd>
                {selected.identity_proof_type} · {selected.identity_number}
              </dd>
              <dt>Payment ref (UPI note)</dt>
              <dd>{selected.payment_ref}</dd>
              <dt>Transaction / UTR ID</dt>
              <dd>{selected.transaction_id || '—'}</dd>
              <dt>Membership ID</dt>
              <dd>{selected.membership_id || '—'}</dd>
            </dl>
            <div className="modal-files">
              {fileUrls.passport && (
                <a className="file-link" href={fileUrls.passport} target="_blank" rel="noreferrer">
                  Passport photo
                </a>
              )}
              {fileUrls.identity && (
                <a className="file-link" href={fileUrls.identity} target="_blank" rel="noreferrer">
                  Identity proof
                </a>
              )}
            </div>
            <div className="nav-buttons">
              <button className="btn-secondary" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
