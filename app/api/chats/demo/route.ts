import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only create demo chats for demo user
    if (session.user.email !== "demo@chat.app") {
      return Response.json({ error: "Demo chats only available for demo user" }, { status: 403 });
    }

    // Ensure demo user exists in database
    let user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: session.user.email,
          name: "Demo User",
          passwordHash: "",
        },
      });
    }

    // Check if demo chats already exist
    const existingChats = await prisma.chatSession.findMany({
      where: { userId: user.id },
    });

    if (existingChats.length > 0) {
      return Response.json({
        chats: existingChats.map(chat => ({
          ...chat,
          messages: []
        }))
      });
    }

    // Create demo chats
    const demoChat1 = await prisma.chatSession.create({
      data: {
        userId: user.id,
        title: "Getting Started",
        messages: {
          create: [
            {
              role: "user",
              content: "Hello! Can you help me?",
              createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
            },
            {
              role: "assistant",
              content: "Hello! I'm your AI assistant. I'm here to help you with any questions or tasks you might have. What would you like to know about?",
              createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000 + 1000), // 2 hours ago + 1s
            },
            {
              role: "user",
              content: "What can you do?",
              createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
            },
            {
              role: "assistant",
              content: "I can help you with a wide variety of tasks! I can answer questions, provide information, help with coding, explain concepts, and much more. I'm designed to be helpful and informative.",
              createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000 + 1000), // 1 hour ago + 1s
            },
          ],
        },
      },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    const demoChat2 = await prisma.chatSession.create({
      data: {
        userId: user.id,
        title: "Programming Help",
        messages: {
          create: [
            {
              role: "user",
              content: "Can you help me with JavaScript?",
              createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
            },
            {
              role: "assistant",
              content: "I'd be happy to help you with JavaScript! I can assist with syntax, concepts, debugging, best practices, and more. What specific JavaScript topic would you like to explore?",
              createdAt: new Date(Date.now() - 30 * 60 * 1000 + 1000), // 30 minutes ago + 1s
            },
          ],
        },
      },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    const demoChat3 = await prisma.chatSession.create({
      data: {
        userId: user.id,
        title: "Quick Question",
        messages: {
          create: [
            {
              role: "user",
              content: "Tell me a joke",
              createdAt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
            },
            {
              role: "assistant",
              content: "Why don't scientists trust atoms? Because they make up everything! 😄",
              createdAt: new Date(Date.now() - 10 * 60 * 1000 + 1000), // 10 minutes ago + 1s
            },
          ],
        },
      },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    const chats = [demoChat3, demoChat2, demoChat1]; // Most recent first

    return Response.json({ chats });
  } catch (error) {
    console.error("Error creating demo chats:", error);
    return Response.json({ error: "Failed to create demo chats" }, { status: 500 });
  }
}
