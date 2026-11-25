import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Clock, Plus, Trash2, UsersRound } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import { Surface } from "@/components/shared/section";
import { DataSourceNotice } from "@/components/shared/data-source-notice";
import { EmptyState } from "@/components/shared/empty-state";
import { CalendarIllustration } from "@/components/shared/illustrations";
import { FormField, inputClass } from "@/components/shared/form-field";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useStore, type MeetingType } from "@/store";

const meetingSchema = z.object({
  title: z.string().trim().min(2, "Give the meeting a title."),
  date: z.string().trim().min(2, "Add a date, e.g. Thu, 20 Nov."),
  time: z.string().trim().min(2, "Add a time, e.g. 10:00 – 10:30."),
  attendees: z.coerce.number().int().min(1, "At least one attendee."),
  type: z.enum(["Internal", "Client", "Review"]),
});
type MeetingInput = z.input<typeof meetingSchema>;
type MeetingOutput = z.output<typeof meetingSchema>;

const TYPE_STYLE: Record<MeetingType, { chip: string; bar: string }> = {
  Internal: { chip: "bg-brand-soft text-[#004fcc]", bar: "bg-primary" },
  Client: { chip: "bg-accent-2-soft text-accent-2-deep", bar: "bg-accent-2" },
  Review: { chip: "bg-mint text-[#1f8a60]", bar: "bg-[#7fd1ad]" },
};

type Filter = "all" | MeetingType;

export default function MeetingsPage() {
  const { meetings, addMeeting, removeMeeting } = useStore();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const { register, handleSubmit, reset, formState: { errors } } = useForm<MeetingInput, unknown, MeetingOutput>({
    resolver: zodResolver(meetingSchema),
    defaultValues: { type: "Internal", attendees: 2, title: "", date: "", time: "" },
  });

  const rows = meetings.filter((m) => filter === "all" || m.type === filter);

  return (
    <AppLayout>
      <PageHeader eyebrow="Workspace" title="Meetings" description="A lightweight schedule for client calls, reviews and internal syncs.">
        <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Schedule meeting
        </Button>
      </PageHeader>

      <DataSourceNotice kind="pending" className="mb-6">
        The PromoCraft API has no meetings module yet. Meetings here are demo entries saved in this browser only — they are not shared with your team or synced to a calendar.
      </DataSourceNotice>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Surface className="p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <SegmentedControl<Filter>
              aria-label="Meeting type"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "All", count: meetings.length },
                ...(["Client", "Review", "Internal"] as MeetingType[]).map((t) => ({ value: t, label: t, count: meetings.filter((m) => m.type === t).length })),
              ]}
            />
          </div>
          {rows.length === 0 ? (
            <EmptyState
              compact
              illustration={<CalendarIllustration className="h-24 w-[120px]" />}
              title="No meetings scheduled"
              description="Add a client call or review to keep it visible to you here."
              action={
                <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Schedule meeting
                </Button>
              }
            />
          ) : (
            <ul className="space-y-2">
              {rows.map((m) => {
                const t = TYPE_STYLE[m.type] || TYPE_STYLE.Internal;
                return (
                  <li key={m.id} className="group relative flex items-center gap-4 overflow-hidden rounded-[18px] bg-card p-4 ring-1 ring-[#e7ecf4] transition-shadow hover:shadow-md">
                    <span className={cn("absolute inset-y-3 left-0 w-1 rounded-r-full", t.bar)} />
                    <div className="flex w-[84px] shrink-0 flex-col items-center rounded-[14px] bg-secondary px-2 py-2 text-center">
                      <span className="text-[12px] leading-tight font-bold text-foreground">{m.date}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-[14px] font-bold">{m.title}</span>
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", t.chip)}>{m.type}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] font-medium text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" /> {m.time}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <UsersRound className="h-3.5 w-3.5" /> {m.attendees} attendees
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeMeeting(m.id)}
                      aria-label={`Remove ${m.title}`}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-subtle transition-colors hover:bg-negative-soft hover:text-negative"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Surface>
        <Surface className="self-start p-5 text-center">
          <CalendarIllustration className="mx-auto h-24 w-[120px]" />
          <div className="figure mt-2 text-[34px] leading-none font-extrabold">{meetings.length}</div>
          <div className="mt-1 text-[13px] font-semibold text-muted-foreground">demo meetings on your list</div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {(["Client", "Review", "Internal"] as MeetingType[]).map((t) => (
              <div key={t} className={cn("rounded-[14px] px-2 py-2", TYPE_STYLE[t].chip)}>
                <div className="figure text-[16px] font-extrabold">{meetings.filter((m) => m.type === t).length}</div>
                <div className="text-[11px] font-bold">{t}</div>
              </div>
            ))}
          </div>
        </Surface>
      </div>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Schedule meeting</DialogTitle>
            <DialogDescription className="text-[13px]">Saved locally as demo data.</DialogDescription>
          </DialogHeader>
          <form
            id="meeting-form"
            noValidate
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={handleSubmit((d) => {
              addMeeting({ id: crypto.randomUUID(), ...d });
              setOpen(false);
              reset();
            })}
          >
            <FormField label="Title" htmlFor="m-title" error={errors.title?.message} className="sm:col-span-2">
              <input id="m-title" className={inputClass} placeholder="Northwind launch review" {...register("title")} />
            </FormField>
            <FormField label="Date" htmlFor="m-date" error={errors.date?.message}>
              <input id="m-date" className={inputClass} placeholder="Thu, 20 Nov" {...register("date")} />
            </FormField>
            <FormField label="Time" htmlFor="m-time" error={errors.time?.message}>
              <input id="m-time" className={inputClass} placeholder="10:00 – 10:30" {...register("time")} />
            </FormField>
            <FormField label="Attendees" htmlFor="m-att" error={errors.attendees?.message}>
              <input id="m-att" type="number" min={1} className={inputClass} {...register("attendees")} />
            </FormField>
            <FormField label="Type" htmlFor="m-type">
              <select id="m-type" className={inputClass} {...register("type")}>
                <option>Internal</option>
                <option>Client</option>
                <option>Review</option>
              </select>
            </FormField>
          </form>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="meeting-form" size="sm">
              Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
