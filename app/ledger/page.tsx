"use client";

import { useEffect, useState, useCallback } from "react";
import { dbService, supabase } from "@/lib/supabase";
import { LedgerSummaryCards } from "@/components/LedgerSummaryCards";
import { LedgerEntryForm } from "@/components/LedgerEntryForm";
import { LedgerList } from "@/components/LedgerList";
import { Button } from "@/components/ui/button";
import { Filter, Download } from "lucide-react";

type Timeframe = 'daily' | 'monthly' | 'yearly' | 'all';

export default function LedgerPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [timeframe, setTimeframe] = useState<Timeframe>('daily');
  const [activeCategory, setActiveCategory] = useState<'all' | 'income' | 'expense'>('all');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await dbService.getLedgerEntries(timeframe, selectedDate);
      setEntries(data || []);
    } catch (error) {
      console.error("Failed to fetch ledger entries:", error);
    } finally {
      setLoading(false);
    }
  }, [timeframe, selectedDate]);

  useEffect(() => {
    fetchData();

    // Subscribe to real-time changes on ledger_entries
    const channel = supabase
      ? supabase.channel('ledger_realtime')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'ledger_entries' }, () => {
            console.log("Realtime: ledger_entries changed, fetching data...");
            fetchData();
          })
          .subscribe()
      : null;

    return () => {
      if (channel) channel.unsubscribe();
    };
  }, [fetchData]);

  const totalIncome = entries
    .filter(e => e.type === 'income')
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const totalExpense = entries
    .filter(e => e.type === 'expense')
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const filteredEntries = entries.filter(e => {
    if (activeCategory === 'all') return true;
    return e.type === activeCategory;
  });

  const handleExport = () => {
    if (filteredEntries.length === 0) return;
    
    const headers = ["Date", "Type", "Category", "Description", "Amount (PKR)"];
    const csvRows = filteredEntries.map(e => [
      `"${new Date(e.date).toLocaleString("en-GB")}"`,
      `"${e.type.toUpperCase()}"`,
      `"${e.category}"`,
      `"${e.description || ""}"`,
      `"${e.amount}"`
    ].join(','));
    
    const blob = new Blob([[headers.join(','), ...csvRows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `iron_ledger_${activeCategory}_${timeframe}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-700 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-primary/5 via-background to-background">
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <header>
          <h1 className="text-4xl font-black tracking-tighter bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text text-transparent italic">
            FINANCIAL LEDGER
          </h1>
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-yellow-500/60 mt-1">Income, Expenses, and Profit Tracking</p>
        </header>

        <div className="flex flex-col items-end gap-3">
          <div className="flex flex-wrap items-center gap-2 bg-secondary/30 p-1.5 rounded-xl border border-border/40 backdrop-blur-sm">
            {(['daily', 'monthly', 'yearly', 'all'] as const).map((t) => (
              <Button
                key={t}
                variant={timeframe === t ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setTimeframe(t)}
                className={`text-[10px] font-black uppercase tracking-widest px-4 h-8 ${timeframe === t ? 'bg-primary shadow-lg shadow-primary/20' : ''}`}
              >
                {t === 'all' ? 'All Time' : t}
              </Button>
            ))}
          </div>

          {/* Timeframe Detail Selectors */}
          {timeframe !== 'all' && (
            <div className="flex items-center gap-2 animate-in slide-in-from-right-2">
              {timeframe === 'daily' && (
                <input 
                  type="date"
                  value={`${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`}
                  onChange={(e) => {
                    const [y, m, d] = e.target.value.split('-').map(Number);
                    setSelectedDate(new Date(y, m - 1, d));
                  }}
                  className="bg-secondary/20 border border-border/40 rounded-lg px-3 py-1 text-[10px] font-bold uppercase tracking-widest outline-none focus:ring-1 focus:ring-primary h-8"
                />
              )}
              {timeframe === 'monthly' && (
                <>
                  <select 
                    value={selectedDate.getMonth()}
                    onChange={(e) => {
                      const d = new Date(selectedDate);
                      d.setMonth(parseInt(e.target.value));
                      setSelectedDate(d);
                    }}
                    className="bg-secondary/20 border border-border/40 rounded-lg px-3 py-1 text-[10px] font-bold uppercase tracking-widest outline-none focus:ring-1 focus:ring-primary h-8"
                  >
                    {months.map((m, i) => <option key={m} value={i}>{m}</option>)}
                  </select>
                  <select 
                    value={selectedDate.getFullYear()}
                    onChange={(e) => {
                      const d = new Date(selectedDate);
                      d.setFullYear(parseInt(e.target.value));
                      setSelectedDate(d);
                    }}
                    className="bg-secondary/20 border border-border/40 rounded-lg px-3 py-1 text-[10px] font-bold uppercase tracking-widest outline-none focus:ring-1 focus:ring-primary h-8"
                  >
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </>
              )}
              {timeframe === 'yearly' && (
                <select 
                  value={selectedDate.getFullYear()}
                  onChange={(e) => {
                    const d = new Date(selectedDate);
                    d.setFullYear(parseInt(e.target.value));
                    setSelectedDate(d);
                  }}
                  className="bg-secondary/20 border border-border/40 rounded-lg px-3 py-1 text-[10px] font-bold uppercase tracking-widest outline-none focus:ring-1 focus:ring-primary h-8"
                >
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              )}
            </div>
          )}
        </div>
      </header>

      <LedgerSummaryCards 
        income={totalIncome} 
        expense={totalExpense} 
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <LedgerEntryForm 
            onEntryAdded={fetchData} 
            createEntry={dbService.createLedgerEntry} 
          />
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
              <Filter className="w-3 h-3 text-primary" /> {activeCategory.toUpperCase()} Transactions ({filteredEntries.length})
            </h2>
            <Button 
               onClick={handleExport}
               variant="outline" 
               size="sm" 
               className="h-8 text-[10px] font-black uppercase tracking-widest border-border/40 bg-card/50 hover:bg-secondary"
            >
              <Download className="w-3 h-3 mr-2" /> Export {activeCategory !== 'all' ? activeCategory : ''}
            </Button>
          </div>

          {loading ? (
            <div className="h-[400px] flex items-center justify-center bg-card/10 rounded-xl border border-dashed border-border/20">
              <div className="animate-pulse flex flex-col items-center gap-2">
                <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Syncing Ledger...</p>
              </div>
            </div>
          ) : (
            <LedgerList 
              entries={filteredEntries} 
              onDelete={async (id) => {
                await dbService.deleteLedgerEntry(id);
                fetchData();
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
