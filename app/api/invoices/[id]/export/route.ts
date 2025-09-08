import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return new Response("Unauthorized", { status: 401 });
  }

  const invoiceId = params.id;

  try {
    // Get user from database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get invoice
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        userId: user.id
      }
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // TODO: Implement actual Excel export
    // For now, return mock response
    const mockResponse = {
      export_url: `https://example.com/exported-invoice-${invoiceId}.xlsx`,
      status: "success",
      message: `Invoice "${invoice.filename}" exported successfully`,
      invoice_data: {
        id: invoice.id,
        filename: invoice.filename,
        extracted_data: invoice.extractedData,
        classified_data: invoice.classifiedData
      }
    };

    return NextResponse.json(mockResponse);
  } catch (error) {
    console.error("Invoice export error:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
