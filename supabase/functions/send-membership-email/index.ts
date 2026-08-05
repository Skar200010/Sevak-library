import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const RESEND_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const FROM_EMAIL = Deno.env.get('MAIL_FROM') ?? 'Sevak Library <no-reply@sevaklibrary.org>'

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

function buildEmail(app: any) {
  const subject = 'Your Sevak Library Membership ID'
  const fee = app.membership_fee ? `Rs. ${app.membership_fee}` : '—'
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:auto;border:1px solid #dadce0;border-top:4px solid #1a7f4b;border-radius:8px;overflow:hidden">
      <div style="background:#e8f5ee;padding:24px;text-align:center">
        <h1 style="color:#126138;margin:0;font-size:22px">Sevak Library</h1>
        <p style="color:#126138;margin:4px 0 0">Initiative by Being Sevak Charitable Trust</p>
      </div>
      <div style="padding:24px">
        <p>Dear <strong>${app.full_name ?? ''}</strong>,</p>
        <p>Congratulations! Your library membership has been approved. Here are your membership details:</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0">
          <tr><td style="padding:8px;border:1px solid #dadce0">Membership ID</td><td style="padding:8px;border:1px solid #dadce0"><strong>${app.membership_id ?? ''}</strong></td></tr>
          <tr><td style="padding:8px;border:1px solid #dadce0">Membership Type</td><td style="padding:8px;border:1px solid #dadce0">${app.membership_type ?? ''}</td></tr>
          <tr><td style="padding:8px;border:1px solid #dadce0">Fee Paid</td><td style="padding:8px;border:1px solid #dadce0">${fee}</td></tr>
          <tr><td style="padding:8px;border:1px solid #dadce0">Start Date</td><td style="padding:8px;border:1px solid #dadce0">${app.start_date ?? ''}</td></tr>
          <tr><td style="padding:8px;border:1px solid #dadce0">End Date</td><td style="padding:8px;border:1px solid #dadce0">${app.end_date ?? ''}</td></tr>
        </table>
        <p>Please carry a copy of this email or your Membership ID when you visit the library.</p>
        <p>Thank you for supporting the Vidhya Project. <strong>Turning Pages, Changing Lives.</strong></p>
      </div>
      <div style="background:#f0f4f1;padding:16px;text-align:center;color:#5f6368;font-size:12px">
        Sevak Library | Being Sevak Charitable Trust
      </div>
    </div>
  `
  return { subject, html }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return json({})

  try {
    const body = await req.json()
    const applicationId = body.applicationId
    if (!applicationId) return json({ error: 'applicationId is required' }, 400)

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

    const { data: app, error } = await supabase
      .from('applications')
      .select('*')
      .eq('id', applicationId)
      .single()

    if (error || !app) return json({ error: error?.message ?? 'Application not found' }, 404)
    if (!app.membership_id) return json({ error: 'Membership ID has not been issued yet' }, 400)

    const { subject, html } = buildEmail(app)

    let sent = false
    let errMsg: string | null = null

    if (RESEND_KEY) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: app.email,
          subject,
          html,
        }),
      })
      if (!res.ok) {
        errMsg = `Resend error ${res.status}: ${await res.text()}`
      } else {
        sent = true
      }
    } else {
      errMsg = 'RESEND_API_KEY not configured - email not sent'
    }

    const { error: logErr } = await supabase.from('mail_log').insert({
      application_id: app.id,
      to_email: app.email,
      subject,
      body: html,
      membership_id: app.membership_id,
      sent,
      error: errMsg,
    })

    return json({
      ok: true,
      sent,
      error: errMsg,
      logError: logErr?.message ?? null,
      membershipId: app.membership_id,
      to: app.email,
    })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
