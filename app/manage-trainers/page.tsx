"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState, Fragment, useMemo, useSyncExternalStore } from "react";
import { dbService, getMemberPaymentSnapshot } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Wallet, Users, Phone, Trash2, Download } from "lucide-react";
import { memberCache } from "@/lib/member-cache";

export default function ManageTrainersPage() {
  const cacheVersion = useSyncExternalStore(
    memberCache.subscribe,
    memberCache.getSnapshot,
    () => 0
  );

  const [expandedTrainerId, setExpandedTrainerId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: "", phone: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derived reactive data from cache
  const { trainers, members } = useMemo(() => {
    const rawTrainers = memberCache.getAllTrainers();
    const rawMembers = memberCache.getAllMembers().filter((m: any) => m.package_type !== 'Employee');

    const trainerStats = rawTrainers.map(t => {
      const portfolio = rawMembers.filter(m => m.trainer_name === t.name);

      return {
         ...t,
         clientCount: portfolio.length,
      };
    });

    return { trainers: trainerStats, members: rawMembers };
  }, [cacheVersion]);

  // Initial initialization
  useEffect(() => {
    memberCache.initialize();
  }, []);

  const handleAddTrainer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await dbService.createTrainer(formData);
      setFormData({ name: "", phone: "" });
    } catch (err: any) {
      setError(err.message || "Failed to add trainer.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTrainer = async (trainer: any) => {
    const hasClients = trainer.clientCount > 0;
    const msg = hasClients 
      ? `WARNING: ${trainer.name} has ${trainer.clientCount} active clients. Deleting them will NOT unassign the clients, but the trainer will no longer appear in stats. Continue?`
      : `Are you sure you want to remove ${trainer.name} from the staff?`;

    if (!window.confirm(msg)) return;

    try {
      await dbService.deleteTrainer(trainer.id);
    } catch (err: any) {
      alert("Failed to delete trainer: " + err.message);
    }
  };

  const handleExportTrainer = (trainer: any) => {
    const assignedMembers = members.filter((m: any) => m.trainer_name === trainer.name);
    if (assignedMembers.length === 0) {
      alert("This trainer has no assigned clients to export.");
      return;
    }

    const headers = ["Member Name", "Phone", "Last Payment", "Trainer Fee", "Payment Status"];
    const csvRows = assignedMembers.map(m => {
      const snapshot = getMemberPaymentSnapshot(m);
      const lastPayment = m.payment_date ? new Date(m.payment_date).toLocaleDateString("en-GB") : 'N/A';
      const status = snapshot.isDue ? "Due" : "Paid";
      return [
        `"${m.name}"`, `"${m.phone || ''}"`, `"${lastPayment}"`, `"${snapshot.recurringTrainerFees}"`, `"${status}"`
      ].join(',');
    });

    const blob = new Blob([[headers.join(','), ...csvRows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${trainer.name.replace(/\s+/g, '_')}_Clients_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
      {/* ... header code ... */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
           <h1 className="text-4xl font-black tracking-tighter bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text text-transparent italic">
             TRAINERS PAYROLL
           </h1>
           <p className="text-xs font-bold uppercase tracking-[0.3em] text-yellow-500/60 mt-1">Hire trainers and manage their active client portfolios</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Hiring Form */}
        <div className="lg:col-span-1">
           <Card className="bg-card/50 backdrop-blur border-border sticky top-8">
              <CardHeader>
                 <CardTitle className="flex items-center gap-2"><UserPlus className="text-emerald-500 w-5 h-5" /> Hire New Trainer</CardTitle>
                 <CardDescription>Enter trainer details to add them to your official staff list.</CardDescription>
              </CardHeader>
              <CardContent>
                 <form onSubmit={handleAddTrainer} className="space-y-4">
                    <div className="space-y-2">
                       <Label htmlFor="name">Trainer Full Name</Label>
                       <Input id="name" placeholder="e.g. Alex Costa" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                    </div>
                    <div className="space-y-2">
                       <Label htmlFor="phone">Phone Number</Label>
                       <div className="relative">
                          <Phone className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                          <Input id="phone" className="pl-9" placeholder="03xx xxxxxxx" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                       </div>
                    </div>
                    {error && (
                       <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-md mb-4">
                          <p className="text-xs text-red-500 font-medium">{error}</p>
                       </div>
                    )}
                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                       {isSubmitting ? "Hiring..." : "Add to Staff"}
                    </Button>
                 </form>
              </CardContent>
           </Card>
        </div>

        {/* Trainers List & Salary */}
        <div className="lg:col-span-2">
           <Card className="bg-card/50 backdrop-blur border-border">
              <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Users className="text-emerald-500 w-5 h-5" /> Professional Portfolios</CardTitle>
                  <CardDescription>Manage assigned clients and export trainer performance reports.</CardDescription>
              </CardHeader>
              <CardContent>
                 <div className="rounded-md border border-border overflow-x-auto">
                    <Table>
                       <TableHeader>
                          <TableRow className="border-border">
                             <TableHead>Trainer Name</TableHead>
                             <TableHead>Contact</TableHead>
                             <TableHead className="text-center">Clients</TableHead>
                             <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                       </TableHeader>
                       <TableBody>
                          {trainers.map(trainer => {
                             const assignedMembers = members.filter((m: any) => m.trainer_name === trainer.name);
                             const isExpanded = expandedTrainerId === trainer.id;

                             return (
                               <Fragment key={trainer.id}>
                                 <TableRow className="border-border">
                                    <TableCell className="font-semibold">{trainer.name}</TableCell>
                                    <TableCell className="text-muted-foreground text-sm">{trainer.phone || "---"}</TableCell>
                                    <TableCell className="text-center">
                                       <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          className="h-7 px-2 text-[10px] uppercase tracking-wider"
                                          onClick={() => setExpandedTrainerId(isExpanded ? null : trainer.id)}
                                       >
                                          <Users className="w-3 h-3 mr-1" />
                                          {assignedMembers.length} Clients
                                       </Button>
                                    </TableCell>
                                    <TableCell className="text-right space-x-2">
                                       <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10"
                                          title="Export Client Portfolio"
                                          onClick={() => handleExportTrainer(trainer)}
                                       >
                                          <Download className="w-4 h-4" />
                                       </Button>
                                       <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                                          title="Delete Trainer"
                                          onClick={() => handleDeleteTrainer(trainer)}
                                       >
                                          <Trash2 className="w-4 h-4" />
                                       </Button>
                                    </TableCell>
                                 </TableRow>

                                 {isExpanded && (
                                   <TableRow className="border-border/60 bg-secondary/10">
                                      <TableCell colSpan={4} className="py-4 px-6">
                                         {assignedMembers.length === 0 ? (
                                           <p className="text-xs text-muted-foreground italic">No members currently assigned to this trainer.</p>
                                         ) : (
                                           <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                              {assignedMembers.map((member: any) => {
                                                const snapshot = getMemberPaymentSnapshot(member);
                                                return (
                                                  <div key={member.id} className="group relative rounded-xl border border-border/60 bg-background/40 p-3 transition-all hover:bg-background/60 overflow-hidden">
                                                     <div className="flex justify-between items-start gap-4">
                                                        <div className="space-y-1 flex-1 min-w-0">
                                                           <p className="text-sm font-bold leading-none truncate" title={member.name}>{member.name}</p>
                                                           <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium truncate">
                                                              {member.phone || 'No phone recorded'}
                                                           </p>
                                                           <div className="flex items-center gap-1.5 mt-2">
                                                              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${snapshot.isDue ? 'bg-red-500' : 'bg-emerald-500'}`} />
                                                              <p className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground truncate">
                                                                Last Payment: <span className="text-foreground">{member.payment_date ? new Date(member.payment_date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : 'N/A'}</span>
                                                              </p>
                                                           </div>
                                                        </div>
                                                        <div className="text-right shrink-0">
                                                           <p className="text-sm font-mono font-black text-emerald-500 whitespace-nowrap">
                                                              PKR {snapshot.recurringTrainerFees}
                                                           </p>
                                                           <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">Trainer Fee</p>
                                                        </div>
                                                     </div>
                                                  </div>
                                                );
                                              })}
                                           </div>
                                         )}
                                      </TableCell>
                                   </TableRow>
                                 )}
                                 </Fragment>
                             );
                          })}
                          {trainers.length === 0 && (
                             <TableRow>
                                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground italic">No trainers hired yet.</TableCell>
                             </TableRow>
                          )}
                       </TableBody>
                    </Table>
                 </div>
              </CardContent>
           </Card>
        </div>
      </div>
    </div>
  );
}
