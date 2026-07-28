import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, Trash2, FileText, Image as ImageIcon, FileArchive } from "lucide-react";
import { PageShell } from "@/components/dashboard/page-shell";
import { useStore } from "@/store";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";

const seed = [
  { id: "1", name: "Brand-Guidelines-v3.pdf", size: "4.2 MB", project: "Brand Refresh 2026", uploaded: "2h ago", kind: "doc" },
  { id: "2", name: "hero-shot-final.jpg", size: "1.8 MB", project: "Q3 Product Launch", uploaded: "Yesterday", kind: "image" },
  { id: "3", name: "launch-assets.zip", size: "38 MB", project: "Q3 Product Launch", uploaded: "2 days ago", kind: "zip" },
  { id: "4", name: "SOW-Vertex.pdf", size: "212 KB", project: "Retail Campaign", uploaded: "Jul 15", kind: "doc" },
];

export default function FilesPage() {
  const navigate = useNavigate();
  const { currentUser } = useStore();
  const [docs, setDocs] = useState(seed);
  const ref = useRef(null);
  
  useEffect(() => {
    if (currentUser?.role === "Employee") {
      navigate("/");
    }
  }, [currentUser, navigate]);

  function kindOf(name) {
    if (/\.(png|jpe?g|gif|webp|svg)$/i.test(name)) return "image";
    if (/\.(zip|rar|7z|tar|gz)$/i.test(name)) return "zip";
    return "doc";
  }

  function humanSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  function onUpload(files) {
    if (!files) return;
    const items = Array.from(files).map((f) => ({
      id: crypto.randomUUID(),
      name: f.name,
      size: humanSize(f.size),
      project: "Unassigned",
      uploaded: "Just now",
      kind: kindOf(f.name),
    }));
    setDocs((p) => [...items, ...p]);
  }

  return (
    <PageShell
      title="Files"
      description={`${docs.length} files shared with the team`}
      actions={
        <>
          <input ref={ref} type="file" multiple hidden onChange={(e) => onUpload(e.target.files)} />
          <Button size="sm" className="h-8 gap-1.5 px-3 text-[13px]" onClick={() => ref.current?.click()}>
            <Upload className="h-4 w-4" /> Upload
          </Button>
        </>
      }
    >
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-[13px]">
          <thead className="bg-secondary/60 text-left text-[12px] font-medium text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5">Name</th>
              <th className="px-4 py-2.5">Project</th>
              <th className="px-4 py-2.5">Size</th>
              <th className="px-4 py-2.5">Uploaded</th>
              <th className="w-10 px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => {
              const Icon = d.kind === "image" ? ImageIcon : d.kind === "zip" ? FileArchive : FileText;
              return (
                <tr key={d.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary text-muted-foreground">
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="font-medium text-foreground">{d.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{d.project}</td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">{d.size}</td>
                  <td className="px-4 py-3 text-muted-foreground">{d.uploaded}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setDocs((p) => p.filter((x) => x.id !== d.id))} className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Delete file">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}