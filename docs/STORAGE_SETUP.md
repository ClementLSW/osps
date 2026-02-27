# Supabase Storage Setup

This documents the Supabase Storage configuration that lives in the dashboard
and isn't captured by the SQL migrations. If the Supabase project is recreated,
apply these settings manually.

---

## `receipts` Bucket

| Setting | Value |
|---------|-------|
| Name | `receipts` |
| Public | **No** (private — requires signed URLs or valid JWT) |
| File size limit | 10 MB |
| Allowed MIME types | `image/jpeg`, `image/png`, `image/webp`, `image/heic` |

### File Path Convention

```
receipts/{groupId}/{expenseId}.jpg
```

All uploads are JPEG — the client compresses and converts to JPEG before uploading
(see `compressImage()` in `AddExpense.jsx`). Canvas redraw strips EXIF metadata (GPS, etc).

### How It's Used

| Operation | File | Method |
|-----------|------|--------|
| Upload | `AddExpense.jsx` | `getSupabase().storage.from('receipts').upload(path, blob, { upsert: true })` |
| View | `GroupDetail.jsx` | `getSupabase().storage.from('receipts').createSignedUrl(path, 3600)` |
| Delete | `GroupDetail.jsx` | `getSupabase().storage.from('receipts').remove([path])` |

Signed URLs expire after 1 hour (3600 seconds).

### RLS Policies

Run in Supabase SQL Editor → Storage section, or via the dashboard under
Storage → Policies for the `receipts` bucket:

```sql
-- Allow group members to upload receipts for their groups
create policy "Group members can upload receipts"
  on storage.objects for insert
  with check (
    bucket_id = 'receipts'
    and auth.uid() is not null
    and public.is_group_member((storage.foldername(name))[1]::uuid)
  );

-- Allow group members to view receipts in their groups
create policy "Group members can view receipts"
  on storage.objects for select
  using (
    bucket_id = 'receipts'
    and public.is_group_member((storage.foldername(name))[1]::uuid)
  );

-- Allow group members to overwrite receipts (upsert on edit)
create policy "Group members can update receipts"
  on storage.objects for update
  using (
    bucket_id = 'receipts'
    and public.is_group_member((storage.foldername(name))[1]::uuid)
  );

-- Allow expense creator or group admin to delete receipts
create policy "Creator or admin can delete receipts"
  on storage.objects for delete
  using (
    bucket_id = 'receipts'
    and public.is_group_member((storage.foldername(name))[1]::uuid)
  );
```

> **Note:** `storage.foldername(name)` returns an array of path segments.
> Element `[1]` is the `{groupId}` — the first folder in the path.
> The `is_group_member()` function is defined in `schema.sql`.

### Dashboard Setup Steps

1. Go to **Storage** in the Supabase dashboard
2. Click **New Bucket**
3. Name: `receipts`
4. Toggle **Public** off
5. Set file size limit: `10 MB`
6. Set allowed MIME types: `image/jpeg, image/png, image/webp, image/heic`
7. Go to **Policies** tab for the bucket and add the SQL policies above
