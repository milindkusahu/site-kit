export function shareLinks(url, title) {
    const u = encodeURIComponent(url);
    const t = encodeURIComponent(title);
    return [
        { network: "x", label: "Share on X", href: `https://x.com/intent/post?url=${u}&text=${t}` },
        { network: "facebook", label: "Share on Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
        { network: "linkedin", label: "Share on LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
        { network: "whatsapp", label: "Share on WhatsApp", href: `https://wa.me/?text=${t}%20${u}` },
        { network: "reddit", label: "Share on Reddit", href: `https://www.reddit.com/submit?url=${u}&title=${t}` },
        { network: "email", label: "Share by email", href: `mailto:?subject=${t}&body=${u}` },
    ];
}
