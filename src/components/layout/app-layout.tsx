import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, FolderPlus, ListPlus, ReceiptText } from "lucide-react";
import { Sidebar, useVisibleNav } from "./sidebar";
import { Navbar } from "./navbar";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useStore } from "@/store";
import { resolveNavRole } from "./nav-config";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [openCommand, setOpenCommand] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigate = useNavigate();
  const { currentUser } = useStore();
  const groups = useVisibleNav();
  const role = resolveNavRole(currentUser?.role);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpenCommand((open) => !open);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const runCommand = (action: () => void) => {
    setOpenCommand(false);
    action();
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <Sidebar />

      <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <Navbar
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
          setOpenCommand={setOpenCommand}
        />
        <main className="thin-scrollbar relative flex-1 overflow-x-hidden overflow-y-auto">
          <div className="mx-auto w-full max-w-[1440px] px-4 pt-3 pb-16 sm:px-6 lg:px-10 lg:pt-4">{children}</div>
        </main>
      </div>

      <CommandDialog open={openCommand} onOpenChange={setOpenCommand}>
        <CommandInput placeholder="Jump to a page or run an action…" className="text-[13px]" />
        <CommandList>
          <CommandEmpty>No matching pages or actions.</CommandEmpty>
          <CommandGroup heading="Create">
            <CommandItem onSelect={() => runCommand(() => navigate("/projects/new"))} className="gap-2 text-[13px]">
              <FolderPlus className="h-4 w-4 text-muted-foreground" />
              New project
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => navigate("/tasks/new"))} className="gap-2 text-[13px]">
              <ListPlus className="h-4 w-4 text-muted-foreground" />
              Create task
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => navigate("/clients/new"))} className="gap-2 text-[13px]">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              Add client
            </CommandItem>
            {role !== "EMPLOYEE" && groups.some((g) => g.id === "finance") && (
              <CommandItem
                onSelect={() => runCommand(() => navigate("/finance/invoices/new"))}
                className="gap-2 text-[13px]"
              >
                <ReceiptText className="h-4 w-4 text-muted-foreground" />
                New invoice
              </CommandItem>
            )}
          </CommandGroup>
          {groups.map((group) => (
            <div key={group.id}>
              <CommandSeparator />
              <CommandGroup heading={group.label}>
                {group.items.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`${group.label} ${item.label} ${(item.keywords || []).join(" ")}`}
                    onSelect={() => runCommand(() => navigate(item.to))}
                    className="gap-2 text-[13px]"
                  >
                    <item.icon className="h-4 w-4 text-muted-foreground" />
                    {item.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </div>
          ))}
        </CommandList>
      </CommandDialog>
    </div>
  );
}
