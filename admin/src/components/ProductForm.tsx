import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImageUploader, type UploaderImage } from "@/components/ImageUploader";
import { TagInput } from "@/components/TagInput";
import {
  createProduct,
  slugify,
  syncProductImages,
  updateProduct,
  uploadProductImage,
  type ProductInput,
} from "@/lib/queries/admin-products";
import type { AdminProduct, Category, Collection, ProductStatus } from "@/lib/types";
import { formatPrice } from "@/lib/format";

type Errors = Partial<
  Record<"name" | "price" | "category_id" | "description" | "images" | "slug" | "sku", string>
>;

/** Turns a raw Supabase/Postgres error into a message a store owner can actually act on. */
function describeSaveError(err: unknown): { message: string; field?: keyof Errors } {
  const pgError = err as { code?: string; message?: string; details?: string } | null;
  if (pgError?.code === "23505") {
    const text = `${pgError.message ?? ""} ${pgError.details ?? ""}`.toLowerCase();
    if (text.includes("slug")) {
      return {
        message: "A product with this name (or URL slug) already exists. Try a different name, or edit the slug below.",
        field: "slug",
      };
    }
    if (text.includes("sku")) {
      return { message: "That SKU is already used by another product. Please choose a different one.", field: "sku" };
    }
    return { message: "A product with these details already exists." };
  }
  if (err instanceof Error) return { message: err.message };
  return { message: "Could not save the product. Please check your connection and try again." };
}

export function ProductForm({
  product,
  categories,
  collections,
}: {
  product?: AdminProduct;
  categories: Category[];
  collections: Collection[];
}) {
  const navigate = useNavigate();
  const isEdit = Boolean(product);

  const [name, setName] = useState(product?.name ?? "");
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [price, setPrice] = useState(product ? String(product.price) : "");
  const [categoryId, setCategoryId] = useState<string>(product?.category_id ?? "");
  const [colors, setColors] = useState<string[]>(product?.colors.map((c) => c.name) ?? []);
  const [sizes, setSizes] = useState<string[]>(product?.sizes ?? []);
  const [material, setMaterial] = useState(product?.material ?? "");
  const [stock, setStock] = useState(product ? String(product.stock_quantity) : "0");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [images, setImages] = useState<UploaderImage[]>(
    product?.images.map((img) => ({ id: img.id, url: img.url })) ?? [],
  );
  const [collectionIds, setCollectionIds] = useState<string[]>(product?.collectionIds ?? []);
  const [featured, setFeatured] = useState(product?.featured ?? false);
  const [newArrival, setNewArrival] = useState(product?.new_arrival ?? false);
  const [bestSeller, setBestSeller] = useState(product?.best_seller ?? false);
  const [availableForSale, setAvailableForSale] = useState(product?.available_for_sale ?? true);
  const [status, setStatus] = useState<ProductStatus>(product?.status ?? "draft");
  const [lowStockThreshold, setLowStockThreshold] = useState(
    product ? String(product.low_stock_threshold) : "3",
  );
  const [seoTitle, setSeoTitle] = useState(product?.seo_title ?? "");
  const [seoDescription, setSeoDescription] = useState(product?.seo_description ?? "");
  const [seoKeywords, setSeoKeywords] = useState(product?.seo_keywords ?? "");

  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [successState, setSuccessState] = useState<{ id: string; name: string } | null>(null);

  const effectiveSlug = useMemo(() => (slugTouched ? slug : slugify(name)), [slugTouched, slug, name]);

  function validate(): boolean {
    const next: Errors = {};
    if (!name.trim()) next.name = "Please enter a product name.";
    const priceNum = Number(price);
    if (!price || Number.isNaN(priceNum) || priceNum < 0) next.price = "Please enter a valid price.";
    if (!categoryId) next.category_id = "Please select a category.";
    if (!description.trim()) next.description = "Please enter a product description.";
    if (images.length === 0) next.images = "Please upload at least one product image.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) {
      toast.error("Please fix the errors below.");
      return;
    }
    setSaving(true);
    try {
      const input: ProductInput = {
        name: name.trim(),
        slug: effectiveSlug || slugify(name),
        description: description.trim(),
        price: Number(price),
        category_id: categoryId,
        sku: sku.trim() || null,
        stock_quantity: Math.max(0, Number(stock) || 0),
        colors: colors.map((c) => ({ name: c })),
        sizes,
        material: material.trim() || null,
        status,
        featured,
        new_arrival: newArrival,
        best_seller: bestSeller,
        available_for_sale: availableForSale,
        low_stock_threshold: Math.max(0, Number(lowStockThreshold) || 3),
        seo_title: seoTitle.trim() || null,
        seo_description: seoDescription.trim() || null,
        seo_keywords: seoKeywords.trim() || null,
        collectionIds,
      };

      if (isEdit && product) {
        await updateProduct(product.id, input);
        await syncProductImages(product.id, images, product.images);
        toast.success("Product updated.");
        setSuccessState({ id: product.id, name: input.name });
      } else {
        const id = await createProduct(input);
        await syncProductImages(id, images, []);
        toast.success("Product added successfully.");
        setSuccessState({ id, name: input.name });
      }
    } catch (err) {
      const { message, field } = describeSaveError(err);
      if (field) setErrors((prev) => ({ ...prev, [field]: message }));
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  if (successState) {
    return (
      <div className="mx-auto max-w-lg rounded-lg border border-border bg-shell p-8 text-center">
        <p className="text-3xl">✓</p>
        <h2 className="mt-3 font-display text-xl uppercase tracking-wide">Product {isEdit ? "updated" : "added"} successfully</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          &ldquo;{successState.name}&rdquo; {isEdit ? "has been updated." : "has been added to your store."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button variant="outline" onClick={() => navigate({ to: "/products/$productId", params: { productId: successState.id } })}>
            Edit product
          </Button>
          <Button variant="outline" onClick={() => navigate({ to: "/products" })}>
            View products
          </Button>
          {!isEdit && (
            <Button onClick={() => window.location.reload()}>Add another product</Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-6">
        <Section title="Product information">
          <Field label="Product name" error={errors.name} required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Essy Rose Satchel"
            />
          </Field>
          <Field label="URL slug" error={errors.slug}>
            <Input
              value={effectiveSlug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(slugify(e.target.value));
                if (errors.slug) setErrors((prev) => ({ ...prev, slug: undefined }));
              }}
              placeholder="essy-rose-satchel"
            />
            <p className="mt-1 text-xs text-muted-foreground">/shop/{effectiveSlug || "product-slug"}</p>
          </Field>
          <Field label="Description" error={errors.description} required>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder="Describe this handbag…"
            />
          </Field>
        </Section>

        <Section title="Pricing & inventory">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Price (KES)" error={errors.price} required>
              <Input
                type="number"
                min={0}
                step="1"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="4500"
              />
            </Field>
            <Field label="Stock quantity">
              <Input
                type="number"
                min={0}
                value={stock}
                onChange={(e) => setStock(e.target.value)}
              />
            </Field>
            <Field label="SKU" error={errors.sku}>
              <Input
                value={sku}
                onChange={(e) => {
                  setSku(e.target.value);
                  if (errors.sku) setErrors((prev) => ({ ...prev, sku: undefined }));
                }}
                placeholder="ESSY-RS-001"
              />
            </Field>
            <Field label="Low stock warning at">
              <Input
                type="number"
                min={0}
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(e.target.value)}
              />
            </Field>
          </div>
        </Section>

        <Section title="Category, colors & material">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category" error={errors.category_id} required>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Material">
              <Input value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="Faux Leather" />
            </Field>
          </div>
          <Field label="Colors">
            <TagInput values={colors} onChange={setColors} placeholder="Blush Pink, Ivory, Brown…" />
          </Field>
          <Field label="Sizes (optional)">
            <TagInput values={sizes} onChange={setSizes} placeholder="Small, Medium, Large…" />
          </Field>
        </Section>

        <Section title="Product images" error={errors.images}>
          <ImageUploader
            label="Product images"
            images={images}
            uploadFn={uploadProductImage}
            onAdd={(urls) => setImages((prev) => [...prev, ...urls.map((url) => ({ url }))])}
            onRemove={(_img, index) => setImages((prev) => prev.filter((_, i) => i !== index))}
            onSetMain={(_img, index) =>
              setImages((prev) => {
                const next = [...prev];
                const [item] = next.splice(index, 1);
                next.unshift(item);
                return next;
              })
            }
            onReorder={(from, to) =>
              setImages((prev) => {
                const next = [...prev];
                const [item] = next.splice(from, 1);
                next.splice(to, 0, item);
                return next;
              })
            }
          />
          <p className="mt-2 text-xs text-muted-foreground">
            The first photo is used everywhere the bag is shown — product cards, search and featured
            sections. Use the arrows to reorder photos, or "Set main" to jump one to the front.
          </p>
        </Section>

        <Section title="Collections">
          <p className="text-xs text-muted-foreground">Choose which curated edits this bag belongs to.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {collections.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={collectionIds.includes(c.id)}
                  onCheckedChange={(checked) =>
                    setCollectionIds((prev) =>
                      checked ? [...prev, c.id] : prev.filter((id) => id !== c.id),
                    )
                  }
                />
                {c.name}
              </label>
            ))}
          </div>
        </Section>

        <Section title="SEO (optional)">
          <Field label="SEO title">
            <Input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} placeholder={name || "Product name"} />
          </Field>
          <Field label="SEO description">
            <Textarea
              value={seoDescription}
              onChange={(e) => setSeoDescription(e.target.value)}
              rows={2}
              placeholder={description.slice(0, 140) || "Short description for search engines"}
            />
          </Field>
          <Field label="SEO keywords">
            <Input value={seoKeywords} onChange={(e) => setSeoKeywords(e.target.value)} placeholder="handbag, satchel, luxury" />
          </Field>
        </Section>
      </div>

      <div className="space-y-6">
        <Section title="Status">
          <Field label="Publish status">
            <Select value={status} onValueChange={(v) => setStatus(v as ProductStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft (hidden)</SelectItem>
                <SelectItem value="published">Published (live)</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <ToggleRow label="Featured product" checked={featured} onCheckedChange={setFeatured} />
          <ToggleRow label="New arrival" checked={newArrival} onCheckedChange={setNewArrival} />
          <ToggleRow label="Best seller" checked={bestSeller} onCheckedChange={setBestSeller} />
          <ToggleRow label="Available for sale" checked={availableForSale} onCheckedChange={setAvailableForSale} />
          {Number(stock) <= 0 && (
            <p className="rounded-md bg-[oklch(0.92_0.07_60)] px-3 py-2 text-xs text-[oklch(0.4_0.1_60)]">
              Stock is 0 — this bag will automatically show as “Out of stock” on the shop.
            </p>
          )}
        </Section>

        <Section title="Preview">
          <div className="overflow-hidden rounded-md border border-border">
            <img
              src={images[0]?.url ?? "/placeholder.svg"}
              alt=""
              className="aspect-[4/5] w-full object-cover"
            />
            <div className="space-y-1 p-3">
              <p className="font-display text-base leading-snug">{name || "Product name"}</p>
              <p className="text-sm">{price ? formatPrice(Number(price)) : "KES —"}</p>
            </div>
          </div>
        </Section>

        <div className="sticky bottom-4 flex flex-col gap-2 rounded-lg border border-border bg-shell p-4 shadow-sm">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Save product"}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate({ to: "/products" })}>
            Cancel
          </Button>
        </div>
      </div>
    </form>
  );
}

function Section({ title, error, children }: { title: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-shell p-5">
      <h2 className="font-display text-base uppercase tracking-wide">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}

function Field({
  label,
  error,
  required,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
