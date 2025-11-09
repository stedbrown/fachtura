import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Verifica autenticazione
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Non autenticato' },
        { status: 401 }
      );
    }

    const { resourceType } = await req.json();

    if (!resourceType || !['invoice', 'quote', 'client', 'product', 'order', 'supplier'].includes(resourceType)) {
      return NextResponse.json(
        { error: 'resourceType non valido (invoice, quote, client, product, order, supplier)' },
        { status: 400 }
      );
    }

    // Chiama la funzione del database per verificare i limiti
    const { data, error } = await supabase.rpc('check_subscription_limits', {
      p_user_id: user.id,
      p_resource_type: resourceType,
    });

    if (error) {
      console.error('Errore verifica limiti:', error);
      return NextResponse.json(
        { error: 'Errore durante la verifica dei limiti' },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Errore verifica limiti:', error);
    return NextResponse.json(
      { error: 'Errore durante la verifica dei limiti' },
      { status: 500 }
    );
  }
}

