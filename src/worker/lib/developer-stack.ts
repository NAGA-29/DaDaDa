import { htmlToText } from './text'

// Broad national feeds also cover appliances and consumer software. Require a named
// development product; a CVE, generic "server", or severity alone never qualifies.
// Keep this allowlist aligned with registered runtimes/services and issue #12.
const DEVELOPER_STACK =
  /(?:\b(?:PHP|Composer|Laravel|npm|Node\.js|Java|OpenJDK|Python|Rust|Cargo|rustup|Go language|Golang|Go toolchain|Go standard library|ASP\.NET|PostgreSQL|Redis|Linux kernel|GitHub|GitLab|Docker|Kubernetes|OpenSSL|nginx|Cloudflare|Supabase|Vercel|Netlify|OpenAI)\b|\.NET\b|\bApache (?:HTTP Server|Tomcat|Struts|Log4j|Maven)\b|Linuxカーネル|Go言語)/i

export function matchesDeveloperStack(...texts: (string | undefined)[]): boolean {
  return texts.some(text => DEVELOPER_STACK.test(htmlToText(text, 100000) ?? ''))
}
