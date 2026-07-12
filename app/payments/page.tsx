"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { dbService, getMemberPaymentSnapshot } from "@/lib/supabase";
import { memberCache } from "@/lib/member-cache";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Banknote, Dumbbell, PlusCircle, Search, Download } from "lucide-react";

export default function PaymentsPage() {
  const cacheVersion = useSyncExternalStore(
    memberCache.subscribe,
    memberCache.getSnapshot,
    () => 0
  );

  const members = (memberCache.getAllMembers() || []).filter((m: any) => m.package_type !== 'Employee');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const selectedMember = useMemo(() => 
    selectedMemberId ? (memberCache.getMemberById(selectedMemberId)) : null
  , [selectedMemberId, cacheVersion]);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    memberCache.initialize();
  }, []);

  const handleAddPayment = async (e: React.FormEvent) => {
     e.preventDefault();
     if(!selectedMember || !paymentAmount || isSubmitting) return;
     
     setIsSubmitting(true);
     try {
       await dbService.updateMemberPayment(selectedMember.id, Number(paymentAmount), paymentDate);
       setPaymentAmount("");
       setPaymentDate(new Date().toISOString().split('T')[0]);
       setSelectedMemberId(null);
     } catch (err: any) {
       console.error(err);
       alert("CRITICAL ERROR: Failed to record payment. Ensure your database tables are set up correctly.");
     } finally {
       setIsSubmitting(false);
     }
  };

  const handleExportCSV = () => {
    const filteredMembers = members.filter(member => 
      member.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (filteredMembers.length === 0) return;

    // CSV Headers
    const headers = [
      "Member Name",
      "Membership Fee",
      "Trainer Fees",
      "Total Paid",
      "Balance/Remaining",
      "Last Payment Date"
    ];

    // CSV Rows
    const rows = filteredMembers.map(member => {
      const snapshot = getMemberPaymentSnapshot(member);
      const balance = snapshot.cycleDue > 0 ? `-${snapshot.cycleDue}` : snapshot.remainingBalance;
      const lastPayment = member.payment_date 
        ? new Date(member.payment_date).toLocaleDateString("en-GB") 
        : "N/A";

      return [
        `"${member.name}"`,
        snapshot.recurringGymFees,
        snapshot.recurringTrainerFees,
        snapshot.totalPaid,
        balance,
        lastPayment
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Iron_Ledger_Payments_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500 relative">
      <header className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-yellow-500 p-2 rounded-lg rotate-12 shadow-[0_0_20px_rgba(234,179,8,0.4)]">
            <Dumbbell className="w-8 h-8 text-black" />
          </div>
          <div className="flex flex-col">
             <h1 className="text-4xl font-[1000] tracking-tighter italic leading-none flex items-center">
               <span className="text-white">WORK</span><span className="text-yellow-500">OUT</span>
               <span className="text-yellow-500 text-xs font-bold tracking-wider ml-2 bg-yellow-500/10 px-1.5 py-0.5 rounded border border-yellow-500/20">CH. 2</span>
               <span className="mx-3 text-muted-foreground/30 font-light not-italic">|</span>
               <span className="text-white/40 text-2xl uppercase tracking-tighter">Finance</span>
             </h1>
            <p className="text-[10px] font-black uppercase tracking-[0.5em] text-yellow-500/60 mt-1">Real-time Financial Disbursement Ledger</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-8">
        <Card className="bg-card/50 backdrop-blur border-border">
          <CardHeader>
             <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <div>
                   <CardTitle>Financial Overview</CardTitle>
                   <CardDescription>Live payment tracker reflecting combined membership and trainer fees.</CardDescription>
                </div>
                 <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative w-full md:w-72">
                       <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                          <Search className="h-4 w-4 text-muted-foreground" />
                       </div>
                       <Input 
                          placeholder="Search member name..." 
                          className="pl-9 h-9" 
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                       />
                    </div>
                    <Button 
                       variant="outline" 
                       size="sm" 
                       onClick={handleExportCSV}
                       className="h-9 gap-2 border-emerald-500/50 text-emerald-500 hover:bg-emerald-500/10"
                    >
                       <Download className="w-4 h-4" />
                       <span className="hidden sm:inline">Export CSV</span>
                    </Button>
                 </div>
             </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-border overflow-x-auto">
               <Table>
                 <TableHeader>
                   <TableRow className="border-border">
                     <TableHead>Member Name</TableHead>
                               <TableHead>Membership Fee</TableHead>
                     <TableHead>Trainer Fees</TableHead>
                               <TableHead>Cycle Paid</TableHead>
                     <TableHead>Balance Remaining</TableHead>
                     <TableHead>Last Payment</TableHead>
                     <TableHead className="text-right">Actions</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {members.filter(member => member.name.toLowerCase().includes(searchQuery.toLowerCase())).map(member => {
                                 const paymentSnapshot = getMemberPaymentSnapshot(member);
                                 const trainer = paymentSnapshot.recurringTrainerFees;
                                 const gym = paymentSnapshot.recurringGymFees;
                                 // currentCyclePaid resets to 0 at the start of each billing period
                                 const paid = paymentSnapshot.currentCyclePaid;
                                 const due = paymentSnapshot.cycleDue;
                                 const remaining = paymentSnapshot.remainingBalance;
                      
                      return (
                       <TableRow key={member.id} className="border-border">
                          <TableCell className="font-semibold">{member.name}</TableCell>
                          <TableCell>PKR {gym}</TableCell>
                          <TableCell>PKR {trainer}</TableCell>
                          <TableCell className="text-emerald-500 font-medium">PKR {paid}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${due > 0 ? 'bg-orange-500/20 text-orange-500' : 'bg-emerald-500/20 text-emerald-500'}`}>
                                              PKR {due > 0 ? `-${due}` : remaining}
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                             {member.payment_date 
                               ? new Date(member.payment_date).toLocaleDateString("en-GB") 
                               : 'No payments'}
                          </TableCell>
                          <TableCell className="text-right">
                             <Button onClick={() => setSelectedMemberId(member.id)} variant="outline" size="sm" className="gap-2">
                                <PlusCircle className="w-4 h-4"/> Collect Cash
                             </Button>
                          </TableCell>
                       </TableRow>
                      );
                   })}
                   {members.filter(m => m.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">No financial data found.</TableCell>
                      </TableRow>
                   )}
                 </TableBody>
               </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {selectedMember && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
             <Card className="w-full max-w-md shadow-2xl border-border">
                <CardHeader>
                   <CardTitle className="flex items-center gap-2"><Banknote className="text-emerald-500" /> Collect Cash</CardTitle>
                   <CardDescription>Logging new payment for {selectedMember.name}</CardDescription>
                </CardHeader>
                <CardContent>
                   <form onSubmit={handleAddPayment} className="space-y-4">
                      {(() => {
                         const paymentSnapshot = getMemberPaymentSnapshot(selectedMember);
                         return (
                           <div className="bg-muted/50 p-4 rounded-md space-y-2 mb-4 text-sm">
                              <div className="flex justify-between items-center">
                                 <span className="text-muted-foreground">Current Balance:</span>
                                 <span className="font-bold text-orange-500">PKR {paymentSnapshot.cycleDue}</span>
                              </div>
                              {paymentSnapshot.cycleDue > 0 && (
                                 <p className="text-[10px] uppercase tracking-wider font-bold text-orange-500">
                                    Member has outstanding dues for the current cycle.
                                 </p>
                              )}
                           </div>
                         );
                      })()}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Cash Received</label>
                            <input 
                                type="number" 
                                autoFocus
                                required
                                value={paymentAmount}
                                onChange={(e) => setPaymentAmount(e.target.value)}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                placeholder="e.g. 50"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Payment Date</label>
                            <input 
                                type="date" 
                                required
                                value={paymentDate}
                                onChange={(e) => setPaymentDate(e.target.value)}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                            />
                        </div>
                      </div>
                      <div className="flex items-center gap-3 pt-6 border-t border-border/20">
                         <Button type="button" variant="ghost" className="flex-1 font-black text-[10px] uppercase tracking-widest hover:bg-red-500/10 hover:text-red-500" onClick={() => setSelectedMemberId(null)}>
                            Discard
                         </Button>
                         <Button type="submit" disabled={isSubmitting} className="flex-1 h-11 bg-primary hover:bg-primary/80 text-black font-black italic uppercase tracking-tighter shadow-[0_10px_30px_-10px_rgba(234,179,8,0.5)] transition-all">
                            {isSubmitting ? 'PROCESSING...' : 'CONFIRM DEPOSIT'}
                         </Button>
                      </div>
                   </form>
                </CardContent>
             </Card>
          </div>
      )}
    </div>
  );
}
