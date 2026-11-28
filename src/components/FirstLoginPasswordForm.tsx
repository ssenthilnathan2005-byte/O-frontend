import { Check, Eye, EyeOff, Loader2, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  /** Minimum length enforced for this role (the backend enforces the same value). */
  minLength?: number;
  /** Temporary password the user just signed in with. If given, the new password must differ from it. */
  tempPassword?: string;
  loading?: boolean;
  /** Called only when both fields are valid and identical. */
  onSubmit: (newPassword: string) => void | Promise<void>;
};

/**
 * Mandatory first-time password screen body, shared by every staff login
 * (Nurse, Front Office, Pharmacy, Hospital Lab, Lab Admin, Hospital Admin, Doctor).
 * Fields: New Password + Confirm New Password, each with a show/hide icon,
 * live match message, and a submit button that stays disabled until valid.
 */
export default function FirstLoginPasswordForm({ minLength = 6, tempPassword, loading = false, onSubmit }: Props) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const longEnough = newPassword.length >= minLength;
  const sameAsTemp = !!tempPassword && newPassword.length > 0 && newPassword === tempPassword;
  const matches = confirmPassword.length > 0 && newPassword === confirmPassword;
  const showMatchMessage = confirmPassword.length > 0;
  const canSubmit = longEnough && !sameAsTemp && matches && !loading;

  function submit() {
    if (!canSubmit) return;
    void onSubmit(newPassword);
  }

  return (
    <>
      <div className="space-y-1.5">
        <Label>New Password</Label>
        <div className="relative">
          <Input
            type={showNew ? "text" : "password"}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder={`Min ${minLength} characters`}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className="pr-10"
            autoComplete="new-password"
            autoFocus
          />
          <button
            type="button"
            onClick={() => setShowNew((v) => !v)}
            aria-label={showNew ? "Hide password" : "Show password"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {newPassword.length > 0 && !longEnough && (
          <p className="text-xs text-red-600">Password must be at least {minLength} characters.</p>
        )}
        {sameAsTemp && (
          <p className="text-xs text-red-600">New password must be different from your temporary password.</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>Confirm New Password</Label>
        <div className="relative">
          <Input
            type={showConfirm ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter new password"
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className="pr-10"
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowConfirm((v) => !v)}
            aria-label={showConfirm ? "Hide password" : "Show password"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {showMatchMessage && (
          matches ? (
            <p className="text-xs text-green-600 flex items-center gap-1"><Check className="w-3.5 h-3.5" />Passwords match.</p>
          ) : (
            <p className="text-xs text-red-600 flex items-center gap-1"><X className="w-3.5 h-3.5" />Passwords do not match.</p>
          )
        )}
      </div>

      <Button type="button" className="w-full" onClick={submit} disabled={!canSubmit}>
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Password & Sign In"}
      </Button>
    </>
  );
}
