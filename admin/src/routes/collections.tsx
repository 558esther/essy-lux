import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
import { ImageUploader, type UploaderImage } from "@/components/ImageUploader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  createCollection,
  deleteCollection,
  getCollectionProductIds,
  listAllCollections,
  setCollectionProducts,
  updateCollection,
  type CollectionInput,
} from "@/lib/queries/admin-collections";
import { listProducts, uploadProductImage } from "@/lib/queries/admin-products";
import type { Collection } from "@/lib/types";

function friendlySlugError(err: unknown, kind: string): string {
  const pg = err as { code?: string } | null;
  if (pg?.code === "23505") return `A ${kind} with this name already exists. Please choose a different name.`;
  if (err instanceof Error) return err.message;
  return `Could not save ${kind}.`;
}

export const Route = createFileRoute("/collections")({
  component: AdminCollections,
});

const EMPTY: CollectionInput = {
  name: "",
  description: "",
  cover_image_url: null,
  display_order: 0,
  active: true,
};

function AdminCollections() {
  const queryClient = useQueryClient();
  const { data: collections = [], isLoading } = useQuery({
    queryKey: ["admin", "collections"],
    queryFn: listAllCollections,
  });
  const { data: products = [] } = useQuery({ queryKey: ["admin", "products", "all"], queryFn: () => listProducts() });

  const [editing, setEditing] = useState<Collection | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<CollectionInput>(EMPTY);
  const [cover, setCover] = useState<UploaderImage[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Collection | null>(null);
  const [saving, setSaving] = useState(false);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin", "collections"] });
  }

  function openNew() {
    setEditing(null);
    setForm(EMPTY);
    setCover([]);
    setSelectedProductIds([]);
    setDialogOpen(true);
  }

  async function openEdit(c: Collection) {
    setEditing(c);
    setForm({
      name: c.name,
      description: c.description,
      cover_image_url: c.cover_image_url,
      display_order: c.display_order,
      active: c.active,
    });
    setCover(c.cover_image_url ? [{ url: c.cover_image_url }] : []);
    setDialogOpen(true);
    const ids = await getCollectionProductIds(c.id);
    setSelectedProductIds(ids);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Please enter a collection name.");
      return;
    }
    setSaving(true);
    try {
      const input = { ...form, cover_image_url: cover[0]?.url ?? null };
      let id = editing?.id;
      if (editing) {
        await updateCollection(editing.id, input);
      } else {
        id = await createCollection(input);
      }
      if (id) await setCollectionProducts(id, selectedProductIds);
      toast.success(editing ? "Collection updated." : "Collection added.");
      setDialogOpen(false);
      invalidate();
    } catch (err) {
      toast.error(friendlySlugError(err, "collection"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteCollection(deleteTarget.id);
    toast.success(`${deleteTarget.name} deleted.`);
    invalidate();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl uppercase tracking-wide">Collections</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openNew}>
              + Add Collection
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit collection" : "Add collection"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Collection name</label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="The Feminine Edit" />
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
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Cover image</label>
                <ImageUploader
                  images={cover}
                  uploadFn={uploadProductImage}
                  onAdd={(urls) => setCover(urls.slice(-1).map((url) => ({ url })))}
                  onRemove={() => setCover([])}
                  onSetMain={() => {}}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Products in this collection</label>
                <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-md border border-border p-3">
                  {products.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={selectedProductIds.includes(p.id)}
                        onCheckedChange={(checked) =>
                          setSelectedProductIds((prev) =>
                            checked ? [...prev, p.id] : prev.filter((id) => id !== p.id),
                          )
                        }
                      />
                      {p.name}
                    </label>
                  ))}
                </div>
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
              <TableHead>Cover</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Products</TableHead>
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
            {collections.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <img
                    src={c.cover_image_url ?? "/placeholder.svg"}
                    alt=""
                    className="h-12 w-16 rounded object-cover"
                  />
                </TableCell>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{c.productCount}</TableCell>
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
        {!isLoading && collections.length === 0 && (
          <p className="rounded-lg border border-border bg-shell py-8 text-center text-sm text-muted-foreground">No collections yet.</p>
        )}
        {isLoading && <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>}
        {collections.map((c) => (
          <div key={c.id} className="rounded-lg border border-border bg-shell p-3">
            <div className="flex items-center gap-3">
              <img src={c.cover_image_url ?? "/placeholder.svg"} alt="" className="h-14 w-16 shrink-0 rounded object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">{c.productCount} products</p>
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
        title="Delete collection?"
        description={`"${deleteTarget?.name}" will be removed. Products themselves are not deleted.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
      />
    </div>
  );
}
