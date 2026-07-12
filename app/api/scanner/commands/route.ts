import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // Bridge calls this to check for pending commands
    const { data, error } = await supabase
      .from('scanner_commands')
      .select('*')
      .eq('status', 'PENDING')
      .order('created_at', { ascending: true })
      .limit(1);

    if (error) throw error;
    return NextResponse.json(data[0] || null);
  } catch (error) {
    console.error('[API] Error fetching commands:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { command_type, user_id } = await req.json();

    if (!command_type || !user_id) {
      return NextResponse.json({ error: 'Command type and User ID are required' }, { status: 400 });
    }

    // Create a new command
    const { data, error } = await supabase
      .from('scanner_commands')
      .insert([{ 
        command_type, 
        user_id: String(user_id), 
        status: 'PENDING' 
      }])
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API] Error creating command:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { id, status, error_message } = await req.json();

    if (!id || !status) {
      return NextResponse.json({ error: 'Command ID and Status are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('scanner_commands')
      .update({ status, error_message, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API] Error updating command:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
