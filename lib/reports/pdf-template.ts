import PDFDocument from "pdfkit";
import { format } from "date-fns";
import type { ReportData } from "./types";

export async function generatePDFBuffer(
  data: ReportData,
  agencyName: string = "Client Dashboard"
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ size: "A4", margin: 40 });

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width - 80;
    const colors = {
      black: "#0a0a0a",
      grey: "#737373",
      lightGrey: "#f5f5f5",
      border: "#e5e5e5",
    };

    // Header
    doc
      .fontSize(24)
      .fillColor(colors.black)
      .text(data.clientName, 40, 40);

    doc
      .fontSize(12)
      .fillColor(colors.grey)
      .text("Monthly Performance Report", 40, 70);

    doc
      .fontSize(11)
      .fillColor(colors.grey)
      .text(format(data.periodStart, "MMMM yyyy"), 40, 40, { align: "right" })
      .text(
        `${format(data.periodStart, "MMM d")} - ${format(data.periodEnd, "MMM d, yyyy")}`,
        40,
        55,
        { align: "right" }
      );

    // Divider
    doc
      .moveTo(40, 100)
      .lineTo(40 + pageWidth, 100)
      .strokeColor(colors.black)
      .lineWidth(2)
      .stroke();

    let y = 130;

    // Section: Lead Summary
    doc
      .fontSize(14)
      .fillColor(colors.black)
      .text("Lead Summary", 40, y);

    y += 25;

    // Stat boxes
    const boxWidth = (pageWidth - 30) / 4;
    const stats = [
      { label: "TOTAL LEADS", value: data.totalLeads.toString() },
      { label: "NEW", value: data.newLeads.toString() },
      { label: "CONTACTED", value: data.contactedLeads.toString() },
      { label: "COMPLETED", value: data.completedLeads.toString() },
    ];

    stats.forEach((stat, i) => {
      const x = 40 + i * (boxWidth + 10);
      doc
        .rect(x, y, boxWidth, 60)
        .fillColor(colors.lightGrey)
        .fill();

      doc
        .fontSize(24)
        .fillColor(colors.black)
        .text(stat.value, x, y + 12, { width: boxWidth, align: "center" });

      doc
        .fontSize(8)
        .fillColor(colors.grey)
        .text(stat.label, x, y + 42, { width: boxWidth, align: "center" });
    });

    y += 80;

    // Section: Analytics (if available)
    if (data.totalVisitors !== undefined) {
      doc
        .fontSize(14)
        .fillColor(colors.black)
        .text("Website Analytics", 40, y);

      y += 25;

      const analyticsStats = [
        { label: "VISITORS", value: data.totalVisitors?.toLocaleString() || "-" },
        { label: "PAGEVIEWS", value: data.totalPageviews?.toLocaleString() || "-" },
        { label: "AVG. SESSION", value: data.avgSessionDuration || "-" },
        { label: "BOUNCE RATE", value: data.bounceRate || "-" },
      ];

      analyticsStats.forEach((stat, i) => {
        const x = 40 + i * (boxWidth + 10);
        doc
          .rect(x, y, boxWidth, 60)
          .fillColor(colors.lightGrey)
          .fill();

        doc
          .fontSize(18)
          .fillColor(colors.black)
          .text(stat.value, x, y + 15, { width: boxWidth, align: "center" });

        doc
          .fontSize(8)
          .fillColor(colors.grey)
          .text(stat.label, x, y + 42, { width: boxWidth, align: "center" });
      });

      y += 80;
    }

    // Section: Leads Trend (simple bar chart)
    if (data.leadsTrend.length > 0) {
      doc
        .fontSize(14)
        .fillColor(colors.black)
        .text("Daily Lead Trend (Last 14 Days)", 40, y);

      y += 25;

      const chartData = data.leadsTrend.slice(-14);
      const maxCount = Math.max(...chartData.map((d) => d.count), 1);
      const chartHeight = 80;
      const barWidth = (pageWidth - 20) / chartData.length - 4;

      chartData.forEach((day, i) => {
        const x = 40 + i * (barWidth + 4);
        const barHeight = Math.max((day.count / maxCount) * chartHeight, 2);

        doc
          .rect(x, y + chartHeight - barHeight, barWidth, barHeight)
          .fillColor(colors.black)
          .fill();

        doc
          .fontSize(6)
          .fillColor(colors.grey)
          .text(day.date.split(" ")[1] || "", x, y + chartHeight + 5, {
            width: barWidth,
            align: "center",
          });
      });

      y += chartHeight + 30;
    }

    // Section: Leads by Website
    if (data.leadsByWebsite.length > 0) {
      doc
        .fontSize(14)
        .fillColor(colors.black)
        .text("Leads by Website", 40, y);

      y += 25;

      // Table header
      doc
        .rect(40, y, pageWidth, 25)
        .fillColor(colors.black)
        .fill();

      doc
        .fontSize(9)
        .fillColor("#ffffff")
        .text("Website", 50, y + 8)
        .text("Leads", 40 + pageWidth - 60, y + 8, { width: 50, align: "right" });

      y += 25;

      // Table rows
      data.leadsByWebsite.slice(0, 5).forEach((item) => {
        doc
          .fontSize(10)
          .fillColor(colors.black)
          .text(item.website, 50, y + 6)
          .text(item.count.toString(), 40 + pageWidth - 60, y + 6, {
            width: 50,
            align: "right",
          });

        doc
          .moveTo(40, y + 22)
          .lineTo(40 + pageWidth, y + 22)
          .strokeColor(colors.border)
          .lineWidth(1)
          .stroke();

        y += 25;
      });

      y += 15;
    }

    // Section: Top Forms
    if (data.topFormNames.length > 0 && y < 650) {
      doc
        .fontSize(14)
        .fillColor(colors.black)
        .text("Top Performing Forms", 40, y);

      y += 25;

      // Table header
      doc
        .rect(40, y, pageWidth, 25)
        .fillColor(colors.black)
        .fill();

      doc
        .fontSize(9)
        .fillColor("#ffffff")
        .text("Form Name", 50, y + 8)
        .text("Submissions", 40 + pageWidth - 80, y + 8, { width: 70, align: "right" });

      y += 25;

      // Table rows
      data.topFormNames.slice(0, 5).forEach((item) => {
        doc
          .fontSize(10)
          .fillColor(colors.black)
          .text(item.name, 50, y + 6, { width: pageWidth - 100 })
          .text(item.count.toString(), 40 + pageWidth - 80, y + 6, {
            width: 70,
            align: "right",
          });

        doc
          .moveTo(40, y + 22)
          .lineTo(40 + pageWidth, y + 22)
          .strokeColor(colors.border)
          .lineWidth(1)
          .stroke();

        y += 25;
      });
    }

    // Footer
    const footerY = doc.page.height - 50;
    doc
      .moveTo(40, footerY)
      .lineTo(40 + pageWidth, footerY)
      .strokeColor(colors.border)
      .lineWidth(1)
      .stroke();

    doc
      .fontSize(8)
      .fillColor(colors.grey)
      .text(
        `Generated by ${agencyName} on ${format(data.generatedAt, "MMM d, yyyy 'at' h:mm a")}`,
        40,
        footerY + 10
      )
      .text("Page 1 of 1", 40 + pageWidth - 50, footerY + 10, { width: 50, align: "right" });

    doc.end();
  });
}
