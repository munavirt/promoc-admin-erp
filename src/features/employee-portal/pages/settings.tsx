import { useState } from "react";
import { useStore } from "@/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Moon, Globe, Lock, LogOut, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function EmployeeSettingsPage() {
  const { logout } = useStore();
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Please fill in all password fields.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }

    setIsChangingPassword(true);
    // MOCK API CALL - there is no backend endpoint for this currently
    setTimeout(() => {
      setIsChangingPassword(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password changed successfully.");
    }, 1500);
  };

  return (
    <div className="flex flex-col min-h-full w-full bg-[#F8F9FA] pb-10">
      <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[800px] mx-auto w-full space-y-8">
        
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings</h1>
          <p className="text-muted-foreground text-[14px] mt-1">Manage your account preferences and security.</p>
        </div>

        <div className="space-y-6">
          
          {/* Preferences */}
          <div className="rounded-2xl border border-border/70 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-border/50">
              <h3 className="text-[15px] font-bold text-foreground">Preferences</h3>
            </div>
            <div className="p-6 space-y-6">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-secondary/80 flex items-center justify-center shrink-0">
                    <Globe className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[14px] font-semibold text-foreground">Language</span>
                    <span className="text-[13px] text-muted-foreground">Select your preferred language</span>
                  </div>
                </div>
                <Select defaultValue="en">
                  <SelectTrigger className="w-full sm:w-[180px] bg-secondary/30 h-10 border-border/70">
                    <SelectValue placeholder="Select Language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English (US)</SelectItem>
                    <SelectItem value="es">Español</SelectItem>
                    <SelectItem value="fr">Français</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full h-[1px] bg-border/50" />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 opacity-60">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-secondary/80 flex items-center justify-center shrink-0">
                    <Moon className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[14px] font-semibold text-foreground flex items-center gap-2">
                      Dark Mode
                      <span className="bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Future</span>
                    </span>
                    <span className="text-[13px] text-muted-foreground">Switch to a dark appearance</span>
                  </div>
                </div>
                <Button variant="outline" disabled className="h-10 text-[13px] w-full sm:w-auto">
                  Coming Soon
                </Button>
              </div>

            </div>
          </div>

          {/* Security */}
          <div className="rounded-2xl border border-border/70 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-border/50">
              <h3 className="text-[15px] font-bold text-foreground">Security</h3>
            </div>
            <div className="p-6">
              
              <form onSubmit={handlePasswordChange} className="space-y-6">
                <div className="flex items-start gap-4 mb-2">
                  <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0 mt-1">
                    <Lock className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex flex-col flex-1 gap-1">
                    <span className="text-[14px] font-semibold text-foreground">Change Password</span>
                    <span className="text-[13px] text-muted-foreground mb-4">Ensure your account is using a long, random password to stay secure.</span>
                    
                    <div className="space-y-4 max-w-md">
                      <div className="space-y-1.5">
                        <Label htmlFor="current-password" className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider">Current Password</Label>
                        <Input 
                          id="current-password" 
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="h-10 bg-secondary/30 border-border/70"
                        />
                      </div>
                      
                      <div className="space-y-1.5">
                        <Label htmlFor="new-password" className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider">New Password</Label>
                        <Input 
                          id="new-password" 
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="h-10 bg-secondary/30 border-border/70"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="confirm-password" className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider">Confirm New Password</Label>
                        <Input 
                          id="confirm-password" 
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="h-10 bg-secondary/30 border-border/70"
                        />
                      </div>

                      <Button type="submit" disabled={isChangingPassword} className="w-full sm:w-auto h-10 text-[13px] font-semibold px-6 bg-blue-600 hover:bg-blue-700 mt-2">
                        {isChangingPassword ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Updating...</>
                        ) : (
                          "Update Password"
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </form>

            </div>
          </div>

          {/* Account Actions */}
          <div className="rounded-2xl border border-red-200 bg-red-50/50 shadow-sm overflow-hidden">
            <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-white border border-red-200 flex items-center justify-center shrink-0">
                  <LogOut className="w-5 h-5 text-red-600" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[14px] font-semibold text-red-900">Sign Out</span>
                  <span className="text-[13px] text-red-700/80">End your current session securely</span>
                </div>
              </div>
              <Button onClick={logout} variant="destructive" className="h-10 px-6 text-[13px] font-semibold w-full sm:w-auto bg-red-600 hover:bg-red-700">
                Log Out
              </Button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
