import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    // Database errors can include bound SQL parameters. Never send those to a browser.
    return error.code === "INTERNAL_SERVER_ERROR" ? { ...shape, message: "The request could not be completed.", data: { ...shape.data, stack: undefined } } : shape;
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

// A temporary-password session can only read its profile, change password, or log out.
export const signedInProcedure = t.procedure.use(requireUser);
export const protectedProcedure = signedInProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.mustChangePassword) throw new TRPCError({ code: "FORBIDDEN", message: "Change your temporary password before continuing." });
  return next({ ctx });
});

export const adminProcedure = protectedProcedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
