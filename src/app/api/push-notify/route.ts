import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { user_id, title, message, link } = body;

    if (!body.user_id || !body.title || !body.message) {
      return NextResponse.json({ error: 'Missing required fields: user_id, title, message' }, { status: 400 });
    }

    // Load active notification channels
    const channels = await db.getNotificationChannels();
    const channel = channels.find((c) => c.user_id === user_id);

    // Retrieve user email
    const profile = await db.getCurrentUser(user_id);
    const email = profile?.email || 'unknown@egypro.com';
    const fullName = profile?.full_name || 'User';

    const preferred = channel?.preferred_channel || 'in_app_only';
    const whatsappNum = channel?.whatsapp_number;
    const isEmailEnabled = channel?.email_enabled ?? true;

    const results: string[] = [];

    // Send WhatsApp (via CallMeBot if key is present)
    if ((preferred === 'whatsapp' || preferred === 'both') && whatsappNum) {
      const apiKey = process.env.CALLMEBOT_API_KEY;
      if (apiKey) {
        try {
          const cleanPhone = whatsappNum.replace(/\+/g, '').trim();
          const whatsappUrl = `https://api.callmebot.com/whatsapp.php?phone=${cleanPhone}&text=${encodeURIComponent(message)}&apikey=${apiKey}`;
          
          const res = await fetch(whatsappUrl, { method: 'GET' });
          if (res.ok) {
            results.push(`WhatsApp successfully pushed to ${whatsappNum}`);
          } else {
            results.push(`WhatsApp CallMeBot responded with status: ${res.status}`);
          }
        } catch (err: any) {
          results.push(`WhatsApp failed: ${err.message}`);
        }
      } else {
        const msg = `[MOCK PUSH] WhatsApp to ${whatsappNum}: "${message}" (CALLMEBOT_API_KEY not configured)`;
        console.log(msg);
        results.push(msg);
      }
    }

    // Send Email
    if (isEmailEnabled || preferred === 'email' || preferred === 'both') {
      const msg = `[MOCK EMAIL] To ${email} (${fullName}): Subject: "${title}" - Body: "${message}. Click here: ${link || '/'}"`;
      console.log(msg);
      results.push(msg);
    }

    return NextResponse.json({ 
      success: true, 
      channel: preferred,
      dispatched: results 
    });
  } catch (error: any) {
    console.error('Error dispatching push notifications:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}
