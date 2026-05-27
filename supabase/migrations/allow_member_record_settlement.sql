-- Allow any group member to record a settlement, not just the payer.
-- The payer (paid_by) is still whoever the transaction says — this just
-- removes the restriction that the recorder must be the payer.
drop policy "Members can create settlements" on public.settlements;

create policy "Members can create settlements"
  on public.settlements for insert
  with check (public.is_group_member(group_id));
