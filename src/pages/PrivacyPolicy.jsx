import { Link } from 'react-router-dom'
import Footer from '@/components/Footer'

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 max-w-2xl mx-auto px-4 py-8 pb-safe">
        <Link to="/" className="text-sm text-osps-gray hover:text-osps-black">
          ← Back
        </Link>

        <h1 className="text-3xl font-display font-bold text-osps-red mt-4 mb-2">
          Privacy Policy
        </h1>
        <p className="text-xs text-osps-gray mb-8">Last updated: February 23, 2026</p>

        <div className="prose prose-sm max-w-none font-body text-osps-black space-y-6">
          <section>
            <h2 className="text-lg font-display font-semibold mb-2">Overview</h2>
            <p className="text-sm text-osps-gray leading-relaxed">
              O$P$ ("Owe Money, Pay Money") is a free, open-source expense splitting
              application. We respect your privacy and collect only the minimum data
              needed to provide the service. We do not sell, rent, or share your
              personal information with third parties for marketing purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-display font-semibold mb-2">What We Collect</h2>
            <p className="text-sm text-osps-gray leading-relaxed mb-2">
              <strong className="text-osps-black">Account information:</strong> When
              you sign up, we store your email address and display name. If you sign
              in with Google, we receive your name, email, and profile picture from
              Google's OAuth service.
            </p>
            <p className="text-sm text-osps-gray leading-relaxed mb-2">
              <strong className="text-osps-black">Expense data:</strong> Group names,
              expense descriptions, amounts, split details, and settlement records
              that you create within the app.
            </p>
            <p className="text-sm text-osps-gray leading-relaxed mb-2">
              <strong className="text-osps-black">Receipt images:</strong> If you use
              the receipt scanning feature, your receipt photos are stored in a private
              storage bucket. Images are processed by a third-party AI vision model
              (via OpenRouter) for text extraction. Receipt images are only accessible
              to authenticated group members.
            </p>
            <p className="text-sm text-osps-gray leading-relaxed">
              <strong className="text-osps-black">Technical data:</strong> We do not
              use analytics trackers or third-party cookies. Standard server logs
              (IP addresses, timestamps) may be retained by our hosting providers
              (Netlify, Supabase) per their respective privacy policies.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-display font-semibold mb-2">How We Use Your Data</h2>
            <p className="text-sm text-osps-gray leading-relaxed">
              Your data is used solely to provide the expense splitting service:
              authenticating your identity, storing your expenses and groups,
              computing balances, sending transactional emails (account confirmation,
              password reset, group invitations), and parsing receipts. We do not
              use your data for advertising, profiling, or any purpose unrelated to
              the core functionality of the app.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-display font-semibold mb-2">Third-Party Services</h2>
            <p className="text-sm text-osps-gray leading-relaxed mb-2">
              O$P$ relies on the following third-party services, each with their own
              privacy policies:
            </p>
            <p className="text-sm text-osps-gray leading-relaxed">
              <strong className="text-osps-black">Supabase</strong> — database, authentication,
              and file storage (hosted in Singapore).{' '}
              <strong className="text-osps-black">Netlify</strong> — web hosting and
              serverless functions.{' '}
              <strong className="text-osps-black">Google</strong> — OAuth sign-in
              (only if you choose Google login).{' '}
              <strong className="text-osps-black">Resend</strong> — transactional
              email delivery.{' '}
              <strong className="text-osps-black">OpenRouter</strong> — AI vision
              model for receipt parsing (receipt images are sent to their API for
              text extraction only).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-display font-semibold mb-2">Data Security</h2>
            <p className="text-sm text-osps-gray leading-relaxed">
              Authentication tokens are encrypted with AES-256-GCM and stored in
              httpOnly cookies that JavaScript cannot access. All communication is
              over HTTPS. Database access is protected by Row Level Security policies
              ensuring users can only access their own groups and expenses. Passwords
              are hashed with bcrypt by Supabase and never stored in plaintext.
              Receipt images are stored in a private bucket accessible only via
              time-limited signed URLs.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-display font-semibold mb-2">Data Retention</h2>
            <p className="text-sm text-osps-gray leading-relaxed">
              Your account and expense data is retained for as long as your account
              exists. When you delete an expense, associated splits, line items, and
              receipt images are permanently removed. You can request deletion of your
              account and all associated data by contacting us.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-display font-semibold mb-2">Your Rights</h2>
            <p className="text-sm text-osps-gray leading-relaxed">
              You can view, edit, and delete your expense data directly within the
              app. You can leave any group at any time. For account deletion or data
              export requests, contact us at the email below.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-display font-semibold mb-2">Open Source</h2>
            <p className="text-sm text-osps-gray leading-relaxed">
              O$P$ is fully open source. You can inspect exactly what data is
              collected and how it is handled by reviewing the source code at{' '}
              <a
                href="https://github.com/ClementLSW/osps"
                target="_blank"
                rel="noopener noreferrer"
                className="text-osps-red hover:underline"
              >
                github.com/ClementLSW/osps
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-display font-semibold mb-2">Contact</h2>
            <p className="text-sm text-osps-gray leading-relaxed">
              For privacy questions or data requests, contact{' '}
              <a
                href="mailto:contact@clementlsw.com"
                className="text-osps-red hover:underline"
              >
                contact@clementlsw.com
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-display font-semibold mb-2">Changes</h2>
            <p className="text-sm text-osps-gray leading-relaxed">
              We may update this policy from time to time. Changes will be reflected
              on this page with an updated date. Continued use of the app after
              changes constitutes acceptance of the revised policy.
            </p>
          </section>
        </div>
      </div>
      <Footer />
    </div>
  )
}
