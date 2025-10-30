# 📦 Configurazione Supabase Storage per Loghi Aziendali

## 1. Crea il Bucket

1. Vai su **Supabase Dashboard** → Il tuo progetto
2. Clicca su **Storage** nella sidebar
3. Clicca su **New bucket**
4. Compila:
   - **Name**: `company-logos`
   - **Public bucket**: ✅ Attiva (per poter accedere ai loghi nei PDF)
5. Clicca **Create bucket**

## 2. Configura le Policies (Permessi)

Vai su **Storage** → `company-logos` → **Policies** e aggiungi queste due policy:

### Policy 1: Upload (INSERT)
```sql
CREATE POLICY "Users can upload their logo"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'company-logos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

### Policy 2: Read (SELECT)
```sql
CREATE POLICY "Public can read logos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'company-logos');
```

### Policy 3: Update (UPDATE)
```sql
CREATE POLICY "Users can update their logo"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'company-logos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'company-logos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

### Policy 4: Delete (DELETE)
```sql
CREATE POLICY "Users can delete their logo"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'company-logos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

## 3. Verifica

Dopo aver creato le policy, dovresti vedere 4 policy attive nel bucket `company-logos`:
- ✅ Users can upload their logo
- ✅ Public can read logos
- ✅ Users can update their logo
- ✅ Users can delete their logo

## Note

- I loghi saranno salvati con il percorso: `{user_id}/logo.{ext}`
- Formati supportati: PNG, JPG, JPEG, SVG
- Dimensione massima: 2MB
- Il bucket è pubblico per permettere la visualizzazione nei PDF

