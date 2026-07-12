import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { ArrowUpRight, ArrowDownRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LedgerListProps {
  entries: any[];
  onDelete?: (id: string) => Promise<void>;
}

export function LedgerList({ entries, onDelete }: LedgerListProps) {
  const handleDelete = async (id: string) => {
    const password = window.prompt("Enter Admin Password to DELETE this entry:");
    if (password === "Hard!!3s") {
      if (onDelete) {
        await onDelete(id);
      }
    } else if (password !== null) {
      alert("Incorrect password. Access denied.");
    }
  };

  if (entries.length === 0) {
    return (
      <div className="text-center py-12 bg-card/20 rounded-xl border border-dashed border-border/40">
        <p className="text-muted-foreground font-medium">No transactions found for this period.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/40 bg-card/30 backdrop-blur overflow-hidden">
      <Table>
        <TableHeader className="bg-secondary/30">
          <TableRow className="hover:bg-transparent border-border/40">
            <TableHead className="text-[10px] font-black uppercase tracking-widest">Type</TableHead>
            <TableHead className="text-[10px] font-black uppercase tracking-widest">Date</TableHead>
            <TableHead className="text-[10px] font-black uppercase tracking-widest">Category</TableHead>
            <TableHead className="text-[10px] font-black uppercase tracking-widest">Description</TableHead>
            <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Amount</TableHead>
            <TableHead className="text-[10px] font-black uppercase tracking-widest text-center w-[50px]">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={entry.id} className="hover:bg-secondary/20 border-border/20 transition-colors">
              <TableCell>
                <div className={`flex items-center gap-1.5 font-bold text-[11px] uppercase tracking-wider ${
                  entry.type === 'income' ? 'text-emerald-500' : 'text-red-500'
                }`}>
                  {entry.type === 'income' ? (
                    <ArrowUpRight className="w-3 h-3" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3" />
                  )}
                  {entry.type}
                </div>
              </TableCell>
              <TableCell className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                {format(new Date(entry.date), "MMM d, yyyy • h:mm a")}
              </TableCell>
              <TableCell className="text-xs font-bold text-foreground/80">
                {entry.category}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                {entry.description || "—"}
              </TableCell>
              <TableCell className={`text-right font-black ${
                entry.type === 'income' ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {entry.type === 'income' ? '+' : '-'}Rs. {Number(entry.amount).toLocaleString()}
              </TableCell>
              <TableCell>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => handleDelete(entry.id)}
                  className="h-8 w-8 text-muted-foreground/50 hover:text-red-500 hover:bg-red-500/10 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
