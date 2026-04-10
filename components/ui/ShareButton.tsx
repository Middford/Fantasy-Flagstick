'use client'

interface ShareButtonProps {
  url: string
  title: string
}

export default function ShareButton({ url, title }: ShareButtonProps) {
  async function handleShare() {
    const fullUrl = `${window.location.origin}${url}`
    if (navigator.share) {
      try {
        await navigator.share({ title, url: fullUrl })
      } catch {
        // User cancelled or share failed — fall through to clipboard
      }
    } else {
      await navigator.clipboard.writeText(fullUrl)
      // Brief visual feedback handled by browser / OS
    }
  }

  return (
    <button
      onClick={handleShare}
      className="text-[#8ab89a] hover:text-white transition-colors p-1"
      aria-label="Share your picks"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
      </svg>
    </button>
  )
}
