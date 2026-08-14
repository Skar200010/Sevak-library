import { supabase } from './supabaseClient.js'

const BUCKET = 'SevakMedia'

export function generateRef() {
  const d = new Date()
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `SL-${ymd}-${rand}`
}

async function uploadFile(ref, key, file) {
  if (!(file instanceof File)) return null
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${ref}/${key}_${Date.now()}_${safe}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file)
  if (error) throw new Error(`Upload failed (${key}): ${error.message}`)
  return path
}

export async function submitApplication(values) {
  const ref = generateRef()

  const passportPath = await uploadFile(ref, 'passport', values.passportPhoto)
  const identityPath = await uploadFile(ref, 'identity', values.identityProofPhoto)

  const data = { ...values }
  delete data.passportPhoto
  delete data.identityProofPhoto

  const { data: row, error } = await supabase.rpc('submit_application', {
    p_data: data,
    p_passport_photo: passportPath,
    p_identity_photo: identityPath
  })

  if (error) throw new Error(`Could not submit: ${error.message}`)
  return row
}

export async function recordPayment(ref, transactionId) {
  const { data: row, error } = await supabase.rpc('record_payment', {
    p_ref: ref,
    p_transaction_id: transactionId
  })
  if (error) throw new Error(error.message)
  return row
}

export async function getApplicationByRef(ref) {
  const { data, error } = await supabase.rpc('get_application_by_ref', { p_ref: ref })
  if (error) throw new Error(error.message)
  return data && data[0] ? data[0] : null
}

export async function getFileUrl(path) {
  if (!path) return null
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600)
  return error ? null : data.signedUrl
}

export async function resolvePhotoUrls(rows) {
  const results = await Promise.all(rows.map((r) => getFileUrl(r.passport_photo)))
  return results.map((u) => u ?? null)
}

export async function updateApplication(id, data, transactionId, photos = {}) {
  const { data: row, error } = await supabase.rpc('update_application', {
    p_id: id,
    p_data: data,
    p_transaction_id: transactionId || null,
    p_passport_photo: photos.passport || null,
    p_identity_photo: photos.identity || null
  })
  if (error) throw new Error(error.message)
  return row
}

export async function uploadApplicationPhoto(ref, key, file) {
  return uploadFile(ref, key, file)
}

export async function deleteApplicationPhoto(path) {
  if (!path) return
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) throw new Error(error.message)
}

export async function listCoupons() {
  const { data, error } = await supabase.from('coupons').select('*').order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data || []
}

export async function createCoupon(values) {
  const { data, error } = await supabase.from('coupons').insert(values).select().single()
  if (error) throw new Error(error.message)
  return data
}

export async function updateCoupon(id, values) {
  const { data, error } = await supabase.from('coupons').update(values).eq('id', id).select().single()
  if (error) throw new Error(error.message)
  return data
}

export async function deleteCoupon(id) {
  const { error } = await supabase.from('coupons').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function importMembers(rows) {
  const { data, error } = await supabase.rpc('import_members', { p_rows: rows })
  if (error) throw new Error(error.message)
  return data && data[0] ? data[0] : { imported: 0, skipped: 0 }
}

export async function sendCouponEmail(couponId, applicationIds) {
  const {
    data: { session }
  } = await supabase.auth.getSession()
  const res = await withTimeout(
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-membership-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`
      },
      body: JSON.stringify({ type: 'coupon', couponId, applicationIds })
    }),
    60000
  )
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(j.error || `Request failed (${res.status})`)
  if (j.sent === false) throw new Error(j.error || 'Email could not be sent')
  return j
}

export async function rejectApplication(id, reason) {
  const { data, error } = await supabase.rpc('reject_application', {
    p_id: id,
    p_reason: reason || ''
  })
  if (error) throw new Error(error.message)
  return data
}

export async function deleteApplication(row) {
  const paths = [row.passport_photo, row.identity_photo].filter(Boolean)
  if (paths.length) {
    const { error: rmErr } = await supabase.storage.from(BUCKET).remove(paths)
    if (rmErr) throw new Error(`Could not remove files: ${rmErr.message}`)
  }
  const { error } = await supabase.from('applications').delete().eq('id', row.id)
  if (error) throw new Error(error.message)
}

async function callEmailFunction(applicationId, type) {
  const {
    data: { session }
  } = await supabase.auth.getSession()
  const res = await withTimeout(
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-membership-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`
      },
      body: JSON.stringify({ applicationId, type })
    }),
    25000
  )
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(j.error || `Request failed (${res.status})`)
  if (j.sent === false) throw new Error(j.error || 'Email could not be sent')
  return j
}

async function withTimeout(promise, ms) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Email service timed out. Try again.')), ms)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timer)
  }
}

export async function resendMembershipEmail(applicationId) {
  return callEmailFunction(applicationId, 'membership')
}

export async function sendPaymentReminder(applicationId) {
  const res = await withTimeout(
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-membership-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationId, type: 'payment' })
    }),
    25000
  )
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(j.error || `Request failed (${res.status})`)
  if (j.sent === false) throw new Error(j.error || 'Email could not be sent')
  return j
}

export function exportApplicationsCsv(rows) {
  const headers = [
    'Reference', 'Status', 'Membership ID', 'Full Name', 'Email', 'Mobile',
    'Plan', 'Fee', 'Start Date', 'End Date', 'Identity Proof', 'Identity Number',
    'Transaction ID', 'Created At'
  ]
  const esc = (v) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [headers.join(',')]
  rows.forEach((r) => {
    lines.push(
      [
        r.ref, r.status, r.membership_id, r.full_name, r.email, r.mobile,
        r.membership_type, r.membership_fee, r.start_date, r.end_date,
        r.identity_proof_type, r.identity_number, r.transaction_id, r.created_at
      ].map(esc).join(',')
    )
  })
  return lines.join('\n')
}
