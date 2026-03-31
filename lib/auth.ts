export function checkAuth(request: Request): boolean {
  const secret = process.env.API_SECRET;
  if (!secret) return true;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}
