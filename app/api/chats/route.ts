import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ensure user exists in database (create demo user if needed)
    let user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) {
      // Create demo user if they don't exist
      user = await prisma.user.create({
        data: {
          email: session.user.email,
          name: session.user.name || "Demo User",
          passwordHash: "", // Demo users don't need password hash
        },
      });
    }

    const chats = await prisma.chatSession.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    return Response.json({ chats });
  } catch (error) {
    console.error("Error fetching chats:", error);
    return Response.json({ error: "Failed to fetch chats" }, { status: 500 });
  }
}
