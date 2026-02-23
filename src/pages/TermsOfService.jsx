import { Link } from 'react-router-dom'
import Footer from '@/components/Footer'

export default function TermsOfService() {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 max-w-2xl mx-auto px-4 py-8 pb-safe">
        <Link to="/" className="text-sm text-osps-gray hover:text-osps-black">
          ← Back
        </Link>

        <h1 className="text-3xl font-display font-bold text-osps-red mt-4 mb-2">
          Terms of Service
        </h1>
        <p className="text-xs text-osps-gray mb-8">Last updated: February 23, 2026</p>

        <div className="prose prose-sm max-w-none font-body text-osps-black space-y-6">
          <section>
            <h2 className="text-lg font-display font-semibold mb-2">Agreement</h2>
            <p className="text-sm text-osps-gray leading-relaxed">
              By accessing or using O$P$ ("Owe Money, Pay Money") at{' '}
              <a
                href="https://osps.clementlsw.com"
                className="text-osps-red hover:underline"
              >
                osps.clementlsw.com
              </a>
              , you agree to be bound by these Terms of Service. If you do not agree
              to these terms, please do not use the service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-display font-semibold mb-2">The Service</h2>
            <p className="text-sm text-osps-gray leading-relaxed">
              O$P$ is a free, open-source expense splitting application that helps
              groups of people track shared expenses and calculate who owes whom. The
              service is provided "as is" without warranty of any kind. O$P$ is not a
              financial institution, payment processor, or accounting service. It is a
              tool to help you keep track of expenses — actual payments and settlements
              are made between users outside of the app.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-display font-semibold mb-2">Accounts</h2>
            <p className="text-sm text-osps-gray leading-relaxed">
              You may create an account using Google sign-in or an email and password.
              You are responsible for maintaining the security of your account
              credentials. You must provide accurate information when creating your
              account. One person may not maintain more than one account. We reserve
              the right to suspend or terminate accounts that violate these terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-display font-semibold mb-2">Acceptable Use</h2>
            <p className="text-sm text-osps-gray leading-relaxed">
              You agree to use O$P$ only for its intended purpose of tracking shared
              expenses. You may not use the service to transmit harmful, fraudulent,
              or illegal content; attempt to gain unauthorised access to other users'
              data or the underlying systems; interfere with or disrupt the service;
              or use automated means to access the service without permission.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-display font-semibold mb-2">Your Data</h2>
            <p className="text-sm text-osps-gray leading-relaxed">
              You retain ownership of any data you submit to O$P$ (group names,
              expense details, receipt images, etc.). By using the service, you grant
              us a limited licence to store, process, and display that data solely
              for the purpose of providing the service to you and your group members.
              You can delete your data at any time through the app. For full details
              on how your data is handled, see our{' '}
              <Link to="/privacy" className="text-osps-red hover:underline">
                Privacy Policy
              </Link>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-display font-semibold mb-2">Group Membership</h2>
            <p className="text-sm text-osps-gray leading-relaxed">
              When you join a group, other group members can see your display name
              and the expenses you log within that group. Group admins (the person who
              created the group) may invite or remove members. Expense and balance
              data within a group is visible to all members of that group.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-display font-semibold mb-2">Accuracy of Calculations</h2>
            <p className="text-sm text-osps-gray leading-relaxed">
              O$P$ performs expense splitting calculations and debt simplification
              automatically. While we strive for accuracy, you should verify any
              calculations before making real payments. O$P$ is not responsible for
              any financial discrepancies arising from the use of the service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-display font-semibold mb-2">Availability</h2>
            <p className="text-sm text-osps-gray leading-relaxed">
              O$P$ is a personal project provided free of charge. We do not
              guarantee uptime, availability, or data durability. While we take
              reasonable measures to protect your data, you acknowledge that the
              service may experience interruptions or data loss. We recommend keeping
              your own records of important financial information.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-display font-semibold mb-2">Limitation of Liability</h2>
            <p className="text-sm text-osps-gray leading-relaxed">
              To the maximum extent permitted by law, O$P$ and its developer shall
              not be liable for any indirect, incidental, special, consequential, or
              punitive damages, or any loss of profits or data, arising from your use
              of the service. The service is provided without any warranties, express
              or implied, including warranties of merchantability, fitness for a
              particular purpose, and non-infringement.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-display font-semibold mb-2">Open Source</h2>
            <p className="text-sm text-osps-gray leading-relaxed">
              O$P$ is open-source software. The source code is available at{' '}
              <a
                href="https://github.com/ClementLSW/osps"
                target="_blank"
                rel="noopener noreferrer"
                className="text-osps-red hover:underline"
              >
                github.com/ClementLSW/osps
              </a>
              . The source code licence is separate from these Terms of Service,
              which govern your use of the hosted service at osps.clementlsw.com.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-display font-semibold mb-2">Changes to Terms</h2>
            <p className="text-sm text-osps-gray leading-relaxed">
              We may update these terms from time to time. Changes will be reflected
              on this page with an updated date. Continued use of the service after
              changes constitutes acceptance of the revised terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-display font-semibold mb-2">Contact</h2>
            <p className="text-sm text-osps-gray leading-relaxed">
              For questions about these terms, contact{' '}
              <a
                href="mailto:contact@clementlsw.com"
                className="text-osps-red hover:underline"
              >
                contact@clementlsw.com
              </a>.
            </p>
          </section>
        </div>
      </div>
      <Footer />
    </div>
  )
}
