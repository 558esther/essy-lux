import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ImageUploader, type UploaderImage } from "@/components/ImageUploader";
import {
  createCategory,
  deleteCategory,
  listAllCategories,
  updateCategory,
  type CategoryInput,
} from "@/lib/queries/admin-categories";
import { uploadImageFile } from "@/lib/queries/storage";
import type { Category } from "@/lib/types";

function friendlySlugError(err: unknown, kind: string): string {
  const pg = err as { code?: string } | null;
  if (pg?.code === "23505") return `A ${kind} with this name already exists. Please choose a different name.`;
  if (err instanceof Error) return err.message;
  return `Could not save ${kind}.`;
}

export const Route = createFileRoute("/categories")({
  component: AdminCategories,
});

const EMPTY: CategoryInput = { name: "", description: "", image_url: null, active: true, display_order: 0 };

function AdminCategories() {
  const queryClient = useQueryClient();
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: listAllCategories,
  });
  const [editing, setEditing] = useState<Category | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<CategoryInput>(EMPTY);
  const [image, setImage] = useState<UploaderImage[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
  }

  function openNew() {
    setEditing(null);
    setForm(EMPTY);
    setImage([]);
    setDialogOpen(true);
  }

  function openEdit(c: Category) {
    setEditing(c);
    setForm({
      name: c.name,
      description: c.description,
      image_url: c.image_url,
      active: c.active,
      display_order: c.display_order,
    });
    setImage(c.image_url ? [{ url: c.image_url }] : []);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Please enter a category name.");
      return;
    }
    setSaving(true);
    try {
      const input = { ...form, image_url: image[0]?.url ?? null };
      if (editing) {
        await updateCategory(editing.id, input);
        toast.success("Category updated.");
      } else {
        await createCategory(input);
        toast.success("Category added.");
      }
      setDialogOpen(false);
      invalidate();
    } catch (err) {
      toast.error(friendlySlugError(err, "category"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteCategory(deleteTarget.id);
    toast.success(`${deleteTarget.name} deleted.`);
    invalidate();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl uppercase tracking-wide">Categories</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openNew}>
              + Add Category
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit category" : "Add category"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Name</label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Satchel" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Description</label>
                <Textarea
                  value={form.description ?? ""}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Category image</label>
                <ImageUploader
                  images={image}
                  uploadFn={(file) => uploadImageFile(file, "categories")}
                  onAdd={(urls) => setImage(urls.slice(-1).map((url) => ({ url })))}
                  onRemove={() => setImage([])}
                  onSetMain={() => {}}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Active</span>
                <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="hidden overflow-hidden rounded-lg border border-border bg-shell md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Image</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {categories.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <img
                    src={c.image_url ?? "/placeholder.svg"}
                    alt=""
                    className="h-10 w-10 rounded object-cover"
                  />
                </TableCell>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-muted-foreground">{c.slug}</TableCell>
                <TableCell>
                  <Badge variant={c.active ? "default" : "secondary"}>{c.active ? "Active" : "Inactive"}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(c)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(c)}
                  >
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-3 md:hidden">
        {!isLoading && categories.length === 0 && (
          <p className="rounded-lg border border-border bg-shell py-8 text-center text-sm text-muted-foreground">No categories yet.</p>
        )}
        {isLoading && <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>}
        {categories.map((c) => (
          <div key={c.id} className="rounded-lg border border-border bg-shell p-3">
            <div className="flex items-center gap-3">
              <img src={c.image_url ?? "/placeholder.svg"} alt="" className="h-12 w-12 shrink-0 rounded object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{c.name}</p>
                <p className="truncate text-xs text-muted-foreground">{c.slug}</p>
              </div>
              <Badge variant={c.active ? "default" : "secondary"}>{c.active ? "Active" : "Inactive"}</Badge>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="outline" className="h-10" onClick={() => openEdit(c)}>
                Edit
              </Button>
              <Button variant="outline" className="h-10 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(c)}>
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete category?"
        description={`Products using "${deleteTarget?.name}" will keep their data but show no category until reassigned.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
      />
    </div>
  );
}
