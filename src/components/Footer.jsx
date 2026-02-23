import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="px-4 sm:px-6 py-8 border-t border-osps-gray-light">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="font-display font-bold text-osps-red text-sm">O$P$</span>
          <span className="text-xs text-osps-gray font-body">Owe Money, Pay Money</span>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="https://github.com/ClementLSW/osps"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-osps-gray hover:text-osps-black transition-colors font-body"
          >
            GitHub
          </a>
          <Link
            to="/privacy"
            className="text-xs text-osps-gray hover:text-osps-black transition-colors font-body"
          >
            Privacy Policy
          </Link>
          <Link
            to="/terms"
            className="text-xs text-osps-gray hover:text-osps-black transition-colors font-body"
          >
            Terms of Service
          </Link>
        </div>
      </div>
    </footer>
  )
}
