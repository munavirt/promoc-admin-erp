import { useState } from "react";
import { Plus, Calendar as CalendarIcon, Clock, Users, Video, MapPin, MoreHorizontal, AlertCircle } from "lucide-react";
import { PageShell } from "@/components/dashboard/page-shell";
import { Button } from "@/components/ui/button";
import { useStore, MeetingType } from "@/store";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { cn } from "@/lib/utils";

const meetingSchema = z.object({
  title: z.string().min(2, "Title is required"),
  date: z.string().min(2, "Date is required"),
  time: z.string().min(2, "Time is required"),
  attendees: z.coerce.number().min(1, "At least 1 attendee"),
  type: z.enum(["Internal", "Client", "Review"]),
});

const meetingForm = meetingSchema;

export default function MeetingsPage() {
  const { meetings, addMeeting, removeMeeting } = useStore();
  const [open, setOpen] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(meetingSchema),
    defaultValues: { type: "Internal", attendees: 2 }
  });

  const onSubmit = (data) => {
    addMeeting({
      id: crypto.randomUUID(),
      ...data,
    });
    setOpen(false);
    reset();
  };

  return (
    <PageShell
      title="Meetings"
      description="Manage your schedule and upcoming syncs."
      actions={
        <Button size="sm" className="h-[34px] gap-1.5 px-3 text-[13px] shadow-sm" onClick={() => setOpen((v) => !v)}>
          <Plus className="h-4 w-4" /> Schedule
        </Button>
      }
    >
      <div className="max-w-[1000px] mx-auto">
        {open && (
          <form onSubmit={handleSubmit(onSubmit)} className="mb-6 rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4">
              <h3 className="text-[14px] font-semibold text-foreground">Schedule Meeting</h3>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
              <div className="md:col-span-2">
                <input {...register("title")} placeholder="Meeting title" className="h-[34px] w-full rounded-md border border-border bg-background px-3 text-[13px] focus:border-primary/40 focus:ring-2 focus:ring-primary/15 outline-none transition-colors" />
                {errors.title && <span className="text-[11px] text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/>{errors.title.message}</span>}
              </div>
              <div>
                <input {...register("date")} placeholder="Date (e.g. Jul 22)" className="h-[34px] w-full rounded-md border border-border bg-background px-3 text-[13px] focus:border-primary/40 focus:ring-2 focus:ring-primary/15 outline-none transition-colors" />
                {errors.date && <span className="text-[11px] text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/>{errors.date.message}</span>}
              </div>
              <div>
                <input {...register("time")} placeholder="Time (10:00 - 11:00)" className="h-[34px] w-full rounded-md border border-border bg-background px-3 text-[13px] focus:border-primary/40 focus:ring-2 focus:ring-primary/15 outline-none transition-colors" />
                {errors.time && <span className="text-[11px] text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/>{errors.time.message}</span>}
              </div>
              <div>
                <select {...register("type")} className="h-[34px] w-full rounded-md border border-border bg-background px-3 text-[13px] focus:border-primary/40 focus:ring-2 focus:ring-primary/15 outline-none transition-colors">
                  <option value="Internal">Internal</option>
                  <option value="Client">Client</option>
                  <option value="Review">Review</option>
                </select>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3 pt-4 border-t border-border/50">
              <Button type="button" size="sm" variant="ghost" className="h-[34px]" onClick={() => {setOpen(false); reset();}}>Cancel</Button>
              <Button type="submit" size="sm" className="h-[34px] shadow-sm">Schedule</Button>
            </div>
          </form>
        )}

        <div className="space-y-4 relative before:absolute before:inset-0 before:ml-[23px] before:-translate-x-px before:h-full before:w-[2px] before:bg-border/60">
          {meetings.map((m, i) => (
            <div key={m.id} className="relative flex items-start gap-6 group">
              <div className="flex items-center justify-center w-12 h-12 rounded-full border-[3px] border-background bg-secondary text-foreground shadow-sm shrink-0 z-10">
                <CalendarIcon className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="flex-1 rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.02)] overflow-hidden transition-all hover:border-primary/40 hover:shadow">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1.5">
                      <h3 className="text-[15px] font-semibold text-foreground group-hover:text-primary transition-colors">{m.title}</h3>
                      <TypeBadge type={m.type} />
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-[13px] text-muted-foreground">
                      <span className="flex items-center gap-1.5"><CalendarIcon className="h-3.5 w-3.5" /> {m.date}</span>
                      <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {m.time}</span>
                      <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> {m.attendees} attendees</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button variant="secondary" size="sm" className="h-8 gap-1.5 text-[12px]">
                      <Video className="w-3.5 h-3.5" /> Join call
                    </Button>
                    <button onClick={() => removeMeeting(m.id)} className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors">
                       <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {meetings.length === 0 && (
             <div className="ml-16 flex h-40 items-center justify-center rounded-xl border border-dashed border-border bg-card/50">
              <div className="text-center">
                <p className="text-[14px] font-medium text-foreground">No meetings scheduled</p>
                <p className="mt-1 text-[13px] text-muted-foreground">You have free time! Or you can schedule a new meeting.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}

function TypeBadge({ type }) {
  const map = {
    Internal: "bg-secondary text-foreground ring-border/50",
    Client: "bg-blue-50 text-blue-700 ring-blue-500/20",
    Review: "bg-amber-50 text-amber-700 ring-amber-500/20",
  } as const;
  return <span className={cn("inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset", map[type])}>{type}</span>;
}