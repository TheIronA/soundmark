"use client";

// Edit the current user's display name and profile picture. Follows the same
// pattern as moment-capture.tsx: pick an image, upload it via lib/storage,
// then write the row (here, upsertProfile instead of createMoment).

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, User as UserIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { MEDIA_BUCKET, buildAvatarPath, uploadObject } from "@/lib/storage";
import { upsertProfile } from "@/lib/profile";
import { uniqueId } from "@/lib/utils";

export interface ProfileFormProps {
  userId: string;
  email: string | null;
  initialUsername: string;
  initialAvatarUrl: string | null;
  initialAvatarPath: string | null;
}

export function ProfileForm({
  userId,
  email,
  initialUsername,
  initialAvatarUrl,
  initialAvatarPath,
}: ProfileFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [username, setUsername] = useState(initialUsername);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    initialAvatarUrl,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const handleAvatarPicked = (file: File | null) => {
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatus(null);
    setSaving(true);
    const supabase = createClient();

    try {
      let avatarPath: string | undefined;
      if (avatarFile) {
        const ext = avatarFile.name.split(".").pop() || "jpg";
        avatarPath = buildAvatarPath(userId, `${uniqueId()}.${ext}`);
        await uploadObject(supabase, avatarPath, avatarFile);
      }

      await upsertProfile(supabase, userId, {
        username: username.trim() || null,
        ...(avatarPath ? { avatar_path: avatarPath } : {}),
      });

      // Clean up the previous avatar object now that the new one is saved.
      if (avatarPath && initialAvatarPath && initialAvatarPath !== avatarPath) {
        await supabase.storage.from(MEDIA_BUCKET).remove([initialAvatarPath]);
      }

      setStatus("Profile saved.");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't save your profile.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-5">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleAvatarPicked(e.target.files?.[0] ?? null)}
      />

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="group relative size-20 shrink-0 overflow-hidden rounded-full border-3 border-border shadow-neo-sm"
          aria-label="Change profile picture"
        >
          {avatarPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarPreview}
              alt="Your profile picture"
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center bg-muted text-muted-foreground">
              <UserIcon className="size-8" />
            </div>
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-[11px] font-medium text-transparent transition-colors group-hover:bg-black/50 group-hover:text-white">
            Change
          </span>
        </button>
        <div className="flex flex-col gap-1">
          {email && (
            <span className="text-sm font-medium">{email}</span>
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="self-start text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Change photo
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="How should we call you?"
          maxLength={32}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {status && !error && (
        <p className="text-sm text-muted-foreground">{status}</p>
      )}

      <Button type="submit" disabled={saving} className="self-start">
        {saving ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : (
          <Check className="mr-2 size-4" />
        )}
        Save changes
      </Button>
    </form>
  );
}
