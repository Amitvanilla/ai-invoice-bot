import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import fs from "fs";
import path from "path";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Get the invoice
    console.log('Looking for invoice:', {
      invoiceId: params.id,
      userId: user.id,
      userEmail: user.email
    });

    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id, userId: user.id }
    });

    if (!invoice) {
      console.log('Invoice not found, checking all invoices for user...');
      const allUserInvoices = await prisma.invoice.findMany({
        where: { userId: user.id }
      });
      console.log('User has invoices:', allUserInvoices.map(inv => ({ id: inv.id, filename: inv.filename })));

      return NextResponse.json({
        error: "Invoice not found",
        invoiceId: params.id,
        userId: user.id,
        availableInvoices: allUserInvoices.length
      }, { status: 404 });
    }

    console.log('Found invoice:', { id: invoice.id, filename: invoice.filename });

    // Get the file type from query parameters
    const url = new URL(request.url);
    const type = url.searchParams.get('type');

    if (!type || !['original', 'processed'].includes(type)) {
      return NextResponse.json({ error: "Invalid file type. Use 'original' or 'processed'" }, { status: 400 });
    }

    let filePath: string;
    let fileName: string;
    let contentType: string;

    if (type === 'original') {
      // Serve original PDF files from the originals directory
      try {
        const originalsDir = path.join(process.cwd(), 'invoice-service', 'originals');
        const originalFiles = fs.readdirSync(originalsDir);

        // Look for a file that matches the invoice filename
        console.log('Looking for files containing:', invoice.filename.replace('.pdf', ''));
        console.log('Available files:', originalFiles);

        // Try multiple matching strategies
        let finalFile = originalFiles.find(file => {
          // Strategy 1: Exact filename match
          return file === invoice.filename;
        });

        if (!finalFile) {
          // Strategy 2: File contains invoice filename (without extension)
          const baseName = invoice.filename.replace('.pdf', '');
          finalFile = originalFiles.find(file => file.includes(baseName));
        }

        if (!finalFile) {
          // Strategy 3: File ends with invoice filename
          finalFile = originalFiles.find(file => file.endsWith(invoice.filename));
        }

        console.log('Matching file found:', finalFile);

        if (!finalFile) {
          console.log('Available original files:', originalFiles);
          console.log('Looking for:', invoice.filename);
          return NextResponse.json({
            error: "Original file not found",
            message: "The original PDF file could not be located",
            filename: invoice.filename,
            availableFiles: originalFiles.length
          }, { status: 404 });
        }

        const filePath = path.join(originalsDir, finalFile);
        console.log('Serving original file:', filePath);

        // Read the PDF file
        const fileBuffer = fs.readFileSync(filePath);

        return new NextResponse(fileBuffer, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="${invoice.filename}"`
          }
        });

      } catch (error) {
        console.error('Error serving original file:', error);
        return NextResponse.json({ error: "Failed to access original file" }, { status: 500 });
      }

    } else {
      // For processed file, serve Excel files from the local exports directory
      try {
        const localExcelPath = path.join(process.cwd(), 'invoice-service', 'exports', 'invoice_analysis.xlsx');

        if (fs.existsSync(localExcelPath)) {
          console.log('Serving local Excel file:', localExcelPath);
          const localFileBuffer = fs.readFileSync(localExcelPath);
          const localFileSize = localFileBuffer.length;

          console.log(`Excel file size: ${localFileSize} bytes`);

          if (localFileSize > 1000) {
            return new NextResponse(localFileBuffer, {
              headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="invoice_analysis_${invoice.id}.xlsx"`,
                'Content-Length': localFileSize.toString(),
                'Cache-Control': 'no-cache'
              }
            });
          } else {
            console.error('Excel file too small, likely corrupted');
            return NextResponse.json({
              error: "Excel file corrupted",
              message: "The generated Excel file appears to be corrupted. Please try uploading the invoice again.",
              fileSize: localFileSize
            }, { status: 500 });
          }
        } else {
          console.log('Local Excel file not found:', localExcelPath);
          return NextResponse.json({
            error: "Processed Excel not available",
            message: "The Excel file has not been generated yet. Please try uploading the invoice again.",
            status: "processed"
          }, { status: 404 });
        }

      } catch (error) {
        console.error('Error serving processed Excel file:', error);
        return NextResponse.json({
          error: "Failed to access Excel file",
          details: "There was an error reading the Excel file from the local storage"
        }, { status: 500 });
      }
    }

  } catch (error) {
    console.error("Download error:", error);
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  }
}
