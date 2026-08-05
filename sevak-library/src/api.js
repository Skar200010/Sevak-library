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
