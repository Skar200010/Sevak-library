import { useEffect, useState } from 'react'
import {
  X, ShieldCheck, BadgeCheck, Mail, MessageCircle, Ban, Trash2, ExternalLink, Loader2, CheckCircle2, XCircle, Hourglass
} from 'lucide-react'
import { getFileUrl, rejectApplication, deleteApplication, resendMembershipEmail, sendPaymentReminder } from '../api.js'
import { supabase } from '../supabaseClient.js'
import { statusLabel } from './meta.js'
import { formatINR, formatDate } from '../formUtils.js'
import { useToast } from './toast.jsx'

const steps = ['SUBMITTED', 'PAYMENT_SUBMITTED', 'VERIFIED', 'APPROVED']
const stepIcon = {
  SUBMITTED: <Hourglass size={14} />,
  PAYMENT_SUBMITTED: <ShieldCheck size={14} />,
  VERIFIED: <BadgeCheck size={14} />,
  APPROVED: <CheckCircle2 size={14} />
}

export default function ApplicationDetail({ row, onClose, refresh }) {
  const toast = useToast()
  const [files, setFiles] = useState({ passport: null, identity: null })
  const [busy, setBusy] = useState('')
  const [confirm, setConfirm] = useState(null)
  const [reason, setReason] = useState('')

  const d = row.data || {}

  useEffect(() => {
    let on = true
    getFileUrl(row.passport_photo).then((u) => on && setFiles((f) => ({ ...f, passport: u })))
    getFileUrl(row.identity_photo).then((u) => on && setFiles((f) => ({ ...f, identity: u })))
    return () => (on = false)
  }, [row])

  const verify = async () => {
    setBusy('verify')
    const { error } = await supabase.rpc('mark_payment_verified', { p_id: row.id })
    if (error) toast(error.message, 'error')
    else {
      toast('Payment verified.')
      refresh()
      onClose()
    }
    setBusy('')
  }

  const approve = async () => {
    setBusy('approve')
    const { data, error } = await supabase.rpc('approve_application', { p_id: row.id })
    if (error) {
      toast(error.message, 'error')
      setBusy('')
      return
    }
    try {
      await resendMembershipEmail(row.id)
      toast(`Membership ${data.membership_id} issued. Email sent.`)
    } catch (e) {
      toast(`Membership ${data.membership_id} issued, but email failed: ${e.message}`, 'error')
    }
    refresh()
    onClose()
    setBusy('')
  }

  const sendReminder = async () => {
    setBusy('reminder')
    try {
      await sendPaymentReminder(row.id)
      toast('Payment reminder email sent.')
    } catch (e) {
      toast(e.message, 'error')
    }
    setBusy('')
  }

  const resend = async () => {
    setBusy('resend')
    try {
      await resendMembershipEmail(row.id)
      toast('Membership email re-sent.')
    } catch (e) {
      toast(e.message, 'error')
    }
    setBusy('')
  }

  const m = row.mobile ? row.mobile.replace(/\D/g, '') : ''
  const waNumber = m.length === 10 ? `91${m}` : m
  const messageText = [
    `Hello ${row.full_name},`,
    '',
    `Your Sevak Library membership has been approved.`,
    `Membership ID: ${row.membership_id || '—'}`,
    `Plan: ${row.membership_type} · ${formatINR(row.membership_fee)}`,
    row.start_date && row.end_date
      ? `Period: ${formatDate(row.start_date)} → ${formatDate(row.end_date)}`
      : '',
    '',
    'Thank you for becoming a part of our library.',
    'Sevak Library | Being Sevak Charitable Trust'
  ]
    .filter(Boolean)
    .join('\n')
  const encoded = encodeURIComponent(messageText)
  const waUrl = waNumber ? `https://wa.me/${waNumber}?text=${encoded}` : ''
  const mailUrl = `mailto:${row.email}?subject=${encodeURIComponent(
    `Sevak Library Membership - ${row.membership_id || row.ref}`
  )}&body=${encoded}`

  const doReject = async () => {
    if (!reason.trim()) {
      toast('Please enter a reason for rejection.', 'error')
      return
    }
    setBusy('reject')
    const { error } = await supabase.rpc('reject_application', { p_id: row.id, p_reason: reason })
    if (error) toast(error.message, 'error')
    else {
      toast('Application rejected.')
      refresh()
      onClose()
    }
    setBusy('')
  }

  const doDelete = async () => {
    setBusy('delete')
    try {
      await deleteApplication(row)
      toast('Application deleted.')
      refresh()
      onClose()
    } catch (e) {
      toast(e.message, 'error')
    }
    setBusy('')
  }

  const rows = [
    ['Full name', row.full_name],
    ['Email', row.email],
    ['Mobile', row.mobile],
    ['Guardian', d.guardianName],
    ['Date of birth', d.dateOfBirth && formatDate(d.dateOfBirth)],
    ['Gender', d.gender],
    ['Category', d.category],
    ['Occupation', d.occupation],
    ['Qualification', d.educationalQualification],
    ['Address', d.currentAddress && [d.currentAddress, d.city, d.state, d.pinCode].filter(Boolean).join(', ')],
    ['Plan', row.membership_type],
    ['Fee', formatINR(row.membership_fee)],
    ['Start → End', row.start_date && row.end_date ? `${formatDate(row.start_date)} → ${formatDate(row.end_date)}` : '—'],
    ['Identity proof', row.identity_proof_type ? `${row.identity_proof_type}${row.identity_number ? ` · ${row.identity_number}` : ''}` : '—'],
    ['Payment ref', row.payment_ref],
    ['Transaction / UTR', row.transaction_id || '—'],
    ['Membership ID', row.membership_id || '—'],
    ['Signature', d.applicantSignature]
  ].filter(([, v]) => v)

  const stepIdx = steps.indexOf(row.status)
  const showTimeline = row.status !== 'REJECTED'

  return (
    <div className="drawer-overlay" onClick={() => !busy && onClose()}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <h3>{row.full_name}</h3>
            <span className="mono">{row.ref}</span>
            <span className={`admin-badge ${row.status}`}>{statusLabel(row.status)}</span>
          </div>
          <button className="drawer-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="drawer-body">
          {showTimeline && (
            <div className="timeline">
              {steps.map((s, i) => (
                <div key={s} className={`tl-step ${i <= stepIdx ? 'done' : ''} ${i === stepIdx ? 'current' : ''}`}>
                  <span className="tl-dot">{stepIcon[s]}</span>
                  <span className="tl-label">{statusLabel(s)}</span>
                </div>
              ))}
            </div>
          )}
          {row.status === 'REJECTED' && row.reject_reason && (
            <div className="reject-box">
              <strong>Rejection reason:</strong> {row.reject_reason}
            </div>
          )}

          <div className="detail-grid">
            {rows.map(([k, v]) => (
              <div key={k} className="detail-item">
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </div>

          <h4 className="doc-head">Documents</h4>
          <div className="doc-grid">
            <div className="doc-card">
              <span className="doc-label">Passport photo</span>
              {files.passport ? (
                <a href={files.passport} target="_blank" rel="noreferrer">
                  <img src={files.passport} alt="Passport" />
                  <span className="doc-open"><ExternalLink size={13} /> Open</span>
                </a>
              ) : (
                <p className="admin-empty">No file</p>
              )}
            </div>
            <div className="doc-card">
              <span className="doc-label">Identity proof</span>
              {files.identity ? (
                <a href={files.identity} target="_blank" rel="noreferrer">
                  <img src={files.identity} alt="Identity proof" />
                  <span className="doc-open"><ExternalLink size={13} /> Open</span>
                </a>
              ) : (
                <p className="admin-empty">No file</p>
              )}
            </div>
          </div>
        </div>

        <div className="drawer-actions">
          {row.status === 'PAYMENT_SUBMITTED' && (
            <button className="btn-act verify" onClick={verify} disabled={!!busy}>
              {busy === 'verify' ? <Loader2 size={15} className="spin" /> : <ShieldCheck size={15} />} Verify txn
            </button>
          )}
          {(row.status === 'VERIFIED' || row.status === 'PAYMENT_SUBMITTED') && (
            <button className="btn-act approve" onClick={approve} disabled={!!busy}>
              {busy === 'approve' ? <Loader2 size={15} className="spin" /> : <BadgeCheck size={15} />} Approve & send email
            </button>
          )}
          {row.status === 'APPROVED' && (
            <>
              <a className="btn-act whatsapp" href={waUrl} target="_blank" rel="noreferrer">
                <MessageCircle size={15} /> WhatsApp
              </a>
              <a className="btn-act email" href={mailUrl}>
                <Mail size={15} /> Email
              </a>
              <button className="btn-act resend" onClick={resend} disabled={!!busy}>
                {busy === 'resend' ? <Loader2 size={15} className="spin" /> : <Mail size={15} />} Resend email
              </button>
            </>
          )}
          {row.status === 'SUBMITTED' && (
            <button className="btn-act remind" onClick={sendReminder} disabled={!!busy}>
              {busy === 'reminder' ? <Loader2 size={15} className="spin" /> : <Mail size={15} />} Send payment reminder
            </button>
          )}
          {(row.status === 'SUBMITTED' || row.status === 'PAYMENT_SUBMITTED') && (
            <button className="btn-act reject" onClick={() => setConfirm('reject')} disabled={!!busy}>
              <Ban size={15} /> Reject
            </button>
          )}
          <button className="btn-act danger" onClick={() => setConfirm('delete')} disabled={!!busy}>
            <Trash2 size={15} /> Delete
          </button>
        </div>

        {confirm && (
          <div className="confirm-bar">
            {confirm === 'reject' ? (
              <>
                <label className="confirm-label">Rejection reason</label>
                <textarea
                  className="confirm-input"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Why is this application being rejected?"
                />
                <div className="confirm-btns">
                  <button className="btn-act" onClick={() => setConfirm(null)}>Cancel</button>
                  <button className="btn-act danger" onClick={doReject} disabled={busy === 'reject'}>
                    {busy === 'reject' ? <Loader2 size={15} className="spin" /> : <XCircle size={15} />} Reject
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="confirm-label">Delete this application? This removes its uploaded files and cannot be undone.</p>
                <div className="confirm-btns">
                  <button className="btn-act" onClick={() => setConfirm(null)}>Cancel</button>
                  <button className="btn-act danger" onClick={doDelete} disabled={busy === 'delete'}>
                    {busy === 'delete' ? <Loader2 size={15} className="spin" /> : <Trash2 size={15} />} Delete permanently
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
