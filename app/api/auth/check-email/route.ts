import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

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
      logger.error('Error checking email', error, { email });
      return NextResponse.json(
        { error: 'Errore durante la verifica dell\'email' },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    logger.error('Error in check-email route', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

