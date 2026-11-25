import { useMemo, useState, type ComponentType, type SVGProps } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownToLine, ArrowUpFromLine, CalendarDays, Plus, Scale } from "lucide-react";
import { workspaceAdapter } from "@/adapters/erp.adapters";
import { getClients } from "@/api/clients.api";
import { getEmployees } from "@/api/employees.api";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { ErrorState, SkeletonBlock } from "@/components/shared/states";
import { Surface } from "@/components/shared/section";
import { IconTile } from "@/components/shared/icon-tile";
import { ClientIllustration, ProjectIllustration, TaskIllustration } from "@/components/shared/illustrations";
import { useProjects } from "@/features/projects/hooks/use-projects";
import { useTasks } from "@/features/tasks/hooks/use-tasks";
import { cn } from "@/lib/utils";
import { useFinancePermissions } from "@/modules/finance/hooks/use-finance";
import { extractApiErrorMessage } from "@/infrastructure/apiClient";
import { useOverviewSummary, useOverviewTrends } from "@/modules/finance/hooks/use-finance-workspace";
import { CashFlowChart, CashFlowLegend } from "@/modules/finance/components/cash-flow-chart";
import type { OverviewQuery } from "@/modules/finance/types/api-contracts";
import { formatDecimalINR, toAmount } from "@/modules/finance/utils/contract-format";
import { formatINR } from "@/modules/finance/utils/money";
import { useStore } from "@/store";
import { greetingFor, isTaskOpen, isTaskOverdue, plural, relativeTime, todayISO } from "../lib/dashboard-insights";
import {
  ActivityTimeline,
  AgencyPulse,
  AttentionStack,
  PanelHeader,
  ProjectRings,
  ProjectsInMotion,
  TaskWorkspace,
  WeekCalendar,
  type ActivityEvent,
  type DeadlineEvent,
} from "./dashboard-panels";

/* ─── Finance period presets (mapped onto /api/finance/overview/ period codes) ── */

type PeriodKey = "7d" | "30d" | "3m" | "6m" | "fy";

function periodQuery(key: PeriodKey): OverviewQuery {
  if (key !== "fy") return { period: key };
  const today = todayISO();
  const [y, m] = today.split("-").map(Number);
  const fyStart = m >= 4 ? y : y - 1;
  return { period: "custom", start_date: `${fyStart}-04-01`, end_date: today, grouping: "month" };
}

const PERIOD_CAPTION: Record<PeriodKey, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "3m": "Last 3 months",
  "6m": "Last 6 months",
  fy: "This financial year",
};

function FinancialSnapshot() {
  const [periodKey, setPeriodKey] = useState<PeriodKey>("30d");
  const query = useMemo(() => periodQuery(periodKey), [periodKey]);
  const summary = useOverviewSummary(query);
  const trends = useOverviewTrends(query);
  const s = summary.data;
  const net = toAmount(s?.net_cash_flow);
  const loading = summary.isLoading || trends.isLoading;
  const monthly = trends.data?.grouping === "month";
  const [expenseFocus, setExpenseFocus] = useState(false);

  if (summary.isError || trends.isError) {
    return (
      <ErrorState
        className="m-5"
        title="Financial snapshot is unavailable"
        description={extractApiErrorMessage(summary.error || trends.error, "The overview figures couldn't be loaded.").message}
        onRetry={() => {
          summary.refetch();
          trends.refetch();
        }}
      />
    );
  }

  const figures = [
    { label: "Income received", value: s?.total_income, count: s?.income_transaction_count, icon: ArrowDownToLine, tone: "mint" as const, to: "/finance/income" },
    { label: "Expenses paid", value: s?.total_expenses, count: s?.expense_transaction_count, icon: ArrowUpFromLine, tone: "peach" as const, to: "/finance/expenses" },
  ];

  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        title="Financial snapshot"
        meta={`${PERIOD_CAPTION[periodKey]} · cash basis`}
        action={
          <SegmentedControl<PeriodKey>
            aria-label="Reporting period"
            value={periodKey}
            onChange={setPeriodKey}
            options={[
              { value: "7d", label: "7D" },
              { value: "30d", label: "30D" },
              { value: "3m", label: "3M" },
              { value: "6m", label: "6M" },
              { value: "fy", label: "FY" },
            ]}
          />
        }
      />
      <div className={cn("grid gap-3 px-4 transition-opacity sm:grid-cols-3 sm:px-5", summary.isPlaceholderData && "opacity-60")}>
        <Link to="/finance" className="rounded-[18px] bg-gradient-to-br from-[#f2f7ff] to-[#e8f1ff] p-4 transition-shadow hover:shadow-sm">
          <div className="flex items-center gap-2 text-[12.5px] font-semibold text-[#004fcc]">
            <IconTile icon={Scale} tone="blue" size="sm" className="bg-white" />
            Net cash flow
          </div>
          {loading ? (
            <SkeletonBlock className="mt-3 h-8 w-32" />
          ) : (
            <div className={cn("figure mt-3 text-[26px] leading-none font-extrabold tracking-[-0.03em]", net < 0 ? "text-negative" : "text-foreground")}>{formatINR(net)}</div>
          )}
          <div className="mt-1.5 text-[11.5px] font-medium text-subtle">{s ? plural(s.total_transaction_count, "transaction") : " "}</div>
        </Link>
        {figures.map((f) => (
          <Link key={f.label} to={f.to} className="rounded-[18px] p-4 ring-1 ring-[#e7ecf4] transition-[box-shadow,background-color] hover:bg-[#fafcff] hover:shadow-sm">
            <div className="flex items-center gap-2 text-[12.5px] font-semibold text-muted-foreground">
              <IconTile icon={f.icon} tone={f.tone} size="sm" />
              {f.label}
            </div>
            {loading ? <SkeletonBlock className="mt-3 h-7 w-28" /> : <div className="figure mt-3 text-[22px] leading-none font-extrabold text-foreground">{formatDecimalINR(f.value)}</div>}
            <div className="mt-1.5 text-[11.5px] font-medium text-subtle">{f.count !== undefined ? plural(f.count, "entry", "entries") : " "}</div>
          </Link>
        ))}
      </div>
      <div className="min-w-0 flex-1 px-3 pt-5 pb-4 sm:px-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-2 sm:px-1">
          <CashFlowLegend showNet={monthly} expenseFocus={expenseFocus} />
          {trends.data && <span className="text-[11.5px] font-medium text-subtle">By {trends.data.grouping}</span>}
        </div>
        {loading || !trends.data ? (
          <SkeletonBlock className="h-[230px] w-full rounded-[14px]" />
        ) : (
          <div className={cn("transition-opacity", trends.isPlaceholderData && "opacity-50")}>
            <CashFlowChart
              points={trends.data.results}
              grouping={trends.data.grouping}
              showNet={monthly}
              height={230}
              expenseFocus={expenseFocus}
              onExpenseFocusChange={setExpenseFocus}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Quick action tiles (floating illustrated cards) ───────────────────── */

function ActionTile({ to, title, hint, Art }: { to: string; title: string; hint: string; Art: ComponentType<SVGProps<SVGSVGElement>> }) {
  return (
    <Link to={to} className="surface surface-hover group flex flex-col items-center px-3 pt-4 pb-4 text-center">
      <Art className="h-[78px] w-[100px] transition-transform duration-300 group-hover:-translate-y-1 group-hover:scale-[1.03]" />
      <div className="mt-2 text-[13.5px] font-bold text-foreground">{title}</div>
      <div className="mt-0.5 text-[11.5px] leading-snug text-subtle">{hint}</div>
    </Link>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────────── */

const AUDIT_VERBS: Record<string, string> = {
  INVOICE_ISSUED: "issued invoice",
  INVOICE_PAID: "settled invoice",
  INVOICE_CANCELLED: "cancelled invoice",
  INVOICE_REVISION_CREATED: "drafted a revision of",
  INVOICE_DRAFT_UPDATED: "updated draft",
  INCOME_CREATED: "recorded income",
  INCOME_UPDATED: "updated income",
  INCOME_REVERSED: "reversed income",
  EXPENSE_CREATED: "recorded expense",
  EXPENSE_UPDATED: "updated expense",
  EXPENSE_REVERSED: "reversed expense",
  ADVANCE_RECORDED: "received an advance",
  ADVANCE_ALLOCATED: "allocated an advance to",
  PAYMENT_RECORDED: "recorded payment",
};

export function DashboardPage() {
  const { currentUser } = useStore();
  const projectsQ = useProjects();
  const tasksQ = useTasks();
  const clientsQ = useQuery({ queryKey: ["clients"], queryFn: () => getClients() });
  const employeesQ = useQuery({ queryKey: ["employees"], queryFn: () => getEmployees() });
  const { data: financePerm } = useFinancePermissions();
  const canViewFinance = financePerm?.permissions?.canViewFinance ?? false;
  const activityQ = useQuery({
    queryKey: ["erp-activities", projectsQ.dataUpdatedAt, tasksQ.dataUpdatedAt, clientsQ.dataUpdatedAt],
    queryFn: () => workspaceAdapter.getActivities(),
    staleTime: 0,
  });

  const projects = projectsQ.data ?? [];
  const tasks = tasksQ.data ?? [];
  const clients = clientsQ.data ?? [];
  const employees = employeesQ.data ?? [];

  const openTasks = useMemo(() => tasks.filter(isTaskOpen), [tasks]);
  const overdueTasks = useMemo(() => tasks.filter(isTaskOverdue), [tasks]);
  const dueToday = useMemo(() => openTasks.filter((t) => t.due_date === todayISO()), [openTasks]);
  const activeProjects = useMemo(() => projects.filter((p) => !["COMPLETED", "CANCELLED"].includes(String(p.status).toUpperCase())), [projects]);
  const clientNames = useMemo(() => new Map(clients.map((c) => [String(c.id), c.company_name])), [clients]);
  const coreLoading = projectsQ.isLoading || tasksQ.isLoading;

  /* Deadlines for the week calendar — only real due dates. */
  const deadlines = useMemo<DeadlineEvent[]>(() => {
    const list: DeadlineEvent[] = [
      ...openTasks
        .filter((t) => t.due_date)
        .map((t) => ({ id: `t-${t.id}`, date: t.due_date, title: t.title, meta: t.assigned_to_name || t.project_name || "Unassigned", kind: "task" as const, to: `/tasks/${t.id}` })),
      ...activeProjects
        .filter((p) => p.deadline)
        .map((p) => ({
          id: `p-${p.id}`,
          date: p.deadline,
          title: p.project_name,
          meta: p.client_name || (typeof p.client === "object" && p.client ? p.client.name : clientNames.get(String(p.client))) || "Client",
          kind: "project" as const,
          to: `/projects/${p.id}`,
        })),
    ];
    // Invoice due dates are omitted until Invoices are integrated (no demo data).
    return list;
  }, [openTasks, activeProjects, clientNames]);

  /* Activity — workspace activity log + finance audit trail. Only recorded events. */
  const events = useMemo<ActivityEvent[]>(() => {
    const ws: ActivityEvent[] = (activityQ.data ?? []).map((a, idx) => {
      const text = `${a.action} ${a.target}`.toLowerCase();
      const kind: ActivityEvent["kind"] = text.includes("client") ? "client" : text.includes("project") || a.action.includes("milestone") ? "project" : "task";
      return {
        id: `ws-${a.id}`,
        actor: a.user,
        verb: a.action,
        target: a.target,
        when: a.createdAtIso ? relativeTime(a.createdAtIso) : a.timestamp,
        sortKey: a.createdAtIso ? new Date(a.createdAtIso).getTime() : Date.now() - (idx + 1) * 3600000,
        kind,
        to: a.projectId ? `/projects/${a.projectId}` : undefined,
      };
    });
    // Finance has no activity/audit endpoint, so no finance events are shown (the old mock audit trail was removed).
    const fin: ActivityEvent[] = [];
    return [...ws, ...fin].sort((a, b) => b.sortKey - a.sortKey).slice(0, 7);
  }, [activityQ.data]);

  const firstName = (currentUser?.name || "there").split(" ")[0];
  const dateLine = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

  const summary = coreLoading ? null : (
    <>
      <b className="font-bold text-foreground">{plural(activeProjects.length, "project")}</b> in motion
      {overdueTasks.length > 0 && (
        <>
          , <b className="font-bold text-negative">{plural(overdueTasks.length, "task")} overdue</b>
        </>
      )}
      {dueToday.length > 0 && (
        <>
          {overdueTasks.length > 0 ? " and " : ", "}
          <b className="font-bold text-foreground">{dueToday.length}</b> due today
        </>
      )}
      .{overdueTasks.length === 0 && " Nothing is overdue."}
    </>
  );

  return (
    <div className="space-y-5 lg:space-y-6">
      {(projectsQ.isError || tasksQ.isError) && (
        <ErrorState
          title="Some workspace data couldn't load"
          description="Projects or tasks failed to load. Figures below may be incomplete."
          onRetry={() => {
            projectsQ.refetch();
            tasksQ.refetch();
          }}
        />
      )}

      {/* Row 1 — greeting + illustrated quick actions */}
      <section className="grid animate-rise items-end gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="min-w-0 pb-1">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1 text-[12px] font-semibold text-muted-foreground shadow-xs">
            <CalendarDays className="h-3.5 w-3.5 text-primary" />
            {dateLine}
          </span>
          <h1 className="mt-4 text-[32px] leading-[1.1] font-extrabold tracking-[-0.035em] text-foreground sm:text-[38px]">
            {greetingFor()}, {firstName}!
            <span className="block text-[#929db0]">Let's keep things moving.</span>
          </h1>
          <p className="mt-4 max-w-xl text-[14.5px] leading-relaxed text-muted-foreground">{summary ?? <SkeletonBlock className="h-4 w-80 max-w-full" />}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {/* "New invoice" tile omitted until Invoices are connected to the backend. */}
          <ActionTile to="/projects/new" title="New project" hint="Kick off delivery" Art={ProjectIllustration} />
          <ActionTile to="/clients/new" title="Add client" hint="Grow the roster" Art={ClientIllustration} />
          <ActionTile to="/tasks/new" title="Create task" hint="Assign the next step" Art={TaskIllustration} />
        </div>
      </section>

      {/* Row 2 — pulse · attention · week */}
      <section className="grid animate-rise gap-5 md:grid-cols-2 xl:grid-cols-[1.1fr_1fr_1fr]">
        <Surface>
          <AgencyPulse
            loading={coreLoading || clientsQ.isLoading || employeesQ.isLoading}
            projects={projects}
            openTasks={openTasks}
            overdueTasks={overdueTasks}
            clients={{ total: clients.length, active: clients.filter((c) => String(c.status).toUpperCase() === "ACTIVE").length }}
            team={{
              active: employees.filter((e) => String(e.status).toUpperCase() === "ACTIVE").length,
              onLeave: employees.filter((e) => String(e.status).toUpperCase() === "ON_LEAVE").length,
            }}
          />
        </Surface>
        <Surface>
          <AttentionStack loading={tasksQ.isLoading} tasks={tasks} />
        </Surface>
        <Surface className="md:col-span-2 xl:col-span-1">
          <WeekCalendar loading={coreLoading} events={deadlines} />
        </Surface>
      </section>

      {/* Row 3 — finance · highlight + rings */}
      <section className={cn("grid animate-rise gap-5", canViewFinance && "xl:grid-cols-[2.1fr_1fr]")}>
        {canViewFinance && (
          <Surface>
            <FinancialSnapshot />
          </Surface>
        )}
        <div className={cn("grid content-start gap-5", !canViewFinance && "md:grid-cols-2")}>
          {!coreLoading && <ProjectRings projects={projects} clientNames={clientNames} />}
        </div>
      </section>

      {/* Row 4 — tasks + projects · activity */}
      <section className="grid animate-rise gap-5 xl:grid-cols-[2.1fr_1fr]">
        <div className="grid min-w-0 gap-5">
          <Surface>
            <TaskWorkspace key={tasksQ.isLoading ? "loading" : "ready"} loading={tasksQ.isLoading} tasks={tasks} />
          </Surface>
          <Surface>
            <ProjectsInMotion loading={coreLoading} projects={projects} clientNames={clientNames} />
          </Surface>
        </div>
        <Surface className="self-start">
          <ActivityTimeline loading={activityQ.isLoading} events={events} />
        </Surface>
      </section>
    </div>
  );
}
