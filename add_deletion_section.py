#!/usr/bin/env python3
"""
add_deletion_section.py — Inserts an "Account Deletion" section into
PrivacyPage.tsx, right after the existing Email contact line.

Run from the O-frontend project root:
    python3 add_deletion_section.py
"""

import sys
from pathlib import Path

ROOT = Path.cwd()
TARGET = ROOT / "src/pages/PrivacyPage.tsx"

ANCHOR = '<p className="mt-1"><strong>Email:</strong> doctorbookedsn1@gmail.com</p>'

NEW_SECTION = '''

              <h2 id="account-deletion" className="text-base font-bold text-gray-900 mt-6 mb-3">Account Deletion</h2>
              <p className="mt-1">
                You can request deletion of your Doctor Booked account and all associated
                personal data at any time.
              </p>
              <p className="mt-1">
                <strong>How to request:</strong> Email{" "}
                <a href="mailto:doctorbookedsn1@gmail.com" className="text-teal-600 underline">doctorbookedsn1@gmail.com</a>{" "}
                from your registered email or phone number, with the subject line "Delete My Account."
              </p>
              <p className="mt-1">
                <strong>What happens:</strong> Your account and personal data (profile information,
                appointment history, and login credentials) will be automatically deleted within
                6 days of your request. If automatic deletion does not occur, our team will
                manually process and confirm the deletion.
              </p>
              <p className="mt-1">
                <strong>Data retained:</strong> Payment transaction records processed through
                Razorpay may be retained separately by Razorpay as required by Indian financial
                regulations, independent of your Doctor Booked account deletion.
              </p>'''


def fail(msg: str):
    print(f"❌ {msg}")
    sys.exit(1)


def main():
    print("Doctor Booked — Add Account Deletion section to privacy policy\n" + "=" * 60)

    if not TARGET.exists():
        fail(
            f"Could not find {TARGET}.\n"
            "Make sure you run this script from your O-frontend project root "
            "(the folder containing package.json, src/, android/)."
        )

    text = TARGET.read_text(encoding="utf-8")

    if "Account Deletion" in text:
        print("✓ Account Deletion section already present in PrivacyPage.tsx — nothing to do.")
        return

    if ANCHOR not in text:
        fail(
            f"Could not find the expected anchor line in {TARGET}:\n  {ANCHOR}\n"
            "The file may have been edited since this script was written. "
            "Aborting to avoid a bad edit — add the section manually instead."
        )

    new_text = text.replace(ANCHOR, ANCHOR + NEW_SECTION)
    TARGET.write_text(new_text, encoding="utf-8")

    print(f"✓ Inserted Account Deletion section into {TARGET}")
    print("\nNext steps:\n")
    print("  npm run build")
    print("  git add src/pages/PrivacyPage.tsx")
    print('  git commit -m "docs: add account deletion instructions to privacy policy"')
    print("  git push")
    print("\nOnce deployed, use this URL in Play Console's Data Safety form:")
    print("  https://www.doctorbooked.in/privacy#account-deletion")


if __name__ == "__main__":
    main()
