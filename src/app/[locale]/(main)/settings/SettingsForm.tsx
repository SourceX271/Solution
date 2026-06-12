"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
        toast.success("头像上传成功");
      } else {
        toast.error(data.error || "上传失败");
      }
    } catch {
      toast.error("上传失败");
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
        toast.success("资料已更新");
        router.refresh();
      } else {
        toast.error(data.error || "更新失败");
      }
    } catch {
      toast.error("更新失败");
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("新密码至少6位");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("两次密码不一致");
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
        toast.success("密码已更改");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast.error(data.error || "密码更改失败");
      }
    } catch {
      toast.error("密码更改失败");
    }
  };

  return (
    <div className="space-y-8">
      {/* Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle>个人资料</CardTitle>
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
                  {uploading ? "上传中..." : "更换头像"}
                </Label>
                <input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploading} />
                <p className="text-xs text-muted-foreground">支持 JPG、PNG、GIF，最大 2MB</p>
              </div>
            </div>

            <div>
              <Label htmlFor="name">昵称</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="你的昵称" />
            </div>

            <div>
              <Label htmlFor="bio">简介</Label>
              <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="介绍一下自己..." rows={3} />
            </div>

            <Button type="submit">保存资料</Button>
          </form>
        </CardContent>
      </Card>

      {/* Password Card */}
      <Card>
        <CardHeader>
          <CardTitle>修改密码</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <Label htmlFor="current-password">当前密码</Label>
              <Input id="current-password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="new-password">新密码</Label>
              <Input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} />
            </div>
            <div>
              <Label htmlFor="confirm-password">确认新密码</Label>
              <Input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            </div>
            <Button type="submit" variant="secondary">更改密码</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}