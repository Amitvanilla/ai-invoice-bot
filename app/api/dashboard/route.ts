import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import fs from "fs";
import path from "path";

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

    // Get all user's processed invoices
    const invoices = await prisma.invoice.findMany({
      where: {
        userId: user.id,
        status: "processed" // Only include successfully processed invoices
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`Found ${invoices.length} processed invoices for user ${user.email}`);

    // Log data from each invoice for debugging
    invoices.forEach((invoice, index) => {
      console.log(`Invoice ${index + 1}: ${invoice.filename}`);
      console.log(`  Status: ${invoice.status}`);
      console.log(`  Extracted Data:`, invoice.extractedData);
      console.log(`  Created: ${invoice.createdAt}`);
    });

    // Calculate dashboard metrics
    const totalInvoices = invoices.length;

    // Calculate total spend by aggregating all invoice amounts
    const totalSpend = invoices.reduce((sum, invoice) => {
      const amount = extractAmount(invoice.extractedData);
      console.log(`Invoice ${invoice.filename}: extracted amount = ${amount}`);
      return sum + (amount || 0);
    }, 0);

    console.log(`Total spend calculated: ₹${totalSpend} from ${totalInvoices} invoices`);

    // Group by vendor - aggregate data from ALL invoices
    const vendorSpend = new Map<string, { total: number; count: number; invoices: any[] }>();
    invoices.forEach(invoice => {
      const vendorName = extractVendorName(invoice.extractedData) || 'Unknown Vendor';
      const amount = extractAmount(invoice.extractedData) || 0;
      const invoiceDate = invoice.createdAt.toISOString().split('T')[0];
      const invoiceNumber = extractInvoiceNumber(invoice.extractedData);

      console.log(`Processing vendor: ${vendorName}, amount: ${amount}`);

      if (!vendorSpend.has(vendorName)) {
        vendorSpend.set(vendorName, { total: 0, count: 0, invoices: [] });
      }

      const vendorData = vendorSpend.get(vendorName)!;
      vendorData.total += amount;
      vendorData.count += 1;
      vendorData.invoices.push({
        id: invoice.id,
        filename: invoice.filename,
        amount: amount,
        date: invoiceDate,
        invoiceNumber: invoiceNumber
      });
    });

    // Convert vendor data to array and sort by total spend
    const topVendors = Array.from(vendorSpend.entries())
      .map(([vendor, data]) => ({
        vendor,
        totalSpend: data.total,
        invoiceCount: data.count,
        recentInvoices: data.invoices.slice(0, 3) // Last 3 invoices
      }))
      .sort((a, b) => b.totalSpend - a.totalSpend)
      .slice(0, 10); // Top 10 vendors

    // Monthly spend analysis
    const monthlySpend = new Map<string, number>();
    invoices.forEach(invoice => {
      const date = new Date(invoice.createdAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const amount = extractAmount(invoice.extractedData) || 0;

      console.log(`Monthly spend for ${monthKey}: adding ₹${amount}`);
      monthlySpend.set(monthKey, (monthlySpend.get(monthKey) || 0) + amount);
    });

    // Recent invoices (last 5) - use real data from each invoice
    const recentInvoices = invoices.slice(0, 5).map(invoice => {
      const vendorName = extractVendorName(invoice.extractedData) || 'Unknown Vendor';
      const amount = extractAmount(invoice.extractedData) || 0;
      const invoiceDate = invoice.createdAt.toISOString().split('T')[0];
      const invoiceNumber = extractInvoiceNumber(invoice.extractedData);

      console.log(`Recent invoice: ${invoice.filename}, vendor: ${vendorName}, amount: ₹${amount}`);

      return {
        id: invoice.id,
        filename: invoice.filename,
        vendor: vendorName,
        amount: amount,
        date: invoiceDate,
        invoiceNumber: invoiceNumber
      };
    });

    // Spend categories (if available from invoice data)
    const spendCategories = new Map<string, number>();
    invoices.forEach(invoice => {
      const categories = extractCategories(invoice.extractedData);
      categories.forEach(category => {
        spendCategories.set(category, (spendCategories.get(category) || 0) + (extractAmount(invoice.extractedData) || 0));
      });
    });

    console.log('Final dashboard calculations:');
    console.log(`  Total Invoices: ${totalInvoices}`);
    console.log(`  Total Spend: ₹${totalSpend}`);
    console.log(`  Average Invoice Value: ₹${totalInvoices > 0 ? totalSpend / totalInvoices : 0}`);
    console.log(`  Top Vendor: ${topVendors.length > 0 ? topVendors[0].vendor : 'None'}`);
    console.log(`  Top Vendor Spend: ₹${topVendors.length > 0 ? topVendors[0].totalSpend : 0}`);

    const dashboardData = {
      summary: {
        totalInvoices,
        totalSpend,
        averageInvoiceValue: totalInvoices > 0 ? totalSpend / totalInvoices : 0,
        topVendor: topVendors.length > 0 ? topVendors[0].vendor : 'No vendors found',
        topVendorSpend: topVendors.length > 0 ? topVendors[0].totalSpend : 0
      },
      topVendors,
      monthlySpend: Object.fromEntries(monthlySpend),
      recentInvoices,
      spendCategories: Object.fromEntries(spendCategories),
      lastUpdated: new Date().toISOString()
    };

    return NextResponse.json(dashboardData);

  } catch (error) {
    console.error("Dashboard error:", error);
    return NextResponse.json({ error: "Failed to load dashboard data" }, { status: 500 });
  }
}

// Helper functions to extract data from invoice JSON
function extractAmount(extractedData: any): number | null {
  if (!extractedData) {
    console.log('No extracted data found');
    return null;
  }

  console.log('Extracting amount from:', extractedData);

  // Try different possible field names for amount
  const amountFields = ['total_amount', 'totalAmount', 'grand_total', 'grandTotal', 'amount'];
  for (const field of amountFields) {
    if (extractedData[field]) {
      const amount = extractedData[field];
      console.log(`Found amount field '${field}':`, amount, typeof amount);

      if (typeof amount === 'string') {
        // Handle different formats: "₹7,468.00", "7468.00", "$1,250.00", "10.00"
        let cleanAmount = amount.replace(/[₹$€£,\s]/g, '');

        // Check for non-numeric strings like "Processing Complete"
        if (isNaN(parseFloat(cleanAmount)) || cleanAmount === '') {
          console.log(`Invalid amount string: "${amount}" -> "${cleanAmount}"`);
          continue;
        }

        const parsed = parseFloat(cleanAmount);
        if (!isNaN(parsed)) {
          console.log(`Successfully parsed amount: ₹${parsed}`);
          return parsed;
        }
      } else if (typeof amount === 'number') {
        console.log(`Found numeric amount: ₹${amount}`);
        return amount;
      }
    }
  }

  console.log('No valid amount found in extracted data');
  return null;
}

function extractVendorName(extractedData: any): string | null {
  if (!extractedData) return null;
  return extractedData.vendor_name || extractedData.vendorName || extractedData.vendor || null;
}

function extractInvoiceNumber(extractedData: any): string | null {
  if (!extractedData) return null;
  return extractedData.invoice_number || extractedData.invoiceNumber || null;
}

function extractCategories(extractedData: any): string[] {
  if (!extractedData) return [];

  const categories: string[] = [];

  // Check for line items and categorize
  if (extractedData.line_items && Array.isArray(extractedData.line_items)) {
    extractedData.line_items.forEach((item: any) => {
      if (item.description) {
        // Simple categorization based on keywords
        const desc = item.description.toLowerCase();
        if (desc.includes('travel') || desc.includes('flight') || desc.includes('air')) {
          categories.push('Travel');
        } else if (desc.includes('office') || desc.includes('supplies')) {
          categories.push('Office Supplies');
        } else if (desc.includes('software') || desc.includes('subscription')) {
          categories.push('Software');
        } else if (desc.includes('food') || desc.includes('meal') || desc.includes('restaurant')) {
          categories.push('Food & Dining');
        } else {
          categories.push('Other');
        }
      }
    });
  }

  return Array.from(new Set(categories)); // Remove duplicates
}
