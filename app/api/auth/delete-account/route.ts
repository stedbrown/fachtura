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

    // Prima di eliminare l'account, il trigger archive_account_on_delete
    // salverà automaticamente un snapshot in deleted_accounts

    // Elimina l'account Supabase (e tutto il cascade)
    const { error: deleteError } = await supabase.rpc('delete_user');

    if (deleteError) {
      console.error('Error deleting account:', deleteError);
      
      // Fallback: usa Admin API se la funzione RPC non esiste
      // Nota: questo richiede che la funzione delete_user sia creata in Supabase
      // o che si usi l'Admin API
      return NextResponse.json(
        { error: 'Impossibile eliminare l\'account. Contatta il supporto.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      message: 'Account eliminato con successo' 
    });

  } catch (error) {
    console.error('Error in delete-account route:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

