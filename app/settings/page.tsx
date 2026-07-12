"use client";

import { useEffect, useState } from "react";
import { dbService } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dumbbell, Plus, Trash2, Shield, Save, CreditCard, Sparkles, Activity } from "lucide-react";
import { memberCache } from "@/lib/member-cache";

export default function SettingsPage() {
  const [isMounted, setIsMounted] = useState(false);

  // Draft configurations
  const [packages, setPackages] = useState<any[]>([]);
  const [addons, setAddons] = useState<any[]>([]);
  const [ptPackages, setPtPackages] = useState<any[]>([]);
  const [admissionFee, setAdmissionFee] = useState<string>("2000");

  // Security Credentials
  const [adminUser, setAdminUser] = useState("Admin");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // UI Status
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    setIsMounted(true);
    memberCache.initialize().then(() => {
      const settings = dbService.getCachedSettings();
      setAdmissionFee(String(settings.admissionFee || 2000));
      setAdminUser(settings.adminUser || "Admin");

      setPackages(dbService.getCachedPackages() || []);
      setAddons(dbService.getCachedAddons() || []);
      setPtPackages(dbService.getCachedPTPackages() || []);
    });
  }, []);

  if (!isMounted) return null;

  // --- Dynamic Package Handlers ---
  const handleAddPackage = (type: 'gym' | 'addon' | 'pt') => {
    const newId = `${type}_${Date.now()}`;
    const newPkg = { id: newId, name: "New Plan", price: 0, duration: 1 };
    
    if (type === 'gym') {
      setPackages([...packages, newPkg]);
    } else if (type === 'addon') {
      setAddons([...addons, newPkg]);
    } else if (type === 'pt') {
      setPtPackages([...ptPackages, newPkg]);
    }
  };

  const handleUpdatePackage = (type: 'gym' | 'addon' | 'pt', id: string, field: string, value: any) => {
    const list = type === 'gym' ? packages : type === 'addon' ? addons : ptPackages;
    const setter = type === 'gym' ? setPackages : type === 'addon' ? setAddons : setPtPackages;

    const updated = list.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    });
    setter(updated);
  };

  const handleDeletePackage = (type: 'gym' | 'addon' | 'pt', id: string) => {
    const list = type === 'gym' ? packages : type === 'addon' ? addons : ptPackages;
    const setter = type === 'gym' ? setPackages : type === 'addon' ? setAddons : setPtPackages;
    setter(list.filter(item => item.id !== id));
  };

  // --- Save All Trigger ---
  const handleSaveAll = async () => {
    setErrorMsg("");
    setSuccessMsg("");

    // Validate security credentials
    const settings = dbService.getCachedSettings();
    if (newPassword) {
      if (!currentPassword) {
        setErrorMsg("You must enter the current password to set a new one.");
        return;
      }
      if (currentPassword !== settings.adminPass) {
        setErrorMsg("Current password entered is incorrect.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setErrorMsg("New password and Confirm Password do not match.");
        return;
      }
    }

    setIsSaving(true);
    try {
      // 1. Save security & admission settings
      const updatedSettings = {
        ...settings,
        admissionFee: Number(admissionFee) || 0,
        adminUser: adminUser
      };
      if (newPassword) {
        updatedSettings.adminPass = newPassword;
      }
      await dbService.saveSettings(updatedSettings);

      // 2. Save dynamic packages
      await dbService.savePackages(packages);
      await dbService.saveAddons(addons);
      await dbService.savePTPackages(ptPackages);

      // 3. Reload cache so pages reflect pricing instantly
      await memberCache.forceRefresh();

      setSuccessMsg("System settings saved successfully! All pricing updates are live.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || "Failed to save settings. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-yellow-500 p-2 rounded-lg rotate-12 shadow-[0_0_20px_rgba(234,179,8,0.4)]">
            <Dumbbell className="w-8 h-8 text-black" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-4xl font-[1000] tracking-tighter italic leading-none">
              <span className="text-white">SYSTEM</span><span className="text-yellow-500"> SETTINGS</span>
            </h1>
            <p className="text-[10px] font-black uppercase tracking-[0.5em] text-yellow-500/60 mt-1">
              Global Configuration & Pricing Models
            </p>
          </div>
        </div>
        
        <Button 
          onClick={handleSaveAll} 
          disabled={isSaving}
          className="bg-yellow-500 hover:bg-yellow-400 text-black font-black uppercase tracking-tight italic gap-2 px-6 shadow-[0_0_20px_rgba(234,179,8,0.2)]"
        >
          <Save className="w-4 h-4" />
          {isSaving ? "Saving Settings..." : "Save All Settings"}
        </Button>
      </header>

      {/* Messages */}
      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-xl text-emerald-500 text-sm font-bold animate-in slide-in-from-top duration-300">
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl text-red-500 text-sm font-bold animate-in slide-in-from-top duration-300">
          {errorMsg}
        </div>
      )}

      {/* Grid Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Column 1: Gym Access Packages */}
        <Card className="bg-card/50 backdrop-blur border-border/80 lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/20">
            <div>
              <CardTitle className="text-lg font-black tracking-tight italic flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-yellow-500" />
                GYM MEMBERSHIP PACKAGES
              </CardTitle>
              <CardDescription className="text-xs">Adjust the core pricing (PKR) for gym access</CardDescription>
            </div>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => handleAddPackage('gym')}
              className="h-8 w-8 p-0 text-yellow-500 border-yellow-500/30 bg-yellow-500/5 hover:bg-yellow-500 hover:text-black"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            {packages.map((pkg) => (
              <div key={pkg.id} className="border border-border/40 p-4 rounded-lg bg-background/30 space-y-3 relative group">
                <Button 
                  onClick={() => handleDeletePackage('gym', pkg.id)}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300 h-7 w-7 p-0"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
                
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground uppercase font-bold">Package Name</Label>
                  <Input 
                    value={pkg.name} 
                    onChange={(e) => handleUpdatePackage('gym', pkg.id, 'name', e.target.value)}
                    className="h-8"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground uppercase font-bold">Price (PKR)</Label>
                    <Input 
                      type="number"
                      value={pkg.price} 
                      onChange={(e) => handleUpdatePackage('gym', pkg.id, 'price', Number(e.target.value) || 0)}
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground uppercase font-bold">Duration (Months)</Label>
                    <Input 
                      type="number"
                      value={pkg.duration} 
                      onChange={(e) => handleUpdatePackage('gym', pkg.id, 'duration', Number(e.target.value) || 1)}
                      className="h-8"
                    />
                  </div>
                </div>
              </div>
            ))}
            
            {/* One-time Admission Fee Input */}
            <div className="border-t border-border/20 pt-4 space-y-2">
              <Label className="text-sm font-bold text-yellow-500 uppercase">ONE-TIME ADMISSION / REGISTRATION FEE</Label>
              <Input 
                type="number"
                value={admissionFee}
                onChange={(e) => setAdmissionFee(e.target.value)}
                placeholder="2000"
              />
            </div>
          </CardContent>
        </Card>

        {/* Column 2: Add-ons & PT Tiers */}
        <div className="space-y-8 lg:col-span-1">
          
          {/* Add-ons */}
          <Card className="bg-card/50 backdrop-blur border-border/80">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border/20">
              <div>
                <CardTitle className="text-lg font-black tracking-tight italic flex items-center gap-2">
                  <Activity className="w-5 h-5 text-yellow-500" />
                  ADD-ON FACILITIES
                </CardTitle>
                <CardDescription className="text-xs">Adjust pricing for supplementary access</CardDescription>
              </div>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => handleAddPackage('addon')}
                className="h-8 w-8 p-0 text-yellow-500 border-yellow-500/30 bg-yellow-500/5 hover:bg-yellow-500 hover:text-black"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              {addons.map((add) => (
                <div key={add.id} className="border border-border/40 p-4 rounded-lg bg-background/30 grid grid-cols-12 gap-3 relative group">
                  <div className="col-span-7 space-y-1">
                    <Label className="text-xs text-muted-foreground uppercase font-bold">Add-on Name</Label>
                    <Input 
                      value={add.name} 
                      onChange={(e) => handleUpdatePackage('addon', add.id, 'name', e.target.value)}
                      className="h-8"
                    />
                  </div>
                  <div className="col-span-4 space-y-1">
                    <Label className="text-xs text-muted-foreground uppercase font-bold">Price (PKR)</Label>
                    <Input 
                      type="number"
                      value={add.price} 
                      onChange={(e) => handleUpdatePackage('addon', add.id, 'price', Number(e.target.value) || 0)}
                      className="h-8"
                    />
                  </div>
                  <div className="col-span-1 flex items-end justify-center">
                    <Button 
                      onClick={() => handleDeletePackage('addon', add.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300 h-8 w-8 p-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Personal Training */}
          <Card className="bg-card/50 backdrop-blur border-border/80">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border/20">
              <div>
                <CardTitle className="text-lg font-black tracking-tight italic flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-yellow-500" />
                  PERSONAL TRAINING
                </CardTitle>
                <CardDescription className="text-xs">Adjust base pricing for private coaching</CardDescription>
              </div>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => handleAddPackage('pt')}
                className="h-8 w-8 p-0 text-yellow-500 border-yellow-500/30 bg-yellow-500/5 hover:bg-yellow-500 hover:text-black"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              {ptPackages.map((pt) => (
                <div key={pt.id} className="border border-border/40 p-4 rounded-lg bg-background/30 grid grid-cols-12 gap-3 relative group">
                  <div className="col-span-7 space-y-1">
                    <Label className="text-xs text-muted-foreground uppercase font-bold">PT Tier Name</Label>
                    <Input 
                      value={pt.name} 
                      onChange={(e) => handleUpdatePackage('pt', pt.id, 'name', e.target.value)}
                      className="h-8"
                    />
                  </div>
                  <div className="col-span-4 space-y-1">
                    <Label className="text-xs text-muted-foreground uppercase font-bold">Price (PKR)</Label>
                    <Input 
                      type="number"
                      value={pt.price} 
                      onChange={(e) => handleUpdatePackage('pt', pt.id, 'price', Number(e.target.value) || 0)}
                      className="h-8"
                    />
                  </div>
                  <div className="col-span-1 flex items-end justify-center">
                    <Button 
                      onClick={() => handleDeletePackage('pt', pt.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300 h-8 w-8 p-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Column 3: Security Credentials */}
        <Card className="bg-card/50 backdrop-blur border-border/80 lg:col-span-1 h-fit">
          <CardHeader className="border-b border-border/20">
            <CardTitle className="text-lg font-black tracking-tight italic flex items-center gap-2">
              <Shield className="w-5 h-5 text-yellow-500" />
              SECURITY
            </CardTitle>
            <CardDescription className="text-xs">Update Dashboard admin credentials</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-xs uppercase font-bold text-muted-foreground">Admin Username</Label>
              <Input 
                id="username" 
                value={adminUser}
                onChange={(e) => setAdminUser(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="current-pass" className="text-xs uppercase font-bold text-muted-foreground">Current Password</Label>
              <Input 
                id="current-pass" 
                type="password"
                placeholder="••••••••"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-pass" className="text-xs uppercase font-bold text-muted-foreground">New Password</Label>
              <Input 
                id="new-pass" 
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-pass" className="text-xs uppercase font-bold text-muted-foreground">Confirm New Password</Label>
              <Input 
                id="confirm-pass" 
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
