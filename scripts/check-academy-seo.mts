import assert from 'node:assert/strict'
import {renderPage,escapeHtml} from '../api/academy-page.ts'
const html=renderPage('<html lang="en"><head><title>Old</title><meta name="description" content="Old"><meta property="og:title" content="Old"></head><body><div id="root"></div></body></html>',{title:'درس <script>',description:'"Quoted" & text',locale:'fa',url:'https://lingo3.com/academy/posts/a?lang=fa',content:'<article>Readable body</article>',alternates:[{locale:'fa',url:'https://lingo3.com/academy/posts/a?lang=fa'}],schema:{'@type':'Article',headline:'</script><script>alert(1)</script>'}})
assert.equal((html.match(/<title>/g)||[]).length,1)
assert.equal((html.match(/name="description"/g)||[]).length,1)
assert(html.includes('dir="rtl"'));assert(html.includes('Readable body'));assert(html.includes('hreflang="fa"'));assert(html.includes('rel="canonical"'))
assert(!html.includes('<script>alert'));assert(html.includes('\\u003c/script>'));assert.equal(escapeHtml('<a>"&'), '&lt;a&gt;&quot;&amp;')
console.log('PASS SEO: server-readable body, single metadata, canonical/hreflang, RTL and HTML/JSON-LD injection escaping.')
