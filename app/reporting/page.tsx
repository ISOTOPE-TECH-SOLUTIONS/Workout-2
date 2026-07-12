"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { dbService } from "@/lib/supabase";
import { Activity, Wallet } from "lucide-react";

type AccessChartPoint = {
  month: string;
  approved: number;
  blocked_unpaid: number;
};

type IncomeChartPoint = {
  month: string;
  income: number;
};

const monthLabels = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const accessChartConfig = {
  approved: {
    label: "Approved Entries",
    color: "#10b981",
  },
  blocked_unpaid: {
    label: "Blocked Unpaid",
    color: "#ef4444",
  },
} satisfies ChartConfig;

const incomeChartConfig = {
  income: {
    label: "Income",
    color: "#eab308",
  },
} satisfies ChartConfig;

export default function ReportingPage() {
  const [accessData, setAccessData] = useState<AccessChartPoint[]>([]);
  const [incomeData, setIncomeData] = useState<IncomeChartPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ approved: 0, blockedUnpaid: 0, totalIncome: 0 });

  useEffect(() => {
    fetchReportingData();
  }, []);

  const fetchReportingData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const rangeStart = new Date(currentYear, 0, 1, 0, 0, 0, 0).toISOString();
      const rangeEnd = new Date(currentYear, 11, 31, 23, 59, 59, 999).toISOString();

      const [attendanceLogs, ledgerEntries] = await Promise.all([
        dbService.getAttendanceByRange(rangeStart, rangeEnd),
        dbService.getLedgerEntries("yearly", now),
      ]);

      const accessByMonth: AccessChartPoint[] = monthLabels.map((label) => ({
        month: label,
        approved: 0,
        blocked_unpaid: 0,
      }));

      let approvedTotal = 0;
      let blockedTotal = 0;

      (attendanceLogs || []).forEach((log: any) => {
        const logDate = new Date(log.timestamp);
        if (Number.isNaN(logDate.getTime()) || logDate.getFullYear() !== currentYear) return;

        const monthIdx = logDate.getMonth();
        const status = String(log.status || "").toLowerCase();
        const hasPaymentNote = !!String(log.notes || "").trim();

        if (status === "granted") {
          accessByMonth[monthIdx].approved += 1;
          approvedTotal += 1;
          return;
        }

        if (status === "denied" && hasPaymentNote) {
          accessByMonth[monthIdx].blocked_unpaid += 1;
          blockedTotal += 1;
        }
      });

      const incomeByMonth: IncomeChartPoint[] = monthLabels.map((label) => ({
        month: label,
        income: 0,
      }));

      let totalIncome = 0;
      (ledgerEntries || []).forEach((entry: any) => {
        if (String(entry.type || "") !== "income") return;

        const entryDate = new Date(entry.date);
        if (Number.isNaN(entryDate.getTime()) || entryDate.getFullYear() !== currentYear) return;

        const monthIdx = entryDate.getMonth();
        const amount = Number(entry.amount) || 0;
        incomeByMonth[monthIdx].income += amount;
        totalIncome += amount;
      });

      setAccessData(accessByMonth);
      setIncomeData(incomeByMonth);
      setSummary({ approved: approvedTotal, blockedUnpaid: blockedTotal, totalIncome });
    } catch (error) {
      console.error("Failed to load reporting charts:", error);
      setAccessData(monthLabels.map((month) => ({ month, approved: 0, blocked_unpaid: 0 })));
      setIncomeData(monthLabels.map((month) => ({ month, income: 0 })));
      setSummary({ approved: 0, blockedUnpaid: 0, totalIncome: 0 });
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
      <header className="space-y-2">
          <h1 className="text-4xl font-black tracking-tighter bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text text-transparent italic">
            REPORTING
          </h1>
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-yellow-500/60">Entry control outcomes and monthly income analytics</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card/50 backdrop-blur border-border">
          <CardHeader className="pb-2">
            <CardDescription>Approved Entries</CardDescription>
            <CardTitle className="text-2xl font-black text-emerald-500">{summary.approved}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-card/50 backdrop-blur border-border">
          <CardHeader className="pb-2">
            <CardDescription>Blocked Unpaid Clients</CardDescription>
            <CardTitle className="text-2xl font-black text-red-500">{summary.blockedUnpaid}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-card/50 backdrop-blur border-border">
          <CardHeader className="pb-2">
            <CardDescription>Total Income (Year)</CardDescription>
            <CardTitle className="text-2xl font-black text-yellow-500">PKR {summary.totalIncome.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="bg-card/50 backdrop-blur border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Activity className="w-4 h-4 text-primary" /> Access Decisions (Monthly)</CardTitle>
            <CardDescription>
              How many unpaid clients were blocked vs how many scans were approved.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={accessChartConfig} className="min-h-[300px] w-full">
              <BarChart accessibilityLayer data={accessData}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="approved" fill="var(--color-approved)" radius={4} />
                <Bar dataKey="blocked_unpaid" fill="var(--color-blocked_unpaid)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-border">
          <CardHeader>
             <CardTitle className="flex items-center gap-2"><Wallet className="w-4 h-4 text-primary" /> Income Trend (Monthly)</CardTitle>
             <CardDescription>Total income entries recorded in the financial ledger.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={incomeChartConfig} className="min-h-[300px] w-full">
              <BarChart accessibilityLayer data={incomeData}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => (
                        <span className="font-mono font-bold text-yellow-500">PKR {(Number(value) || 0).toLocaleString()}</span>
                      )}
                    />
                  }
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="income" fill="var(--color-income)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {loading && (
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Loading reporting data...</p>
      )}
    </div>
  );
}
