"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from "react";
import { dbService } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, UserPlus, Fingerprint, Save, CheckCircle2 } from "lucide-react";
export default function ScannerMappingPage() {
    const [members, setMembers] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [newZkId, setNewZkId] = useState("");

    useEffect(() => {
        fetchMembers();
    }, []);

    const fetchMembers = async () => {
        setLoading(true);
        try {
            const data = await dbService.getAllMembers();
            setMembers(data || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = async (memberId: string) => {
        try {
            await dbService.updateMemberZkId(memberId, newZkId);
            setMembers(members.map(m => m.id === memberId ? { ...m, zk_id: newZkId } : m));
            setEditingId(null);
            setNewZkId("");
            alert("✓ ID Map updated successfully!");
        } catch (error) {
            console.error(error);
            alert("Error updating mapping.");
        }
    };

    const filteredMembers = members.filter(m => 
        m.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.phone?.includes(searchTerm) ||
        m.zk_id?.includes(searchTerm)
    );

    return (
        <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
            <header className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Biometric ID Mapping</h1>
                <p className="text-muted-foreground">Link physical ZKTeco device IDs to member profiles in Iron Ledger.</p>
            </header>

            <Card className="border-border/40 bg-card/50 backdrop-blur shadow-xl">
                <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <CardTitle className="flex items-center gap-2">
                            <Search className="w-5 h-5 text-primary" />
                            Registered Members
                        </CardTitle>
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input 
                                placeholder="Search name or ID..." 
                                className="pl-9 bg-background/50" 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="py-20 text-center animate-pulse text-muted-foreground">Loading members...</div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredMembers.map((member) => (
                                <Card key={member.id} className="group relative border-border/20 bg-background/30 hover:bg-background/60 transition-all duration-300 overflow-hidden">
                                    <div className={`absolute top-0 left-0 w-1 h-full transition-colors ${member.zk_id ? 'bg-emerald-500' : 'bg-orange-500'}`} />
                                    <CardContent className="p-6">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h3 className="font-bold text-lg leading-none mb-1">{member.name}</h3>
                                                <p className="text-xs text-muted-foreground uppercase tracking-widest">{member.phone || 'No phone'}</p>
                                            </div>
                                            <div className="h-4 w-4 rounded-full bg-secondary flex items-center justify-center">
                                                {member.zk_id ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-ping" />}
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border/10">
                                                <div className="flex items-center gap-2">
                                                    <Fingerprint className="w-4 h-4 text-muted-foreground" />
                                                    <span className="text-xs font-semibold text-muted-foreground uppercase">Bridge ID</span>
                                                </div>
                                                {editingId === member.id ? (
                                                    <Input 
                                                        className="h-7 w-20 text-center text-sm font-mono" 
                                                        autoFocus
                                                        value={newZkId}
                                                        onChange={(e) => setNewZkId(e.target.value)}
                                                        onKeyDown={(e) => e.key === 'Enter' && handleUpdate(member.id)}
                                                    />
                                                ) : (
                                                    <span className="font-mono font-bold text-primary">{member.zk_id || "NOT SET"}</span>
                                                )}
                                            </div>

                                            {editingId === member.id ? (
                                               <div className="flex gap-2">
                                                   <Button size="sm" className="w-full bg-emerald-600 hover:bg-emerald-500" onClick={() => handleUpdate(member.id)}>
                                                       <Save className="w-3.5 h-3.5 mr-2" /> Save
                                                   </Button>
                                                   <Button size="sm" variant="outline" className="w-full" onClick={() => setEditingId(null)}>Cancel</Button>
                                               </div>
                                            ) : (
                                                <Button 
                                                    variant="secondary" 
                                                    size="sm" 
                                                    className="w-full text-xs hover:bg-primary hover:text-primary-foreground group-hover:shadow-lg transition-all"
                                                    onClick={() => {
                                                        setEditingId(member.id);
                                                        setNewZkId(member.zk_id || "");
                                                    }}
                                                >
                                                    <UserPlus className="w-3.5 h-3.5 mr-2" /> 
                                                    {member.zk_id ? "Change ID Map" : "Assign ZK ID"}
                                                </Button>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                    {!loading && filteredMembers.length === 0 && (
                        <div className="text-center py-20 text-muted-foreground border-2 border-dashed border-border/20 rounded-xl">
                            No members found matching your search.
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
