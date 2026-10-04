"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

interface UserData {
  name: string | null;
  email: string | null;
  image: string | null;
  bio: string | null;
}

export function SettingsForm({ user }: { user: UserData }) {
  const router = useRouter();
  const t = useTranslations("profile");
  const tc = useTranslations("common");
  const ts = useTranslations("settings");
  const [name, setName] = useState(user.name || "");
  const [bio, setBio] = useState(user.bio || "");
  const [avatarUrl, setAvatarUrl] = useState(user.image || "");
  const [uploading, setUploading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.success) {
        setAvatarUrl(data.url);
        // Update user profile
        await fetch("/api/users/" + "me", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: data.url }),
        });
        toast.success(tc("avatarUpdated"));
      } else {
        toast.error(data.error || tc("uploadFailed"));
      }
    } catch {
      toast.error(tc("uploadFailed"));
    } finally {
      setUploading(false);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/users/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, bio }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(tc("profileUpdated"));
        router.refresh();
      } else {
        toast.error(data.error || tc("updateFailed"));
      }
    } catch {
      toast.error(tc("updateFailed"));
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    // Mirror passwordChangeSchema in src/lib/validations.ts (8+ chars, letter + digit).
    if (newPassword.length < 8) {
      toast.error(tc("newPasswordMin"));
      return;
    }
    if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      toast.error(tc("newPasswordPattern"));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(tc("passwordMismatch"));
      return;
    }

    try {
      const res = await fetch("/api/users/me/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(tc("passwordUpdated"));
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast.error(data.error || tc("passwordFailed"));
      }
    } catch {
      toast.error(tc("passwordFailed"));
    }
  };

  return (
    <div className="space-y-8">
      {/* Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfileUpdate} className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={avatarUrl || ""} alt={name} />
                <AvatarFallback className="text-xl">{name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <Label htmlFor="avatar-upload" className="cursor-pointer text-sm text-primary hover:underline">
                  {uploading ? t("avatarUploading") : t("avatarChange")}
                </Label>
                <input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploading} />
                <p className="text-xs text-muted-foreground">{t("avatarHint")}</p>
              </div>
            </div>

            <div>
              <Label htmlFor="name">{t("nickname")}</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("nicknamePlaceholder")} />
            </div>

            <div>
              <Label htmlFor="bio">{t("bio")}</Label>
              <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} placeholder={t("bioPlaceholder")} rows={3} />
            </div>

            <Button type="submit">{t("saveProfile")}</Button>
          </form>
        </CardContent>
      </Card>

      {/* Password Card */}
      <Card>
        <CardHeader>
          <CardTitle>{ts("changePassword")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <Label htmlFor="current-password">{ts("currentPassword")}</Label>
              <Input id="current-password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="new-password">{ts("newPassword")}</Label>
              <Input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} />
            </div>
            <div>
              <Label htmlFor="confirm-password">{ts("confirmNewPassword")}</Label>
              <Input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            </div>
            <Button type="submit" variant="secondary">{ts("changePassword")}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}