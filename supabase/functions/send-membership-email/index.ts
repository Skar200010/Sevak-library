import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const GMAIL_USER = Deno.env.get('GMAIL_USER') ?? 'library.sevak@gmail.com'
const GMAIL_APP_PASSWORD = Deno.env.get('GMAIL_APP_PASSWORD') ?? ''
const APP_URL = Deno.env.get('APP_URL') ?? 'https://sevak-library.vercel.app'

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    },
  })

// ---------- Minimal pure-Deno SMTP client (no external deps) ----------
// Connects with implicit TLS on port 465 and uses AUTH PLAIN to send.

async function smtpSend(to: string, subject: string, html: string): Promise<void> {
  const conn = await Deno.connectTls({ hostname: 'smtp.gmail.com', port: 465 })
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  let buffer = ''
  const readLine = async (): Promise<string> => {
    while (!buffer.includes('\n')) {
      const chunk = new Uint8Array(1024)
      const n = await conn.read(chunk)
      if (n === null) throw new Error('SMTP connection closed while reading')
      buffer += decoder.decode(chunk.subarray(0, n))
    }
    const idx = buffer.indexOf('\n')
    const line = buffer.slice(0, idx).trim()
    buffer = buffer.slice(idx + 1)
    return line
  }

  const write = async (line: string) => {
    await conn.write(encoder.encode(line + '\r\n'))
  }

  const expect = async (code: string): Promise<string> => {
    const line = await readLine()
    if (!line.startsWith(code)) throw new Error(`SMTP expected ${code}, got: ${line}`)
    // Drain multiline responses (e.g. EHLO ends with 250- ...)
    if (line.length > 3 && line[3] === '-') {
      while ((await readLine())[3] === '-') { /* keep draining */ }
    }
    return line
  }

  const b64 = (s: string) => bin2base64(encoder.encode(s))

  try {
    await expect('220') // banner
    await write(`EHLO ${GMAIL_USER}`)
    await expect('250')
    // Gmail on implicit TLS (465) accepts AUTH PLAIN directly, no STARTTLS needed.
    await write(`AUTH PLAIN ${b64(`\u0000${GMAIL_USER}\u0000${GMAIL_APP_PASSWORD}`)}`)
    await expect('235')
    await write(`MAIL FROM:<${GMAIL_USER}>`)
    await expect('250')
    await write(`RCPT TO:<${to}>`)
    await expect('250')
    await write('DATA')
    await expect('354')

    const escapedHtml = html.replace(/^\./gm, '..') // dot-stuffing
    const message = `From: Sevak Library <${GMAIL_USER}>\r\n` +
      `To: <${to}>\r\n` +
      `Subject: ${subject}\r\n` +
      `MIME-Version: 1.0\r\n` +
      `Content-Type: text/html; charset=UTF-8\r\n` +
      `Content-Transfer-Encoding: 8bit\r\n` +
      `\r\n` +
      `${escapedHtml}`

    await conn.write(encoder.encode(message.replace(/\r?\n/g, '\r\n') + '\r\n.\r\n'))
    await expect('250')
    await write('QUIT')
  } finally {
    try { conn.close() } catch { /* ignore */ }
  }
}

// Simple base64 encoder without relying on global btoa over binary.
function bin2base64(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i]
    const b2 = i + 1 < bytes.length ? bytes[i + 1] : 0
    const b3 = i + 2 < bytes.length ? bytes[i + 2] : 0
    out += chars[b1 >> 2]
    out += chars[((b1 & 3) << 4) | (b2 >> 4)]
    out += i + 1 < bytes.length ? chars[((b2 & 15) << 2) | (b3 >> 6)] : '='
    out += i + 2 < bytes.length ? chars[b3 & 63] : '='
  }
  return out
}

// ---------- Email builders ----------

const cardRow = (k: string, v: string) =>
  `<tr><td style="padding:8px;border:1px solid #dadce0">${k}</td><td style="padding:8px;border:1px solid #dadce0"><strong>${v}</strong></td></tr>`

const shell = (inner: string) => `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:auto;border:1px solid #dadce0;border-top:4px solid #1a7f4b;border-radius:8px;overflow:hidden">
    <div style="background:#e8f5ee;padding:24px;text-align:center">
      <h1 style="color:#126138;margin:0;font-size:22px">Sevak Library</h1>
      <p style="color:#126138;margin:4px 0 0">Initiative by Being Sevak Charitable Trust</p>
    </div>
    <div style="padding:24px">${inner}</div>
    <div style="background:#f0f4f1;padding:16px;text-align:center;color:#5f6368;font-size:12px">
      Sevak Library | Being Sevak Charitable Trust
    </div>
  </div>
`

const btn = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;background:#1a7f4b;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;margin:8px 0">${label}</a>`

function buildMembershipEmail(app: any) {
  const subject = 'Your Sevak Library Membership ID'
  const fee = app.membership_fee ? `Rs. ${app.membership_fee}` : '—'
  const html = shell(`
    <p>Dear <strong>${app.full_name ?? ''}</strong>,</p>
    <p>Congratulations! Your library membership has been approved. Here are your membership details:</p>
    <table style="border-collapse:collapse;width:100%;margin:16px 0">
      ${cardRow('Membership ID', app.membership_id ?? '')}
      ${cardRow('Membership Type', app.membership_type ?? '')}
      ${cardRow('Fee Paid', fee)}
      ${cardRow('Start Date', app.start_date ?? '')}
      ${cardRow('End Date', app.end_date ?? '')}
    </table>
    <p>Please carry a copy of this email or your Membership ID when you visit the library.</p>
    <p>Thank you for supporting the Vidhya Project. <strong>Turning Pages, Changing Lives.</strong></p>
  `)
  return { subject, html }
}

function buildPaymentEmail(app: any) {
  const subject = 'Complete your Sevak Library membership payment'
  const fee = app.membership_fee ? `Rs. ${app.membership_fee}` : '—'
  const payUrl = `${APP_URL}/#/pay/${encodeURIComponent(app.ref ?? '')}`
  const html = shell(`
    <p>Dear <strong>${app.full_name ?? ''}</strong>,</p>
    <p>Thank you for applying to Sevak Library. Your application has been received, but your payment is still pending.</p>
    <table style="border-collapse:collapse;width:100%;margin:16px 0">
      ${cardRow('Application Reference', app.ref ?? '')}
      ${cardRow('Membership Type', app.membership_type ?? '')}
      ${cardRow('Amount to pay', fee)}
      ${cardRow('Start Date', app.start_date ?? '')}
      ${cardRow('End Date', app.end_date ?? '')}
    </table>
    <p>Click the button below to complete your payment:</p>
    <p style="text-align:center">${btn(payUrl, 'Complete my payment')}</p>
    <p style="color:#5f6368;font-size:12.5px">Or copy this link into your browser: <br><span style="color:#1a7f4b">${payUrl}</span></p>
    <p>If you have already paid, please ignore this email.</p>
  `)
  return { subject, html }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return json({})

  try {
    const body = await req.json()
    const applicationId = body.applicationId
    const type = body.type === 'payment' ? 'payment' : 'membership'
    if (!applicationId) return json({ error: 'applicationId is required' }, 400)

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

    const { data: app, error } = await supabase
      .from('applications')
      .select('*')
      .eq('id', applicationId)
      .single()

    if (error || !app) return json({ error: error?.message ?? 'Application not found' }, 404)

    if (type === 'membership' && !app.membership_id) {
      return json({ error: 'Membership ID has not been issued yet' }, 400)
    }
    if (type === 'payment' && app.status !== 'SUBMITTED') {
      return json({ error: 'Payment has already been submitted for this application' }, 400)
    }

    const { subject, html } = type === 'payment' ? buildPaymentEmail(app) : buildMembershipEmail(app)

    let sent = false
    let errMsg: string | null = null

    if (GMAIL_APP_PASSWORD) {
      try {
        await smtpSend(app.email, subject, html)
        sent = true
      } catch (e) {
        errMsg = `SMTP error: ${String(e)}`
      }
    } else {
      errMsg = 'GMAIL_APP_PASSWORD not configured - email not sent'
    }

    console.log(`[send-membership-email] provider=gmail sent=${sent} to=${app.email} error=${errMsg}`)

    const { error: logErr } = await supabase.from('mail_log').insert({
      application_id: app.id,
      to_email: app.email,
      subject,
      body: html,
      membership_id: type === 'membership' ? app.membership_id : null,
      sent,
      error: errMsg,
    })

    return json({
      ok: true,
      type,
      sent,
      provider: 'gmail',
      error: errMsg,
      logError: logErr?.message ?? null,
      membershipId: type === 'membership' ? app.membership_id : null,
      to: app.email,
    })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})