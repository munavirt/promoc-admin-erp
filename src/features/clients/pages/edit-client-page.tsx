import { useMemo } from "react";
import { useNavigate, Link, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, RefreshCcw } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { getClient, updateClient, type ClientBackend, type ClientWritePayload } from "@/api/clients.api";
import { extractApiErrorMessage } from "@/infrastructure/apiClient";
import { ClientForm, toClientPayload, type ClientFormValues } from "../components/client-form";

function toFormValues(c: ClientBackend): ClientFormValues {
  return {
    company_name: c.company_name || "",
    contact_person: c.contact_person || "",
    email: c.email || "",
    phone: c.phone || "",
    website: c.website || "",
    status: c.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    address: c.address || "",
    notes: c.notes || "",
  };
}

export function EditClientPage() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: client, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["client", String(clientId)],
    queryFn: ({ signal }) => getClient(clientId as string, signal),
    enabled: !!clientId,
  });
  const defaults = useMemo(() => (client ? toFormValues(client) : null), [client]);

  const updateMutation = useMutation({ mutationFn: updateClient });

  const handleSubmit = async (values: ClientFormValues) => {
    if (!client || !defaults) return;
    // PATCH only changed fields.
    const next = toClientPayload(values);
    const payload: Partial<ClientWritePayload> = {};
    (Object.keys(next) as (keyof ClientWritePayload)[]).forEach((key) => {
      if ((next[key] ?? "") !== ((defaults as Record<string, string>)[key] ?? "")) {
        (payload as Record<string, unknown>)[key] = next[key];
      }
    });
    if (Object.keys(payload).length === 0) {
      toast("No changes to save.");
      navigate(`/clients/${client.id}`);
      return;
    }
    await updateMutation.mutateAsync({ id: client.id, data: payload });
    queryClient.invalidateQueries({ queryKey: ["clients"] });
    queryClient.invalidateQueries({ queryKey: ["client", String(client.id)] });
    // Project lists show client_name; the project client picker lists active clients.
    queryClient.invalidateQueries({ queryKey: ["projects"] });
    queryClient.invalidateQueries({ queryKey: ["project"] });
    if (payload.status === "INACTIVE") {
      toast.success(`${client.company_name} was deactivated and is now hidden by the API.`);
      queryClient.removeQueries({ queryKey: ["client", String(client.id)] });
      navigate("/clients");
    } else {
      toast.success("Client updated successfully.");
      navigate(`/clients/${client.id}`);
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="animate-pulse space-y-6">
          <div className="h-4 w-24 rounded bg-secondary/60" />
          <div className="h-10 w-64 rounded bg-secondary/60" />
          <div className="h-64 rounded-2xl bg-secondary/60" />
        </div>
      </AppLayout>
    );
  }

  if (isError || !client || !defaults) {
    const notFound = (error as { status?: number | null } | null)?.status === 404;
    return (
      <AppLayout>
        <div className="flex h-[400px] flex-col items-center justify-center gap-3 text-center">
          <AlertTriangle className="h-10 w-10 text-muted-foreground/40" />
          <h2 className="text-[18px] font-semibold text-foreground">{notFound || !isError ? "Client not found" : "Unable to load client"}</h2>
          <p className="max-w-sm text-[13px] text-muted-foreground">
            {notFound || !isError
              ? "It may not exist, or it was deactivated (the API hides inactive clients)."
              : extractApiErrorMessage(error, "Please try again.").message}
          </p>
          {isError && !notFound && (
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => void refetch()} disabled={isFetching}>
              <RefreshCcw className="mr-2 h-3.5 w-3.5" /> Retry
            </Button>
          )}
          <Link to="/clients" className="text-sm text-primary hover:underline">Return to Clients</Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Link to={`/clients/${client.id}`} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors mb-6">
        <ArrowLeft className="h-4 w-4" /> Back to Client Profile
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Edit Client</h1>
        <p className="mt-1 text-sm text-muted-foreground">Update the information for {client.company_name}.</p>
      </div>

      <ClientForm
        mode="edit"
        defaultValues={defaults}
        createdByName={client.created_by_name || ""}
        submitLabel="Save Changes"
        isPending={updateMutation.isPending}
        onCancel={() => navigate(`/clients/${client.id}`)}
        onSubmit={handleSubmit}
      />
    </AppLayout>
  );
}
