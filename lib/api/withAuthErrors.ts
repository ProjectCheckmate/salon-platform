import { NextResponse } from "next/server";
import { UnauthorizedError, ForbiddenError } from "@/lib/permissions";

/**
 * Wrap any route handler that calls requireSession/requireRole/requireSalonAccess
 * so those thrown errors become proper 401/403 responses instead of an
 * unhandled exception (which Next would otherwise turn into a raw 500,
 * violating spec section 62: never show raw server errors to customers).
 */
export function withAuthErrors<T extends (...args: any[]) => Promise<Response>>(handler: T): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        return NextResponse.json({ error: "Please sign in." }, { status: 401 });
      }
      if (err instanceof ForbiddenError) {
        return NextResponse.json({ error: "You don't have access to this." }, { status: 403 });
      }
      console.error(err);
      return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }
  }) as T;
}
