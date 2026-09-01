import { ArrowLeft } from "lucide-react";
import { useRouter } from "../router/RouterContext";

export default function PrivacyPage() {
  const { goBack } = useRouter();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button type="button" onClick={goBack} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <span className="text-gray-300">|</span>
          <span className="text-sm font-semibold text-gray-800">Privacy Policy</span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="mb-8 pb-6 border-b border-gray-100">
            <h1 className="text-2xl font-bold text-gray-900">Privacy Policy</h1>
            <p className="text-sm text-gray-500 mt-2">Last updated: September 1, 2026</p>
            <p className="text-sm text-gray-600 mt-3">This Privacy Policy describes how Doctor Booked ("we", "us", or "our") collects, uses, and protects your information when you use our app and website at doctorbooked.in.</p>
          </div>

          <div className="space-y-8 text-gray-700 text-sm leading-relaxed">

            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-2">1. Information We Collect</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Account information:</strong> Name, email address, and phone number when you register.</li>
                <li><strong>Location:</strong> Your device location (foreground only) when you use the "Near Me" feature to find nearby hospitals. This is optional and only collected when you explicitly request it.</li>
                <li><strong>Microphone / Voice:</strong> Audio is captured only when you use the voice chatbot feature. Audio is processed on-device by Android's SpeechRecognizer — we only receive the resulting text transcript, not the raw audio.</li>
                <li><strong>Booking data:</strong> Appointment and queue information you create within the app.</li>
                <li><strong>Payment information:</strong> Payments are processed by Razorpay. We only receive a payment confirmation (order ID, payment ID, and signature). We never see or store your card, UPI, or bank details.</li>
                <li><strong>Device tokens:</strong> Firebase Cloud Messaging (FCM) tokens for sending push notifications about your bookings and queue status.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-2">2. How We Use Your Information</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>To create and manage your account.</li>
                <li>To process appointment bookings and manage queue tokens.</li>
                <li>To send real-time push notifications about your queue status and bookings.</li>
                <li>To show nearby hospitals based on your location (only when requested).</li>
                <li>To process payments securely via Razorpay.</li>
                <li>To improve app performance and fix issues.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-2">3. Data Sharing</h2>
              <p>We do not sell or share your personal data with third parties for marketing purposes. We share data only with:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li><strong>Razorpay</strong> — for payment processing (PCI-DSS compliant).</li>
                <li><strong>Firebase (Google)</strong> — for push notifications and authentication.</li>
                <li><strong>Supabase</strong> — for secure database storage.</li>
                <li>The clinic or hospital you book an appointment with — they receive your name and booking details.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-2">4. Data Storage and Security</h2>
              <p>Your data is stored securely on Supabase (PostgreSQL) with encryption at rest and in transit. We use industry-standard security practices to protect your information.</p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-2">5. Your Rights</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>You can request deletion of your account and data by contacting us.</li>
                <li>You can disable location access or notifications at any time via your device settings.</li>
                <li>You can opt out of voice features by not using the voice chatbot.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-2">6. Children's Privacy</h2>
              <p>Doctor Booked is not intended for children under 18. We do not knowingly collect data from minors.</p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-2">7. Changes to This Policy</h2>
              <p>We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated date.</p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-2">8. Contact Us</h2>
              <p>If you have any questions about this Privacy Policy, contact us at:</p>
              <p className="mt-1"><strong>Email:</strong> support@doctorbooked.in</p>
              <p><strong>Website:</strong> doctorbooked.in</p>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}
