import { useRef, useState } from "react";
import { ImagePlus, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export type UploaderImage = { url: string; id?: string };

const ACCEPTED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

export function ImageUploader({
  images,
  onAdd,
  onRemove,
  onSetMain,
  onReorder,
  uploadFn,
  disabled,
  label = "Photos",
}: {
  images: UploaderImage[];
  onAdd: (urls: string[]) => void;
  onRemove: (image: UploaderImage, index: number) => void;
  onSetMain: (image: UploaderImage, index: number) => void;
  /** Called with the index to move and its new index, when the admin reorders photos. */
  onReorder?: (fromIndex: number, toIndex: number) => void;
  uploadFn: (file: File) => Promise<string>;
  disabled?: boolean;
  label?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const valid = Array.from(files).filter((f) => ACCEPTED_TYPES.includes(f.type));
    if (valid.length === 0) {
      toast.error("Please choose JPG, PNG or WEBP images.");
      return;
    }
    setUploading(true);
    try {
      const urls = await Promise.all(valid.map((f) => uploadFn(f)));
      onAdd(urls);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Image upload failed.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => !disabled && !uploading && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-disabled={disabled || uploading}
        className={`cursor-pointer rounded-md border-2 border-dashed p-8 text-center transition-colors ${
          dragOver ? "border-primary bg-secondary/50" : "border-border hover:border-primary/60"
        } ${disabled || uploading ? "pointer-events-none opacity-60" : ""}`}
      >
        <ImagePlus className="mx-auto h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
        <p className="mt-3 text-sm font-medium">📷 {label}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {uploading ? "Uploading…" : "Tap to choose photos from your device, or drag and drop them here."}
        </p>
        <span className="mt-3 inline-flex h-10 items-center rounded-md border border-input bg-background px-4 text-sm font-medium shadow-sm">
          Choose photos
        </span>
        <p className="mt-1 text-[0.7rem] text-muted-foreground">JPG, JPEG, PNG or WEBP</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          hidden
          disabled={disabled || uploading}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {images.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {images.map((img, i) => (
            <div
              key={img.id ?? img.url}
              className="group relative overflow-hidden rounded-md border border-border bg-shell"
            >
              <img src={img.url} alt="" className="aspect-square w-full object-cover" />
              {i === 0 && (
                <span className="absolute left-1.5 top-1.5 rounded bg-primary px-1.5 py-0.5 text-[0.625rem] font-semibold text-primary-foreground">
                  Main
                </span>
              )}
              {onReorder && images.length > 1 && (
                <>
                  {i > 0 && (
                    <button
                      type="button"
                      onClick={() => onReorder(i, i - 1)}
                      aria-label="Move image earlier"
                      className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-black/55 p-1.5 text-white opacity-100 transition-opacity hover:bg-black/70 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                    >
                      <ChevronLeft className="h-4 w-4" strokeWidth={2} />
                    </button>
                  )}
                  {i < images.length - 1 && (
                    <button
                      type="button"
                      onClick={() => onReorder(i, i + 1)}
                      aria-label="Move image later"
                      className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-black/55 p-1.5 text-white opacity-100 transition-opacity hover:bg-black/70 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                    >
                      <ChevronRight className="h-4 w-4" strokeWidth={2} />
                    </button>
                  )}
                </>
              )}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-black/55 p-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                {i !== 0 && (
                  <button
                    type="button"
                    onClick={() => onSetMain(img, i)}
                    className="rounded px-2 py-2 text-[0.6875rem] font-medium text-white hover:bg-white/20"
                  >
                    Set main
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onRemove(img, i)}
                  className="ml-auto rounded p-2 text-white hover:bg-white/20"
                  aria-label="Remove image"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
