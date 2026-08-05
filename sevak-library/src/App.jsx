import { useState } from 'react'
import { FORM_META, SECTIONS, MEMBERSHIP_PRICES } from './formConfig.js'
import { validateField, getIdentityMaxLength, validateIdentityDocument } from './validate.js'
import { buildInitialValues, computeEndDate } from './formUtils.js'
import { submitApplication } from './api.js'
import CheckoutPage from './CheckoutPage.jsx'
import DonePage from './DonePage.jsx'
import AdminPanel from './AdminPanel.jsx'

function Field({ field, value, onChange, error }) {
  const handleText = (e) => onChange(field.id, e.target.value)

  if (field.type === 'textarea') {
    return (
      <div className={`field ${error ? 'has-error' : ''}`}>
        <label className="field-label" htmlFor={field.id}>
          {field.label}
          {field.required && <span className="req">*</span>}
        </label>
        {field.helpText && <p className="help-text">{field.helpText}</p>}
        <textarea
          id={field.id}
          rows={3}
          value={value || ''}
          onChange={handleText}
          placeholder={field.placeholder}
        />
        {error && <p className="error-text">{error}</p>}
      </div>
    )
  }

  if (field.type === 'select') {
    return (
      <div className={`field ${error ? 'has-error' : ''}`}>
        <label className="field-label" htmlFor={field.id}>
          {field.label}
          {field.required && <span className="req">*</span>}
        </label>
        {field.helpText && <p className="help-text">{field.helpText}</p>}
        <select id={field.id} value={value || ''} onChange={handleText}>
          <option value="" disabled>
            {field.placeholder || 'Select...'}
          </option>
          {field.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        {error && <p className="error-text">{error}</p>}
      </div>
    )
  }

  if (field.type === 'radio') {
    return (
      <div className={`field ${error ? 'has-error' : ''}`}>
        <span className="field-label">
          {field.label}
          {field.required && <span className="req">*</span>}
        </span>
        {field.helpText && <p className="help-text">{field.helpText}</p>}
        <div className="options">
          {field.options.map((opt) => (
            <label key={opt} className="option">
              <input
                type="radio"
                name={field.id}
                checked={value === opt}
                onChange={() => onChange(field.id, opt)}
              />
              <span>{opt}</span>
            </label>
          ))}
        </div>
        {error && <p className="error-text">{error}</p>}
      </div>
    )
  }

  if (field.type === 'checkboxes') {
    const arr = Array.isArray(value) ? value : []
    const toggle = (opt) => {
      const next = arr.includes(opt) ? arr.filter((x) => x !== opt) : [...arr, opt]
      onChange(field.id, next)
    }
    return (
      <div className={`field ${error ? 'has-error' : ''}`}>
        <span className="field-label">
          {field.label}
          {field.required && <span className="req">*</span>}
        </span>
        {field.helpText && <p className="help-text">{field.helpText}</p>}
        <div className="options">
          {field.options.map((opt) => (
            <label key={opt} className="option">
              <input
                type="checkbox"
                checked={arr.includes(opt)}
                onChange={() => toggle(opt)}
              />
              <span>{opt}</span>
            </label>
          ))}
        </div>
        {error && <p className="error-text">{error}</p>}
      </div>
    )
  }

  if (field.type === 'checkbox') {
    return (
      <div className={`field checkbox-single ${error ? 'has-error' : ''}`}>
        <label className="option">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(field.id, e.target.checked)}
          />
          <span>{field.options[0]}</span>
        </label>
        {field.helpText && <p className="help-text">{field.helpText}</p>}
        {error && <p className="error-text">{error}</p>}
      </div>
    )
  }

  if (field.type === 'file') {
    return (
      <div className={`field ${error ? 'has-error' : ''}`}>
        <label className="field-label" htmlFor={field.id}>
          {field.label}
          {field.required && <span className="req">*</span>}
        </label>
        {field.helpText && <p className="help-text">{field.helpText}</p>}
        <label className="file-input">
          <input
            id={field.id}
            type="file"
            accept={field.accept ? field.accept.join(',') : undefined}
            onChange={(e) => onChange(field.id, e.target.files[0] || '')}
          />
          <span>{value instanceof File ? value.name : 'Choose file'}</span>
        </label>
        {error && <p className="error-text">{error}</p>}
      </div>
    )
  }

  return (
    <div className={`field ${error ? 'has-error' : ''}`}>
      <label className="field-label" htmlFor={field.id}>
        {field.label}
        {field.required && <span className="req">*</span>}
      </label>
      {field.helpText && <p className="help-text">{field.helpText}</p>}
      <input
        id={field.id}
        type={field.type === 'date' ? 'date' : field.type === 'email' ? 'email' : field.type === 'tel' ? 'tel' : 'text'}
        inputMode={field.inputMode || undefined}
        value={value || ''}
        onChange={handleText}
        disabled={field.readOnly}
        className={field.readOnly ? 'readonly' : undefined}
        placeholder={field.placeholder}
        maxLength={field.maxLength || (field.type === 'tel' ? 10 : undefined)}
      />
      {error && <p className="error-text">{error}</p>}
    </div>
  )
}

function AboutLibrary({ section }) {
  return (
    <div className="about-card">
      {section.content.map((block, i) =>
        block.heading ? (
          <h2 key={i} className="about-heading">
            {block.heading}
          </h2>
        ) : (
          <p key={i} className="about-body">
            {block.body}
          </p>
        )
      )}
    </div>
  )
}

function SectionBody({ section, values, onChange, errors }) {
  if (section.type === 'info') return <AboutLibrary section={section} />
  return section.fields.map((f) => {
    const field =
      f.custom === 'identityNumber'
        ? { ...f, maxLength: getIdentityMaxLength(values.identityProofType) }
        : f
    return (
      <Field
        key={field.id}
        field={field}
        value={values[field.id]}
        onChange={onChange}
        error={errors[field.id]}
      />
    )
  })
}

async function validateSection(section, values) {
  const errs = {}
  for (const f of section.fields || []) {
    if (f.custom === 'identityDocument') {
      errs[f.id] = await validateIdentityDocument(values[f.id])
    } else {
      errs[f.id] = validateField(f, values[f.id], values)
    }
  }
  return errs
}

export default function App() {
  const [values, setValues] = useState(buildInitialValues)
  const [errors, setErrors] = useState({})
  const [current, setCurrent] = useState(0)
  const [stage, setStage] = useState('form')
  const [application, setApplication] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  if (window.location.hash.startsWith('#/admin')) {
    return <AdminPanel />
  }

  const section = SECTIONS[current]
  const total = SECTIONS.length
  const progress = Math.round(((current + 1) / total) * 100)

  const handleChange = (id, value) => {
    const next = { ...values, [id]: value }
    if (id === 'membershipType' && value && MEMBERSHIP_PRICES[value]) {
      next.membershipFee = MEMBERSHIP_PRICES[value]
    }
    if (id === 'membershipType' || id === 'startDate') {
      next.endDate = computeEndDate(next.startDate, next.membershipType)
    }
    setValues(next)

    const field = (section.fields || []).find((f) => f.id === id)
    if (field) {
      if (field.custom === 'identityDocument') {
        validateIdentityDocument(value).then((err) =>
          setErrors((prev) => ({ ...prev, [id]: err }))
        )
      } else {
        const err = validateField(field, value, next)
        setErrors((prev) => ({ ...prev, [id]: err }))
      }
    }
  }

  const goNext = async () => {
    if (current === total - 1) {
      setSubmitting(true)
      setSubmitError('')
      const ready = {
        ...values,
        endDate: values.endDate || computeEndDate(values.startDate, values.membershipType)
      }
      const errs = await validateSection(section, ready)
      setErrors(errs)
      if (Object.values(errs).some(Boolean)) {
        setSubmitting(false)
        return
      }
      try {
        const row = await submitApplication(ready)
        setApplication(row)
        setStage('checkout')
      } catch (e) {
        setSubmitError(e.message)
      } finally {
        setSubmitting(false)
      }
      return
    }

    const errs = await validateSection(section, values)
    setErrors(errs)
    if (Object.values(errs).some(Boolean)) return
    setCurrent(current + 1)
    setErrors({})
  }

  const goBack = () => {
    if (current > 0) {
      setCurrent(current - 1)
      setErrors({})
    }
  }

  const reset = () => {
    setValues(buildInitialValues())
    setErrors({})
    setCurrent(0)
    setStage('form')
    setApplication(null)
  }

  if (stage === 'checkout') {
    return (
      <CheckoutPage
        application={application}
        onDone={(updated) => {
          setApplication(updated)
          setStage('done')
        }}
        onCancel={() => setStage('done')}
      />
    )
  }

  if (stage === 'done') {
    return <DonePage application={application} onReset={reset} />
  }

  return (
    <div className="page">
      <header className="form-header">
        <h1>{FORM_META.title}</h1>
        <h2>{FORM_META.subtitle}</h2>
        <p className="initiative">{FORM_META.initiative}</p>
        <p className="description">{FORM_META.description}</p>
      </header>

      <div className="progress-wrap">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="progress-label">
          {current + 1} of {total} sections
        </span>
      </div>

      <div className="card">
        <h3 className="section-title">{section.title}</h3>
        <SectionBody section={section} values={values} onChange={handleChange} errors={errors} />

        {submitError && <p className="error-text submit-error">{submitError}</p>}

        <div className="nav-buttons">
          {current > 0 && (
            <button className="btn-secondary" onClick={goBack}>
              Back
            </button>
          )}
          <button className="btn-primary" onClick={goNext} disabled={submitting}>
            {submitting ? 'Submitting...' : current === total - 1 ? 'Pay Now' : 'Next'}
          </button>
        </div>
      </div>

      <footer className="form-footer">
        <p>
          Sevak Library | Being Sevak Charitable Trust |{' '}
          <a href="#/admin" className="admin-link">
            Staff Login
          </a>
        </p>
      </footer>
    </div>
  )
}
