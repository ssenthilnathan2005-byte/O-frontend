import sys

def apply(path, replacements):
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    for old, new, label in replacements:
        count = content.count(old)
        if count != 1:
            print(f"[FAIL] {path}: expected 1 match for '{label}', found {count}")
            sys.exit(1)
        content = content.replace(old, new)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"[OK] {path} updated")

apply("src/api.ts", [
    (
        '  update: (id: string, data: Partial<Lab> & { mapLocation?: string }) => patch<Lab>(`/labs/${id}`, data),',
        '  update: (id: string, data: Partial<Lab> & { mapLocation?: string }) => patch<Lab>(`/labs/${id}`, data),\n'
        '  remove: (id: string) => del<{ success: boolean }>(`/labs/${id}`),',
        "labs.update -> add remove",
    ),
])

apply("src/pages/admin/AdminLabs.tsx", [
    (
        'import { Edit2, FlaskConical, KeyRound, Loader2, Plus, RefreshCw, MapPin } from "lucide-react";',
        'import { Edit2, FlaskConical, KeyRound, Loader2, Plus, RefreshCw, MapPin, Trash2 } from "lucide-react";',
        "lucide import",
    ),
    (
        '  const [resetting, setResetting] = useState(false);\n',
        '  const [resetting, setResetting] = useState(false);\n'
        '  const [deleteLab, setDeleteLab] = useState<Lab | null>(null);\n'
        '  const [deleting, setDeleting] = useState(false);\n',
        "state hooks",
    ),
    (
        '  async function handleResetLogin() {\n'
        '    if (!loginDialogLab) return;\n'
        '    setResetting(true);\n'
        '    try {\n'
        '      const res = await api.labs.resetLogin(loginDialogLab.id, newLoginIdInput.trim() || undefined);\n'
        '      setLoginInfo({ loginId: res.loginId, hasAdminAccount: res.hasAdminAccount, firstLogin: true });\n'
        '      setNewLoginIdInput("");\n'
        '      toast.success("Lab staff will need to set a new password on next login");\n'
        '    } catch (err: any) {\n'
        '      toast.error(err.message || "Failed to reset login");\n'
        '    } finally {\n'
        '      setResetting(false);\n'
        '    }\n'
        '  }',
        '  async function handleResetLogin() {\n'
        '    if (!loginDialogLab) return;\n'
        '    setResetting(true);\n'
        '    try {\n'
        '      const res = await api.labs.resetLogin(loginDialogLab.id, newLoginIdInput.trim() || undefined);\n'
        '      setLoginInfo({ loginId: res.loginId, hasAdminAccount: res.hasAdminAccount, firstLogin: true });\n'
        '      setNewLoginIdInput("");\n'
        '      toast.success("Lab staff will need to set a new password on next login");\n'
        '    } catch (err: any) {\n'
        '      toast.error(err.message || "Failed to reset login");\n'
        '    } finally {\n'
        '      setResetting(false);\n'
        '    }\n'
        '  }\n'
        '\n'
        '  async function handleDeleteLab() {\n'
        '    if (!deleteLab) return;\n'
        '    setDeleting(true);\n'
        '    try {\n'
        '      await api.labs.remove(deleteLab.id);\n'
        '      toast.success(`Lab "${deleteLab.name}" deleted`);\n'
        '      setDeleteLab(null);\n'
        '      loadLabs();\n'
        '    } catch (err: any) {\n'
        '      if (err.hasBookings || /booking/i.test(err.message || "")) {\n'
        '        toast.error(err.message || "This lab has bookings and can\'t be deleted. Deactivate it instead.");\n'
        '      } else {\n'
        '        toast.error(err.message || "Failed to delete lab");\n'
        '      }\n'
        '    } finally {\n'
        '      setDeleting(false);\n'
        '    }\n'
        '  }',
        "handleDeleteLab function",
    ),
    (
        '                <TableCell>\n'
        '                  <div className="flex items-center gap-2 justify-end">\n'
        '                    <Button variant="ghost" size="sm" onClick={() => openEditLab(lab)}>\n'
        '                      <Edit2 className="w-4 h-4" />\n'
        '                    </Button>\n'
        '                    <Button variant="ghost" size="sm" onClick={() => openLoginDialog(lab)}>\n'
        '                      <KeyRound className="w-4 h-4 mr-1" /> Login\n'
        '                    </Button>\n'
        '                  </div>\n'
        '                </TableCell>',
        '                <TableCell>\n'
        '                  <div className="flex items-center gap-2 justify-end">\n'
        '                    <Button variant="ghost" size="sm" onClick={() => openEditLab(lab)}>\n'
        '                      <Edit2 className="w-4 h-4" />\n'
        '                    </Button>\n'
        '                    <Button variant="ghost" size="sm" onClick={() => openLoginDialog(lab)}>\n'
        '                      <KeyRound className="w-4 h-4 mr-1" /> Login\n'
        '                    </Button>\n'
        '                    <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => setDeleteLab(lab)}>\n'
        '                      <Trash2 className="w-4 h-4" />\n'
        '                    </Button>\n'
        '                  </div>\n'
        '                </TableCell>',
        "action buttons row",
    ),
    (
        '      {/* Login Dialog */}',
        '      {/* Delete Confirm Dialog */}\n'
        '      <Dialog open={!!deleteLab} onOpenChange={open => !open && setDeleteLab(null)}>\n'
        '        <DialogContent>\n'
        '          <DialogHeader><DialogTitle>Delete Lab</DialogTitle></DialogHeader>\n'
        '          <p className="text-sm text-muted-foreground py-2">\n'
        '            Are you sure you want to delete <span className="font-medium text-foreground">{deleteLab?.name}</span>?\n'
        '            This cannot be undone. Labs with existing bookings can\'t be deleted — deactivate them instead.\n'
        '          </p>\n'
        '          <DialogFooter>\n'
        '            <Button variant="outline" onClick={() => setDeleteLab(null)}>Cancel</Button>\n'
        '            <Button variant="destructive" onClick={handleDeleteLab} disabled={deleting}>\n'
        '              {deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}\n'
        '              Delete\n'
        '            </Button>\n'
        '          </DialogFooter>\n'
        '        </DialogContent>\n'
        '      </Dialog>\n'
        '\n'
        '      {/* Login Dialog */}',
        "delete confirm dialog",
    ),
])
