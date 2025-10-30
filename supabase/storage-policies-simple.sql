-- Policy semplificate per il bucket company-logos
-- Copia e incolla questo nel SQL Editor di Supabase

-- 1. Permetti agli utenti autenticati di caricare i loro loghi
CREATE POLICY "Authenticated users can upload logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'company-logos');

-- 2. Permetti a tutti di leggere i loghi (necessario per i PDF)
CREATE POLICY "Anyone can view logos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'company-logos');

-- 3. Permetti agli utenti autenticati di aggiornare i loghi
CREATE POLICY "Authenticated users can update logos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'company-logos');

-- 4. Permetti agli utenti autenticati di eliminare i loghi
CREATE POLICY "Authenticated users can delete logos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'company-logos');

