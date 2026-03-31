import "./Privacy.scss";

export default function PrivacyPage() {
  return (
    <div className="privacy">
      <div className="privacy__header">
        <h1 className="privacy__title">Privacy Policy</h1>
        <p className="privacy__updated">Last updated: March 30, 2026</p>
      </div>

      <div className="privacy__body">
        <section className="privacy__section">
          <h2>1. Information We Collect</h2>
          <p>When you use NodeMap.io, we collect the following information:</p>
          <ul>
            <li>
              <strong>Account information:</strong> Your name, email address, and
              password when you create an account.
            </li>
            <li>
              <strong>Conversation data:</strong> The messages and branches you
              create within the app.
            </li>
            <li>
              <strong>API keys:</strong> Your OpenRouter API key, which is
              encrypted with AES-256-GCM before storage.
            </li>
          </ul>
        </section>

        <section className="privacy__section">
          <h2>2. How We Use Your Information</h2>
          <p>We use your information to:</p>
          <ul>
            <li>Provide and maintain the NodeMap.io service</li>
            <li>Authenticate your identity and manage your account</li>
            <li>Save and retrieve your conversations</li>
            <li>Send API requests to OpenRouter on your behalf</li>
          </ul>
        </section>

        <section className="privacy__section">
          <h2>3. Data Storage & Security</h2>
          <p>
            Your data is stored in a PostgreSQL database. API keys are encrypted
            using AES-256-GCM and are never exposed in full after saving.
            Passwords are hashed before storage. We use JWT-based authentication
            with access and refresh tokens.
          </p>
        </section>

        <section className="privacy__section">
          <h2>4. Third-Party Services</h2>
          <p>
            NodeMap.io connects to OpenRouter to process your conversations
            through AI language models. When you send a message, its content is
            transmitted to OpenRouter using your API key. Please review{" "}
            <a
              href="https://openrouter.ai/privacy"
              target="_blank"
              rel="noopener noreferrer"
            >
              OpenRouter&apos;s privacy policy
            </a>{" "}
            for details on how they handle data.
          </p>
        </section>

        <section className="privacy__section">
          <h2>5. Data Sharing</h2>
          <p>
            We do not sell, trade, or share your personal information with third
            parties, except as necessary to provide the service (e.g., sending
            messages to OpenRouter) or as required by law.
          </p>
        </section>

        <section className="privacy__section">
          <h2>6. Data Retention</h2>
          <p>
            Your conversations and account data are retained as long as your
            account is active. You can delete individual conversations at any
            time. If you wish to delete your account and all associated data,
            contact us.
          </p>
        </section>

        <section className="privacy__section">
          <h2>7. Your Rights</h2>
          <p>You have the right to:</p>
          <ul>
            <li>Access the personal data we hold about you</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Export your conversation data</li>
          </ul>
        </section>

        <section className="privacy__section">
          <h2>8. Cookies</h2>
          <p>
            NodeMap.io uses authentication tokens stored in your browser to keep
            you signed in. We do not use tracking cookies or third-party
            analytics.
          </p>
        </section>

        <section className="privacy__section">
          <h2>9. Changes to This Policy</h2>
          <p>
            We may update this privacy policy from time to time. Changes will be
            reflected by updating the date at the top of this page.
          </p>
        </section>

        <section className="privacy__section">
          <h2>10. Contact</h2>
          <p>
            If you have questions about this privacy policy, contact us at{" "}
            <a href="mailto:maratkotik97@gmail.com">maratkotik97@gmail.com</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
