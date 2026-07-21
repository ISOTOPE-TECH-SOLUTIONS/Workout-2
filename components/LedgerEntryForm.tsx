"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, MinusCircle } from "lucide-react";

interface LedgerEntryFormProps {
  onEntryAdded: () => void;
  createEntry: (payload: any) => Promise<void>;
}

export function LedgerEntryForm({ onEntryAdded, createEntry }: LedgerEntryFormProps) {
  const [type, setType] = useState<'income' | 'expense'>('income');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !category || loading) return;

    setLoading(true);
    setSuccess(false);
    try {
      // Build a local-timezone ISO string for the selected date so it is stored
      // on the correct calendar date regardless of the user's UTC offset.
      // e.g. PKT (UTC+5): new Date().toISOString() returns UTC time which would
      // shift the stored date by 5 hours and land on the wrong day in Supabase.
      const buildLocalIso = (dateStr: string): string => {
        const [y, m, d] = dateStr.split('-').map(Number);
        const now = new Date();
        const local = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
        const offsetMinutes = -local.getTimezoneOffset();
        const sign = offsetMinutes >= 0 ? '+' : '-';
        const absOffset = Math.abs(offsetMinutes);
        const oh = String(Math.floor(absOffset / 60)).padStart(2, '0');
        const om = String(absOffset % 60).padStart(2, '0');
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${y}-${pad(m)}-${pad(d)}T${pad(local.getHours())}:${pad(local.getMinutes())}:${pad(local.getSeconds())}${sign}${oh}:${om}`;
      };
      const ledgerTimestamp = buildLocalIso(date);

      await createEntry({
        type,
        amount: parseFloat(amount),
        category,
        description,
        date: ledgerTimestamp,
      });
      setAmount('');
      setCategory('');
      setDescription('');
      setDate(new Date().toISOString().split('T')[0]); // Reset to default
      setSuccess(true);
      onEntryAdded();
      
      // Auto-hide success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (error: any) {
      console.error("Failed to add entry:", error);
      const errorMsg = error.message || "Unknown database error";
      alert(`Database Error: ${errorMsg}\n\nTip: If you haven't created the 'ledger_entries' table yet, please run the SQL script I provided.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-card/50 backdrop-blur border-border h-full">
      <CardHeader>
        <CardTitle className="text-xl font-black italic tracking-tight">Add Transaction</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex p-1 bg-secondary rounded-lg">
            <button
              type="button"
              onClick={() => setType('income')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${
                type === 'income' ? 'bg-emerald-500 text-white shadow-lg' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <PlusCircle className="w-3 h-3" /> Income
            </button>
            <button
              type="button"
              onClick={() => setType('expense')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${
                type === 'expense' ? 'bg-red-500 text-white shadow-lg' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <MinusCircle className="w-3 h-3" /> Expense
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Amount (Rs.)</Label>
              <Input
                id="amount"
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-background/50 border-border/40 focus:border-primary/50"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Transaction Date</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-background/50 border-border/40 focus:border-primary/50"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Category</Label>
            <Input
              id="category"
              placeholder="e.g. Membership, Rent, Electricity"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="bg-background/50 border-border/40 focus:border-primary/50"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Description (Optional)</Label>
            <Input
              id="description"
              placeholder="Details about this transaction..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-background/50 border-border/40 focus:border-primary/50"
            />
          </div>

          <Button 
            type="submit" 
            className={`w-full font-black uppercase tracking-widest h-12 shadow-lg transition-all active:scale-95 ${
              type === 'income' 
                ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20' 
                : 'bg-red-600 hover:bg-red-500 shadow-red-500/20'
            }`}
            disabled={loading}
          >
            {loading ? 'Recording...' : success ? 'Successfully Added!' : `Add ${type}`}
          </Button>

          {success && (
            <p className="text-center text-[10px] font-bold text-emerald-500 animate-bounce">
              Transaction has been recorded successfully!
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
