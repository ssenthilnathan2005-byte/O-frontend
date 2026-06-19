import { ArrowLeft } from "lucide-react";
import { useRouter } from "../router/RouterContext";

export default function TermsPage() {
  const { goBack } = useRouter();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button
            type="button"
            onClick={goBack}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <span className="text-gray-300">|</span>
          <span className="text-sm font-semibold text-gray-800">Terms & Conditions</span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">

          {/* Title */}
          <div className="mb-8 pb-6 border-b border-gray-100">
            <div className="flex items-center gap-3 mb-3">
              <img
                src="/assets/Logo.jpg"
                alt="Doctor Booked"
                className="w-10 h-10 rounded-full object-cover"
                onError={e => {
                  (e.target as HTMLImageElement).src =
                    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Ccircle cx='20' cy='20' r='20' fill='%2314b8a6'/%3E%3Ctext x='50%25' y='55%25' dominant-baseline='middle' text-anchor='middle' fill='white' font-size='18' font-family='sans-serif'%3EDB%3C/text%3E%3C/svg%3E";
                }}
              />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Terms & Conditions</h1>
                <p className="text-xs text-gray-400 mt-0.5">Last updated: June 2026 · Doctor Booked · Udyam Registered Startup</p>
              </div>
            </div>
            <div className="bg-teal-50 border border-teal-100 rounded-xl px-4 py-3 text-sm text-teal-800">
              By creating an account or using Doctor Booked, you agree to these terms. Please read them carefully.
            </div>
          </div>

          <div className="space-y-8 text-sm text-gray-600 leading-relaxed">

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-3">1. About Doctor Booked</h2>
              <p>
                Doctor Booked is a Udyam-registered startup operating across India. We provide an online platform
                that allows patients to book doctor appointments, receive a real-time token number, and track their
                queue position live — eliminating unnecessary waiting at clinics and hospitals.
              </p>
              <p className="mt-2">
                Our platform connects patients with hospitals and doctors, making healthcare access simpler,
                faster, and more transparent for everyone.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-3">2. Token-Based Appointment System</h2>
              <p>
                Doctor Booked uses a unique token system. When a patient books an appointment, they receive a
                numbered token. Each token costs <strong>₹10</strong> as a nominal booking fee. This fee is
                non-refundable once the token is confirmed.
              </p>
              <p className="mt-2">
                Doctors registered on Doctor Booked receive a <strong>40% commission (₹4 per token)</strong> for
                every appointment booked with them. This commission is credited automatically and doctors are
                never charged a subscription or joining fee.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-3">3. Patient Responsibilities</h2>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Patients must provide accurate personal information during registration.</li>
                <li>Patients are responsible for arriving at the hospital when their token is near.</li>
                <li>Doctor Booked sends real-time notifications to help patients track their turn.</li>
                <li>Tokens are non-transferable and valid only for the booked date and session.</li>
                <li>Patients must not misuse the platform or book multiple tokens to block slots.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-3">4. Doctor & Hospital Responsibilities</h2>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Doctors must maintain accurate availability and session timings on the platform.</li>
                <li>Hospitals are responsible for ensuring their listed information is current.</li>
                <li>Doctors and hospitals must not manipulate token queues or appointment counts.</li>
                <li>Doctor login credentials are personal and must not be shared.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-3">5. Payments & Fees</h2>
              <p>
                The ₹10 token booking fee is collected via Razorpay, our secure payment partner. Doctor Booked
                retains 60% (₹6) and the remaining 40% (₹4) is credited to the respective doctor.
              </p>
              <p className="mt-2">
                Refunds are not provided for booked tokens unless the doctor cancels the session. In case of
                session cancellation by the hospital or doctor, a full refund will be processed within 5–7
                business days.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-3">6. Privacy & Data</h2>
              <p>
                Doctor Booked collects only the information necessary to operate the platform — your name,
                email, and appointment history. We do not sell your data to third parties.
              </p>
              <p className="mt-2">
                Notifications (SMS, email, in-app) are sent only for appointment-related updates. You may
                opt out of non-essential communications at any time from your profile settings.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-3">7. Platform Availability</h2>
              <p>
                Doctor Booked strives to maintain 24/7 availability. However, we do not guarantee uninterrupted
                service. Scheduled maintenance will be communicated in advance where possible.
              </p>
              <p className="mt-2">
                We are not liable for missed appointments due to technical issues beyond our control. In such
                cases, contact our support for assistance.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-3">8. Prohibited Use</h2>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Creating fake accounts or impersonating doctors/patients.</li>
                <li>Attempting to hack, scrape, or exploit the platform.</li>
                <li>Using the platform for any purpose other than healthcare appointment booking.</li>
                <li>Posting false reviews or ratings about doctors or hospitals.</li>
              </ul>
              <p className="mt-2">
                Violation of these terms may result in immediate account suspension and legal action where applicable.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-3">9. Changes to These Terms</h2>
              <p>
                Doctor Booked reserves the right to update these Terms & Conditions at any time. Continued use
                of the platform after changes are posted constitutes acceptance of the updated terms.
                Significant changes will be notified via email.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-3">10. Contact Us</h2>
              <p>
                For any questions, concerns, or support regarding these terms or your account, please reach
                out to us at:
              </p>
              <div className="mt-3 bg-gray-50 rounded-xl p-4 space-y-1">
                <p><span className="font-medium text-gray-800">Website:</span> <a href="https://www.doctorbooked.in" className="text-teal-600 hover:underline" target="_blank" rel="noopener noreferrer">www.doctorbooked.in</a></p>
                <p><span className="font-medium text-gray-800">Email:</span> support@doctorbooked.in</p>
                <p><span className="font-medium text-gray-800">Registered in:</span> India (Udyam Registered Startup)</p>
              </div>
            </section>

          </div>

          {/* Footer */}
          <div className="mt-10 pt-6 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-400">
              © 2026 Doctor Booked. All rights reserved. · Udyam Registered · Made in India 🇮🇳
            </p>
            <button
              type="button"
              onClick={goBack}
              className="mt-4 inline-flex items-center gap-2 text-sm text-teal-600 hover:text-teal-700 font-medium"
            >
              <ArrowLeft className="w-4 h-4" /> Back to App
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
