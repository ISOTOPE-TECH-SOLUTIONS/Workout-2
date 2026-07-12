"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { dbService, getMemberPaymentSnapshot } from "@/lib/supabase";
import { memberCache } from "@/lib/member-cache";
import { hardwareApi } from "@/lib/hardware-api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Activity, CheckCircle2, Download, Dumbbell, Pencil, Trash2, UserCog } from "lucide-react";

const toDisplaySerial = (value: number) => String(Math.max(1, value)).padStart(3, "0");

export default function MembersDirectoryPage() {
  const cacheVersion = useSyncExternalStore(
    memberCache.subscribe,
    memberCache.getSnapshot,
    () => 0
  );

  const members = useMemo(() => memberCache.getAllMembers(), [cacheVersion]);
  const trainers = useMemo(() => memberCache.getAllTrainers(), [cacheVersion]);
  const packages = useMemo(() => dbService.getCachedPackages() || [], [cacheVersion]);
  const addons = useMemo(() => dbService.getCachedAddons() || [], [cacheVersion]);
  const ptPackages = useMemo(() => dbService.getCachedPTPackages() || [], [cacheVersion]);
   const [searchQuery, setSearchQuery] = useState("");
   const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
   const editingMember = useMemo(() => 
     editingMemberId ? (memberCache.getMemberById(editingMemberId)) : null
   , [editingMemberId, cacheVersion]);
    const [packageDraft, setPackageDraft] = useState({
       package_type: "Basic",
       trainer_package_type: "none",
       has_cardio: false,
       trainer_commission: "0",
       reset_start_date: false,
    });
   const [isSavingPackage, setIsSavingPackage] = useState(false);
   const [paymentGateInfo, setPaymentGateInfo] = useState<{
      isOpen: boolean;
      oldTotalRequired: number;
      newTotalRequired: number;
      upgradeCost: number;
      outstandingBalance: number;
      totalDueToday: number;
      paymentInput: string;
      creditApplied: number;
      newCycleCost: number;
   } | null>(null);

     const membersWithResolvedSerials = useMemo(() => {
        const usedSerials = new Set<string>();
        let nextSerial = 1;

        return members.map((member) => {
           const rawSerial = String(member.serial_number || "").trim();
           const parsedSerial = /^\d+$/.test(rawSerial) ? Number.parseInt(rawSerial, 10) : null;
           const canonicalSerial = parsedSerial && parsedSerial > 0 ? toDisplaySerial(parsedSerial) : null;

           if (canonicalSerial && !usedSerials.has(canonicalSerial)) {
              usedSerials.add(canonicalSerial);
              if (parsedSerial !== null && parsedSerial >= nextSerial) {
                 nextSerial = parsedSerial + 1;
              }
              return { ...member, resolved_serial_number: canonicalSerial };
           }

           while (usedSerials.has(toDisplaySerial(nextSerial))) {
              nextSerial += 1;
           }

           const fallbackSerial = toDisplaySerial(nextSerial);
           usedSerials.add(fallbackSerial);
           nextSerial += 1;

           return { ...member, resolved_serial_number: fallbackSerial };
        });
     }, [members]);

  useEffect(() => {
    memberCache.initialize();
  }, []);

  const handleRemoveMember = async (member: any) => {
     if (!window.confirm(`Are you sure you want to completely remove ${member.name} from the registry? This will also delete scanner data from the device.`)) {
        return;
     }

     const scannerId = String(member.zk_id || "").trim();

     try {
        if (scannerId) {
           // Try hardware deletion first if a scanner ID exists
           try {
              const deletePayload: { uid?: number; user_id?: string } = {};
              if (/^\d+$/.test(scannerId)) {
                deletePayload.uid = Number.parseInt(scannerId, 10);
                deletePayload.user_id = scannerId;
              } else {
                deletePayload.user_id = scannerId;
              }
              await hardwareApi.deleteUser(deletePayload);
           } catch (hwError: any) {
              console.warn("Hardware deletion failed:", hwError);
              const errMsg = hwError?.message || "Device unreachable or user missing.";
              
              const forceDelete = window.confirm(
                 `Scanner Sync Issue: ${errMsg}\n\nThe system could not confirm deletion from the physical scanner. If the user is already removed from the device or the device is offline, you can still delete them from the database.\n\nProceed to delete from database anyway?`
              );
              
              if (!forceDelete) {
                 return; // Abort if they don't want to proceed
              }
           }
        } else {
           // No scanner ID assigned
           const proceedDbOnly = window.confirm(
              "This member does not have a ZKTeco Device ID assigned. They will only be deleted from the database.\n\nProceed?"
           );
           if (!proceedDbOnly) return;
        }

        // Proceed to delete from database
        await dbService.deleteMember(member.id);
     } catch (error: any) {
        console.error("Database deletion failed", error);
        alert(`Failed to delete member from database: ${error?.message || "Unknown error"}`);
     }
  };

  const handleAssignTrainer = async (memberId: string, trainerName: string) => {
     await dbService.assignTrainerToMember(memberId, trainerName);
  };

  const handleUpdateZkId = async (memberId: string, zkId: string) => {
     await dbService.updateMemberZkId(memberId, zkId);
  };

    const openPackageEditor = (member: any) => {
       setEditingMemberId(member.id);
       const isCardioOnlyPackage = String(member.package_type || '').toLowerCase() === 'cardio only';
       setPackageDraft({
          package_type: member.package_type || "Basic",
          trainer_package_type: member.trainer_package_type || "none",
          has_cardio: isCardioOnlyPackage ? false : !!member.has_cardio,
          trainer_commission: String(member.trainer_commission || 0),
          reset_start_date: false,
       });
    };

    const handleSavePackage = async () => {
       if (!editingMember) return;
       setIsSavingPackage(true);
       try {
          const isCardioOnlyPackage = packageDraft.package_type === 'Cardio Only';
          const payload = {
             package_type: packageDraft.package_type,
             trainer_package_type: packageDraft.trainer_package_type,
             has_cardio: isCardioOnlyPackage ? false : packageDraft.has_cardio,
             trainer_commission: Number(packageDraft.trainer_commission) || 0,
             reset_start_date: !!packageDraft.reset_start_date,
             amount_paid: paymentGateInfo?.isOpen ? (Number(paymentGateInfo.paymentInput) || 0) : undefined,
          };

          if (!paymentGateInfo?.isOpen) {
              const oldSnapshot = getMemberPaymentSnapshot(editingMember);
              const simulationResult = dbService.simulatePackageUpdate(editingMember, payload);
              const newSnapshot = simulationResult.snapshot;

              const upgradeCost = newSnapshot.totalRequired - oldSnapshot.totalRequired;
              
              const rawTotalDue = newSnapshot.totalRequired - oldSnapshot.totalPaid;
              const totalDueToday = rawTotalDue > 0 ? rawTotalDue : 0;
              const overpaidBalance = oldSnapshot.cycleDue < 0 ? Math.abs(oldSnapshot.cycleDue) : 0;
              const outstandingBalance = oldSnapshot.cycleDue > 0 ? oldSnapshot.cycleDue : 0;

              const isPackageChanged = 
                 payload.package_type !== editingMember.package_type ||
                 payload.trainer_package_type !== editingMember.trainer_package_type ||
                 payload.has_cardio !== editingMember.has_cardio ||
                 payload.trainer_commission !== editingMember.trainer_commission ||
                 payload.reset_start_date;

             if (isPackageChanged) {
                 setPaymentGateInfo({
                     isOpen: true,
                     oldTotalRequired: oldSnapshot.totalRequired,
                     newTotalRequired: newSnapshot.totalRequired,
                     upgradeCost: upgradeCost,
                     outstandingBalance: outstandingBalance,
                     totalDueToday: totalDueToday,
                     paymentInput: String(totalDueToday),
                     creditApplied: simulationResult.metrics.creditApplied,
                     newCycleCost: simulationResult.metrics.newCycleCost
                 });
                 setIsSavingPackage(false);
                 return;
             }
         }

          if (paymentGateInfo?.isOpen) {
             const paymentAmount = Number(paymentGateInfo.paymentInput) || 0;
             if (paymentAmount > 0 && !payload.reset_start_date) {
                await dbService.updateMemberPayment(editingMember.id, paymentAmount);
             }
          }

         await dbService.updateMemberPackage(editingMember.id, payload);
         setEditingMemberId(null);
         setPaymentGateInfo(null);
      } catch (error: any) {
         console.error(error);
         alert(error?.message || "Failed to update package details.");
      } finally {
         setIsSavingPackage(false);
      }
   };

  const exportMembersToCSV = () => {
      if (membersWithResolvedSerials.length === 0) return;
    
    const headers = [
      "Serial Number", "Member Name", "Phone", "Gender", "Trainer", "Gym Fees", "Trainer Fees", "Paid", "Balance", "Start Date"
    ];
    
      const csvRows = membersWithResolvedSerials.map(m => {
            const paymentSnapshot = getMemberPaymentSnapshot(m);
            const gym = paymentSnapshot.recurringGymFees;
            const trainer = paymentSnapshot.recurringTrainerFees;
            const paid = paymentSnapshot.totalPaid;
            const balance = paymentSnapshot.cycleDue;

        return [
               `"${m.resolved_serial_number}"`, `"${m.name}"`, `"${m.phone}"`, `"${m.gender}"`, `"${m.trainer_name}"`, `"${gym}"`, `"${trainer}"`, `"${paid}"`, `"${balance}"`, `"${m.package_start_date ? new Date(m.package_start_date).toLocaleDateString("en-GB") : '---'}"`
        ].join(',');
    });
    
    const blob = new Blob([[headers.join(','), ...csvRows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `members_directory_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

   const normalizedQuery = searchQuery.trim().toLowerCase();
   const filteredMembers = membersWithResolvedSerials.filter((member) => {
      if (!normalizedQuery) return true;

      return [
         member.resolved_serial_number,
         member.name,
         member.phone,
         member.gender,
         member.trainer_name,
         member.zk_id,
      ].some((field) => String(field || "").toLowerCase().includes(normalizedQuery));
   });

   const isCardioOnlyDraft = packageDraft.package_type === 'Cardio Only';

  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-yellow-500 p-2 rounded-lg rotate-12 shadow-[0_0_20px_rgba(234,179,8,0.4)]">
            <Dumbbell className="w-8 h-8 text-black" />
          </div>
          <div className="flex flex-col">
             <h1 className="text-4xl font-[1000] tracking-tighter italic leading-none flex items-center">
               <span className="text-white">WORK</span><span className="text-yellow-500">OUT</span>
               <span className="text-yellow-500 text-xs font-bold tracking-wider ml-2 bg-yellow-500/10 px-1.5 py-0.5 rounded border border-yellow-500/20">CH. 2</span>
               <span className="mx-3 text-muted-foreground/30 font-light not-italic">|</span>
               <span className="text-white/40 text-2xl uppercase tracking-tighter">Directory</span>
             </h1>
            <p className="text-[10px] font-black uppercase tracking-[0.5em] text-yellow-500/60 mt-1">Personnel & Enrollment Management</p>
          </div>
        </div>
        <Button onClick={exportMembersToCSV} variant="outline" className="gap-2">
           <Download className="w-4 h-4" /> Export Directory (CSV)
        </Button>
      </header>

      <div className="grid grid-cols-1 gap-8">
        <Card className="bg-card/50 backdrop-blur border-border">
          <CardHeader>
             <CardTitle className="flex items-center gap-2"><UserCog className="w-5 h-5 text-emerald-500" /> Active Members Portfolio</CardTitle>
             <CardDescription>Assign or reassign hired trainers to manage member physical progress.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
               <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, phone, serial, trainer, or scanner ID"
                  className="w-full md:max-w-md"
               />
               <p className="text-xs text-muted-foreground">
                  Showing {filteredMembers.length} of {members.length} members
               </p>
            </div>
            <div className="rounded-md border border-border overflow-x-auto">
               <Table>
                 <TableHeader>
                   <TableRow className="border-border">
                     <TableHead>Serial No.</TableHead>
                     <TableHead>Member Name</TableHead>
                     <TableHead>Gender</TableHead>
                     <TableHead>Assigned Trainer</TableHead>
                     <TableHead>ZKTeco Device ID</TableHead>
                     <TableHead className="text-right">Actions</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                            {filteredMembers.map(member => (
                      <TableRow key={member.id} className="border-border">
                         <TableCell className="font-mono text-muted-foreground">{member.resolved_serial_number || '---'}</TableCell>
                         <TableCell className="font-medium">{member.name}</TableCell>
                         <TableCell className="text-sm">{member.gender || '---'}</TableCell>
                         <TableCell>
                            {!member.trainer_package_type || member.trainer_package_type.toLowerCase() === 'none' ? (
                               <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest bg-muted/50 px-2 py-1 rounded-md">Requires Package</span>
                            ) : (
                               <select 
                                  className="bg-background border border-border rounded px-2 py-1 text-xs focus:ring-1 focus:ring-emerald-500 outline-none w-full"
                                  value={member.trainer_name || "Unassigned"} 
                                  onChange={(e) => handleAssignTrainer(member.id, e.target.value)}
                               >
                                  <option value="Unassigned">Unassigned</option>
                                  {trainers.map(t => (
                                     <option key={t.id} value={t.name}>{t.name}</option>
                                  ))}
                               </select>
                            )}
                         </TableCell>
                         <TableCell>
                            <input 
                               type="text"
                               className="bg-background border border-border rounded px-2 py-1 text-xs w-20 focus:ring-1 focus:ring-emerald-500 outline-none"
                               placeholder="Device ID"
                               value={member.zk_id || ""}
                               onChange={(e) => memberCache.upsertMember({ id: member.id, zk_id: e.target.value })}
                               onBlur={(e) => handleUpdateZkId(member.id, (e.target as HTMLInputElement).value)}
                            />
                         </TableCell>
                         <TableCell className="text-right">
                                          {member.package_type !== 'Employee' && (
                                             <Button
                                                onClick={() => openPackageEditor(member)}
                                                variant="ghost"
                                                size="sm"
                                                className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                                             >
                                                <Pencil className="w-4 h-4" />
                                             </Button>
                                          )}
                            <Button onClick={() => handleRemoveMember(member)} variant="ghost" size="sm" className="text-red-500 hover:text-red-400 hover:bg-red-500/10">
                               <Trash2 className="w-4 h-4" />
                            </Button>
                         </TableCell>
                      </TableRow>
                   ))}
                   {filteredMembers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-6 text-muted-foreground italic">
                           {members.length === 0 ? "No members found." : `No members match \"${searchQuery.trim()}\".`}
                        </TableCell>
                      </TableRow>
                   )}
                 </TableBody>
               </Table>
            </div>
          </CardContent>
        </Card>
      </div>

         {editingMember && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/90 backdrop-blur-xl animate-in fade-in duration-300">
               <Card className="w-full max-w-lg border-border/50 shadow-2xl bg-card secondary-glow transition-all">
                  <CardHeader className="border-b border-border/40 bg-secondary/20 pb-6">
                     <div className="flex items-center gap-3">
                        <div className="bg-primary/20 p-3 rounded-xl text-primary">
                           <UserCog className="w-6 h-6" />
                        </div>
                        <div>
                           <CardTitle className="text-xl font-black text-white italic tracking-tight">EDIT CLIENT PACKAGE</CardTitle>
                           <CardDescription className="text-[10px] uppercase font-bold tracking-widest text-primary/80">Updating for: {editingMember.name}</CardDescription>
                        </div>
                     </div>
                  </CardHeader>
                  <CardContent className="space-y-6 pt-6">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                           <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                              <Download className="w-3 h-3 text-primary rotate-180" /> Gym Membership
                           </label>
                           <select
                              value={packageDraft.package_type}
                              onChange={(e) => setPackageDraft(prev => ({
                                 ...prev,
                                 package_type: e.target.value,
                                 ...(e.target.value === 'Cardio Only' || e.target.value === 'pkg_cardio' ? { has_cardio: false } : {}),
                              }))}
                              className="flex h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-primary/50 outline-none transition-all cursor-pointer"
                           >
                              {packages.map(p => (
                                 <option key={p.id} value={p.id}>{p.name} ({p.price.toLocaleString()})</option>
                              ))}
                           </select>
                        </div>

                        <div className="space-y-2">
                           <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                              <UserCog className="w-3 h-3 text-primary" /> Trainer Plan
                           </label>
                           <select
                              value={packageDraft.trainer_package_type}
                              onChange={(e) => setPackageDraft(prev => ({ ...prev, trainer_package_type: e.target.value }))}
                              className="flex h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-primary/50 outline-none transition-all cursor-pointer"
                           >
                              <option value="none">No Private Trainer</option>
                              {ptPackages.map(pt => (
                                 <option key={pt.id} value={pt.id}>{pt.name} ({pt.price.toLocaleString()})</option>
                              ))}
                              <option value="Commissioned">Custom Commission</option>
                           </select>
                        </div>
                     </div>

                     {packageDraft.trainer_package_type === 'Commissioned' && (
                        <div className="space-y-2 p-4 rounded-xl bg-primary/5 border border-primary/20 animate-in slide-in-from-top-2 duration-300">
                           <label className="text-[10px] font-black uppercase text-primary tracking-widest">Commission Amount (PKR)</label>
                           <input
                              type="number"
                              min="0"
                              value={packageDraft.trainer_commission}
                              onChange={(e) => setPackageDraft(prev => ({ ...prev, trainer_commission: e.target.value }))}
                              className="flex h-10 w-full rounded-md border-none bg-background/50 px-3 py-2 text-lg font-black text-white focus:ring-0 outline-none"
                              placeholder="0"
                           />
                        </div>
                     )}

                     {!isCardioOnlyDraft ? (
                        <div className="p-4 rounded-xl bg-background border border-border/50 flex items-center justify-between hover:border-primary/40 transition-all cursor-pointer group" onClick={() => setPackageDraft(prev => ({ ...prev, has_cardio: !prev.has_cardio }))}>
                           <div className="flex items-center gap-4">
                              <div className={`p-2 rounded-lg transition-colors ${packageDraft.has_cardio ? 'bg-emerald-500/20 text-emerald-500' : 'bg-muted text-muted-foreground'}`}>
                                 <Activity className="w-5 h-5" />
                              </div>
                              <div>
                                 <p className="text-sm font-black italic text-white uppercase tracking-tight">Cardio Access Add-on</p>
                                 <p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">+ PKR {(addons.find((a: any) => a.name.toLowerCase().includes('cardio') || a.id === 'add_cardio')?.price ?? 2500).toLocaleString()} / Month</p>
                              </div>
                           </div>
                           <div className={`w-6 h-6 rounded border-2 transition-all flex items-center justify-center ${packageDraft.has_cardio ? 'bg-emerald-500 border-emerald-500' : 'border-border'}`}>
                              {packageDraft.has_cardio && <CheckCircle2 className="w-4 h-4 text-black font-black" />}
                           </div>
                        </div>
                     ) : (
                        <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex items-center gap-4">
                           <Activity className="w-5 h-5 text-emerald-500" />
                           <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500/80 leading-relaxed italic">The Cardio Only package includes full access to cardio facilities by default.</p>
                        </div>
                     )}

                      {/* Reset billing cycle start date checkbox */}
                      <div className="p-4 rounded-xl bg-background border border-border/50 flex items-center justify-between hover:border-yellow-500/40 transition-all cursor-pointer group" onClick={() => setPackageDraft(prev => ({ ...prev, reset_start_date: !prev.reset_start_date }))}>
                         <div className="flex items-center gap-4">
                            <div className={`p-2 rounded-lg transition-colors ${packageDraft.reset_start_date ? 'bg-yellow-500/20 text-yellow-500' : 'bg-muted text-muted-foreground'}`}>
                               <Activity className="w-5 h-5" />
                            </div>
                            <div>
                               <p className="text-sm font-black italic text-white uppercase tracking-tight">Reset Cycle / Renew from Today</p>
                               <p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">Start fresh billing cycle starting today</p>
                            </div>
                         </div>
                         <div className={`w-6 h-6 rounded border-2 transition-all flex items-center justify-center ${packageDraft.reset_start_date ? 'bg-yellow-500 border-yellow-500' : 'border-border'}`}>
                            {packageDraft.reset_start_date && <CheckCircle2 className="w-4 h-4 text-black font-black" />}
                         </div>
                      </div>

                     {/* Payment Gate Modal Overlay */}
                     {paymentGateInfo?.isOpen && (
                        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/95 backdrop-blur-2xl animate-in fade-in duration-300">
                           <Card className="w-full max-w-md border-primary/50 shadow-2xl bg-card secondary-glow">
                              <CardHeader className="border-b border-border/40 bg-primary/10 pb-6 text-center">
                                 <CardTitle className="text-2xl font-black text-primary italic tracking-tight">
                                    {paymentGateInfo.totalDueToday > 0 ? "PAYMENT REQUIRED" : "CONFIRM PACKAGE CHANGE"}
                                 </CardTitle>
                                 <CardDescription className="text-xs uppercase font-bold tracking-widest text-muted-foreground">
                                    {paymentGateInfo.totalDueToday > 0 ? "Please log the payment for this package change" : "Review the new balance and confirm changes"}
                                 </CardDescription>
                              </CardHeader>
                              <CardContent className="space-y-4 pt-6">
                                 <div className="space-y-2 p-4 rounded-xl bg-background border border-border">
                                    <div className="flex justify-between text-sm">
                                       <span className="text-muted-foreground font-bold">New Package Cost</span>
                                       <span className="font-black text-white">PKR {paymentGateInfo.newCycleCost.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                       <span className="text-muted-foreground font-bold">Unused Days Credit</span>
                                       <span className="font-black text-green-400">- PKR {paymentGateInfo.creditApplied.toLocaleString()}</span>
                                    </div>
                                    <div className="h-px bg-border my-2"></div>
                                    <div className="flex justify-between text-sm">
                                       <span className="text-muted-foreground font-bold">{paymentGateInfo.upgradeCost >= 0 ? "Upgrade Cost" : "Prorated Credit"}</span>
                                       <span className={`font-black ${paymentGateInfo.upgradeCost >= 0 ? 'text-white' : 'text-green-400'}`}>
                                          {paymentGateInfo.upgradeCost >= 0 ? `PKR ${paymentGateInfo.upgradeCost.toLocaleString()}` : `- PKR ${Math.abs(paymentGateInfo.upgradeCost).toLocaleString()}`}
                                       </span>
                                    </div>
                                    {paymentGateInfo.outstandingBalance > 0 && (
                                       <div className="flex justify-between text-sm">
                                          <span className="text-muted-foreground font-bold">Previous Unpaid Balance</span>
                                          <span className="font-black text-destructive">PKR {paymentGateInfo.outstandingBalance.toLocaleString()}</span>
                                       </div>
                                    )}
                                    {paymentGateInfo.oldTotalRequired < 0 && (
                                       <div className="flex justify-between text-sm">
                                          <span className="text-muted-foreground font-bold">Overpaid Balance Applied</span>
                                          <span className="font-black text-green-400">- PKR {Math.abs(paymentGateInfo.oldTotalRequired).toLocaleString()}</span>
                                       </div>
                                    )}
                                    {paymentGateInfo.totalDueToday < paymentGateInfo.upgradeCost && paymentGateInfo.outstandingBalance === 0 && (
                                       <div className="flex justify-between text-sm">
                                          <span className="text-muted-foreground font-bold">Overpaid Balance Applied</span>
                                          <span className="font-black text-green-400">- PKR {(paymentGateInfo.upgradeCost - paymentGateInfo.totalDueToday).toLocaleString()}</span>
                                       </div>
                                    )}
                                    {paymentGateInfo.upgradeCost < 0 && paymentGateInfo.totalDueToday === 0 && (
                                       <div className="flex justify-between text-sm">
                                          <span className="text-muted-foreground font-bold">Credit Added To Account</span>
                                          <span className="font-black text-emerald-400">+ PKR {Math.abs(paymentGateInfo.upgradeCost).toLocaleString()}</span>
                                       </div>
                                    )}
                                    <div className="h-px bg-border my-2"></div>
                                    <div className="flex justify-between text-lg">
                                       <span className="text-primary font-black">Total Due Today</span>
                                       <span className="font-black text-primary">PKR {paymentGateInfo.totalDueToday.toLocaleString()}</span>
                                    </div>
                                 </div>
                                 
                                 {paymentGateInfo.totalDueToday > 0 ? (
                                    <div className="space-y-2">
                                       <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Amount Paid (PKR)</label>
                                       <input
                                          type="number"
                                          min="0"
                                          value={paymentGateInfo.paymentInput}
                                          onChange={(e) => setPaymentGateInfo(prev => prev ? {...prev, paymentInput: e.target.value} : null)}
                                          className="flex h-12 w-full rounded-lg border-2 border-primary/30 bg-background px-4 text-lg font-black focus:border-primary outline-none transition-all"
                                       />
                                    </div>
                                 ) : (
                                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-center">
                                       <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest">No payment required</p>
                                    </div>
                                 )}
                                 
                                 <div className="flex gap-3 pt-4">
                                    <Button
                                       onClick={() => setPaymentGateInfo(null)}
                                       variant="ghost"
                                       className="flex-1 rounded-xl h-12 font-black tracking-widest"
                                    >
                                       CANCEL
                                    </Button>
                                    <Button
                                       onClick={handleSavePackage}
                                       disabled={isSavingPackage}
                                       className="flex-1 rounded-xl h-12 font-black tracking-widest bg-primary text-primary-foreground hover:bg-primary/90"
                                    >
                                       {isSavingPackage ? "PROCESSING..." : (paymentGateInfo.totalDueToday > 0 ? "CONFIRM & PAY" : "CONFIRM CHANGE")}
                                    </Button>
                                 </div>
                              </CardContent>
                           </Card>
                        </div>
                     )}

                     <div className="flex items-center gap-3 pt-6 border-t border-border/20">
                        <Button type="button" variant="outline" className="flex-1 font-black text-[10px] uppercase tracking-widest hover:bg-red-500/10 hover:text-red-500 border-border/50" onClick={() => { setEditingMemberId(null); setPaymentGateInfo(null); }}>
                           Discard
                        </Button>
                        <Button type="button" className="flex-1 h-11 bg-primary hover:bg-primary/80 text-black font-black italic uppercase tracking-tighter shadow-[0_10px_30px_-10px_rgba(234,179,8,0.5)] transition-all" onClick={handleSavePackage} disabled={isSavingPackage}>
                           {isSavingPackage ? "SAVING..." : "CONFIRM CHANGES"}
                        </Button>
                     </div>
                  </CardContent>
               </Card>
            </div>
         )}
    </div>
  );
}
