import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Get user's invoices
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    // Get user from database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get user's invoices
    const invoices = await prisma.invoice.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' }
    });

    // Format response
    const formattedInvoices = invoices.map(invoice => ({
      id: invoice.id,
      filename: invoice.filename,
      status: invoice.status,
      extracted_data: invoice.extractedData || {},
      classified_data: invoice.classifiedData || {},
      created_at: invoice.createdAt.toISOString()
    }));

    return NextResponse.json(formattedInvoices);
  } catch (error) {
    console.error("Invoice fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch invoices" }, { status: 500 });
  }
}

// Upload and process invoice
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    // Get user from database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Create invoice record
    const invoice = await prisma.invoice.create({
      data: {
        userId: user.id,
        filename: file.name,
        status: "processing",
        extractedData: {
          message: "Invoice uploaded, processing in progress...",
          file_size: file.size,
          mime_type: file.type
        }
      }
    });

    // TODO: Add actual invoice processing logic here
    // For now, we'll simulate processing
    setTimeout(async () => {
      try {
        // Mock processed data
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            status: "processed",
            extractedData: {
              invoice_number: "INV-2024-001",
              date: "2024-01-15",
              vendor_name: "Sample Vendor",
              total_amount: "$1,250.00"
            },
            classifiedData: {
              invoice_number: "INV-2024-001",
              date: "2024-01-15",
              vendor_name: "Sample Vendor",
              total_amount: "$1,250.00"
            },
            embeddings: JSON.stringify([0.1, 0.2, 0.3]) // Mock embeddings
          }
        });
      } catch (error) {
        console.error("Invoice processing error:", error);
      }
    }, 2000); // Simulate 2 second processing

    return NextResponse.json({
      id: invoice.id,
      filename: invoice.filename,
      status: invoice.status,
      extracted_data: invoice.extractedData,
      classified_data: invoice.classifiedData,
      created_at: invoice.createdAt.toISOString()
    });
  } catch (error) {
    console.error("Invoice upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
