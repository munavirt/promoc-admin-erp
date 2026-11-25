import { useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/app-layout";
import { createClient } from "@/api/clients.api";
import { useStore } from "@/store";
import { ClientForm, EMPTY_CLIENT_FORM, toClientPayload, type ClientFormValues } from "../components/client-form";

export function AddClientPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentUser } = useStore();
  const defaults = useMemo(() => ({ ...EMPTY_CLIENT_FORM }), []);

  // POST /api/clients/ — created_by is assigned by the backend (request.user); never sent.
  const createMutation = useMutation({ mutationFn: createClient });

  const handleSubmit = async (values: ClientFormValues) => {
    const { client } = await createMutation.mutateAsync({ ...toClientPayload(values), status: "ACTIVE" });
    queryClient.invalidateQueries({ queryKey: ["clients"] });
    toast.success("Client created successfully.");
    // The create response has no id; the service resolves it by exact company name.
    navigate(client ? `/clients/${client.id}` : "/clients");
  };

  return (
    <AppLayout>
      <Link to="/clients" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors mb-6">
        <ArrowLeft className="h-4 w-4" /> Back to Clients
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Add Client</h1>
        <p className="mt-1 text-sm text-muted-foreground">Fill in the details to create a new client account.</p>
      </div>

      <ClientForm
        mode="create"
        defaultValues={defaults}
        createdByName={currentUser?.name || ""}
        submitLabel="Save Client"
        isPending={createMutation.isPending}
        onCancel={() => navigate("/clients")}
        onSubmit={handleSubmit}
      />
    </AppLayout>
  );
}
