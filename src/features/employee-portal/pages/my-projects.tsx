import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMeProjects } from "@/api/me.api";
import { projectClientName } from "@/api/projects.api";
import { StatusBadge } from "@/components/shared/status-badge";
import { Input } from "@/components/ui/input";
import { Search, FolderKanban, Users, CalendarIcon, CheckSquare, Building2 } from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

function getInitials(name?: string) {
  if (!name) return "U";
  return name.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
}

export function EmployeeProjectsPage() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["me-projects"],
    queryFn: ({ signal }) => getMeProjects(signal),
  });

  const filteredProjects = useMemo(() => {
    let result = projects;
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(p => 
        p.project_name.toLowerCase().includes(lower) || 
        projectClientName(p).toLowerCase().includes(lower)
      );
    }
    return result;
  }, [projects, searchTerm]);

  return (
    <div className="flex flex-col min-h-full w-full bg-[#F8F9FA] pb-10">
      <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto w-full space-y-8">
        
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mb-6">Projects</h1>
          
          {/* Search */}
          <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-border/70 shadow-sm max-w-md">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search projects..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 border-none bg-secondary/50 focus-visible:ring-1 focus-visible:bg-white h-10 rounded-lg text-[13px]"
              />
            </div>
          </div>
        </div>

        {/* Project Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {isLoading && <div className="col-span-full p-12 text-center text-muted-foreground">Loading projects...</div>}
          
          {!isLoading && filteredProjects.length === 0 && (
            <div className="col-span-full p-12 text-center bg-white rounded-xl border border-dashed border-border/70 shadow-sm flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mb-4">
                <FolderKanban className="w-6 h-6 text-muted-foreground" />
              </div>
              <h3 className="text-[15px] font-semibold text-foreground">No projects found</h3>
              <p className="text-[13px] text-muted-foreground mt-1">You aren't assigned to any active projects.</p>
            </div>
          )}

          {filteredProjects.map((project) => (
            <Link key={project.id} to={`/projects/${project.id}`} className="group block">
              <div className="rounded-2xl border border-border/70 bg-white p-6 shadow-sm hover:shadow-md hover:border-border transition-all flex flex-col h-full relative overflow-hidden">
                <div className="flex items-start justify-between mb-5">
                  <div className="flex flex-col gap-1.5 min-w-0 pr-4">
                    <h3 className="text-[16px] font-bold text-foreground group-hover:text-blue-600 transition-colors truncate">
                      {project.project_name}
                    </h3>
                    <div className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
                      <Building2 className="w-3.5 h-3.5" />
                      <span className="truncate">{projectClientName(project)}</span>
                    </div>
                  </div>
                  <div className="shrink-0">
                    <StatusBadge status={project.status} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-[12px] font-medium text-muted-foreground mb-6 bg-secondary/30 p-4 rounded-xl border border-border/50">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 flex items-center gap-1.5"><CalendarIcon className="w-3 h-3" /> Deadline</span>
                    <span className="text-foreground">{project.deadline ? format(new Date(project.deadline), "MMM d, yyyy") : "No deadline"}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 flex items-center gap-1.5"><CheckSquare className="w-3 h-3" /> Tasks</span>
                    <span className="text-foreground">-- Total Tasks</span>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-auto pt-2">
                  <div className="flex -space-x-2">
                    {project.members?.slice(0, 4).map((member: any) => (
                      <Avatar key={member.id} className="w-8 h-8 border-2 border-white">
                        <AvatarFallback className="bg-blue-600 text-[10px] font-semibold text-white">
                          {getInitials(member.employee_name || member.name)}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                    {(project.members?.length || 0) > 4 && (
                      <div className="w-8 h-8 rounded-full border-2 border-white bg-secondary flex items-center justify-center text-[10px] font-semibold text-muted-foreground">
                        +{(project.members?.length || 0) - 4}
                      </div>
                    )}
                    {(!project.members || project.members.length === 0) && (
                      <div className="text-[11px] text-muted-foreground font-medium">No members</div>
                    )}
                  </div>
                  
                  {/* Progress bar */}
                  <div className="w-1/2 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      <span>Progress</span>
                      <span>{project.progress}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                      <div 
                        className="h-full rounded-full bg-blue-500 transition-all duration-1000 ease-out" 
                        style={{ width: `${project.progress}%` }} 
                      />
                    </div>
                  </div>
                </div>

              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
