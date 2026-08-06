import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SmtpClient } from 'https://deno.land/x/smtp@v0.7.0/mod.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const GMAIL_USER = Deno.env.get('GMAIL_USER') ?? 'being.sevak@gmail.com'
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
      const client = new SmtpClient()
      try {
        await client.connectTLS({
          hostname: 'smtp.gmail.com',
          port: 465,
          username: GMAIL_USER,
          password: GMAIL_APP_PASSWORD,
        })
        await client.send({
          from: GMAIL_USER,
          to: app.email,
          subject,
          content: subject,
          html,
        })
        sent = true
      } catch (e) {
        errMsg = `SMTP error: ${String(e)}`
      } finally {
        try {
          await client.close()
        } catch {
          // ignore close errors
        }
      }
    } else {
      errMsg = 'GMAIL_APP_PASSWORD not configured - email not sent'
    }

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
      error: errMsg,
      logError: logErr?.message ?? null,
      membershipId: type === 'membership' ? app.membership_id : null,
      to: app.email,
    })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
