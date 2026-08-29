-- Add a column to store the error message
alter table public.entries 
  add column if not exists last_error text;
