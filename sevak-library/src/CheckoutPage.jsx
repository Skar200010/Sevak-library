import { useState } from 'react'
import { FORM_META } from './formConfig.js'
import { UPI_APPS, buildUpiUrl } from './upi.js'
import { recordPayment } from './api.js'
import { formatINR, formatDate } from './formUtils.js'

export default function CheckoutPage({ application, onDone, onCancel }) {
  const [selectedApp, setSelectedApp] = useState(null)
  const [txnId, setTxnId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  const fee = application.membership_fee

  const pay = (app) => {
    setSelectedApp(app)
    setMsg('')
    const url = buildUpiUrl(app, {
      vpa: FORM_META.upiId,
      payee: 'Sevak Library',
      amount: fee,
      note: application.payment_ref
    })
    window.open(url, '_blank')
  }

  const submitTxn = async () => {
    const id = txnId.trim()
    if (!id) {
      setError('Please enter the transaction / UTR ID you received after payment.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      const updated = await recordPayment(application.ref, id)
      onDone(updated)
    } catch (e) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page">
      <header className="form-header">
        <h1>Pay for your membership</h1>
        <p className="description">
          Complete the payment below to finish your application. Your application reference is{' '}
          <strong>{application.ref}</strong>
        </p>
      </header>

      <div className="card checkout-card">
        <div className="checkout-summary">
          <div className="summary-row">
            <span>Membership plan</span>
            <strong>{application.membership_type}</strong>
          </div>
          <div className="summary-row">
            <span>Membership period</span>
            <strong>
              {formatDate(application.start_date)} → {formatDate(application.end_date)}
            </strong>
          </div>
          <div className="summary-row">
            <span>Amount to pay</span>
            <strong className="amount">{formatINR(fee)}</strong>
          </div>
        </div>

        <div className="qr-box">
          <div className="qr-canvas">
            <img
              className="qr-img"
              src="/payment-qr.png"
              alt="Sevak Library UPI payment QR code"
            />
          </div>
          <p className="upi-label">Scan &amp; Pay using any UPI app</p>
          <p className="upi-id">
            UPI ID: <strong>{FORM_META.upiId}</strong>
          </p>
          {FORM_META.upiIdAlt && <p className="upi-id-alt">or {FORM_META.upiIdAlt}</p>}
          <p className="qr-hint">
            Scan the QR with any UPI app and enter {formatINR(fee)}, or tap an app below to pay
            with the amount pre-filled.
          </p>
        </div>

        <h3 className="checkout-subtitle">Pay {formatINR(fee)} via</h3>
        <div className="app-grid">
          {UPI_APPS.map((app) => (
            <button key={app.id} className="app-btn" onClick={() => pay(app)}>
              {app.name}
            </button>
          ))}
        </div>
        {selectedApp && (
          <p className="help-text">
            Your {selectedApp.name} app should open with the amount pre-filled. If it didn't open,
            tap the app icon again or scan the QR above.
          </p>
        )}

        <hr className="checkout-divider" />

        <h3 className="checkout-subtitle">Completed the payment?</h3>
        <p className="help-text">
          Enter the transaction ID / UTR number you received after the payment. Our team will
          verify it before approving your membership.
        </p>
        <div className="field">
          <label className="field-label" htmlFor="txnId">
            Transaction / UTR ID
          </label>
          <input
            id="txnId"
            type="text"
            value={txnId}
            onChange={(e) => setTxnId(e.target.value)}
            placeholder="e.g. 4155 7219 3840 1045"
          />
        </div>

        {error && <p className="error-text">{error}</p>}
        {msg && <p className="help-text">{msg}</p>}

        <div className="nav-buttons">
          <button className="btn-secondary" onClick={onCancel}>
            Pay later
          </button>
          <button className="btn-primary" onClick={submitTxn} disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Transaction ID'}
          </button>
        </div>
      </div>

      <footer className="form-footer">
        <p>Sevak Library | Being Sevak Charitable Trust</p>
      </footer>
    </div>
  )
}
