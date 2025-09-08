import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { google } from "googleapis";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Get the user's Gmail tokens from the database
    const account = await prisma.account.findFirst({
      where: {
        userId: userId,
        provider: "google",
      },
    });

    if (!account || !account.access_token) {
      return NextResponse.json(
        { error: "Gmail not connected" },
        { status: 400 }
      );
    }

    // Check if token is expired and refresh if needed
    let accessToken = account.access_token;
    const now = Math.floor(Date.now() / 1000);

    if (account.expires_at && account.expires_at < now) {
      if (!account.refresh_token) {
        return NextResponse.json(
          { error: "Token expired and no refresh token available" },
          { status: 400 }
        );
      }

      // Refresh the token
      try {
        const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            refresh_token: account.refresh_token,
            grant_type: "refresh_token",
          }),
        });

        if (!tokenResponse.ok) {
          return NextResponse.json(
            { error: "Failed to refresh token" },
            { status: 400 }
          );
        }

        const tokenData = await tokenResponse.json();
        accessToken = tokenData.access_token;

        // Update the token in the database
        const expiresAt = now + (tokenData.expires_in || 3600);
        await prisma.account.update({
          where: { id: account.id },
          data: {
            access_token: accessToken,
            expires_at: expiresAt,
          },
        });
      } catch (error) {
        console.error("Token refresh error:", error);
        return NextResponse.json(
          { error: "Failed to refresh access token" },
          { status: 500 }
        );
      }
    }

    // Initialize Gmail API client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID!,
      process.env.GOOGLE_CLIENT_SECRET!
    );

    oauth2Client.setCredentials({
      access_token: accessToken,
    });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // Search for invoice emails
    const query = "invoice OR receipt OR bill OR statement";
    const response = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults: 10, // Limit for demo
    });

    const messages = response.data.messages || [];
    const syncResults = [];

    // Process each message
    for (const message of messages) {
      try {
        const messageData = await gmail.users.messages.get({
          userId: "me",
          id: message.id!,
          format: "full",
        });

        // Extract invoice data from email
        const emailData = {
          id: message.id,
          subject: messageData.data.payload?.headers?.find(
            (h: any) => h.name === "Subject"
          )?.value,
          from: messageData.data.payload?.headers?.find(
            (h: any) => h.name === "From"
          )?.value,
          date: messageData.data.payload?.headers?.find(
            (h: any) => h.name === "Date"
          )?.value,
          snippet: messageData.data.snippet,
        };

        syncResults.push(emailData);
      } catch (error) {
        console.error(`Error processing message ${message.id}:`, error);
      }
    }

    // Log the sync operation
    await prisma.invoiceSearch.create({
      data: {
        userId: userId,
        query: `Gmail sync: ${query}`,
        results: {
          totalEmails: messages.length,
          processedEmails: syncResults.length,
          results: syncResults,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Gmail sync completed",
      data: {
        totalEmails: messages.length,
        processedEmails: syncResults.length,
        results: syncResults,
      },
    });

  } catch (error) {
    console.error("Gmail sync error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
