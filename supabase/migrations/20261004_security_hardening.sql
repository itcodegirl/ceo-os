-- =========================
-- security hardening (Supabase advisor findings)
-- =========================

-- 1. Telemetry prune RPC: only the server may call it.
-- 20260422_app_error_telemetry_events.sql revoked EXECUTE from anon and
-- authenticated, but Postgres also grants EXECUTE on every new function to
-- PUBLIC, which both roles inherit. The SECURITY DEFINER function was
-- therefore callable by anyone through /rest/v1/rpc/, and could delete the
-- app-error log (e.g. max_rows => 1). Revoking from PUBLIC closes that.
revoke execute on function public.prune_old_app_error_telemetry_events(integer, integer)
  from public, anon, authenticated;
grant execute on function public.prune_old_app_error_telemetry_events(integer, integer)
  to service_role;

-- 2. updated_at trigger helper: pin its search_path so an object placed
-- earlier on a caller's path can never be resolved in its place. The body
-- only uses now(), which lives in pg_catalog (always searched).
alter function public.set_updated_at() set search_path = '';
