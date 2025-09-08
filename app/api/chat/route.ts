import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// Using Node.js runtime for Prisma compatibility

export async function POST(req: NextRequest) {
  console.log('🔍 Chat API: Request received');

  const session = await auth();
  console.log('🔍 Chat API: Session check', { hasSession: !!session, email: session?.user?.email });

  if (!session?.user?.email) {
    console.error('❌ Chat API: Unauthorized - no session or email');
    return new Response("Unauthorized", { status: 401 });
  }

  const { chatId, prompt } = await req.json();
  console.log('🔍 Chat API: Request data', { chatId, prompt: prompt?.substring(0, 50) + '...' });

  if (!prompt || typeof prompt !== "string") {
    console.error('❌ Chat API: Invalid prompt', { prompt, type: typeof prompt });
    return new Response("Invalid prompt", { status: 400 });
  }

  // Ensure user exists in database (create demo user if needed)
  console.log('🔍 Chat API: Checking user in database');
  let user = await prisma.user.findUnique({ where: { email: session.user.email } });
  console.log('🔍 Chat API: User lookup result', { found: !!user, userId: user?.id });

  if (!user) {
    console.log('🔍 Chat API: Creating new user');
    user = await prisma.user.create({
      data: {
        email: session.user.email,
        name: session.user.name || "Demo User",
        passwordHash: "", // Demo users don't need password hash
      },
    });
    console.log('🔍 Chat API: User created', { userId: user.id });
  }

  // Ensure chat session exists (create if not)
  console.log('🔍 Chat API: Checking chat session', { chatId, userId: user.id });
  let chat = chatId
    ? await prisma.chatSession.findFirst({ where: { id: chatId, userId: user.id } })
    : null;
  console.log('🔍 Chat API: Chat session lookup', { found: !!chat, chatId: chat?.id });

  if (!chat) {
    console.log('🔍 Chat API: Creating new chat session');
    chat = await prisma.chatSession.create({
      data: { userId: user.id, title: prompt.slice(0, 32) || "New chat" },
    });
    console.log('🔍 Chat API: Chat session created', { chatId: chat.id });
  }

  // Save user message
  console.log('🔍 Chat API: Saving user message');
  await prisma.message.create({
    data: { chatId: chat.id, role: "user", content: prompt },
  });
  console.log('🔍 Chat API: User message saved');

  // Create SSE response with hardcoded messages
  console.log('🔍 Chat API: Starting response generation');
  const encoder = new TextEncoder();
  let fullText = "";
  let messageId = crypto.randomUUID();
  console.log('🔍 Chat API: Generated message ID', { messageId });

  // Check if the query is invoice-related and query the knowledge base
  const isInvoiceQuery = (userPrompt: string) => {
    const prompt = userPrompt.toLowerCase();
    const invoiceKeywords = [
      'invoice', 'bill', 'receipt', 'payment', 'vendor', 'supplier',
      'spend', 'expense', 'amount', 'total', 'cost', 'price',
      'purchase', 'transaction', 'interglobe', 'indigo', 'airlines',
      'travel', 'flight', 'pnr', 'booking'
    ];

    const isInvoice = invoiceKeywords.some(keyword => prompt.includes(keyword));
    console.log('🔍 Chat API: Invoice query detection', { prompt: prompt.substring(0, 50), isInvoice });
    return isInvoice;
  };

  // Handle expense analysis queries
  const handleExpenseAnalysisQuery = (userPrompt: string, invoices: any[]) => {
    console.log('🔍 Chat API: Handling expense analysis query:', userPrompt);

    const prompt = userPrompt.toLowerCase();

    // Parse amounts from invoices
    const invoicesWithAmounts = invoices.map(invoice => {
      const data = invoice.extractedData || {};
      let amount = 0;

      // Try to parse amount from various formats
      const amountStr = data.total_amount || data.amount || '0';
      const cleanedAmount = amountStr.toString().replace(/[^0-9.-]/g, '');
      amount = parseFloat(cleanedAmount) || 0;

      return {
        ...invoice,
        parsedAmount: amount,
        data
      };
    }).filter(inv => inv.parsedAmount > 0); // Only include invoices with valid amounts

    console.log('🔍 Chat API: Parsed amounts from', invoicesWithAmounts.length, 'invoices');

    if (prompt.includes('most') || prompt.includes('highest') || prompt.includes('biggest') || prompt.includes('which')) {
      // Find invoice with highest amount
      if (invoicesWithAmounts.length === 0) {
        return "I couldn't find any invoices with valid amount data to analyze.";
      }

      const highestInvoice = invoicesWithAmounts.reduce((max, current) =>
        current.parsedAmount > max.parsedAmount ? current : max
      );

      return `📊 **Most Expensive Invoice:**\n\n` +
             `**${highestInvoice.filename}**\n` +
             `- Amount: $${highestInvoice.parsedAmount.toFixed(2)}\n` +
             `- Vendor: ${highestInvoice.data.vendor_name || 'N/A'}\n` +
             `- Invoice: ${highestInvoice.data.invoice_number || 'N/A'}\n` +
             `- Date: ${highestInvoice.data.date || 'N/A'}\n\n` +
             `This is your highest expense among ${invoicesWithAmounts.length} invoices.`;

    } else if (prompt.includes('total') || prompt.includes('spend') || prompt.includes('sum')) {
      // Calculate total spending
      const totalAmount = invoicesWithAmounts.reduce((sum, invoice) => sum + invoice.parsedAmount, 0);

      let response = `📊 **Total Spending Analysis:**\n\n`;
      response += `- Total Amount: $${totalAmount.toFixed(2)}\n`;
      response += `- Number of Invoices: ${invoicesWithAmounts.length}\n`;
      response += `- Average per Invoice: $${(totalAmount / invoicesWithAmounts.length).toFixed(2)}\n\n`;

      // Filter by month if requested
      if (prompt.includes('month') || prompt.includes('this month')) {
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();

        const thisMonthInvoices = invoicesWithAmounts.filter(invoice => {
          if (!invoice.data.date) return false;
          const invoiceDate = new Date(invoice.data.date);
          return invoiceDate.getMonth() === currentMonth &&
                 invoiceDate.getFullYear() === currentYear;
        });

        const thisMonthTotal = thisMonthInvoices.reduce((sum, invoice) => sum + invoice.parsedAmount, 0);

        response += `**This Month (${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}) :**\n`;
        response += `- Amount: $${thisMonthTotal.toFixed(2)}\n`;
        response += `- Invoices: ${thisMonthInvoices.length}\n\n`;
      }

      return response;
    }

    // Default expense analysis response
    return `📊 **Expense Analysis:**\n\n` +
           `I analyzed ${invoicesWithAmounts.length} invoices with valid amounts.\n\n` +
           `💡 Try asking:\n` +
           `- "which invoice has the most expense"\n` +
           `- "my total spends for this month"\n` +
           `- "what's my highest invoice amount"`;
  };

// Generate embedding for user query
const generateQueryEmbedding = async (query: string): Promise<number[]> => {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      input: query,
      model: 'text-embedding-3-small',
      dimensions: 1536
    })
  });

  if (!response.ok) {
    throw new Error('Failed to generate embedding');
  }

  const data = await response.json();
  return data.data[0].embedding;
};

// Find similar invoices using vector similarity
const findSimilarInvoices = async (queryEmbedding: number[], userId: string): Promise<any[]> => {
  // Get all invoices for the user that have embeddings
  const invoices = await prisma.invoice.findMany({
    where: {
      userId: userId,
      status: "processed",
      embeddings: { not: null }
    }
  });

  console.log(`🔍 Chat API: Found ${invoices.length} invoices with embeddings`);

  // Calculate cosine similarity for each invoice
  const similarities = invoices.map(invoice => {
    try {
      const invoiceEmbedding = JSON.parse(invoice.embeddings!);
      const similarity = cosineSimilarity(queryEmbedding, invoiceEmbedding);
      return {
        ...invoice,
        similarity_score: similarity
      };
    } catch (error) {
      console.log(`🔍 Chat API: Error parsing embeddings for invoice ${invoice.id}`);
      return null;
    }
  }).filter(item => item !== null);

  // Sort by similarity and return top results
  similarities.sort((a, b) => b.similarity_score - a.similarity_score);

  return similarities.slice(0, 10); // Return top 10 most similar
};

// Calculate cosine similarity between two vectors
const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

// Generate intelligent response using RAG results
const generateRAGResponse = async (userPrompt: string, searchResults: any[]) => {
    console.log('🔍 Chat API: Generating RAG response for', searchResults.length, 'results');

    try {
      // Prepare context from search results
      const context = searchResults.map((result, index) => {
        const data = result.extractedData || {};
        return `Invoice ${index + 1}:
- Filename: ${result.filename || 'Unknown'}
- Amount: ${data.total_amount || 'N/A'}
- Vendor: ${data.vendor_name || 'N/A'}
- Invoice Number: ${data.invoice_number || 'N/A'}
- Date: ${data.date || 'N/A'}
- Status: ${result.status || 'N/A'}
- Relevance Score: ${(result.similarity_score * 100).toFixed(1)}%`;
      }).join('\n\n');

      // Create RAG prompt
      const ragPrompt = `You are an intelligent invoice assistant. Use the following invoice search results to answer the user's query.

USER QUERY: "${userPrompt}"

SEARCH RESULTS:
${context}

INSTRUCTIONS:
1. Analyze the search results and provide a helpful, accurate response
2. If the query asks for specific information (like "most expensive"), calculate and provide it
3. If the query asks for totals or summaries, compute them from the available data
4. Be conversational and helpful
5. If no relevant information is found, say so clearly
6. Always reference specific invoices when possible
7. Provide actionable insights when relevant

RESPONSE:`;

      // Call OpenAI for RAG response
      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are an intelligent invoice analysis assistant that provides accurate, helpful responses based on invoice data.'
            },
            {
              role: 'user',
              content: ragPrompt
            }
          ],
          max_tokens: 1000,
          temperature: 0.3
        })
      });

      if (openaiResponse.ok) {
        const aiResult = await openaiResponse.json();
        const response = aiResult.choices[0]?.message?.content?.trim();

        if (response) {
          console.log('🔍 Chat API: RAG response generated successfully');
          return response;
        }
      }

      console.log('🔍 Chat API: OpenAI RAG failed, falling back to basic formatting');
    } catch (error) {
      console.error('🔍 Chat API: RAG generation error:', error);
    }

    // Fallback to basic formatting if RAG fails
    return formatBasicInvoiceResponse(userPrompt, searchResults);
  };

  // Fallback formatting for when RAG fails
  const formatBasicInvoiceResponse = (userPrompt: string, invoices: any[]) => {
    const prompt = userPrompt.toLowerCase();

    if (prompt.includes('most') || prompt.includes('highest') || prompt.includes('expensive')) {
      // Find most expensive
      let maxAmount = 0;
      let maxInvoice = null;

      invoices.forEach(invoice => {
        const data = invoice.extracted_data || invoice.data || {};
        const amount = parseFloat((data.total_amount || '0').replace(/[^0-9.-]/g, '')) || 0;
        if (amount > maxAmount) {
          maxAmount = amount;
          maxInvoice = invoice;
        }
      });

      if (maxInvoice) {
        const data = maxInvoice.extracted_data || maxInvoice.data || {};
        return `📊 **Most Expensive Invoice:**\n\n**${maxInvoice.filename}**\n- Amount: $${maxAmount.toFixed(2)}\n- Vendor: ${data.vendor_name || 'N/A'}\n- Date: ${data.date || 'N/A'}`;
      }
    }

    if (prompt.includes('total') || prompt.includes('spend')) {
      // Calculate total
      let total = 0;
      let validInvoices = 0;

      invoices.forEach(invoice => {
        const data = invoice.extracted_data || invoice.data || {};
        const amount = parseFloat((data.total_amount || '0').replace(/[^0-9.-]/g, '')) || 0;
        if (amount > 0) {
          total += amount;
          validInvoices++;
        }
      });

      return `📊 **Spending Summary:**\n\n- Total Amount: $${total.toFixed(2)}\n- Valid Invoices: ${validInvoices}\n- Average: $${(total / validInvoices).toFixed(2)}`;
    }

    // Default list response
    let response = `I found ${invoices.length} relevant invoice(s):\n\n`;
    invoices.slice(0, 5).forEach((invoice, index) => {
      const data = invoice.extracted_data || invoice.data || {};
      response += `${index + 1}. **${invoice.filename}**\n`;
      response += `   - Amount: ${data.total_amount || 'N/A'}\n`;
      response += `   - Vendor: ${data.vendor_name || 'N/A'}\n\n`;
    });

    return response;
  };

  // Get invoice-related response using semantic search and RAG
  const getInvoiceResponse = async (userPrompt: string) => {
    console.log('🔍 Chat API: Processing invoice query with RAG');
    try {
      // Get user from database for invoice queries
      console.log('🔍 Chat API: Fetching user for invoice query');
      const user = await prisma.user.findUnique({
        where: { email: session.user.email }
      });
      console.log('🔍 Chat API: User lookup result', { found: !!user, userId: user?.id });

      if (!user) {
        console.log('❌ Chat API: User not found for invoice query');
        return "I couldn't find your user account. Please try signing in again.";
      }

      // Use direct vector similarity search from database
      console.log('🔍 Chat API: Performing direct vector similarity search');

      try {
        // Generate embedding for user query using OpenAI
        const queryEmbedding = await generateQueryEmbedding(userPrompt);
        console.log('🔍 Chat API: Generated query embedding');

        // Search invoices using vector similarity
        const similarInvoices = await findSimilarInvoices(queryEmbedding, user.id);
        console.log('🔍 Chat API: Found similar invoices', { count: similarInvoices.length });

        if (similarInvoices && similarInvoices.length > 0) {
          // Use RAG to generate intelligent response
          return await generateRAGResponse(userPrompt, similarInvoices);
        }
      } catch (vectorError) {
        console.log('🔍 Chat API: Vector search error, falling back to database query', vectorError.message);
      }

      // Fallback to direct database query if RAG fails
      console.log('🔍 Chat API: Fetching invoices from database (fallback)');
      const invoices = await prisma.invoice.findMany({
        where: {
          userId: user.id,
          status: "processed"
        },
        orderBy: { createdAt: 'desc' }
      });
      console.log('🔍 Chat API: Found invoices', { count: invoices.length });

      if (invoices.length === 0) {
        console.log('❌ Chat API: No processed invoices found');
        return "You don't have any processed invoices yet. Try uploading some invoices first!";
      }

      // Check query type
      const searchLower = userPrompt.toLowerCase();

      // Expanded detection for various invoice queries
      const isGeneralListQuery = searchLower.includes('list') ||
                                searchLower.includes('all') ||
                                searchLower.includes('show') ||
                                searchLower.includes('give') ||
                                searchLower.includes('my invoices');

      const isExpenseQuery = searchLower.includes('expense') ||
                            searchLower.includes('spend') ||
                            searchLower.includes('cost') ||
                            searchLower.includes('amount') ||
                            searchLower.includes('total') ||
                            searchLower.includes('most') ||
                            searchLower.includes('highest') ||
                            searchLower.includes('biggest') ||
                            searchLower.includes('month') ||
                            searchLower.includes('which');

      let relevantInvoices;
      let queryType = 'unknown';

      if (isGeneralListQuery) {
        // For general queries, return all invoices
        relevantInvoices = invoices;
        queryType = 'general_list';
        console.log('🔍 Chat API: General list query detected, returning all invoices');
      } else if (isExpenseQuery) {
        // For expense/spending queries, return all invoices for analysis
        relevantInvoices = invoices;
        queryType = 'expense_analysis';
        console.log('🔍 Chat API: Expense analysis query detected, returning all invoices for analysis');
      } else {
        // For specific queries, filter by content
        relevantInvoices = invoices.filter(invoice => {
          const extractedText = JSON.stringify(invoice.extractedData || {}).toLowerCase();
          const classifiedText = JSON.stringify(invoice.classifiedData || {}).toLowerCase();
          const filename = invoice.filename.toLowerCase();

          return extractedText.includes(searchLower) ||
                 classifiedText.includes(searchLower) ||
                 filename.includes(searchLower);
        });
        queryType = 'specific_search';
        console.log('🔍 Chat API: Specific search query, filtered invoices:', relevantInvoices.length);
      }

      if (relevantInvoices.length > 0) {
        console.log('🔍 Chat API: Formatting invoice response for', relevantInvoices.length, 'invoices, query type:', queryType);

        // Handle expense analysis queries specially
        if (queryType === 'expense_analysis') {
          return handleExpenseAnalysisQuery(userPrompt, relevantInvoices);
        }

        // Format the results into a helpful response
        let response = `I found ${relevantInvoices.length} relevant invoice(s) related to your query:\n\n`;

        relevantInvoices.slice(0, 3).forEach((invoice: any, index: number) => {
          const data = invoice.extractedData;
          console.log(`🔍 Chat API: Invoice ${index + 1} data:`, {
            filename: invoice.filename,
            status: invoice.status,
            extractedData: data
          });

          response += `${index + 1}. **${invoice.filename}**\n`;
          response += `   - Invoice: ${data?.invoice_number || 'N/A'}\n`;
          response += `   - Vendor: ${data?.vendor_name || 'N/A'}\n`;
          response += `   - Amount: ${data?.total_amount || 'N/A'}\n`;
          response += `   - Date: ${data?.date || 'N/A'}\n\n`;
        });

        if (relevantInvoices.length > 3) {
          response += `... and ${relevantInvoices.length - 3} more results.\n\n`;
        }

        response += `You can view these invoices in your dashboard for more details!`;

        return response;
      }

      return "I couldn't find any invoices matching your query. Try uploading some invoices first, or check your dashboard for existing invoices.";

    } catch (error) {
      console.error('Invoice query error:', error);
      return "I had trouble accessing your invoice data. Please check your dashboard for invoice information.";
    }
  };

  // Hardcoded responses based on user input
  const getHardcodedResponse = async (userPrompt: string) => {
    const prompt = userPrompt.toLowerCase();

    // Check for invoice-related queries first
    if (isInvoiceQuery(userPrompt)) {
      return await getInvoiceResponse(userPrompt);
    }

    if (prompt.includes('hello') || prompt.includes('hi')) {
      return "Hello! I'm your AI assistant. How can I help you today?";
    } else if (prompt.includes('how are you')) {
      return "I'm doing great, thank you for asking! I'm here and ready to assist you with anything you need.";
    } else if (prompt.includes('what can you do')) {
      return "I can help you with a wide variety of tasks! I can answer questions about your invoices, provide information, help with coding, explain concepts, and much more. What would you like to know about?";
    } else if (prompt.includes('tell me a joke')) {
      return "Why don't scientists trust atoms? Because they make up everything! 😄";
    } else if (prompt.includes('weather')) {
      return "I don't have access to real-time weather data, but I can suggest checking a weather app or website for the most current information in your area.";
    } else if (prompt.includes('code') || prompt.includes('programming')) {
      return "I'd be happy to help you with programming! I can assist with various languages like JavaScript, Python, React, and more. What specific coding task are you working on?";
    } else if (prompt.includes('time')) {
      return "I don't have access to the current time, but you can check your device's clock or use a time website for the most accurate information.";
    } else {
      return "That's an interesting question! While I don't have specific information about that topic right now, I'd be happy to help you explore related concepts or answer any other questions you might have. What else would you like to know?";
    }
  };

  console.log('🔍 Chat API: Generating response');
  const hardcodedResponse = await getHardcodedResponse(prompt);
  console.log('🔍 Chat API: Response generated', { length: hardcodedResponse.length });

  console.log('🔍 Chat API: Creating streaming response');
  const stream = new ReadableStream({
    async start(controller) {
      try {
        console.log('🔍 Chat API: Stream started, sending start event');
        // Send start event
        const startData = JSON.stringify({
          event: 'start',
          chatId: chat.id,
          messageId
        });
        controller.enqueue(encoder.encode(`data: ${startData}\n\n`));

        // Stream the response character by character with delays
        console.log('🔍 Chat API: Starting character streaming', { totalChars: hardcodedResponse.length });
        for (let i = 0; i < hardcodedResponse.length; i++) {
          const char = hardcodedResponse[i];
          fullText += char;

          // Send chunk event
          const chunkData = JSON.stringify({
            event: 'chunk',
            content: char,
            chatId: chat.id
          });
          controller.enqueue(encoder.encode(`data: ${chunkData}\n\n`));

          // Add a small delay to simulate realistic typing
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        console.log('🔍 Chat API: Character streaming completed');

        // Save assistant message to database
        console.log('🔍 Chat API: Saving assistant message to database');
        await prisma.message.create({
          data: { chatId: chat!.id, role: "assistant", content: fullText },
        });
        console.log('🔍 Chat API: Assistant message saved');

        // Send completion event
        console.log('🔍 Chat API: Sending completion event');
        const doneData = JSON.stringify({
          event: 'done',
          messageId,
          fullText,
          chatId: chat.id
        });
        controller.enqueue(encoder.encode(`data: ${doneData}\n\n`));

        console.log('🔍 Chat API: Stream completed successfully');
        controller.close();

      } catch (error) {
        console.error("❌ Error in chat streaming:", error);
        console.error("❌ Error stack:", error.stack);
        const errorData = JSON.stringify({
          event: 'error',
          error: "Failed to process message",
          details: error.message
        });
        controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Cache-Control",
    },
  });
}
