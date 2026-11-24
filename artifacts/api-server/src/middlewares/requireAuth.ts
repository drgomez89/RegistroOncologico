import { getAuth } from "@clerk/express";
import type { RequestHandler } from "express";
import { authProvider, verifiedSupabaseIdentity } from "../lib/supabase-auth";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      authDisplayName?: string;
    }
  }
}

const requireAuth: RequestHandler = async (req, res, next) => {
  if (authProvider() === 'supabase') {
    try {
      const identity = await verifiedSupabaseIdentity(req.get('authorization'));
      if (!identity) { res.status(401).json({ error: "Authentication required" }); return; }
      req.userId = identity.id;
      req.authDisplayName = identity.displayName;
      next();
    } catch {
      res.status(503).json({ error: "Authentication service unavailable. Please try again." });
    }
    return;
  }
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  req.userId = userId;
  next();
};

export default requireAuth;
