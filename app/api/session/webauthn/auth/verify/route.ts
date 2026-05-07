import { authVerify } from "@/lib/server/webauthn-handlers";

export async function POST(request: Request) {
  return authVerify(request);
}
