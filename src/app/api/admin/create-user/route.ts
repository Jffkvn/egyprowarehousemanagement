import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, full_name, role, phone } = body;

    if (!email || !password || !full_name || !role) {
      return NextResponse.json({ error: 'Missing required fields: email, password, full_name, role' }, { status: 400 });
    }

    // Fallback if serviceRoleKey is not configured (Mock/Local mode)
    if (!serviceRoleKey) {
      const msg = `[MOCK CREATE USER] Created user: email=${email}, full_name=${full_name}, role=${role}`;
      console.log(msg);
      return NextResponse.json({ 
        success: true, 
        user: {
          id: 'user_' + Math.random().toString(36).substr(2, 9),
          email,
          full_name,
          role,
          phone,
          is_active: true
        }
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // 1. Create the auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role }
    });

    if (authError) throw authError;

    // 2. Fetch the company ID to associate with
    const { data: companyData, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('id')
      .limit(1)
      .single();

    if (companyError) throw companyError;

    // 3. Create the user profile in our custom table
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('users')
      .insert([{
        id: authData.user.id,
        company_id: companyData.id,
        full_name,
        email,
        role,
        phone: phone || null,
        is_active: true
      }])
      .select()
      .single();

    if (profileError) {
      // Clean up the auth user if profile creation failed to prevent orphaned auth accounts
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw profileError;
    }

    return NextResponse.json({ success: true, user: profileData });
  } catch (error: any) {
    console.error('Error creating user admin service:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}
