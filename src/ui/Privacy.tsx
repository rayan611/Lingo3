/**
 * The privacy policy, at /privacy.
 *
 * A page rather than a paragraph because both app stores require a reachable
 * URL, and because the honest version is longer than a paragraph: this app
 * sends the words you type to a model provider, and that is the one thing
 * someone would want to know before typing anything.
 *
 * It is a React branch like the landing page, not a second HTML file. The
 * service worker's navigateFallback sends every path to index.html, so a real
 * file at /privacy.html would be shadowed by the shell or have to be carved
 * out of the fallback. As a branch it also works offline, which a policy page
 * has no particular need to do but costs nothing.
 */
const CONTACT = 'rayan.rahpou@gmail.com'

/** Shown in the footer so it is obvious whether this is the current version. */
const LAST_UPDATED = '25 October 2026'

export function Privacy({ onBack }: { onBack?: () => void }) {
  return (
    <div className="landing legal">
      <h1>Privacy</h1>
      <p className="muted small">Last updated {LAST_UPDATED}</p>

      <section className="landing-section">
        <h2>The short version</h2>
        <p>
          Lingo3 is a personal project, not a business. It shows no adverts,
          has no analytics, no tracking and no third-party scripts, and nothing
          about you is sold or shared with anyone. What it stores is the
          vocabulary you put in and what you need to schedule its review.
        </p>
      </section>

      <section className="landing-section">
        <h2>What is stored</h2>
        <ul className="legal-list">
          <li>
            <strong>Your email address and password.</strong> The password is
            never seen by this app: sign-in is handled by Supabase, which
            stores only a hash of it.
          </li>
          <li>
            <strong>The words you add</strong> — the word itself, its meanings
            and forms in each language you study, your topics and notes, and
            the example sentences generated for it.
          </li>
          <li>
            <strong>Your review history</strong> — which card you saw, when,
            and how you rated it. This is what the scheduling runs on; without
            it the app cannot tell you what to review.
          </li>
          <li>
            <strong>Your settings</strong>, and a display name if you give one.
          </li>
        </ul>
        <p>
          There is no location data, no contacts, no address book, no
          advertising identifier, and no profile of you beyond the above.
        </p>
      </section>

      <section className="landing-section">
        <h2>Where it is stored</h2>
        <p>
          On your own device first — the app keeps a full copy locally so it
          works with no connection — and in a Supabase database hosted in the
          European Union, so that the same vocabulary is on your phone and your
          computer. Access is enforced per row by the database itself: your rows
          are readable only by your account.
        </p>
      </section>

      <section className="landing-section">
        <h2>The one thing worth knowing</h2>
        <p>
          When you add a word, that word is sent to an AI model provider —
          currently Google (Gemini), with Groq and then Mistral as fallbacks
          when it is busy — which
          returns its translations, grammatical forms and an example sentence.
          The same happens when you generate a reading text, where the words
          sent are the vocabulary the text is to be built from. Quick translate
          sends the text you type there, and it is not stored on our server.
        </p>
        <p>
          Mistral is used on its free plan, and on that plan Mistral may use
          what it receives to train its models. It is only asked when Gemini
          and Groq are both unavailable, but it can happen, so do not type
          anything private into Quick translate.
        </p>
        <p>
          Your email address and your review history are never sent with it. The
          provider receives the word and nothing that identifies you. Review scheduling and the cards themselves work entirely on your device.
          Optional speech playback can use the network, as explained below.
        </p>
      </section>

      <section className="landing-section">
        <h2>Speech playback</h2>
        <p>
          The app tries your device’s available voices first. Some devices or
          voices may themselves use an online speech service. If no suitable
          voice is available, the app sends the text you ask it to speak and
          its language to Google through our speech endpoint. It does not send
          your account email or review history with that request, and it does
          not record your microphone. Speech may be unavailable offline;
          reviewing your cards still works.
        </p>
      </section>

      <section className="landing-section">
        <h2>Deleting everything</h2>
        <p>
          Settings → Account → Delete account removes your words, your review
          history, your settings and your sign-in, from the server and from the
          device you are on, and it cannot be undone. There is an export button
          in Settings if you want a copy of your vocabulary first.
        </p>
        <p>
          Other devices you have used keep their local copy until you open the
          app on them; signing out there and clearing the site data removes it.
        </p>
      </section>

      <section className="landing-section">
        <h2>Children</h2>
        <p>
          The app is not directed at children and asks for nothing beyond an
          email address.
        </p>
      </section>

      <section className="landing-section">
        <h2>Contact</h2>
        <p>
          Questions, or a request to see or remove your data:{' '}
          <a href={`mailto:${CONTACT}?subject=Lingo3 privacy`}>{CONTACT}</a>
        </p>
      </section>

      {onBack && (
        <footer className="landing-foot">
          <button className="primary big" onClick={onBack}>
            Back
          </button>
        </footer>
      )}
    </div>
  )
}
