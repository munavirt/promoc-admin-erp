import { useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/app-layout";
import { useCreateProject, invalidateProjectData } from "../hooks/use-projects";
import { ProjectForm, EMPTY_PROJECT_FORM, applyProjectFieldErrors, toProjectPayload, type ProjectFormValues } from "../components/project-form";
import { assignMembersSequentially, describeFailures } from "../lib/assign-members";
import { getEmployeeLabelMap } from "../lib/employee-labels";

export function CreateProjectPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createMutation = useCreateProject();
  const defaults = useMemo(() => ({ ...EMPTY_PROJECT_FORM, newMembers: [] }), []);

  const handleSubmit: React.ComponentProps<typeof ProjectForm>["onSubmit"] = async (values: ProjectFormValues, { setError }) => {
    // 1. POST /api/projects/ (members are not accepted here — ProjectSerializer.members is read-only)
    let project;
    try {
      project = await createMutation.mutateAsync(toProjectPayload(values));
    } catch (err) {
      applyProjectFieldErrors(err, setError);
      return;
    }

    // 2. POST /api/projects/{id}/members/ for each member, using the real new project id.
    if (values.newMembers.length > 0) {
      const labels = getEmployeeLabelMap(queryClient);
      const { added, failed } = await assignMembersSequentially(
        project.id,
        values.newMembers.map((m) => ({ ...m, label: labels.get(m.employee) })),
      );
      invalidateProjectData(queryClient, project.id);
      if (failed.length) {
        toast.warning(
          `Project created, but ${failed.length} of ${values.newMembers.length} team member${values.newMembers.length === 1 ? "" : "s"} could not be added. ${describeFailures(failed)}`,
          { duration: 12000 },
        );
        // Land on the edit page so the missing members can be added.
        navigate(`/projects/${project.id}/edit`);
        return;
      }
      toast.success(`Project created with ${added.length} team member${added.length === 1 ? "" : "s"}.`);
    } else {
      toast.success("Project created successfully.");
    }
    navigate(`/projects/${project.id}`);
  };

  return (
    <AppLayout>
      <Link to="/projects" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors mb-6">
        <ArrowLeft className="h-4 w-4" /> Back to Projects
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Create Project</h1>
        <p className="mt-1 text-sm text-muted-foreground">Setup a new project and assign team members.</p>
      </div>

      <ProjectForm
        mode="create"
        defaultValues={defaults}
        submitLabel="Create Project"
        pendingLabel="Creating..."
        isPending={createMutation.isPending}
        onCancel={() => navigate("/projects")}
        onSubmit={handleSubmit}
      />
    </AppLayout>
  );
}
