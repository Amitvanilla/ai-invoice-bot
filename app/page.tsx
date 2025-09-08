"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import ChatClient from "@/components/chat-client";
import Link from "next/link";
import { MessageSquare } from "lucide-react";

export default function Home() {
  const { data: session, status } = useSession();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "loading") return;

    if (session?.user?.email) {
      // Fetch user's chats
      fetch('/api/chats')
        .then(res => res.json())
        .then(data => {
          if (data.chats && data.chats.length > 0) {
            setChats(data.chats);
          } else if (session.user.email === "demo@chat.app") {
            // Create demo chats for demo user
            createDemoChats();
          }
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [session, status]);

  const createDemoChats = async () => {
    try {
      const response = await fetch('/api/chats/demo', {
        method: 'POST',
      });
      const data = await response.json();
      if (data.chats) {
        setChats(data.chats);
      }
    } catch (error) {
      console.error('Error creating demo chats:', error);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <main className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <MessageSquare className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Welcome to Amit Chat</h1>
          <p className="text-gray-600 mb-8">Sign in to start your AI conversation experience</p>
          <Link
            href="/login"
            className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            Sign In
          </Link>
        </div>
      </main>
    );
  }

  return <ChatClient initialChats={chats} />;
}
