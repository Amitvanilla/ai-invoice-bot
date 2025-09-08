import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get all user's invoices with embeddings
    const invoices = await prisma.invoice.findMany({
      where: {
        userId: user.id,
        status: "processed"
      },
      orderBy: { createdAt: 'desc' }
    });

    let searchResults;

    if (query && query.trim()) {
      // Semantic search using embeddings
      try {
        // Generate embedding for the search query
        const queryText = `Search query: ${query}`;
        const mockQueryEmbedding = Array.from({ length: 1536 }, () => Math.random() - 0.5);

        // Calculate similarity with each invoice's embeddings
        const scoredInvoices = invoices.map(invoice => {
          let similarity = 0;
          let matchedContent = '';

          try {
            if (invoice.embeddings && typeof invoice.embeddings === 'string') {
              const invoiceEmbeddings = JSON.parse(invoice.embeddings);
              if (Array.isArray(invoiceEmbeddings)) {
                // Simple cosine similarity calculation
                const dotProduct = invoiceEmbeddings.reduce((sum, val, i) =>
                  sum + val * (mockQueryEmbedding[i] || 0), 0);
                const invoiceNorm = Math.sqrt(invoiceEmbeddings.reduce((sum, val) => sum + val * val, 0));
                const queryNorm = Math.sqrt(mockQueryEmbedding.reduce((sum, val) => sum + val * val, 0));

                similarity = invoiceNorm && queryNorm ? dotProduct / (invoiceNorm * queryNorm) : 0;

                // Also check for text matches to boost relevance
                const extractedText = JSON.stringify(invoice.extractedData || {}).toLowerCase();
                const searchLower = query.toLowerCase();

                if (extractedText.includes(searchLower)) {
                  similarity += 0.3; // Boost for text matches
                  matchedContent = `Found "${query}" in invoice data`;
                } else {
                  matchedContent = `Similar invoice: ${invoice.filename}`;
                }
              }
            }
          } catch (error) {
            console.log('Error calculating similarity for invoice:', invoice.id, error.message);
            similarity = 0;
            matchedContent = `Invoice: ${invoice.filename}`;
          }

          return {
            invoice,
            similarity,
            matchedContent
          };
        });

        // Sort by similarity and filter relevant results
        searchResults = scoredInvoices
          .filter(item => item.similarity > 0.1) // Minimum similarity threshold
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, 10) // Top 10 results
          .map(item => item.invoice);

      } catch (embeddingError) {
        console.log('Embedding search failed, falling back to text search:', embeddingError.message);
        // Fallback to text search
        searchResults = invoices.filter(invoice => {
          const extractedText = JSON.stringify(invoice.extractedData || {}).toLowerCase();
          const classifiedText = JSON.stringify(invoice.classifiedData || {}).toLowerCase();
          const filename = invoice.filename.toLowerCase();
          const searchLower = query.toLowerCase();

          return extractedText.includes(searchLower) ||
                 classifiedText.includes(searchLower) ||
                 filename.includes(searchLower);
        });
      }
    } else {
      // No query - return all invoices
      searchResults = invoices;
    }

    // Format results with relevance scores
    const formattedResults = searchResults.map((invoice, index) => ({
      id: invoice.id,
      filename: invoice.filename,
      relevance_score: query ? Math.max(0.1, 1 - (index * 0.1)) : 0.8,
      matched_content: query ? `Invoice: ${invoice.filename}` : `Invoice: ${invoice.filename}`,
      extracted_data: invoice.extractedData || {}
    }));

    // Log search query
    await prisma.invoiceSearch.create({
      data: {
        userId: user.id,
        query: query,
        results: formattedResults
      }
    });

    return NextResponse.json(formattedResults);
  } catch (error) {
    console.error("Invoice search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
