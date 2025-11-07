import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email richiesta' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Chiama la funzione SQL per verificare se l'email è bloccata
    const { data, error } = await supabase.rpc('check_email_abuse_protection', {
      p_email: email.toLowerCase().trim()
    });

    if (error) {
      console.error('Error checking email:', error);
      return NextResponse.json(
        { error: 'Errore durante la verifica dell\'email' },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in check-email route:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

