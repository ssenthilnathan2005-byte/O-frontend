import React from "react";

export default function DeleteAccountPage() {
  return (
    <div style={{ maxWidth: 600, margin: "40px auto", padding: "0 20px", fontFamily: "sans-serif" }}>
      <h1>Delete Your Account</h1>
      <p>If you wish to delete your Doctor Booked account and all associated data, please follow the steps below:</p>
      <h2>How to delete your account</h2>
      <ol>
        <li>Open the Doctor Booked app and log in.</li>
        <li>Go to your <strong>Profile</strong> section.</li>
        <li>Tap <strong>Delete Account</strong> and confirm.</li>
      </ol>
      <p>Alternatively, you can email us at <a href="mailto:support@doctorbooked.in">support@doctorbooked.in</a> with the subject <strong>"Delete My Account"</strong> and we will process your request within 7 business days.</p>
      <h2>What gets deleted</h2>
      <ul>
        <li>Your profile and personal information</li>
        <li>Your booking history</li>
        <li>All account data associated with your phone number or email</li>
      </ul>
      <p>For any questions, contact us at <a href="mailto:support@doctorbooked.in">support@doctorbooked.in</a>.</p>
    </div>
  );
}
