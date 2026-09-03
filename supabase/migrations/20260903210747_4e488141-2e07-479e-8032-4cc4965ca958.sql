REVOKE EXECUTE ON FUNCTION public.is_staff(UUID) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;