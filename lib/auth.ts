import NextAuth, { type NextAuthConfig } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GitHub,
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code"
        }
      },
      allowDangerousEmailAccountLinking: true
    }),
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (creds) => {
        const email = creds?.email as string;
        const password = creds?.password as string;

        // Temporary fallback for demo purposes
        const demoEmail = process.env.DEMO_EMAIL || "demo@chat.app";
        const demoPassword = process.env.DEMO_PASSWORD || "demo1234";
        
        if (email === demoEmail && password === demoPassword) {
          return {
            id: "demo-user-id",
            name: "Demo User",
            email: demoEmail
          };
        }

        // Try database authentication if available
        try {
          const user = await prisma.user.findUnique({ where: { email } });
          if (!user?.passwordHash) return null;
          const ok = await bcrypt.compare(password, user.passwordHash);
          return ok ? { id: user.id, name: user.name ?? null, email: user.email } : null;
        } catch (error) {
          // If database fails, return null
          return null;
        }
      },
    }),
  ],
  session: { strategy: "database" },
  pages: { signIn: "/login" },
  callbacks: {
    session: async ({ session, user }) => {
      if (user) {
        session.user.id = user.id;
      }
      return session;
    },
    jwt: async ({ token, user, account }) => {
      if (user) {
        token.uid = user.id;
      }
      return token;
    },
    signIn: async ({ user, account, profile }) => {
      // Allow OAuth sign-in if no account exists or if email matches existing account
      if (account?.provider === "google") {
        try {
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email! },
            include: { accounts: true }
          });

          if (existingUser) {
            // Check if user already has a Google account linked
            const hasGoogleAccount = existingUser.accounts.some(
              acc => acc.provider === "google"
            );

            if (hasGoogleAccount) {
              // User already has Google linked, allow sign-in
              return true;
            } else {
              // User exists but no Google account - this is the normal linking scenario
              console.log(`Linking Google account to existing user: ${user.email}`);
              return true;
            }
          }

          // No existing user, allow new account creation
          return true;
        } catch (error) {
          console.error("Sign-in callback error:", error);
          // If there's a database error, still allow sign-in to prevent lockout
          return true;
        }
      }

      return true;
    },
  },
  events: {
    signIn: async ({ user, account, profile, isNewUser }) => {
      if (account?.provider === "google" && !isNewUser) {
        // This handles the case where we're linking an existing account
        console.log(`User ${user.email} signed in with Google (account linked)`);
      }
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
