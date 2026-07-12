import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Wallet } from "lucide-react";

interface LedgerSummaryProps {
  income: number;
  expense: number;
  activeCategory: 'all' | 'income' | 'expense';
  onCategoryChange: (category: 'all' | 'income' | 'expense') => void;
}

export function LedgerSummaryCards({ income, expense, activeCategory, onCategoryChange }: LedgerSummaryProps) {
  const profit = income - expense;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card 
        onClick={() => onCategoryChange('income')}
        className={`cursor-pointer bg-card/40 backdrop-blur transition-all duration-300 border-2 
          ${activeCategory === 'income' ? 'border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.2)]' : 'border-transparent hover:border-emerald-500/30'}
        `}
      >
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Total Income</CardTitle>
          <TrendingUp className={`w-4 h-4 ${activeCategory === 'income' ? 'text-emerald-400' : 'text-emerald-500/50'}`} />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-black text-emerald-500">Rs. {income.toLocaleString()}</div>
          <p className="text-[10px] text-muted-foreground mt-1">Click to filter income entries</p>
        </CardContent>
      </Card>

      <Card 
        onClick={() => onCategoryChange('expense')}
        className={`cursor-pointer bg-card/40 backdrop-blur transition-all duration-300 border-2
          ${activeCategory === 'expense' ? 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.2)]' : 'border-transparent hover:border-red-500/30'}
        `}
      >
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Total Expense</CardTitle>
          <TrendingDown className={`w-4 h-4 ${activeCategory === 'expense' ? 'text-red-400' : 'text-red-500/50'}`} />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-black text-red-500">Rs. {expense.toLocaleString()}</div>
          <p className="text-[10px] text-muted-foreground mt-1">Click to filter expense entries</p>
        </CardContent>
      </Card>

      <Card 
        onClick={() => onCategoryChange('all')}
        className={`cursor-pointer bg-card/40 backdrop-blur transition-all duration-300 border-2
          ${activeCategory === 'all' ? 'border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.2)]' : 'border-transparent hover:border-blue-500/30'}
        `}
      >
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Net Profit</CardTitle>
          <Wallet className={`w-4 h-4 ${activeCategory === 'all' ? 'text-blue-400' : 'text-blue-500/50'}`} />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-black ${profit >= 0 ? 'text-blue-500' : 'text-orange-500'}`}>
            Rs. {profit.toLocaleString()}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">Click to show all transactions</p>
        </CardContent>
      </Card>
    </div>
  );
}
