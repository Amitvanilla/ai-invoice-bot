import { NextRequest } from "next/server";
import { auth, signOut } from "@/lib/auth";

export async function GET() {
  try {
    await signOut({ redirect: false });
    return Response.redirect(new URL('/', process.env.NEXTAUTH_URL || 'http://localhost:3000'));
  } catch (error) {
    console.error('Sign out error:', error);
    return Response.redirect(new URL('/', process.env.NEXTAUTH_URL || 'http://localhost:3000'));
  }
}

export async function POST() {
  try {
    await signOut({ redirect: false });
    return Response.redirect(new URL('/', process.env.NEXTAUTH_URL || 'http://localhost:3000'));
  } catch (error) {
    console.error('Sign out error:', error);
    return Response.redirect(new URL('/', process.env.NEXTAUTH_URL || 'http://localhost:3000'));
  }
}
